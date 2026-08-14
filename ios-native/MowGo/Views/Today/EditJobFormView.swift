//
//  EditJobFormView.swift
//  MowGo
//
//  Edit an existing job's title, client, notes, and route order.
//  Matches Android's EditJobDialog.kt scope (not schedule/assignment).
//

import SwiftUI

struct EditJobFormView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) var dismiss
    @Environment(\.colorScheme) private var colorScheme

    let job: Job

    @State private var clientId: UUID?
    @State private var title: String
    @State private var notes: String
    @State private var routeOrderText: String
    @State private var isSaving = false
    @State private var error: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    init(job: Job) {
        self.job = job
        _clientId = State(initialValue: job.clientId)
        _title = State(initialValue: job.title)
        _notes = State(initialValue: job.notes ?? "")
        _routeOrderText = State(initialValue: job.routeOrder.map(String.init) ?? "")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                Form {
                    Section("Job Details") {
                        TextField("Title", text: $title)
                            .textInputAutocapitalization(.words)
                        Picker(selection: $clientId) {
                            ForEach(store.clients) { client in
                                Text(client.name).tag(client.id as UUID?)
                            }
                        } label: {
                            HStack(spacing: 0) {
                                Text("Client")
                                Text(" *").foregroundColor(.red)
                            }
                        }
                        .accessibilityLabel("Client, required")
                        TextField("Notes (optional)", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                        TextField("Route order (optional)", text: $routeOrderText)
                            .keyboardType(.numberPad)
                    }
                    .listRowBackground(theme.surface)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Edit Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(
                            clientId == nil ||
                            title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                            isSaving
                        )
                }
            }
            .alert("Couldn't Save Job", isPresented: Binding(
                get: { error != nil },
                set: { if !$0 { error = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? NSLocalizedString("Please check the form and try again.", comment: "Job edit failure fallback message"))
            }
        }
    }

    private func save() {
        guard let clientId else { return }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return }

        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        isSaving = true
        var updated = job
        updated.clientId = clientId
        updated.title = trimmedTitle
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.notes = trimmedNotes.isEmpty ? nil : trimmedNotes
        updated.routeOrder = Int(routeOrderText.trimmingCharacters(in: .whitespacesAndNewlines))

        Task {
            error = nil
            do {
                try await store.updateJob(updated)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}
