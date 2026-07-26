from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1] / "MowFlow"


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

        self.assertIn("struct JobStatusPatch: Encodable", data_store)
        self.assertIn("struct JobSchedulePatch: Encodable", data_store)
        self.assertIn("struct InvoicePaidPatch: Encodable", data_store)
        self.assertIn('sb.update("jobs", id: job.id, JobStatusPatch(', data_store)
        self.assertIn('sb.update("jobs", id: job.id, JobSchedulePatch(', data_store)
        self.assertIn('sb.update("invoices", id: invoice.id, InvoicePaidPatch(', data_store)
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
        app = source("MowFlowApp.swift")

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
        self.assertGreaterEqual(
            len(re.findall(r"await signOut\(\)\s+throw error", service)),
            2,
        )

    def test_payment_intent_creation_has_a_single_flight_guard(self) -> None:
        stripe = source("Services/StripeService.swift")
        payment = source("Views/Payments/PaymentView.swift")

        create_intent = stripe.split("func createPaymentIntent", 1)[1]
        create_intent = create_intent.split("// MARK: - Confirm payment", 1)[0]
        self.assertIn("guard !isLoading else", create_intent)
        self.assertIn("isLoading = true", create_intent)
        self.assertIn("defer { isLoading = false }", create_intent)
        self.assertIn("case operationInProgress", stripe)
        self.assertIn("@ObservedObject private var stripe", payment)

    def test_forms_display_errors_and_trim_required_fields(self) -> None:
        client_form = source("Views/Clients/NewClientFormView.swift")
        job_form = source("Views/Today/NewJobFormView.swift")

        self.assertIn('.alert("Couldn’t Save Client"', client_form)
        self.assertIn('.alert("Couldn’t Save Job"', job_form)
        self.assertIn("trimmingCharacters(in: .whitespacesAndNewlines)", client_form)
        self.assertIn("trimmingCharacters(in: .whitespacesAndNewlines)", job_form)
        self.assertIn("guard let clientId else", job_form)
        self.assertNotIn('Text("None").tag(nil as UUID?)', job_form)

    def test_subscription_view_uses_authenticated_tier(self) -> None:
        settings = source("Views/Settings/SettingsView.swift")

        self.assertIn(
            "SubscriptionView(currentTier: auth.user?.tier ?? \"free\")",
            settings,
        )
        self.assertIn("let currentTier: String", settings)
        self.assertEqual(settings.count("isCurrent: normalizedCurrentTier =="), 3)
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
        self.assertIn("private var totalUnpaidCents: Int", invoices)
        self.assertIn("$0 + $1.amountCents", invoices)


if __name__ == "__main__":
    unittest.main()
