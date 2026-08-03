package com.mowgo.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ─── Brand Colors (from iOS Theme.swift) ───────────────────────────────

object MowGoColors {
    // Backgrounds
    val BackgroundDark = Color(0xFF1A1A2E)
    val BackgroundLight = Color(0xFFF8F9FA)
    val SurfaceDark = Color(0xFF16213E)
    val SurfaceLight = Color(0xFFFFFFFF)
    val ElevatedDark = Color(0xFF1F2937)
    val ElevatedLight = Color(0xFFE5E7EB)

    // Brand greens
    val BrandGreenDark = Color(0xFF4ADE80)
    val BrandGreenLight = Color(0xFF22C55E)
    val DeepGreenDark = Color(0xFF22C55E)
    val DeepGreenLight = Color(0xFF16A34A)

    // Text
    val TextPrimaryDark = Color(0xFFE5E7EB)
    val TextPrimaryLight = Color(0xFF111827)
    val TextSecondaryDark = Color(0xFF9CA3AF)
    val TextSecondaryLight = Color(0xFF6B7280)
    val TextMutedDark = Color(0xFF9CA3AF)
    val TextMutedLight = Color(0xFF6B7280)
    val TextInverseDark = Color(0xFF6B7280)
    val TextInverseLight = Color(0xFF9CA3AF)

    // Accent / Special
    val RainBlue = Color(0xFF1E3A5F)
    val OnAccent = Color(0xFFFFFFFF)
    val AccentOpacity = 0.15f

    // Semantic
    val SuccessDark = Color(0xFF4ADE80)
    val SuccessLight = Color(0xFF16A34A)
    val WarningDark = Color(0xFFFBBF24)
    val WarningLight = Color(0xFFF59E0B)
    val DangerDark = Color(0xFFF87171)
    val DangerLight = Color(0xFFEF4444)
    val InfoDark = Color(0xFF60A5FA)
    val InfoLight = Color(0xFF3B82F6)
}

// ─── Dark Color Scheme (default) ───────────────────────────────────────

private val DarkColorScheme = darkColorScheme(
    primary = MowGoColors.BrandGreenDark,
    onPrimary = MowGoColors.OnAccent,
    primaryContainer = MowGoColors.DeepGreenDark,
    onPrimaryContainer = MowGoColors.OnAccent,

    secondary = MowGoColors.DeepGreenDark,
    onSecondary = MowGoColors.OnAccent,
    secondaryContainer = MowGoColors.SurfaceDark,
    onSecondaryContainer = MowGoColors.TextPrimaryDark,

    tertiary = MowGoColors.RainBlue,
    onTertiary = MowGoColors.OnAccent,
    tertiaryContainer = MowGoColors.RainBlue,
    onTertiaryContainer = MowGoColors.OnAccent,

    background = MowGoColors.BackgroundDark,
    onBackground = MowGoColors.TextPrimaryDark,

    surface = MowGoColors.SurfaceDark,
    onSurface = MowGoColors.TextPrimaryDark,
    surfaceVariant = MowGoColors.ElevatedDark,
    onSurfaceVariant = MowGoColors.TextSecondaryDark,

    error = MowGoColors.DangerDark,
    onError = MowGoColors.OnAccent,
    errorContainer = MowGoColors.DangerDark,
    onErrorContainer = MowGoColors.OnAccent,

    outline = MowGoColors.TextSecondaryDark,
    outlineVariant = MowGoColors.ElevatedDark,
)

// ─── Light Color Scheme ────────────────────────────────────────────────

private val LightColorScheme = lightColorScheme(
    primary = MowGoColors.BrandGreenLight,
    onPrimary = MowGoColors.OnAccent,
    primaryContainer = MowGoColors.DeepGreenLight,
    onPrimaryContainer = MowGoColors.OnAccent,

    secondary = MowGoColors.DeepGreenLight,
    onSecondary = MowGoColors.OnAccent,
    secondaryContainer = MowGoColors.ElevatedLight,
    onSecondaryContainer = MowGoColors.TextPrimaryLight,

    tertiary = MowGoColors.RainBlue,
    onTertiary = MowGoColors.OnAccent,
    tertiaryContainer = MowGoColors.RainBlue,
    onTertiaryContainer = MowGoColors.OnAccent,

    background = MowGoColors.BackgroundLight,
    onBackground = MowGoColors.TextPrimaryLight,

    surface = MowGoColors.SurfaceLight,
    onSurface = MowGoColors.TextPrimaryLight,
    surfaceVariant = MowGoColors.ElevatedLight,
    onSurfaceVariant = MowGoColors.TextSecondaryLight,

    error = MowGoColors.DangerLight,
    onError = MowGoColors.OnAccent,
    errorContainer = MowGoColors.DangerLight,
    onErrorContainer = MowGoColors.OnAccent,

    outline = MowGoColors.TextSecondaryLight,
    outlineVariant = MowGoColors.ElevatedLight,
)

// ─── Composable Theme ──────────────────────────────────────────────────

@Composable
fun MowGoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
