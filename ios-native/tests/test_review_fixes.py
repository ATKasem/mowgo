from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1] / "MowGo"


def source(relative_path: str) -> str:
    return (ROOT / relative_path).read_text()


class IOSReviewFixTests(unittest.TestCase):
    def test_ownership_is_resolved_in_create_methods(self) -> None:
        data_store = source("Services/DataStore.swift")

        self.assertIn("struct ClientInsert: Encodable", data_store)
        self.assertIn("struct JobInsert: Encodable", data_store)
        self.assertGreaterEqual(
            data_store.count("guard let userId = try await sb.getCurrentUserId()"),
            2,
        )
        self.assertIn('sb.insert("clients", ClientInsert(', data_store)
        self.assertIn('sb.insert("jobs", JobInsert(', data_store)
        self.assertNotRegex(
            data_store,
            re.compile(r'sb\.insert\("clients",\s*client\)'),
        )
        self.assertNotRegex(
            data_store,
            re.compile(r'sb\.insert\("jobs",\s*job\)'),
        )

    def test_updates_use_operation_specific_patch_payloads(self) -> None:
        data_store = source("Services/DataStore.swift")

        self.assertIn("struct ClientUpdate: Encodable", data_store)
        self.assertIn("struct JobStatusPatch: Encodable", data_store)
        # Codable: rain-delay undo also decodes it.
        self.assertRegex(data_store, re.compile(r"struct JobSchedulePatch: (Encodable|Codable)"))
        self.assertIn("struct InvoicePaidPatch: Encodable", data_store)
        self.assertIn('sb.update("clients", id: client.id, ClientUpdate(', data_store)
        self.assertIn('sb.update("jobs", id: job.id, JobStatusPatch(', data_store)
        self.assertIn('sb.update("jobs", id: job.id, JobSchedulePatch(', data_store)
        self.assertIn('sb.update("invoices", id: invoice.id, InvoicePaidPatch(', data_store)
        client_update = data_store.split("private struct ClientUpdate:", 1)[1].split(
            "private struct ", 1
        )[0]
        self.assertNotIn("userId", client_update)
        self.assertNotIn("createdAt", client_update)
        self.assertNotRegex(
            data_store,
            re.compile(r'sb\.update\("clients",\s*id:\s*client\.id,\s*client\)'),
        )
        self.assertNotRegex(
            data_store,
            re.compile(r'sb\.update\("jobs",\s*id:\s*job\.id,\s*job\)'),
        )
        self.assertNotRegex(
            data_store,
            re.compile(r'sb\.update\("invoices",\s*id:\s*invoice\.id,\s*updated\)'),
        )

    def test_data_loading_waits_for_authenticated_app_state(self) -> None:
        data_store = source("Services/DataStore.swift")
        app = source("MowGoApp.swift")

        self.assertNotIn("init() { Task { await loadAll() } }", data_store)
        self.assertIn("guard await sb.ensureAuthenticated() else", data_store)
        self.assertIn("func clear()", data_store)
        self.assertIn("loadGeneration += 1", data_store)
        self.assertIn("generation == loadGeneration", data_store)
        self.assertIn("guard !Task.isCancelled", data_store)
        self.assertIn(".task(id: authLoadState)", app)
        self.assertIn("await store.loadAll()", app)
        self.assertIn("store.clear()", app)

    def test_expired_restored_session_is_refreshed(self) -> None:
        service = source("Services/SupabaseService.swift")

        self.assertIn("func restoreSession() async -> Bool", service)
        restore = service.split("func restoreSession() async -> Bool", 1)[1]
        restore = restore.split("private func clearSession()", 1)[0]
        self.assertIn("if isAuthenticated { return true }", restore)
        self.assertIn("try await refreshAccessToken()", restore)
        self.assertIn("await signOut()", restore)
        self.assertIn("return false", restore)
        self.assertIn("func ensureAuthenticated() async -> Bool", service)

    def test_auth_requests_cannot_recursively_refresh(self) -> None:
        service = source("Services/SupabaseService.swift")

        self.assertIn("allowsTokenRefresh: Bool = true", service)
        self.assertGreaterEqual(service.count("allowsTokenRefresh: false"), 3)
        self.assertIn(
            "http.statusCode == 401, allowsTokenRefresh, refreshToken != nil",
            service,
        )
        self.assertNotIn("try? await refreshAccessToken()", service)
        self.assertNotIn("isRetry: Bool", service)
        # Only permanent (401/403/auth) refresh failures sign the user out;
        # transient ones (offline) keep the session. Both paths rethrow.
        self.assertGreaterEqual(
            len(re.findall(
                r"if isPermanentRefreshFailure\(error\) \{\s+await signOut\(\)\s+\}\s+throw error",
                service,
            )),
            2,
        )

    def test_payment_requests_have_a_single_flight_guard(self) -> None:
        payments = source("Services/PaymentsService.swift")
        payment = source("Views/Payments/PaymentView.swift")

        post = payments.split("private func post(", 1)[1].split("private func hostedURL", 1)[0]
        self.assertIn("guard !isLoading else", post)
        self.assertIn("isLoading = true", post)
        self.assertIn("defer { isLoading = false }", post)
        self.assertIn("case operationInProgress", payments)
        self.assertIn("@ObservedObject private var payments", payment)

    def test_invoice_payment_is_settled_server_side_only(self) -> None:
        # Server logic (amount/ids/voided checks) is covered by
        # functions/api/_shared/payments/payments.test.js.
        payments = source("Services/PaymentsService.swift")
        payment = source("Views/Payments/PaymentView.swift")

        self.assertNotIn("import Stripe", payment)
        self.assertNotIn("import Stripe", payments)
        self.assertIn('url.scheme == "https"', payments)
        self.assertIn('"payments_unavailable"', payments)
        self.assertIn("validAccessToken()", payments)
        # The app never marks an invoice paid; the provider webhook does.
        self.assertNotIn("markInvoicePaid", payment)
        self.assertNotIn("InvoicePaidPatch", payment)
        self.assertIn("onDismiss: { Task { await store.loadAll() } }", payment)

    def test_currency_models_do_not_use_binary_floating_point(self) -> None:
        models = source("Models/Models.swift")
        data_store = source("Services/DataStore.swift")
        components = source("Views/Components/ReusableViews.swift")
        client_form = source("Views/Clients/NewClientFormView.swift")

        self.assertNotRegex(models, re.compile(r"(amount|rate): Double"))
        self.assertNotRegex(data_store, re.compile(r"rate: Double"))
        self.assertNotRegex(components, re.compile(r"amount: Double"))
        self.assertIn("var amount: Decimal", models)
        self.assertIn("var rate: Decimal", models)
        self.assertIn("Decimal(string: rate)", client_form)

    def test_forms_display_errors_and_trim_required_fields(self) -> None:
        client_form = source("Views/Clients/NewClientFormView.swift")
        job_form = source("Views/Today/NewJobFormView.swift")

        self.assertIn('.alert("Couldn’t Save Client"', client_form)
        self.assertRegex(job_form, re.compile(r'\.alert\("Couldn[’\']t Save Job"'))
        self.assertIn("trimmingCharacters(in: .whitespacesAndNewlines)", client_form)
        self.assertIn("trimmingCharacters(in: .whitespacesAndNewlines)", job_form)
        self.assertIn("guard let clientId else", job_form)
        self.assertNotIn('Text("None").tag(nil as UUID?)', job_form)

    def test_client_form_supports_editing_and_preserves_identity_fields(self) -> None:
        client_form = source("Views/Clients/NewClientFormView.swift")
        clients_view = source("Views/Clients/ClientsView.swift")
        data_store = source("Services/DataStore.swift")

        self.assertIn("let client: Client?", client_form)
        self.assertIn("init(client: Client? = nil)", client_form)
        self.assertIn('_name = State(initialValue: client?.name ?? "")', client_form)
        self.assertIn('client == nil ? "New Client" : "Edit Client"', client_form)
        self.assertIn("try await store.updateClient(updated)", client_form)
        self.assertIn("try await store.createClient(newClient)", client_form)

        self.assertIn("@State private var editingClient: Client?", clients_view)
        self.assertIn("onEdit:", clients_view)
        self.assertIn('Button("Edit")', clients_view)
        self.assertIn("NewClientFormView(client: client)", clients_view)

        local_update = data_store.split("func updateClient(_ client: Client)", 1)[1].split(
            "func deleteClient", 1
        )[0]
        self.assertIn("updated.userId = existing.userId", local_update)
        self.assertIn("updated.createdAt = existing.createdAt", local_update)

    def test_subscription_view_uses_authenticated_tier(self) -> None:
        settings = source("Views/Settings/SettingsView.swift")

        self.assertIn(
            "SubscriptionView(currentTier: auth.user?.tier ?? \"free\")",
            settings,
        )
        self.assertIn("let currentTier: String", settings)
        # Free, Solo, Crew, Premium.
        self.assertEqual(settings.count("isCurrent: normalizedCurrentTier =="), 4)
        self.assertNotIn("isCurrent: true", settings)
        self.assertNotIn("isCurrent: false", settings)

    def test_currency_displays_use_format_style_without_integer_truncation(self) -> None:
        swift_sources = "\n".join(
            path.read_text() for path in ROOT.rglob("*.swift")
        )

        self.assertNotRegex(swift_sources, re.compile(r'"\$\\\(Int\('))
        self.assertNotIn('specifier: "%.2f"', swift_sources)
        self.assertGreaterEqual(
            swift_sources.count('.formatted(.currency(code: "USD"))'),
            7,
        )
        invoices = source("Views/Invoices/InvoicesView.swift")
        # Summed as Decimal — exact, no Double or integer truncation.
        self.assertIn("private var totalUnpaid: Decimal", invoices)
        self.assertIn("$0 + $1.amount", invoices)

    def test_job_card_labels_pet_and_key_details(self) -> None:
        job_card = source("Views/Components/JobCardView.swift")

        self.assertIn('Text("Pets: \\(notes)")', job_card)
        self.assertIn('Text("Key: \\(key)")', job_card)

    def test_job_photo_picker_offers_camera_and_library_sources(self) -> None:
        picker = source("Views/Components/JobPhotoPicker.swift")

        self.assertIn('@State private var showSourcePicker = false', picker)
        self.assertIn(".sheet(isPresented: $showSourcePicker)", picker)
        self.assertIn('Label("Take Photo"', picker)
        self.assertIn(
            ".disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))",
            picker,
        )
        self.assertIn('Label("Choose from Library"', picker)
        self.assertRegex(
            picker,
            re.compile(r"CameraView\(jobId:\s*jobId\)\s*\{\s*url\s+in"),
        )
        self.assertIn("onPhotoUploaded?(url)", picker)
        self.assertIn("dismiss()", picker)

    def test_camera_view_uploads_captured_photo_for_the_job(self) -> None:
        camera = source("Views/Components/CameraView.swift")

        self.assertIn("let jobId: UUID", camera)
        self.assertIn("var onPhotoUploaded: ((String) -> Void)?", camera)
        self.assertIn("UIImagePickerController", camera)
        self.assertIn("picker.sourceType = .camera", camera)
        self.assertRegex(
            camera,
            re.compile(
                r"SupabaseService\.shared\.uploadJobPhoto\(\s*jobId:\s*jobId"
            ),
        )
        self.assertIn("onPhotoUploaded?(url)", camera)

    def test_camera_usage_description_is_generated(self) -> None:
        config = source("Config.xcconfig")
        project = (ROOT.parent / "project.yml").read_text()

        self.assertIn("INFOPLIST_KEY_NSCameraUsageDescription", config)
        self.assertIn("INFOPLIST_KEY_NSCameraUsageDescription", project)

    def test_recurring_start_date_is_parsed_in_the_local_calendar(self) -> None:
        models = source("Models/Models.swift")
        matching = models.split("func matchesDate", 1)[1].split(
            "private static func nthWeekday", 1
        )[0]

        self.assertIn("private static let localDateFmt: DateFormatter", models)
        self.assertIn("Self.localDateFmt.date(from: startDate)", matching)
        self.assertNotIn("utcStart", matching)
        self.assertNotIn("startComponents", matching)

    def test_successful_load_rechecks_generation_after_offline_sync(self) -> None:
        data_store = source("Services/DataStore.swift")
        successful_load = data_store.split("await syncPendingMutations()", 1)[1]
        successful_load = successful_load.split("await generateJobsFromRecurring()", 1)[0]

        self.assertIn(
            "guard !Task.isCancelled, generation == loadGeneration else { return }",
            successful_load,
        )

    def test_demo_member_removal_and_replayed_status_notifications(self) -> None:
        data_store = source("Services/DataStore.swift")
        removal = data_store.split("func removeTeamMember", 1)[1].split(
            "// MARK: - Helpers", 1
        )[0]
        self.assertLess(removal.index("guard await sb.isConfigured else"), removal.index(
            'guard auth?.user?.role == "owner" else'
        ))

        replay = data_store.split('case "job:status":', 1)[1].split(
            'case "job:delete":', 1
        )[0]
        # `updated` = the local job with the replayed status applied.
        self.assertIn("await fireWebhookJobCompleted(updated)", replay)
        self.assertIn("await firePushJobCompleted(updated)", replay)
        self.assertIn("await fireWebhookJobSkipped(updated)", replay)

    def test_sign_out_waits_for_device_token_clear(self) -> None:
        push = source("Services/PushNotificationService.swift")
        auth = source("Services/AuthService.swift")

        self.assertIn(
            "func clearDeviceToken() -> Task<Void, Never>?",
            push,
        )
        self.assertIn("return task", push)
        # Waits for the clear, but capped (5s) so sign-out never hangs.
        self.assertIn("PushNotificationService.shared.clearDeviceToken()", auth)
        self.assertIn("await clearTask.value", auth)
        self.assertIn("Task.sleep(for: .seconds(5))", auth)


if __name__ == "__main__":
    unittest.main()
