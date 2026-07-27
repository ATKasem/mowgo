//
//  Theme.swift
//  MowGo
//
//  App-wide design system derived from the MowGo app icon.
//  Neutral colors adapt to the active SwiftUI color scheme.
//

import SwiftUI

struct MowGoTheme {
    let background: Color
    let surface: Color
    let surfaceElevated: Color
    let textPrimary: Color
    let textSecondary: Color
    let textMuted: Color
    let textInverse: Color

    init(_ colorScheme: ColorScheme) {
        let isDark = colorScheme == .dark
        background = Color(hex: isDark ? "111827" : "ffffff")
        surface = Color(hex: isDark ? "1f2937" : "f3f4f6")
        surfaceElevated = Color(hex: isDark ? "374151" : "e5e7eb")
        textPrimary = Color(hex: isDark ? "ffffff" : "111827")
        textSecondary = Color(hex: isDark ? "d1d5db" : "374151")
        textMuted = Color(hex: isDark ? "9ca3af" : "6b7280")
        textInverse = Color(hex: isDark ? "6b7280" : "9ca3af")
    }

    // MARK: - Brand Colors (from app icon)

    /// Primary brand green — the icon's lawnmower and grass. Use for CTAs, active states, highlights.
    static let brandGreen = Color(hex: "22c55e")       // Lime neon (icon foreground)

    /// Deep brand green — used for buttons, links, selected states.
    static let deepGreen = Color(hex: "16a34a")         // Emerald (existing accent)

    /// Dark forest — icon background gradient top.
    static let forestDark = Color(hex: "0d2818")

    /// Near-black green — icon background gradient bottom, OLED-optimized.
    static let forestBlack = Color(hex: "061208")

    /// Light mode icon background.
    static let mintWhite = Color(hex: "f0fdf4")

    // MARK: - Semantic

    static let success = Color(hex: "16a34a")
    static let warning = Color(hex: "f59e0b")
    static let danger = Color(hex: "ef4444")
    static let info = Color(hex: "3b82f6")
    static let onAccent = Color.white

    // MARK: - Misc

    static let rainBlue = Color(hex: "1e3a5f")          // Rain delay button
    static let accentOpacity = 0.15                      // For background tints
}

enum AppearancePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: Self { self }

    var label: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
