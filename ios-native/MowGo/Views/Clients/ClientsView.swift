//
//  ClientsView.swift
//  MowGo
//
//  Client list with search, expandable details, navigation.
//

import SwiftUI

struct ClientsView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @State private var expandedId: UUID?
    @State private var searchText = ""
    @State private var showNewClient = false
    @State private var editingClient: Client?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    private var filtered: [Client] {
        if searchText.isEmpty { return store.clients }
        return store.clients.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(MowGoTheme.deepGreen)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 8) {
                            if !store.clients.isEmpty {
                                Text("\(store.clients.count) clients")
                                    .font(.headline)
                                    .foregroundColor(theme.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.bottom, 4)
                            }

                            if store.clients.isEmpty && searchText.isEmpty {
                                VStack(spacing: 12) {
                                    Image(systemName: "person.2.slash")
                                        .font(.system(size: 40))
                                        .foregroundColor(theme.surfaceElevated)
                                    Text("No clients yet")
                                        .font(.headline)
                                        .foregroundColor(theme.textPrimary)
                                    Text("Add your first client to get started")
                                        .font(.subheadline)
                                        .foregroundColor(theme.textMuted)
                                    Button { showNewClient = true } label: {
                                        Text("Add Client")
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 20)
                                            .padding(.vertical, 10)
                                            .background(MowGoTheme.deepGreen)
                                            .clipShape(Capsule())
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, 40)
                            }

                            LazyVStack(spacing: 8) {
                            ForEach(filtered) { client in
                                ClientCard(
                                    client: client,
                                    isExpanded: expandedId == client.id,
                                    onTap: {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            expandedId = expandedId == client.id ? nil : client.id
                                        }
                                    },
                                    onEdit: {
                                        editingClient = client
                                    }
                                )
                            }
                        }
                        }
                        .padding(16)
                    }
                    .searchable(text: $searchText, prompt: "Search clients...")
                    .refreshable {
                        await store.loadAll()
                    }
                }
            }
            .navigationTitle("Clients")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showNewClient = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(MowGoTheme.deepGreen)
                    }
                    .accessibilityLabel("Add client")
                }
            }
            .sheet(isPresented: $showNewClient) {
                NewClientFormView()
                    .environmentObject(store)
                    .environmentObject(auth)
            }
            .sheet(item: $editingClient) { client in
                NewClientFormView(client: client)
                    .environmentObject(store)
                    .environmentObject(auth)
            }
        }
    }
}

struct ClientCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let client: Client
    let isExpanded: Bool
    let onTap: () -> Void
    let onEdit: () -> Void

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        VStack(spacing: 0) {
            Button(action: {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onTap()
            }) {
                HStack(spacing: 10) {
                    Circle()
                        .fill(MowGoTheme.deepGreen.opacity(0.12))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Text(String(client.name.prefix(1)).uppercased())
                                .font(.headline.weight(.semibold))
                                .foregroundColor(MowGoTheme.deepGreen)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(client.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(theme.textPrimary)
                            .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                        if let address = client.address {
                            Text(address).font(.caption)
                                .foregroundColor(theme.textMuted).lineLimit(1)
                        }
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        if client.rate > 0 {
                            Text(client.rate.formatted(.currency(code: "USD")))
                                .font(.caption.weight(.medium)).foregroundColor(MowGoTheme.deepGreen)
                        }
                        Image(systemName: "chevron.right").font(.caption)
                            .foregroundColor(theme.textInverse)
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    }
                }
                .padding(12)
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    if let phone = client.phone, !phone.isEmpty {
                        Button(action: { callPhone(phone) }) {
                            DetailRow(icon: "phone", text: phone)
                        }
                        .accessibilityLabel("Call \(phone)")
                    }
                    if let key = client.keyCode, !key.isEmpty {
                        DetailRow(icon: "lock", text: "Gate: \(key)")
                    }
                    if let pets = client.petInstructions, !pets.isEmpty {
                        DetailRow(icon: "pawprint", text: pets)
                    }
                    if let address = client.address, !address.isEmpty {
                        Button(action: { openMaps(address) }) {
                            DetailRow(icon: "map", text: address)
                        }
                        .accessibilityLabel("Navigate to \(address)")
                    }
                    if let notes = client.cleaningNotes, !notes.isEmpty {
                        DetailRow(icon: "note.text", text: notes)
                    }
                }
                .padding(.horizontal, 12).padding(.bottom, 8)

                HStack(spacing: 6) {
                    if let phone = client.phone, !phone.isEmpty {
                        Button {
                            callPhone(phone)
                        } label: {
                            Image(systemName: "phone.fill")
                                .font(.caption)
                                .foregroundColor(MowGoTheme.success)
                                .frame(width: 28, height: 28)
                                .background(theme.surfaceElevated)
                                .cornerRadius(6)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Call \(phone)")
                    }
                    if let address = client.address, !address.isEmpty {
                        Button {
                            openMaps(address)
                        } label: {
                            Image(systemName: "location.fill")
                                .font(.caption)
                                .foregroundColor(MowGoTheme.info)
                                .frame(width: 28, height: 28)
                                .background(theme.surfaceElevated)
                                .cornerRadius(6)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Navigate to \(address)")
                    }

                    // Camera — placeholder for client photo feature
                    Button {
                        // TODO: client photo attachment
                    } label: {
                        Image(systemName: "camera.fill")
                            .font(.caption)
                            .foregroundColor(theme.textMuted)
                            .frame(width: 28, height: 28)
                            .background(theme.surfaceElevated)
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add client photo")
                }
                .padding(.horizontal, 12).padding(.bottom, 8)

                Button("Edit") {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onEdit()
                }
                .font(.caption.weight(.semibold))
                    .foregroundColor(MowGoTheme.deepGreen)
                    .accessibilityLabel("Edit \(client.name)")
                .padding(.horizontal, 12).padding(.bottom, 12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(theme.surface).cornerRadius(12)
    }

    private func openMaps(_ address: String) {
        let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "maps://?q=\(encoded)") {
            UIApplication.shared.open(url)
        }
    }

    private func callPhone(_ phone: String) {
        let cleaned = phone.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
        if let url = URL(string: "tel:\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }
}

struct DetailRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let text: String

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 9))
                .foregroundColor(theme.textInverse)
                .frame(width: 16)
            Text(text)
                .font(.caption2)
                .foregroundColor(theme.textSecondary)
                .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        }
    }
}
