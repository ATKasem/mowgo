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
    @State private var selectedInvoice: Invoice?
    @State private var showPayment = false

    private var unpaid: [Invoice] { store.invoices.filter { $0.status == .unpaid } }
    private var paid: [Invoice] { store.invoices.filter { $0.status == .paid } }
    private var totalUnpaid: Double { unpaid.reduce(0) { $0 + $1.amount } }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(Color(hex: "16a34a"))
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
                Text("Outstanding").font(.caption).foregroundColor(Color(hex: "9ca3af"))
                Text("$\(Int(totalUnpaid))").font(.title2.weight(.bold)).foregroundColor(.white)
            }
            Spacer()
            Text("\(unpaid.count) invoice\(unpaid.count == 1 ? "" : "s")")
                .font(.caption).foregroundColor(Color(hex: "6b7280"))
        }
        .padding().background(Color(hex: "1f2937")).cornerRadius(16)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title).font(.headline).foregroundColor(.white)
            .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text").font(.system(size: 40)).foregroundColor(Color(hex: "374151"))
            Text("No invoices yet").font(.headline).foregroundColor(.white)
            Text("Complete a job to create one").font(.subheadline).foregroundColor(Color(hex: "6b7280"))
        }
        .padding(.top, 60)
    }
}

struct InvoiceRow: View {
    let invoice: Invoice
    var showPay: Bool
    var onPay: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.clientName ?? "Invoice")
                    .font(.subheadline.weight(.medium)).foregroundColor(.white)
                if let date = invoice.createdAt {
                    Text(date.prefix(10).description)
                        .font(.caption).foregroundColor(Color(hex: "9ca3af"))
                }
            }
            Spacer()
            Text("$\(Int(invoice.amount))")
                .font(.subheadline.weight(.semibold)).foregroundColor(.white)

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
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(hex: "16a34a"))
                    .cornerRadius(8)
                }
            }
        }
        .padding(12).background(Color(hex: "1f2937")).cornerRadius(12)
    }
}
