//
//  Theme.swift
//  MowGo
//
//  App-wide design system derived from the MowGo app icon.
//  Neutral colors adapt to the active SwiftUI color scheme.
//

import SwiftUI

struct MowGoTheme: Equatable {
    let background: Color
    let surface: Color
    let surfaceElevated: Color
    let textPrimary: Color
    let textSecondary: Color
    let textMuted: Color
    let textInverse: Color

    private static var cache: [ColorScheme: MowGoTheme] = [:]

    static func themed(_ scheme: ColorScheme) -> MowGoTheme {
        if let cached = cache[scheme] { return cached }
        let theme = MowGoTheme(colorScheme: scheme)
        cache[scheme] = theme
        return theme
    }

    init(colorScheme: ColorScheme) {
        background = Color(
            light: Color(hex: "f8f9fa"),
            dark: Color(hex: "1a1a2e")
        )
        surface = Color(
            light: .white,
            dark: Color(hex: "16213e")
        )
        surfaceElevated = Color(
            light: Color(hex: "e5e7eb"),
            dark: Color(hex: "1f2937")
        )
        textPrimary = Color(
            light: Color(hex: "111827"),
            dark: Color(hex: "e5e7eb")
        )
        textSecondary = Color(
            light: Color(hex: "6b7280"),
            dark: Color(hex: "9ca3af")
        )
        textMuted = Color(
            light: Color(hex: "6b7280"),
            dark: Color(hex: "9ca3af")
        )
        textInverse = Color(
            light: Color(hex: "9ca3af"),
            dark: Color(hex: "6b7280")
        )
    }

    // MARK: - Brand Colors (from app icon)

    /// Primary brand green — the icon's lawnmower and grass. Use for CTAs, active states, highlights.
    static let brandGreen = Color(
        light: Color(hex: "22c55e"),
        dark: Color(hex: "4ade80")
    )

    /// Deep brand green — used for buttons, links, selected states.
    static let deepGreen = Color(
        light: Color(hex: "16a34a"),
        dark: Color(hex: "22c55e")
    )

    /// Dark forest — icon background gradient top.
    static let forestDark = Color(hex: "0d2818")

    /// Near-black green — icon background gradient bottom, OLED-optimized.
    static let forestBlack = Color(hex: "061208")

    /// Light mode icon background.
    static let mintWhite = Color(hex: "f0fdf4")

    // MARK: - Semantic

    static let success = Color(light: Color(hex: "16a34a"), dark: Color(hex: "4ade80"))
    static let warning = Color(light: Color(hex: "f59e0b"), dark: Color(hex: "fbbf24"))
    static let danger  = Color(light: Color(hex: "ef4444"), dark: Color(hex: "f87171"))
    static let info    = Color(light: Color(hex: "3b82f6"), dark: Color(hex: "60a5fa"))
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
