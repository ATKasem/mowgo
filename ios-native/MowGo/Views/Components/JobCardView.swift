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
    @Environment(\.colorScheme) private var colorScheme
    let job: Job
    var teamMembers: [UserProfile] = []
    var onToggle: (() -> Void)?
    var onSkip: (() -> Void)?
    var showDate: Bool = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    @State private var showPhotoPicker = false
    @State private var showSkipConfirm = false
    @State private var showMapPicker = false

    private var assignedMember: UserProfile? {
        guard let assignedTo = job.assignedTo else { return nil }
        return teamMembers.first { $0.id == assignedTo }
    }

    private var memberIndex: Int {
        guard let member = assignedMember else { return -1 }
        return teamMembers.firstIndex(where: { $0.id == member.id }) ?? -1
    }

    private let chipColors = ["16a34a", "3b82f6", "f59e0b", "8b5cf6", "ec4899"]

    private static let dateFmt: DateFormatter = {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"; return fmt
    }()

    private static let dayFmt: DateFormatter = {
        let fmt = DateFormatter(); fmt.dateFormat = "EEE"; return fmt
    }()

    private var dayAbbreviation: String {
        guard let date = Self.dateFmt.date(from: job.scheduledDate) else { return "" }
        return Self.dayFmt.string(from: date)
    }

    // MARK: - Status icon helpers (computed outside ViewBuilder)

    private var statusIconName: String {
        job.status == .done ? "checkmark.circle.fill" : "circle"
    }

    private var statusIconColor: Color {
        job.status == .done ? MowGoTheme.deepGreen : .gray
    }

    private var statusLabelText: String {
        job.status == .done ? "Undo" : "Complete"
    }

    private var statusAccessibilityLabel: String {
        job.status == .done ? "Undo job completion" : "Mark job as complete"
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onToggle?()
            } label: {
                VStack(spacing: 1) {
                    Image(systemName: statusIconName)
                        .font(.title3)
                        .contentTransition(.symbolEffect(.replace))
                    Text(statusLabelText)
                        .font(.caption2)
                }
                .foregroundColor(statusIconColor)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(statusAccessibilityLabel)

            VStack(alignment: .leading, spacing: 4) {
                if showDate {
                    Text(dayAbbreviation)
                        .font(.caption2.weight(.medium))
                        .foregroundColor(MowGoTheme.deepGreen)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(MowGoTheme.deepGreen.opacity(0.15))
                        .cornerRadius(4)
                }
                HStack {
                    Text(job.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(theme.textPrimary)
                        .strikethrough(job.status == .done || job.status == .skipped)
                        .dynamicTypeSize(...DynamicTypeSize.accessibility2)

                    if job.isRecurring == true {
                        Text("🔄")
                            .font(.caption2)
                            .accessibilityLabel("Recurring job")
                    }

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
                }
                .font(.caption2)
                .foregroundColor(theme.textInverse)

                if let notes = job.clients?.petInstructions, !notes.isEmpty {
                    HStack(spacing: 2) {
                        Image(systemName: "pawprint")
                            .font(.system(size: 9))
                        Text("Pets: \(notes)")
                    }
                    .font(.caption2)
                    .foregroundColor(MowGoTheme.warning)
                }
                if let key = job.clients?.keyCode, !key.isEmpty {
                    HStack(spacing: 2) {
                        Image(systemName: "lock")
                            .font(.system(size: 9))
                        Text("Key: \(key)")
                    }
                    .font(.caption2)
                    .foregroundColor(MowGoTheme.info)
                }
                if let phone = job.clients?.phone, !phone.isEmpty {
                    HStack(spacing: 2) {
                        Image(systemName: "phone")
                            .font(.system(size: 9))
                        Text(phone)
                    }
                    .font(.caption2)
                    .foregroundColor(theme.textMuted)
                }
                if let address = job.clients?.address, !address.isEmpty {
                    HStack(spacing: 2) {
                        Image(systemName: "mappin")
                            .font(.system(size: 9))
                        Text(address)
                            .lineLimit(1)
                    }
                    .font(.caption2)
                    .foregroundColor(theme.textMuted)
                }

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

            // Quick actions: Call + Navigate
            HStack(spacing: 6) {
                if let phone = job.clients?.phone, !phone.isEmpty {
                    Button {
                        let cleaned = phone.replacingOccurrences(of: " ", with: "")
                            .replacingOccurrences(of: "-", with: "")
                            .replacingOccurrences(of: "(", with: "")
                            .replacingOccurrences(of: ")", with: "")
                        UIApplication.shared.open(URL(string: "tel:\(cleaned)")!)
                    } label: {
                        Image(systemName: "phone.fill")
                            .font(.caption)
                            .foregroundColor(MowGoTheme.success)
                            .frame(width: 28, height: 28)
                            .background(theme.surfaceElevated)
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Call \(phone)")
                }

                // Map pin — opens preferred GPS with client address
                if let address = job.address, !address.isEmpty {
                    Button {
                        showMapPicker = true
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.caption)
                            .foregroundColor(MowGoTheme.info)
                            .frame(width: 28, height: 28)
                            .background(theme.surfaceElevated)
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                    .confirmationDialog("Navigate", isPresented: $showMapPicker) {
                        if let enc = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
                            Button("Apple Maps") { UIApplication.shared.open(URL(string: "https://maps.apple.com/?q=\(enc)")!) }
                            Button("Google Maps") { UIApplication.shared.open(URL(string: "comgooglemaps://?q=\(enc)")!) }
                            Button("Waze") { UIApplication.shared.open(URL(string: "waze://?q=\(enc)")!) }
                        }
                        Button("Cancel", role: .cancel) { }
                    }
                    .accessibilityLabel("Navigate to \(address)")
                }
            }

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
                Button { showSkipConfirm = true } label: {
                    Label("Skip Job", systemImage: "forward")
                }
            }
            if job.status == .skipped {
                Button { onToggle?() } label: {
                    Label("Unskip Job", systemImage: "arrow.counterclockwise")
                }
            }
        }
        .confirmationDialog(
            "Skip this job?",
            isPresented: $showSkipConfirm,
            titleVisibility: .visible
        ) {
            Button("Skip Job", role: .destructive) { onSkip?() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This job will be marked as skipped and won't appear in your active route.")
        }
        .sheet(isPresented: $showPhotoPicker) {
            JobPhotoPicker(jobId: job.id, onPhotoUploaded: { url in
                if let idx = store.jobs.firstIndex(where: { $0.id == job.id }) {
                    store.jobs[idx].photoUrl = url
                }
            })
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }
}
