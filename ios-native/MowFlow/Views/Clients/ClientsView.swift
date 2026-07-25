//
//  ClientsView.swift
//  MowFlow
//
//  Client list with search, expandable details, navigation.
//

import SwiftUI

struct ClientsView: View {
    @EnvironmentObject var store: DataStore
    @State private var expandedId: UUID?
    @State private var searchText = ""
    @State private var showNewClient = false

    private var filtered: [Client] {
        if searchText.isEmpty { return store.clients }
        return store.clients.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(Color(hex: "16a34a"))
                } else {
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(filtered) { client in
                                ClientCard(client: client, isExpanded: expandedId == client.id) {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        expandedId = expandedId == client.id ? nil : client.id
                                    }
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
                            .foregroundColor(Color(hex: "16a34a"))
                    }
                }
            }
            .sheet(isPresented: $showNewClient) {
                NewClientFormView()
            }
        }
    }
}

struct ClientCard: View {
    let client: Client
    let isExpanded: Bool
    let onTap: () -> Void

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
                            .foregroundColor(.white)
                            .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                        if let address = client.address {
                            Text(address).font(.caption)
                                .foregroundColor(Color(hex: "9ca3af")).lineLimit(1)
                        }
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        if client.rate > 0 {
                            Text("$\(Int(client.rate))")
                                .font(.caption.weight(.medium)).foregroundColor(Color(hex: "16a34a"))
                        }
                        Image(systemName: "chevron.right").font(.caption)
                            .foregroundColor(Color(hex: "6b7280"))
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
                }
                .padding(.horizontal, 12).padding(.bottom, 12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color(hex: "1f2937")).cornerRadius(12)
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
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(Color(hex: "6b7280"))
                .frame(width: 16)
            Text(text)
                .font(.caption)
                .foregroundColor(Color(hex: "d1d5db"))
                .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        }
    }
}
