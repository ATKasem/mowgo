//
//  ClientsView.swift
//  MowGo
//
//  Client list with search, expandable details, navigation.
//

import SwiftUI

struct ClientsView: View {
    private enum ClientFilter: String {
        case all = "All"
        case withJobs = "With Jobs"
        case withInvoices = "With Invoices"
        case recent = "Recent"
    }

    private enum ClientSort: String {
        case nameAscending = "Name A-Z"
        case nameDescending = "Name Z-A"
        case recent = "Recent"
        case oldest = "Oldest"
    }

    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthService
    @Environment(\.colorScheme) private var colorScheme
    @State private var expandedId: UUID?
    @State private var searchText = ""
    @State private var showNewClient = false
    @State private var editingClient: Client?
    @State private var selectedSegment = 0
    @State private var showNewLead = false
    @State private var operationError: String?
    @State private var selectedFilter: ClientFilter = .all
    @State private var selectedSort: ClientSort = .nameAscending
    @State private var showFilterOptions = false
    @State private var showSortOptions = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    private var filteredClients: [Client] {
        var clients = store.clients

        if !searchText.isEmpty {
            clients = clients.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }

        switch selectedFilter {
        case .all:
            break
        case .withJobs:
            let clientIds = Set(store.jobs.compactMap(\.clientId))
            clients = clients.filter { clientIds.contains($0.id) }
        case .withInvoices:
            let clientIds = Set(store.invoices.compactMap(\.clientId))
            clients = clients.filter { clientIds.contains($0.id) }
        case .recent:
            let cutoff = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? .distantPast
            clients = clients.filter { clientCreatedAt($0).map { $0 >= cutoff } ?? false }
        }

        return clients.sorted { lhs, rhs in
            switch selectedSort {
            case .nameAscending:
                return compareNames(lhs, rhs, ascending: true)
            case .nameDescending:
                return compareNames(lhs, rhs, ascending: false)
            case .recent:
                return compareDates(lhs, rhs, newestFirst: true)
            case .oldest:
                return compareDates(lhs, rhs, newestFirst: false)
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                if store.isLoading {
                    ProgressView().tint(MowGoTheme.deepGreen)
                } else {
                    VStack(spacing: 0) {
                        Picker("View", selection: $selectedSegment) {
                            Text("Clients").tag(0)
                            Text("Leads").tag(1)
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)

                        if selectedSegment == 0 {
                            ScrollView {
                                VStack(alignment: .leading, spacing: 8) {
                            if !store.clients.isEmpty {
                                Text("\(store.clients.count) clients")
                                    .font(.headline)
                                    .foregroundColor(theme.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.bottom, 4)

                                HStack {
                                    filterButton
                                    Spacer()
                                    sortButton
                                }
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
                                        ForEach(filteredClients) { client in
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
                        } else {
                            leadsList
                        }
                    }
                }
            }
            .navigationTitle("Clients")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        if selectedSegment == 0 { showNewClient = true } else { showNewLead = true }
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(MowGoTheme.deepGreen)
                    }
                    .accessibilityLabel(selectedSegment == 0 ? "Add client" : "Add lead")
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
            .sheet(isPresented: $showNewLead) {
                NewLeadFormView().environmentObject(store)
            }
        }
    }

    private var filterButton: some View {
        Button {
            showFilterOptions = true
        } label: {
            Label("Filter", systemImage: "line.3.horizontal.decrease")
                .font(.caption.weight(.medium))
                .foregroundColor(theme.textPrimary)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(theme.surface)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .confirmationDialog("Filter", isPresented: $showFilterOptions, titleVisibility: .visible) {
            Button("All") { selectedFilter = .all }
            Button("With Jobs") { selectedFilter = .withJobs }
            Button("With Invoices") { selectedFilter = .withInvoices }
            Button("Recent") { selectedFilter = .recent }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var sortButton: some View {
        Button {
            showSortOptions = true
        } label: {
            Label("Sort", systemImage: "arrow.up.arrow.down")
                .font(.caption.weight(.medium))
                .foregroundColor(theme.textPrimary)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(theme.surface)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .confirmationDialog("Sort", isPresented: $showSortOptions, titleVisibility: .visible) {
            Button("Name A-Z") { selectedSort = .nameAscending }
            Button("Name Z-A") { selectedSort = .nameDescending }
            Button("Recent") { selectedSort = .recent }
            Button("Oldest") { selectedSort = .oldest }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func clientCreatedAt(_ client: Client) -> Date? {
        guard let value = client.createdAt else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private func compareNames(_ lhs: Client, _ rhs: Client, ascending: Bool) -> Bool {
        let result = lhs.name.localizedStandardCompare(rhs.name)
        if result == .orderedSame { return lhs.id.uuidString < rhs.id.uuidString }
        return ascending ? result == .orderedAscending : result == .orderedDescending
    }

    private func compareDates(_ lhs: Client, _ rhs: Client, newestFirst: Bool) -> Bool {
        switch (clientCreatedAt(lhs), clientCreatedAt(rhs)) {
        case let (left?, right?) where left != right:
            return newestFirst ? left > right : left < right
        case (_?, nil):
            return true
        case (nil, _?):
            return false
        default:
            return compareNames(lhs, rhs, ascending: true)
        }
    }

    private var leadsList: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let operationError {
                    Text(operationError).font(.caption).foregroundColor(.red)
                }
                if store.leads.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.badge.questionmark")
                            .font(.system(size: 40)).foregroundColor(theme.surfaceElevated)
                        Text("No leads yet").font(.headline).foregroundColor(theme.textPrimary)
                        Text("Add a lead to start building your pipeline")
                            .font(.subheadline).foregroundColor(theme.textMuted)
                    }
                    .frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    ForEach(store.leads) { lead in
                        leadRow(lead)
                            .contextMenu {
                                if lead.status == LeadStatus.lost.rawValue {
                                    Button("Delete", role: .destructive) { deleteLead(lead) }
                                }
                            }
                    }
                }
            }
            .padding(16)
        }
        .refreshable { await store.loadLeads() }
    }

    private func leadRow(_ lead: Lead) -> some View {
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(lead.name).font(.subheadline.weight(.semibold)).foregroundColor(theme.textPrimary)
                    Text(lead.source.capitalized)
                        .font(.caption2.weight(.medium)).foregroundColor(MowGoTheme.deepGreen)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(MowGoTheme.deepGreen.opacity(0.12)).clipShape(Capsule())
                }
                Spacer()
                Menu {
                    Picker("Status", selection: Binding(
                        get: { LeadStatus(rawValue: lead.status) ?? .new },
                        set: { updateStatus(lead, status: $0) }
                    )) {
                        ForEach(LeadStatus.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }
                } label: {
                    Label((LeadStatus(rawValue: lead.status) ?? .new).displayName, systemImage: "chevron.down")
                        .font(.caption.weight(.medium))
                }
            }

            HStack(spacing: 8) {
                if let phone = lead.phone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(destination: url) { Image(systemName: "phone.fill") }
                        .buttonStyle(.bordered).accessibilityLabel("Call \(lead.name)")
                }
                if let email = lead.email, let url = URL(string: "mailto:\(email)") {
                    Link(destination: url) { Image(systemName: "envelope.fill") }
                        .buttonStyle(.bordered).accessibilityLabel("Email \(lead.name)")
                }
                Spacer()
                if lead.status != LeadStatus.won.rawValue {
                    Button("Convert") { convert(lead) }
                        .font(.caption.weight(.semibold)).buttonStyle(.borderedProminent).tint(MowGoTheme.deepGreen)
                }
            }
        }
        .padding(12).background(theme.surface).cornerRadius(12)
    }

    private func updateStatus(_ lead: Lead, status: LeadStatus) {
        Task<Void, Never> {
            do { try await store.updateLeadStatus(lead.id, status: status) }
            catch { operationError = error.localizedDescription }
        }
    }

    private func convert(_ lead: Lead) {
        Task<Void, Never> {
            do {
                try await store.convertLeadToClient(lead)
                selectedSegment = 0
            } catch { operationError = error.localizedDescription }
        }
    }

    private func deleteLead(_ lead: Lead) {
        Task<Void, Never> {
            do { try await store.deleteLead(lead.id) }
            catch { operationError = error.localizedDescription }
        }
    }
}

struct ClientCard: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject var auth: AuthService
    let client: Client
    let isExpanded: Bool
    let onTap: () -> Void
    let onEdit: () -> Void
    @State private var fetchedKeyCode: String?

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    /// Gate code isn't kept in the general client list or its offline cache —
    /// fetched on demand the moment this card expands. Demo mode has no
    /// backend to call, so it reads straight off the (already-local) demo client.
    private var displayKeyCode: String? { auth.isDemoMode ? client.keyCode : fetchedKeyCode }

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
                    if let key = displayKeyCode, !key.isEmpty {
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
        .task(id: isExpanded) {
            guard isExpanded, !auth.isDemoMode else { return }
            let codes = try? await SupabaseService.shared.fetchClientCode(clientId: client.id)
            fetchedKeyCode = codes?.keyCode
        }
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
