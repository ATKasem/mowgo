//
//  InvoicesView.swift
//  MowGo
//
//  Invoice list with Stripe payment integration.
//  Tap "Pay" on unpaid invoices to launch Stripe checkout.
//

import SwiftUI

struct InvoicesView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedInvoice: Invoice?
    @State private var showPayment = false

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

    private var unpaid: [Invoice] { store.invoices.filter { $0.status == .unpaid } }
    private var paid: [Invoice] { store.invoices.filter { $0.status == .paid } }
    private var totalUnpaidCents: Int { unpaid.reduce(0) { $0 + $1.amountCents } }
    private var totalUnpaid: Decimal { Decimal(totalUnpaidCents) / 100 }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(MowGoTheme.deepGreen)
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            if !unpaid.isEmpty { totalBar }

                            if !unpaid.isEmpty {
                                sectionHeader("Unpaid")
                                ForEach(unpaid) { inv in
                                    InvoiceRow(invoice: inv, showPay: true) {
                                        selectedInvoice = inv
                                        showPayment = true
                                    }
                                }
                            }

                            if !paid.isEmpty {
                                sectionHeader("Paid")
                                ForEach(paid) { inv in
                                    InvoiceRow(invoice: inv, showPay: false) {}
                                }
                            }

                            if unpaid.isEmpty && paid.isEmpty { emptyState }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Invoices")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showPayment) {
                if let inv = selectedInvoice {
                    NavigationStack {
                        PaymentView(invoice: inv)
                            .navigationTitle("Payment")
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbar {
                                ToolbarItem(placement: .cancellationAction) {
                                    Button("Close") { showPayment = false }
                                }
                            }
                    }
                }
            }
        }
    }

    private var totalBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Outstanding").font(.caption).foregroundColor(theme.textMuted)
                Text(totalUnpaid.formatted(.currency(code: "USD")))
                    .font(.title2.weight(.bold)).foregroundColor(theme.textPrimary)
            }
            Spacer()
            Text("\(unpaid.count) invoice\(unpaid.count == 1 ? "" : "s")")
                .font(.caption).foregroundColor(theme.textInverse)
        }
        .padding().background(theme.surface).cornerRadius(16)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title).font(.headline).foregroundColor(theme.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text").font(.system(size: 40)).foregroundColor(theme.surfaceElevated)
            Text("No invoices yet").font(.headline).foregroundColor(theme.textPrimary)
            Text("Complete a job to create one").font(.subheadline).foregroundColor(theme.textInverse)
        }
        .padding(.top, 60)
    }
}

struct InvoiceRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let invoice: Invoice
    var showPay: Bool
    var onPay: () -> Void

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.clientName ?? "Invoice")
                    .font(.subheadline.weight(.medium)).foregroundColor(theme.textPrimary)
                if let date = invoice.createdAt {
                    Text(date.prefix(10).description)
                        .font(.caption).foregroundColor(theme.textMuted)
                }
            }
            Spacer()
            Text(invoice.currencyAmount.formatted(.currency(code: "USD")))
                .font(.subheadline.weight(.semibold)).foregroundColor(theme.textPrimary)

            if showPay {
                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    onPay()
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "creditcard")
                            .font(.system(size: 10))
                        Text("Pay")
                            .font(.caption.weight(.medium))
                    }
                    .foregroundColor(MowGoTheme.onAccent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(MowGoTheme.deepGreen)
                    .cornerRadius(8)
                }
            }
        }
        .padding(12).background(theme.surface).cornerRadius(12)
    }
}
