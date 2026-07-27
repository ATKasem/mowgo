//
//  MainTabView.swift
//  MowGo
//
//  Tab bar shell — matches web Layout.jsx navigation.
//  Added AI Chat tab and haptic feedback on tab selection.
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(0)

            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(1)

            ClientsView()
                .tabItem { Label("Clients", systemImage: "person.2.fill") }
                .tag(2)

            ChatView()
                .tabItem { Label("AI", systemImage: "brain.head.profile.fill") }
                .tag(3)

            InvoicesView()
                .tabItem { Label("Invoices", systemImage: "doc.text.fill") }
                .tag(4)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                .tag(5)
        }
        .tint(MowGoTheme.deepGreen)
        .sensoryFeedback(.selection, trigger: selectedTab)
    }
}
