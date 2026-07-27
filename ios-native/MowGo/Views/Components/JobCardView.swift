//
//  JobCardView.swift
//  MowGo
//
//  Job card with haptic feedback on toggle, swipe actions, photo support,
//  accessibility labels, and skip context menu.
//

import SwiftUI

struct JobCardView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\\.colorScheme) private var colorScheme
    let job: Job
    var teamMembers: [UserProfile] = []
    var onToggle: (() -> Void)?
    var onSkip: (() -> Void)?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    @State private var showPhotoPicker = false
    @State private var showSkipConfirm = false

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
                let iconName: String
                let iconColor: Color
                switch job.status {
                case .scheduled:
                    iconName = "play.circle"
                    iconColor = .gray
                case .inProgress:
                    iconName = "checkmark.circle.fill"
                    iconColor = .orange
                case .done:
                    iconName = "arrow.counterclockwise.circle"
                    iconColor = MowGoTheme.deepGreen
                case .skipped:
                    iconName = "forward.circle"
                    iconColor = MowGoTheme.warning
                }
                Image(systemName: iconName)
                    .font(.title3)
                    .foregroundColor(iconColor)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(job.status == .done
                ? "Reset job to scheduled"
                : job.status == .inProgress
                    ? "Mark job as complete"
                    : job.status == .skipped
                        ? "Unskip job"
                        : "Start job")

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(job.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(theme.textPrimary)
                        .strikethrough(job.status == .done || job.status == .skipped)
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
                            .foregroundColor(MowGoTheme.warning)
                            .accessibilityHidden(true)
                    }
                    if let key = job.clients?.keyCode, !key.isEmpty {
                        Image(systemName: "lock")
                            .font(.system(size: 10))
                            .foregroundColor(MowGoTheme.info)
                            .accessibilityHidden(true)
                    }
                }
                .font(.caption2)
                .foregroundColor(theme.textInverse)

                // Photo thumbnail row
                if let photoUrl = job.photoUrl, !photoUrl.isEmpty {
                    AsyncImage(url: URL(string: photoUrl)) { image in
                        image
                            .resizable()
                            .scaledToFill()
                    } placeholder: {
                        Color.gray.opacity(0.2)
                    }
                    .frame(width: 60, height: 45)
                    .cornerRadius(6)
                    .clipped()
                    .accessibilityLabel("Job photo")
                }
            }

            Spacer(minLength: 0)

            // Camera button
            Button {
                showPhotoPicker = true
            } label: {
                Image(systemName: "camera.fill")
                    .font(.caption)
                    .foregroundColor(theme.textMuted)
                    .frame(width: 28, height: 28)
                    .background(theme.surfaceElevated)
                    .cornerRadius(6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add job photo")
        }
        .padding(12)
        .background(theme.surface)
        .cornerRadius(12)
        .contextMenu {
            if job.status != .skipped {
                Button {
                    showSkipConfirm = true
                } label: {
                    Label("Skip Job", systemImage: "forward")
                }
            }
            if job.status == .skipped {
                Button {
                    onToggle?()
                } label: {
                    Label("Unskip Job", systemImage: "arrow.counterclockwise")
                }
            }
        }
        .confirmationDialog(
            "Skip this job?",
            isPresented: $showSkipConfirm,
            titleVisibility: .visible
        ) {
            Button("Skip Job", role: .destructive) {
                onSkip?()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This job will be marked as skipped and won't appear in your active route.")
        }
        .sheet(isPresented: $showPhotoPicker) {
            JobPhotoPicker(jobId: job.id) { [store] url in
                // Persist the uploaded photo URL to the job
                if let idx = store.jobs.firstIndex(where: { $0.id == job.id }) {
                    store.jobs[idx].photoUrl = url
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Job: \(job.title), \(job.status.label), scheduled for \(job.scheduledTime ?? "no time")")
    }
}
