//
//  Theme.swift
//  MowGo
//
//  App-wide design system derived from the MowGo app icon.
//  Replace Color(hex: "...") calls with these semantic constants.
//

import SwiftUI

enum MowGoTheme {

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

    // MARK: - Backgrounds

    /// Main app background — matches dark mode icon.
    static let background = Color(hex: "111827")        // Existing dark bg

    /// Card / surface background.
    static let surface = Color(hex: "1f2937")

    /// Elevated surface (hover, sheets).
    static let surfaceElevated = Color(hex: "374151")

    // MARK: - Text

    static let textPrimary = Color.white
    static let textSecondary = Color(hex: "d1d5db")
    static let textMuted = Color(hex: "9ca3af")
    static let textInverse = Color(hex: "6b7280")

    // MARK: - Semantic

    static let success = Color(hex: "16a34a")
    static let warning = Color(hex: "f59e0b")
    static let danger = Color(hex: "ef4444")
    static let info = Color(hex: "3b82f6")

    // MARK: - Misc

    static let rainBlue = Color(hex: "1e3a5f")          // Rain delay button
    static let accentOpacity = 0.15                      // For background tints
}
