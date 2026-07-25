//
//  ReusableViews.swift
//  MowFlow
//
//  Shared small views used across multiple screens.
//

import SwiftUI

// MARK: - StatChip (TodayView stats bar)

struct StatChip: View {
    let label: String
    var count: Int? = nil
    var amount: Double? = nil
    let color: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(hex: color))
                .frame(width: 6, height: 6)
            if let amount {
                Text("$\(Int(amount))")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
            } else {
                Text("\(count ?? 0)")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
            }
            Text(label)
                .font(.caption2)
                .foregroundColor(Color(hex: "9ca3af"))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color(hex: "1f2937"))
        .cornerRadius(8)
    }
}

// MARK: - StatCard (HomeView stats grid)

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(Color(hex: color))
            Text(value)
                .font(.subheadline.weight(.bold))
                .foregroundColor(.white)
            Text(title)
                .font(.caption2)
                .foregroundColor(Color(hex: "9ca3af"))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(hex: "1f2937"))
        .cornerRadius(12)
    }
}

// MARK: - QuickActionRow (HomeView quick actions)

struct QuickActionRow: View {
    let icon: String
    let label: String
    let color: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(Color(hex: color))
                .frame(width: 24)
            Text(label)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.white)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color(hex: "6b7280"))
        }
        .padding(12)
        .background(Color(hex: "1f2937"))
        .cornerRadius(12)
    }
}

// MARK: - InfoRow (SettingsView)

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(Color(hex: "9ca3af"))
            Spacer()
            Text(value)
                .font(.subheadline)
                .foregroundColor(.white)
        }
    }
}
