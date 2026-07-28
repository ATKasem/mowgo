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
            TodayView(selectedTab: $selectedTab)
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(0)

            ClientsView()
                .tabItem { Label("Clients", systemImage: "person.2.fill") }
                .tag(1)

            InvoicesView()
                .tabItem { Label("Invoices", systemImage: "doc.text.fill") }
                .tag(2)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                .tag(3)
        }
        .tint(MowGoTheme.deepGreen)
        .sensoryFeedback(.selection, trigger: selectedTab)
    }
}
