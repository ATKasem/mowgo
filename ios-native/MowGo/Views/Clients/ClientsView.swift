//
//  ClientsView.swift
//  MowGo
//
//  Client list with search, expandable details, navigation.
//

import SwiftUI

struct ClientsView: View {
    @EnvironmentObject var store: DataStore
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
            }
            .sheet(item: $editingClient) { client in
                NewClientFormView(client: client)
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
                HStack {
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
                VStack(alignment: .leading, spacing: 8) {
                    if let phone = client.phone {
                        Button {
                            callPhone(phone)
                        } label: {
                            DetailRow(icon: "phone", text: phone)
                        }
                    }
                    if let key = client.keyCode {
                        DetailRow(icon: "lock", text: "Gate: \(key)")
                    }
                    if let alarm = client.alarmCode {
                        DetailRow(icon: "bell", text: "Alarm: \(alarm)")
                    }
                    if let pets = client.petInstructions {
                        DetailRow(icon: "pawprint", text: pets)
                    }
                    if let notes = client.cleaningNotes {
                        DetailRow(icon: "note.text", text: notes)
                    }
                    if let address = client.address {
                        Button {
                            openMaps(address)
                        } label: {
                            DetailRow(icon: "map", text: "Navigate")
                        }
                    }
                    Button("Edit") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onEdit()
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MowGoTheme.deepGreen)
                    .accessibilityLabel("Edit \(client.name)")
                }
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
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(theme.textInverse)
                .frame(width: 16)
            Text(text)
                .font(.caption)
                .foregroundColor(theme.textSecondary)
                .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        }
    }
}
