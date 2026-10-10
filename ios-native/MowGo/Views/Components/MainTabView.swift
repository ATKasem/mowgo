//
//  MainTabView.swift
//  MowGo
//
//  Tab bar shell — matches web Layout.jsx navigation.
//  4 tabs: Today, Clients, Invoices, Settings.
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView(selectedTab: $selectedTab)
                .tabItem { Label("Dashboard", systemImage: "rectangle.grid.1x2.fill") }
                .tag(0)

            TodayView(selectedTab: $selectedTab)
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(1)

            ClientsView()
                .tabItem { Label("Clients", systemImage: "person.2.fill") }
                .tag(2)

            InvoicesView()
                .tabItem { Label("Invoices", systemImage: "doc.text.fill") }
                .tag(3)

            SettingsView()
                .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
                .tag(4)
        }
        .tint(MowGoTheme.deepGreen)
        .sensoryFeedback(.selection, trigger: selectedTab)
        // DataStore.error carries offline-save notices, discarded sync changes,
        // failed saves and rain-delay rollback warnings. Show it app-wide.
        .safeAreaInset(edge: .top, spacing: 0) {
            if let message = store.error {
                StoreMessageBanner(message: message) { store.error = nil }
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: store.error)
    }
}

/// Dismissible banner for DataStore.error. Stays until dismissed or replaced
/// (some messages, like rollback warnings, need the user to act).
private struct StoreMessageBanner: View {
    let message: String
    let onDismiss: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(MowGoTheme.warning)
                .accessibilityHidden(true)
            Text(message)
                .font(.subheadline)
                .foregroundColor(theme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 12)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(theme.textMuted)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(Text("Dismiss"))
        }
        .padding(.leading, 14)
        .background(theme.surfaceElevated)
        .cornerRadius(12)
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .task(id: message) {
            AccessibilityNotification.Announcement(message).post()
        }
    }
}
