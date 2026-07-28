//
//  MainTabView.swift
//  MowGo
//
//  Tab bar shell — matches web Layout.jsx navigation.
//  AI assistant is now a floating overlay accessible from all tabs.
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedTab = 0
    @State private var showChat = false

    private var pageContext: String {
        switch selectedTab {
        case 0: return "Today — see your scheduled jobs and progress"
        case 1: return "Home — overview of your business"
        case 2: return "Clients — managing your client list"
        case 3: return "Invoices — billing and payments"
        case 4: return "Settings — app configuration"
        default: return ""
        }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
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

                InvoicesView()
                    .tabItem { Label("Invoices", systemImage: "doc.text.fill") }
                    .tag(3)

                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                    .tag(4)
            }
            .tint(MowGoTheme.deepGreen)
            .sensoryFeedback(.selection, trigger: selectedTab)

            // Floating AI button — above tab bar
            FloatingAIButton(isPresented: $showChat)
                .padding(.trailing, 20)
                .padding(.bottom, 90) // above tab bar
        }
        .sheet(isPresented: $showChat) {
            ChatOverlay(pageContext: pageContext)
                .environmentObject(auth)
                .environmentObject(store)
        }
    }
}
