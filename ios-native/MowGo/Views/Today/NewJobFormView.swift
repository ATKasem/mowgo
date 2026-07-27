//
//  NewJobFormView.swift
//  MowGo
//
//  Form to create a new job with haptic feedback.
//

import SwiftUI

struct NewJobFormView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) var dismiss
    @Environment(\.colorScheme) private var colorScheme

    let date: String
    var teamMembers: [UserProfile] = []

    @State private var title = ""
    @State private var clientId: UUID?
    @State private var assignedTo: UUID? = nil
    @State private var scheduledTime = Date()
    @State private var duration = 60
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                Form {
                    Section("Job Details") {
                        TextField("Title (e.g. Weekly Mow)", text: $title)
                            .textContentType(.name)
                        Picker("Client", selection: $clientId) {
                            ForEach(store.clients) { client in
                                Text(client.name).tag(client.id as UUID?)
                            }
                        }
                        DatePicker("Time", selection: $scheduledTime, displayedComponents: .hourAndMinute)
                        Picker("Duration", selection: $duration) {
                            Text("30 min").tag(30)
                            Text("45 min").tag(45)
                            Text("60 min").tag(60)
                            Text("90 min").tag(90)
                            Text("120 min").tag(120)
                        }
                        if !teamMembers.isEmpty {
                            Picker("Assign To", selection: $assignedTo) {
                                Text("Unassigned").tag(nil as UUID?)
                                ForEach(teamMembers) { member in
                                    Text(member.businessName ?? "Unknown").tag(member.id as UUID?)
                                }
                            }
                        }
                        TextField("Notes (optional)", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                            .textContentType(.none)
                    }
                    .listRowBackground(theme.surface)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("New Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(
                            title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                            clientId == nil ||
                            isSaving
                        )
                }
            }
            .alert("Couldn’t Save Job", isPresented: Binding(
                get: { error != nil },
                set: { if !$0 { error = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? "Please check the form and try again.")
            }
        }
    }

    private func save() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            error = "Enter a job title."
            return
        }
        guard let clientId else {
            error = "Select a client."
            return
        }

        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        isSaving = true
        let timeFmt = DateFormatter(); timeFmt.dateFormat = "HH:mm"
        let job = Job(
            id: UUID(),
            clientId: clientId,
            assignedTo: assignedTo,
            title: trimmedTitle,
            scheduledDate: date,
            scheduledTime: timeFmt.string(from: scheduledTime),
            durationMinutes: duration,
            status: .scheduled,
            notes: notes.isEmpty ? nil : notes,
            routeOrder: store.jobs.filter { $0.scheduledDate == date }.count
        )
        Task {
            error = nil
            do {
                try await store.createJob(job)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}
