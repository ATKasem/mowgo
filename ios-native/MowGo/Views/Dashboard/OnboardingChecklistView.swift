//
//  OnboardingChecklistView.swift
//  MowGo
//
//  Dashboard activation checklist — mirrors client/src/components/OnboardingChecklist.jsx.
//  Owner-only nudge toward first client / job / completion / invoice.
//

import SwiftUI

struct OnboardingChecklistView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme

    /// Dismissal keyed per authenticated profile, so it doesn't leak across accounts on the same device.
    @AppStorage("onboarding_checklist_dismissed_") private var dismissedRaw = ""
    @Binding var selectedTab: Int

    private var dismissedKey: String {
        auth.user?.id?.uuidString ?? "anon"
    }

    private var isDismissedForUser: Bool {
        dismissedRaw.split(separator: ",").contains(Substring(dismissedKey))
    }

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    private static func milestoneStates(store: DataStore) -> [(done: Bool, label: LocalizedStringKey, tab: Int)] {
        [
            (done: !store.clients.isEmpty, label: "Add your first client", tab: 2),
            (done: !store.jobs.isEmpty, label: "Schedule your first job", tab: 1),
            (done: store.jobs.contains { $0.status == .done }, label: "Complete a job", tab: 1),
            (done: !store.invoices.isEmpty, label: "Send an invoice", tab: 3)
        ]
    }

    static func milestonesDone(store: DataStore) -> Bool {
        milestoneStates(store: store).allSatisfy { $0.done }
    }

    private var milestones: [(done: Bool, label: LocalizedStringKey, tab: Int)] {
        Self.milestoneStates(store: store)
    }

    private var allDone: Bool {
        Self.milestonesDone(store: store)
    }

    var body: some View {
        if !isDismissedForUser && !allDone {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Start in 4 steps")
                        .font(.headline)
                        .foregroundColor(theme.textPrimary)
                    Spacer()
                    Button {
                        var keys = dismissedRaw.split(separator: ",").map(String.init)
                        if !keys.contains(dismissedKey) {
                            keys.append(dismissedKey)
                        }
                        dismissedRaw = keys.joined(separator: ",")
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(theme.textMuted)
                    }
                    .accessibilityLabel("Dismiss")
                }

                VStack(spacing: 4) {
                    ForEach(milestones.indices, id: \.self) { i in
                        milestoneRow(milestones[i])
                    }
                }
            }
            .padding(16)
            .background(theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func milestoneRow(_ milestone: (done: Bool, label: LocalizedStringKey, tab: Int)) -> some View {
        Button {
            selectedTab = milestone.tab
        } label: {
            HStack(spacing: 10) {
                Image(systemName: milestone.done ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(milestone.done ? MowGoTheme.deepGreen : theme.textMuted)
                Text(milestone.label)
                    .font(.subheadline.weight(milestone.done ? .regular : .medium))
                    .foregroundColor(milestone.done ? theme.textMuted : theme.textPrimary)
                    .strikethrough(milestone.done)
                Spacer()
            }
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
