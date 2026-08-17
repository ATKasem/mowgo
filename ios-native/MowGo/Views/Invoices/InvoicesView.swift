import SwiftUI
import UIKit

struct InvoicesView: View {
    enum Segment: String, CaseIterable {
        case invoices = "Invoices"
        case estimates = "Estimates"
        var label: LocalizedStringKey {
            switch self {
            case .invoices: return "Invoices"
            case .estimates: return "Estimates"
            }
        }
    }
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @State private var segment = Segment.invoices
    @State private var selectedInvoice: Invoice?
    @State private var selectedInvoiceDetail: Invoice?
    @State private var selectedEstimate: Estimate?
    @State private var showPayment = false
    @State private var showNewInvoice = false
    @State private var showNewEstimate = false
    @State private var showCollectCopied = false
    @State private var collectCopiedInvoice: Invoice?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var unpaid: [Invoice] { store.invoices.filter { $0.status == .unpaid || $0.status == .overdue } }
    private var paid: [Invoice] { store.invoices.filter { $0.status == .paid } }
    private var totalUnpaid: Decimal { unpaid.reduce(0) { $0 + $1.amount } }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                theme.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    Picker("View", selection: $segment) {
                        ForEach(Segment.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented).tint(MowGoTheme.deepGreen).padding(.horizontal, 16).padding(.vertical, 10)
                    if store.isLoading { Spacer(); ProgressView().tint(MowGoTheme.deepGreen); Spacer() }
                    else if segment == .invoices { invoiceList }
                    else { estimateList }
                }
                if segment == .invoices {
                    Button { showNewInvoice = true } label: {
                        Image(systemName: "plus").font(.title2.weight(.semibold)).foregroundColor(MowGoTheme.onAccent)
                            .frame(width: 56, height: 56).background(MowGoTheme.deepGreen).clipShape(Circle()).shadow(radius: 4)
                    }.padding(20).accessibilityLabel("New Invoice")
                }
                if segment == .estimates {
                    Button { showNewEstimate = true } label: {
                        Image(systemName: "plus").font(.title2.weight(.semibold)).foregroundColor(MowGoTheme.onAccent)
                            .frame(width: 56, height: 56).background(MowGoTheme.deepGreen).clipShape(Circle()).shadow(radius: 4)
                    }.padding(20).accessibilityLabel("New Estimate")
                }
            }
            .navigationTitle("Invoices").navigationBarTitleDisplayMode(.inline)
            .task { await store.loadEstimates() }
            .sheet(isPresented: $showPayment) { paymentSheet }
            .sheet(isPresented: $showNewInvoice) { NewInvoiceView() }
            .sheet(isPresented: $showNewEstimate) { NewEstimateView() }
            .sheet(item: $selectedInvoiceDetail) { InvoiceDetailView(invoice: $0) }
            .sheet(item: $selectedEstimate) { EstimateDetailView(estimate: $0) }
        }
    }

    private var invoiceList: some View {
        ScrollView { VStack(spacing: 16) {
            if !unpaid.isEmpty { totalBar; sectionHeader("Unpaid") }
            ForEach(unpaid) { inv in
                InvoiceRow(
                    invoice: inv,
                    showPay: true,
                    onOpen: { selectedInvoiceDetail = inv },
                    onPay: { copyPaymentText(inv) }
                )
            }
            if !paid.isEmpty { sectionHeader("Paid") }
            ForEach(paid) { inv in
                InvoiceRow(invoice: inv, showPay: false, onOpen: { selectedInvoiceDetail = inv }) {}
            }
            if unpaid.isEmpty && paid.isEmpty { invoiceEmpty }
        }.padding(16) }
    }

    private var estimateList: some View {
        ScrollView { VStack(spacing: 10) {
            ForEach(store.estimates) { estimate in
                Button { selectedEstimate = estimate } label: { EstimateRow(estimate: estimate) }.buttonStyle(.plain)
            }
            if store.estimates.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass").font(.system(size: 40)).foregroundColor(theme.surfaceElevated)
                    Text("No estimates yet").font(.headline).foregroundColor(theme.textPrimary)
                    Text("Pick a client and send one in 10 seconds").font(.subheadline).foregroundColor(theme.textMuted)
                }.padding(.top, 60)
            }
        }.padding(16).padding(.bottom, 72) }
    }

    private var totalBar: some View {
        HStack { VStack { Text("Unpaid").font(.caption); Text(totalUnpaid.formatted(.currency(code: "USD"))).font(.title2.bold()).foregroundColor(MowGoTheme.danger) }.frame(maxWidth: .infinity)
            Divider().frame(height: 40)
            VStack { Text("Paid").font(.caption); Text("\(paid.count)").font(.title2.bold()).foregroundColor(MowGoTheme.success) }.frame(maxWidth: .infinity)
        }.foregroundColor(theme.textMuted).padding().background(theme.surface).cornerRadius(16)
    }
    private func sectionHeader(_ title: String) -> some View { Text(title).font(.headline).foregroundColor(theme.textPrimary).frame(maxWidth: .infinity, alignment: .leading) }
    private var invoiceEmpty: some View { VStack(spacing: 12) { Text("No invoices yet").font(.headline); Text("Complete a job to create one").font(.subheadline).foregroundColor(theme.textMuted) }.foregroundColor(theme.textPrimary).padding(.top, 60) }
    @ViewBuilder private var paymentSheet: some View { if let inv = selectedInvoice { NavigationStack { PaymentView(invoice: inv).navigationTitle("Payment").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { showPayment = false } } } } } }
}

struct InvoiceRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let invoice: Invoice; var showPay: Bool; var onOpen: () -> Void; var onPay: () -> Void
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    var body: some View {
        HStack(spacing: 12) {
            Button(action: onOpen) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading) {
                        Text(invoice.clientName ?? NSLocalizedString("Invoice", comment: "Invoice row fallback when no client name"))
                            .font(.subheadline.weight(.medium))
                        if let date = invoice.createdAt {
                            Text(String(date.prefix(10))).font(.caption).foregroundColor(theme.textMuted)
                        }
                        Text("Tap for details")
                            .font(.caption2)
                            .foregroundColor(theme.textInverse)
                    }
                    Spacer()
                    status
                    Text(invoice.amount.formatted(.currency(code: "USD"))).font(.subheadline.weight(.semibold))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if showPay {
                Button("Collect") {
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    onPay()
                }
                .buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen).controlSize(.small)
            }
            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundColor(theme.textInverse)
        }
        .foregroundColor(theme.textPrimary).padding(12).background(theme.surface).cornerRadius(12)
    }
    private var status: some View { Text(showPay ? "Due" : "Paid").font(.caption2.weight(.medium)).foregroundColor(showPay ? MowGoTheme.warning : MowGoTheme.success).padding(.horizontal, 8).padding(.vertical, 3).background((showPay ? MowGoTheme.warning : MowGoTheme.success).opacity(0.12)).clipShape(Capsule()) }
}

private struct InvoiceDetailView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var showPayment = false
    @State private var showVoidConfirm = false
    @State private var voidError: String?
    @State private var voiding = false
    @State private var markPaidError: String?
    @State private var markingPaid = false
    @State private var showDetailCollectCopied = false
    let invoice: Invoice
    @Environment(\.colorScheme) private var colorScheme
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var currentInvoice: Invoice {
        store.invoices.first(where: { $0.id == invoice.id }) ?? invoice
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack { Text("Client").foregroundColor(theme.textMuted); Spacer(); Text(currentInvoice.clientName ?? NSLocalizedString("Unknown", comment: "Invoice detail fallback when no client name")) }
                    HStack { Text("Amount").foregroundColor(theme.textMuted); Spacer(); Text(currentInvoice.amount.formatted(.currency(code: "USD"))) }
                    if let date = currentInvoice.createdAt {
                        HStack { Text("Created").foregroundColor(theme.textMuted); Spacer(); Text(String(date.prefix(10))) }
                    }
                }
                Section {
                    if currentInvoice.status != .voided {
                        Button("Copy payment text") { copy(invoiceText) }
                    }
                    if canNudge {
                        Button("Nudge") { copy(nudgeText) }.tint(.orange)
                    }
                    if currentInvoice.status == .unpaid || currentInvoice.status == .overdue {
                        Button("Collect") {
                            UIPasteboard.general.string = invoiceText
                            showDetailCollectCopied = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { showDetailCollectCopied = false }
                        }
                        Button("Mark Paid") {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            markPaid()
                        }
                        .disabled(markingPaid)
                        if let markPaidError {
                            Text(markPaidError).foregroundColor(MowGoTheme.danger)
                        }
                    }
                }
                if currentInvoice.status == .unpaid || currentInvoice.status == .overdue {
                    Section {
                        Button("Void invoice", role: .destructive) { showVoidConfirm = true }
                            .disabled(voiding)
                        if let voidError {
                            Text(voidError).foregroundColor(MowGoTheme.danger)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.background)
            .navigationTitle("Invoice").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .sheet(isPresented: $showPayment) {
                NavigationStack {
                    PaymentView(invoice: currentInvoice).navigationTitle("Payment")
                        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { showPayment = false } } }
                }
            }
            .confirmationDialog("Void this invoice?", isPresented: $showVoidConfirm, titleVisibility: .visible) {
                Button("Void Invoice", role: .destructive) { voidInvoice() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This can't be undone. The invoice will no longer be collectible.")
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var canNudge: Bool {
        guard currentInvoice.status != .paid,
              currentInvoice.status != .voided,
              let value = currentInvoice.createdAt,
              let date = Self.parseISODate(value) else { return false }
        return date < Calendar.current.date(byAdding: .day, value: -3, to: Date())!
    }

    /// Tolerant ISO-8601 parser: Supabase timestamps carry fractional seconds,
    /// which the default ISO8601DateFormatter rejects.
    private static func parseISODate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

    private func copy(_ text: String) {
        UIPasteboard.general.string = text
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    /// Formats payment text for an invoice and copies it to clipboard.
    private func copyPaymentText(_ invoice: Invoice) {
        let profile = auth.user
        var parts: [String] = []
        let datePart: String
        if let createdAt = invoice.createdAt, let date = Self.parseISODate(createdAt) {
            datePart = " on \(date.formatted(.dateTime.month(.abbreviated).day()))"
        } else {
            datePart = ""
        }
        if let venmo = profile?.venmoHandle?.trimmingCharacters(in: .whitespacesAndNewlines), !venmo.isEmpty {
            parts.append("Venmo: @\(venmo.replacingOccurrences(of: "^@", with: "", options: .regularExpression))")
        }
        if let cashapp = profile?.cashappHandle?.trimmingCharacters(in: .whitespacesAndNewlines), !cashapp.isEmpty {
            parts.append("Cash App: $\(cashapp.replacingOccurrences(of: "^\\$", with: "", options: .regularExpression))")
        }
        let payLine = parts.isEmpty
            ? "Please send payment at your earliest convenience"
            : "Pay via \(parts.joined(separator: " · "))"
        let text = "Hi \(invoice.clientName ?? "there") — your lawn was serviced\(datePart). \(invoice.amount.formatted(.currency(code: "USD"))) due. \(payLine). Thanks!"
        copy(text)
        collectCopiedInvoice = invoice
        showCollectCopied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { showCollectCopied = false }
    }

    private func markPaid() {
        guard !markingPaid else { return }
        markingPaid = true
        markPaidError = nil
        Task {
            do {
                try await store.markInvoicePaid(currentInvoice)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run {
                    markPaidError = error.localizedDescription
                    markingPaid = false
                }
            }
        }
    }

    private func voidInvoice() {
        voiding = true
        voidError = nil
        Task {
            do {
                try await store.voidInvoice(currentInvoice)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { voidError = error.localizedDescription; voiding = false }
            }
        }
    }

    /// Payment methods the operator configured, Zelle first (mirrors web —
    /// clients default to the first option listed).
    private var payMethods: [String] {
        guard let profile = store.auth?.user else { return [] }
        var parts: [String] = []
        if let zelle = profile.zelleHandle?.trimmingCharacters(in: .whitespacesAndNewlines), !zelle.isEmpty {
            parts.append("Zelle: \(zelle)")
        }
        if let venmo = profile.venmoHandle?.trimmingCharacters(in: .whitespacesAndNewlines), !venmo.isEmpty {
            parts.append("Venmo: @\(venmo.replacingOccurrences(of: "^@", with: "", options: .regularExpression))")
        }
        if let cashapp = profile.cashappHandle?.trimmingCharacters(in: .whitespacesAndNewlines), !cashapp.isEmpty {
            parts.append("Cash App: $\(cashapp.replacingOccurrences(of: "^\\$", with: "", options: .regularExpression))")
        }
        return parts
    }

    private var payLine: String {
        let methods = payMethods
        return methods.isEmpty
            ? "Please send payment at your earliest convenience"
            : "Pay via \(methods.joined(separator: " · "))"
    }

    private var shortDate: String {
        guard let value = currentInvoice.createdAt, let date = Self.parseISODate(value) else { return "" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    private var invoiceText: String {
        let datePart = shortDate.isEmpty ? "" : " on \(shortDate)"
        return "Hi \(currentInvoice.clientName ?? "there") — your lawn was serviced\(datePart). \(currentInvoice.amount.formatted(.currency(code: "USD"))) due. \(payLine). Thanks!"
    }

    private var nudgeText: String {
        let datePart = shortDate.isEmpty ? "" : " from \(shortDate)"
        return "Hi \(currentInvoice.clientName ?? "there") — friendly reminder: \(currentInvoice.amount.formatted(.currency(code: "USD")))\(datePart) is still due. \(payLine). Thanks!"
    }
}

struct EstimateRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let estimate: Estimate
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var color: Color { switch estimate.status { case .draft: theme.textMuted; case .sent: MowGoTheme.info; case .approved: MowGoTheme.success; case .declined: MowGoTheme.danger } }
    var body: some View { HStack(spacing: 12) { VStack(alignment: .leading, spacing: 3) { Text(estimate.clientName ?? "Estimate").font(.subheadline.weight(.medium)); if let date = estimate.createdAt { Text(String(date.prefix(10))).font(.caption).foregroundColor(theme.textMuted) }; if let note = estimate.note, !note.isEmpty { Text(note).font(.caption2).foregroundColor(theme.textMuted).lineLimit(1) }; if estimate.jobId != nil { Text("Converted ✓").font(.caption2.weight(.medium)).foregroundColor(MowGoTheme.success) } }; Spacer(); Text(estimate.status.label).font(.caption2.weight(.medium)).foregroundColor(color).padding(.horizontal, 8).padding(.vertical, 3).background(color.opacity(0.12)).clipShape(Capsule()); Text(estimate.amount.formatted(.currency(code: "USD"))).font(.subheadline.weight(.semibold)) }.foregroundColor(theme.textPrimary).padding(12).background(theme.surface).cornerRadius(12) }
}

private struct NewEstimateView: View {
    @EnvironmentObject var store: DataStore; @Environment(\.dismiss) private var dismiss; @Environment(\.colorScheme) private var colorScheme
    @State private var client: Client?; @State private var amount = ""; @State private var note = ""; @State private var showClients = false; @State private var saving = false
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    var body: some View { NavigationStack { Form { Button(client?.name ?? "Select Client") { showClients = true }; TextField("Amount", text: $amount).keyboardType(.decimalPad); TextField("Note (optional)", text: $note); HStack { Button("Save Draft") { save(send: false) }.buttonStyle(.bordered).frame(maxWidth: .infinity); Button("Send") { save(send: true) }.buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen).frame(maxWidth: .infinity) }.disabled(client == nil || Decimal(string: amount) == nil || saving) }.scrollContentBackground(.hidden).background(theme.background).navigationTitle("New Estimate").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }.sheet(isPresented: $showClients) { NavigationStack { List(store.clients) { item in Button(item.name) { client = item; amount = NSDecimalNumber(decimal: item.rate).stringValue; showClients = false } }.navigationTitle("Select Client").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showClients = false } } } }.presentationDetents([.medium, .large]) } }.presentationDetents([.medium, .large]) }
    private func save(send: Bool) { guard let client, let value = Decimal(string: amount) else { return }; saving = true; let estimate = Estimate(id: UUID(), clientId: client.id, amount: value, status: send ? .sent : .draft, note: note.isEmpty ? nil : note, createdAt: ISO8601DateFormatter().string(from: Date()), clients: Estimate.ClientRef(name: client.name)); let task: Task<Void, Never> = Task { do { try await store.createEstimate(estimate, send: send); if send { UIPasteboard.general.string = estimateText(estimate) }; dismiss() } catch { saving = false } }; _ = task }
}

private struct NewInvoiceView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var client: Client?
    @State private var amount = ""
    @State private var showClients = false
    @State private var saving = false
    @State private var errorMessage: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button(client?.name ?? "Select Client") { showClients = true }
                    TextField("Amount", text: $amount).keyboardType(.decimalPad)
                    if let errorMessage {
                        Text(errorMessage).foregroundColor(MowGoTheme.danger)
                    }
                    Button("Create Invoice") { create() }
                        .buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen).frame(maxWidth: .infinity)
                        .disabled(client == nil || (Decimal(string: amount) ?? 0) <= 0 || saving)
                }
            }
            .scrollContentBackground(.hidden).background(theme.background)
            .navigationTitle("New Invoice").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sheet(isPresented: $showClients) {
                NavigationStack {
                    List(store.clients) { item in
                        Button(item.name) {
                            client = item
                            amount = NSDecimalNumber(decimal: item.rate).stringValue
                            showClients = false
                        }
                    }.navigationTitle("Select Client")
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showClients = false } } }
                }.presentationDetents([.medium, .large])
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func create() {
        guard let client, let value = Decimal(string: amount), value > 0 else { return }
        saving = true
        errorMessage = nil
        let task: Task<Void, Never> = Task {
            do {
                try await store.createManualInvoice(clientId: client.id, amount: value, clientName: client.name)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMessage = error.localizedDescription; saving = false }
            }
        }
        _ = task
    }
}

private struct EstimateDetailView: View {
    @EnvironmentObject var store: DataStore; @Environment(\.dismiss) private var dismiss; @State private var showJobCreated = false
    let estimate: Estimate
    private var current: Estimate { store.estimates.first(where: { $0.id == estimate.id }) ?? estimate }
    var body: some View { NavigationStack { Form { Section { EstimateRow(estimate: current) }; Section { Button("Copy estimate text") { copy(estimateText(current)) }; if canNudge { Button("Nudge") { copy(nudgeText(current)) }.tint(.orange) }; if current.status == .draft || current.status == .sent { Button("Mark Approved") { update(.approved) }; Button("Mark Declined", role: .destructive) { update(.declined) } }; if current.status == .approved && current.jobId == nil { Button("Convert to Job") { convert() } }; if current.jobId != nil { Text("Converted ✓").foregroundColor(MowGoTheme.success) } } }.navigationTitle("Estimate").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }.alert("Job created", isPresented: $showJobCreated) { Button("OK") {} } }.presentationDetents([.medium, .large]) }
    private var canNudge: Bool { guard current.status == .sent, let value = current.sentAt, let date = ISO8601DateFormatter().date(from: value) else { return false }; return date < Calendar.current.date(byAdding: .day, value: -3, to: Date())! }
    private func copy(_ text: String) { UIPasteboard.general.string = text; UINotificationFeedbackGenerator().notificationOccurred(.success) }
    private func update(_ status: Estimate.EstimateStatus) { let task: Task<Void, Never> = Task { try? await store.updateEstimateStatus(current.id, to: status) }; _ = task }
    private func convert() { let task: Task<Void, Never> = Task { do { try await store.convertEstimateToJob(current); showJobCreated = true } catch {} }; _ = task }
}

private func estimateText(_ estimate: Estimate) -> String { "Hi \(estimate.clientName ?? "there"), here's your estimate: \(estimate.amount.formatted(.currency(code: "USD"))) for lawn care. Valid for 30 days. Thanks!" }
private func nudgeText(_ estimate: Estimate) -> String { "Hi \(estimate.clientName ?? "there"), just checking in on your estimate for \(estimate.amount.formatted(.currency(code: "USD"))) from \(String((estimate.sentAt ?? estimate.createdAt ?? "").prefix(10))) — still want me to hold the spot? Happy to adjust anything. Thanks!" }
