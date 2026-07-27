//
//  JobCardView.swift
//  MowGo
//
//  Job card with haptic feedback on toggle, swipe actions.
//

import SwiftUI

struct JobCardView: View {
    @Environment(\.colorScheme) private var colorScheme
    let job: Job
    var teamMembers: [UserProfile] = []
    var onToggle: (() -> Void)?

    private var theme: MowGoTheme { MowGoTheme(colorScheme) }

    private var assignedMember: UserProfile? {
        guard let assignedTo = job.assignedTo else { return nil }
        return teamMembers.first { $0.id == assignedTo }
    }

    private var memberIndex: Int {
        guard let member = assignedMember else { return -1 }
        return teamMembers.firstIndex(where: { $0.id == member.id }) ?? -1
    }

    private let chipColors = ["16a34a", "3b82f6", "f59e0b", "8b5cf6", "ec4899"]

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onToggle?()
            } label: {
                Image(systemName: job.status == .done
                    ? "checkmark.circle.fill"
                    : "circle")
                    .font(.title3)
                    .foregroundColor(job.status == .done
                        ? MowGoTheme.deepGreen
                        : theme.textInverse)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(job.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(theme.textPrimary)
                        .strikethrough(job.status == .done)
                        .dynamicTypeSize(...DynamicTypeSize.accessibility2)

                    Spacer()
                    if let rate = job.clientRate {
                        Text(rate.formatted(.currency(code: "USD")))
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(MowGoTheme.deepGreen)
                    }
                }

                if let client = job.clientName {
                    Text(client)
                        .font(.caption)
                        .foregroundColor(theme.textMuted)
                }

                HStack(spacing: 4) {
                    if let time = job.scheduledTime {
                        Image(systemName: "clock")
                            .font(.system(size: 10))
                        Text(time)
                    }
                    if let duration = job.durationMinutes {
                        Text("· \(duration)m")
                            .font(.caption2)
                    }
                    Spacer()
                    if let notes = job.clients?.petInstructions, !notes.isEmpty {
                        Image(systemName: "pawprint")
                            .font(.system(size: 10))
                            .foregroundColor(Color(hex: "f59e0b"))
                            .accessibilityHidden(true)
                    }
                    if let key = job.clients?.keyCode, !key.isEmpty {
                        Image(systemName: "lock")
                            .font(.system(size: 10))
                            .foregroundColor(Color(hex: "3b82f6"))
                            .accessibilityHidden(true)
                    }
                }
                .font(.caption2)
                .foregroundColor(theme.textInverse)
            }
        }
        .padding(12)
        .background(theme.surface)
        .cornerRadius(12)
    }
}
