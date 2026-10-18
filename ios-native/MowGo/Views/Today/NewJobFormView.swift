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

    @State private var clientId: UUID?
    @State private var assignedTo: UUID? = nil
    @State private var scheduledTime = Date()
    @State private var duration = 60
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var repeatFrequency: RecurringJob.Frequency? = nil
    @State private var selectedDays: Set<Int> = [] // 1=Mon, 2=Tue, ..., 6=Sat

    private static let dayLabels: [(Int, LocalizedStringKey)] = [
        (1, "Mon"), (2, "Tue"), (3, "Wed"),
        (4, "Thu"), (5, "Fri"), (6, "Sat")
    ]

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                Form {
                    Section("Job Details") {
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

                    // MARK: - Repeat Section
                    Section("Repeat") {
                        Picker("Schedule", selection: $repeatFrequency) {
                            Text("Does not repeat").tag(nil as RecurringJob.Frequency?)
                            ForEach(RecurringJob.Frequency.allCases, id: \.self) { freq in
                                Text(freq.label).tag(freq as RecurringJob.Frequency?)
                            }
                        }
                        .onChange(of: repeatFrequency) { _, newFreq in
                            if newFreq != nil && selectedDays.isEmpty {
                                selectedDays = Set(1...6)
                            }
                        }

                        if repeatFrequency != nil {
                            Text("On which days?")
                                .font(.caption)
                                .foregroundColor(theme.textMuted)
                            HStack(spacing: 6) {
                                ForEach(Self.dayLabels, id: \.0) { day, label in
                                    DayToggleButton(
                                        label: label,
                                        isSelected: selectedDays.contains(day),
                                        theme: theme
                                    ) {
                                        if selectedDays.contains(day) {
                                            selectedDays.remove(day)
                                        } else {
                                            selectedDays.insert(day)
                                        }
                                    }
                                }
                            }
                        }
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
                            clientId == nil ||
                            isSaving ||
                            (repeatFrequency != nil && selectedDays.isEmpty)
                        )
                }
            }
            .alert("Couldn't Save Job", isPresented: Binding(
                get: { error != nil },
                set: { if !$0 { error = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? NSLocalizedString("Please check the form and try again.", comment: "Job save failure fallback message"))
            }
        }
    }

    private func save() {
        guard let clientId else {
            error = "Select a client."
            return
        }
        guard let clientName = store.clients.first(where: { $0.id == clientId })?.name else {
            error = "The selected client is no longer available."
            return
        }
        let jobTitle = clientName
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let jobNotes = trimmedNotes.isEmpty ? nil : trimmedNotes

        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        isSaving = true
        let timeFmt = DateFormatter(); timeFmt.dateFormat = "HH:mm"
        let job = Job(
            id: UUID(),
            clientId: clientId,
            assignedTo: assignedTo,
            title: jobTitle,
            scheduledDate: date,
            scheduledTime: timeFmt.string(from: scheduledTime),
            durationMinutes: duration,
            status: .scheduled,
            notes: jobNotes,
            routeOrder: (store.jobs
                .filter { $0.scheduledDate == date }
                .map { $0.routeOrder ?? -1 }
                .max() ?? -1) + 1,
            isRecurring: repeatFrequency != nil ? true : nil,
            recurrenceRule: repeatFrequency?.rawValue
        )
        Task {
            error = nil
            do {
                try await store.createJob(job)

                // If repeat is selected, also save the recurring template
                if let freq = repeatFrequency, !selectedDays.isEmpty {
                    let dateFmt = DateFormatter(); dateFmt.dateFormat = "yyyy-MM-dd"
                    let template = RecurringJob(
                        id: UUID(),
                        clientId: clientId,
                        title: jobTitle,
                        scheduledTime: timeFmt.string(from: scheduledTime),
                        durationMinutes: duration,
                        assignedTo: assignedTo,
                        notes: jobNotes,
                        frequency: freq,
                        daysOfWeek: Array(selectedDays).sorted(),
                        isActive: true,
                        startDate: date
                    )
                    do {
                        try await store.createRecurringJob(template)
                    } catch {
                        // Keep job/template creation atomic from the form's perspective.
                        try? await store.deleteJob(job)
                        throw error
                    }
                }

                dismiss()
            } catch {
                self.error = error.localizedDescription
                store.errorWasPresented(error)
                isSaving = false
            }
        }
    }
}

// MARK: - Day Toggle Button

struct DayToggleButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let label: LocalizedStringKey
    let isSelected: Bool
    let theme: MowGoTheme
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.medium))
                .frame(width: 38, height: 32)
                .background(isSelected ? MowGoTheme.deepGreen : theme.surfaceElevated)
                .foregroundColor(isSelected ? MowGoTheme.onAccent : theme.textMuted)
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}
