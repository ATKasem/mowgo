import SwiftUI

struct RainDelaySheet: View {
    @EnvironmentObject private var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    let date: String
    let affectedCount: Int
    let onApplied: (RainDelayEntry) -> Void

    @State private var targetChoice = 0
    @State private var customDate = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var isApplying = false
    @State private var error: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private var targetDate: String {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return Self.dateFormatter.string(from: targetChoice == 0 ? tomorrow : customDate)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text("\(affectedCount) scheduled job\(affectedCount == 1 ? "" : "s") will move")
                    .font(.headline).foregroundColor(theme.textPrimary)

                Picker("Target", selection: $targetChoice) {
                    Text("Tomorrow").tag(0)
                    Text("Pick a date").tag(1)
                }
                .pickerStyle(.segmented)

                if targetChoice == 1 {
                    DatePicker(
                        "Move to",
                        selection: $customDate,
                        in: (Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date())...,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                }

                Text("Only today's jobs move. Your schedule stays intact.")
                    .font(.subheadline).foregroundColor(theme.textMuted)

                if let error { Text(error).font(.caption).foregroundColor(.red) }

                Spacer()
                Button {
                    apply()
                } label: {
                    if isApplying { ProgressView().tint(.white) }
                    else { Text("Confirm Rain Delay").fontWeight(.semibold) }
                }
                .frame(maxWidth: .infinity).padding(12)
                .background(MowGoTheme.rainBlue).foregroundColor(.white).cornerRadius(12)
                .disabled(isApplying || affectedCount == 0)
            }
            .padding(20).background(theme.background.ignoresSafeArea())
            .navigationTitle("Rain Delay").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
        .preferredColorScheme(.dark)
    }

    private func apply() {
        isApplying = true
        Task<Void, Never> {
            do {
                if try await store.rainDelay(for: date, to: targetDate) {
                    if let entry = store.rainDelayHistory.first { onApplied(entry) }
                    dismiss()
                } else {
                    isApplying = false
                }
            } catch {
                self.error = error.localizedDescription
                isApplying = false
            }
        }
    }
}

struct RainDelayHistoryView: View {
    @EnvironmentObject private var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var error: String?
    @State private var isUndoing = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        NavigationStack {
            List {
                if store.rainDelayHistory.isEmpty {
                    Text("No rain delays yet").foregroundColor(theme.textMuted)
                } else {
                    ForEach(store.rainDelayHistory) { entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(entry.date) → \(entry.targetDate)").font(.subheadline.weight(.semibold))
                                Text("\(entry.jobCount) job\(entry.jobCount == 1 ? "" : "s")")
                                    .font(.caption).foregroundColor(theme.textMuted)
                            }
                            Spacer()
                            Button("Undo") { undo(entry) }
                                .buttonStyle(.bordered)
                                .disabled(isUndoing)
                        }
                        .listRowBackground(theme.surface)
                    }
                }
                if let error { Text(error).foregroundColor(.red) }
            }
            .scrollContentBackground(.hidden).background(theme.background)
            .navigationTitle("Rain Delay History")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    private func undo(_ entry: RainDelayEntry) {
        isUndoing = true
        Task<Void, Never> {
            defer { isUndoing = false }
            do { try await store.undoRainDelay(entry) }
            catch let caught { error = caught.localizedDescription }
        }
    }
}
