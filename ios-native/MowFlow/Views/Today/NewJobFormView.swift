//
//  NewJobFormView.swift
//  MowFlow
//
//  Form to create a new job with haptic feedback.
//

import SwiftUI

struct NewJobFormView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) var dismiss

    let date: String

    @State private var title = ""
    @State private var clientId: UUID?
    @State private var scheduledTime = Date()
    @State private var duration = 60
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()
                Form {
                    Section("Job Details") {
                        TextField("Title (e.g. Weekly Mow)", text: $title)
                            .textContentType(.name)
                        Picker("Client", selection: $clientId) {
                            Text("None").tag(nil as UUID?)
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
                    }
                    .listRowBackground(Color(hex: "1f2937"))
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
                        .disabled(title.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        isSaving = true
        let timeFmt = DateFormatter(); timeFmt.dateFormat = "HH:mm"
        let job = Job(
            id: UUID(),
            clientId: clientId,
            title: title,
            scheduledDate: date,
            scheduledTime: timeFmt.string(from: scheduledTime),
            durationMinutes: duration,
            status: .scheduled,
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
