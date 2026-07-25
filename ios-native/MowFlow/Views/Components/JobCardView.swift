//
//  JobCardView.swift
//  MowFlow
//
//  Job card with haptic feedback on toggle, swipe actions.
//

import SwiftUI

struct JobCardView: View {
    let job: Job
    var onToggle: (() -> Void)?

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
                        ? Color(hex: "16a34a")
                        : Color(hex: "4b5563"))
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(job.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .strikethrough(job.status == .done)
                        .dynamicTypeSize(...DynamicTypeSize.accessibility2)

                    Spacer()
                    if let rate = job.clientRate {
                        Text("$\(Int(rate))")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(Color(hex: "16a34a"))
                    }
                }

                if let client = job.clientName {
                    Text(client)
                        .font(.caption)
                        .foregroundColor(Color(hex: "9ca3af"))
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
                .foregroundColor(Color(hex: "6b7280"))
            }
        }
        .padding(12)
        .background(Color(hex: "1f2937"))
        .cornerRadius(12)
    }
}
