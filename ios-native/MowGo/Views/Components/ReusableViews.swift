//
//  ReusableViews.swift
//  MowGo
//
//  Shared small views used across multiple screens.
//

import SwiftUI

// MARK: - StatChip (TodayView stats bar)

struct StatChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let label: String
    var count: Int? = nil
    var amount: Decimal? = nil
    let color: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var semanticColor: Color {
        switch color.lowercased() {
        case "f59e0b": MowGoTheme.warning
        case "ef4444": MowGoTheme.danger
        case "3b82f6": MowGoTheme.info
        default: MowGoTheme.success
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(semanticColor)
                .frame(width: 6, height: 6)
            if let amount {
                Text(amount.formatted(.currency(code: "USD")))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(theme.textPrimary)
            } else {
                Text("\(count ?? 0)")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(theme.textPrimary)
            }
            Text(label)
                .font(.caption2)
                .foregroundColor(theme.textMuted)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(theme.surface)
        .cornerRadius(8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(count.map { String($0) } ?? amount.map { $0.formatted(.currency(code: "USD")) } ?? "0") \(label)")
    }
}

// MARK: - StatCard (TodayView stats grid)

struct StatCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: LocalizedStringKey
    let value: String
    let icon: String
    let color: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var semanticColor: Color {
        switch color.lowercased() {
        case "f59e0b": MowGoTheme.warning
        case "ef4444": MowGoTheme.danger
        case "3b82f6": MowGoTheme.info
        default: MowGoTheme.success
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(semanticColor)
            Text(value)
                .font(.caption.weight(.bold))
                .foregroundColor(theme.textPrimary)
            Text(title)
                .font(.caption2)
                .foregroundColor(theme.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(theme.surface)
        .cornerRadius(12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(value) + Text(" ") + Text(title))
    }
}

// MARK: - QuickActionRow (HomeView quick actions)

struct QuickActionRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let label: String
    let color: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private var semanticColor: Color {
        switch color.lowercased() {
        case "f59e0b": MowGoTheme.warning
        case "ef4444": MowGoTheme.danger
        case "3b82f6": MowGoTheme.info
        default: MowGoTheme.success
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(semanticColor)
                .frame(width: 24)
            Text(label)
                .font(.subheadline.weight(.medium))
                .foregroundColor(theme.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(theme.textInverse)
        }
        .padding(12)
        .background(theme.surface)
        .cornerRadius(12)
    }
}

// MARK: - InfoRow (SettingsView)

struct InfoRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let label: LocalizedStringKey
    let value: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(theme.textMuted)
            Spacer()
            Text(value)
                .font(.subheadline)
                .foregroundColor(theme.textPrimary)
        }
    }
}
