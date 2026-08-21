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
    @Environment(\\.colorScheme) private var colorScheme

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

    private struct Milestone {
        let label: LocalizedStringKey
        let tab: Int
        let done: Bool
    }

    private var milestones: [Milestone] {
        [
            Milestone(label: "Add your first client", tab: 2, done: !store.clients.isEmpty),
            Milestone(label: "Schedule your first job", tab: 1, done: !store.jobs.isEmpty),
            Milestone(label: "Complete a job", tab: 1, done: store.jobs.contains { $0.status == .done }),
            Milestone(label: "Send an invoice", tab: 3, done: !store.invoices.isEmpty)
        ]
    }

    private var allDone: Bool { milestones.allSatisfy(\.done) }

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

    private func milestoneRow(_ milestone: Milestone) -> some View {
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
