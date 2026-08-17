//
//  ImportFromYardbookView.swift
//  MowGo
//
//  6-step CSV import wizard for migrating from Yardbook.
//  Mirrors the web ImportFromYardbook.jsx flow.
//

import SwiftUI
import UniformTypeIdentifiers

// MARK: - Batch payloads

private struct ClientBatchItem: Codable {
    let user_id: String
    let name: String
    let address: String?
    let phone: String?
    let email: String?
    let cleaning_notes: String?
    let rate: Decimal
    let tags: [String]
}

private struct ClientBatchResult: Decodable {
    let id: String
    let name: String
    let address: String?
    let phone: String?
}

private struct RecurringJobPayload: Codable {
    let user_id: String
    let client_id: String
    let title: String
    let scheduled_time: String?
    let duration_minutes: Int
    let frequency: String
    let days_of_week: [Int]
    let is_active: Bool
    let start_date: String
}

private struct RecurringJobResult: Decodable { let id: String }

// MARK: - Import Model

private struct ImportConfig {
    var defaultRate: Decimal = 0
    var scheduleFrequency: String = "weekly"
    var scheduleDays: [Int] = [1]
    var scheduleTime: String = "08:00"
    var scheduleDuration: Int = 60
    var scheduleTitle: String = "Lawn Care"
}

private enum ImportStep: String, CaseIterable { case upload, preview, configure, `import`, schedules, results }

// MARK: - View

struct ImportFromYardbookView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @State private var step: ImportStep = .upload
    @State private var rawText: String = ""
    @State private var showFilePicker = false
    @State private var showError: String?

    @State private var parsedHeaders: [String] = []
    @State private var parsedRows: [[String]] = []
    @State private var parseErrors: [CsvParseError] = []
    @State private var columnMap: [String: CsvField] = [:]

    @State private var existingClients: [Client] = []
    @State private var existingLoaded = false

    @State private var config = ImportConfig()
    @State private var importPreview: ImportPreview?

    @State private var importedCount = 0
    @State private var importResults: ImportResultsState?
    @State private var isImporting = false

    @State private var clientSchedules: [ClientScheduleRow] = []
    @State private var scheduleSaving = false
    @State private var schedulesCreated = 0

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }
    private let batchSize = 50
    private let maxFileBytes = 2 * 1024 * 1024
    private let maxRows = 2000
    private let freeClientLimit = 5

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    stepIndicator.padding(.top)
                    switch step {
                    case .upload: uploadStep
                    case .preview: previewStep
                    case .configure: configureStep
                    case .import: importProgressStep
                    case .schedules: schedulesStep
                    case .results: resultsStep
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 32)
            }
        }
        .navigationTitle("Import from Yardbook")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if step != .import && step != .results {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .fileImporter(isPresented: $showFilePicker, allowedContentTypes: [.commaSeparatedText, .plainText, .text], allowsMultipleSelection: false) { result in
            if case .success(let urls) = result, let url = urls.first { handleSelectedFile(url) }
            else if case .failure(let error) = result { showError = error.localizedDescription }
        }
        .onAppear { loadExistingClients() }
        .alert("Error", isPresented: Binding(get: { showError != nil }, set: { if !$0 { showError = nil } })) {
            Button("OK", role: .cancel) { showError = nil }
        } message: { Text(showError ?? "") }
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        let all = ImportStep.allCases
        let ci = all.firstIndex(of: step) ?? 0
        return HStack(spacing: 0) {
            ForEach(Array(all.enumerated()), id: \.offset) { i, s in
                VStack(spacing: 4) {
                    Circle().fill(i < ci ? Color.green : (s == step ? MowGoTheme.deepGreen : Color.gray.opacity(0.3))).frame(width: 24, height: 24)
                        .overlay(Text(i < ci ? "✓" : "\(i + 1)").font(.caption2.bold()).foregroundColor(.white))
                    Text(s.rawValue.capitalized).font(.system(size: 8)).lineLimit(1).minimumScaleFactor(0.5).foregroundColor(s == step ? MowGoTheme.deepGreen : theme.textSecondary)
                        .frame(maxWidth: 50)
                }
                .frame(minWidth: 40)
                if i < all.count - 1 {
                    Rectangle().fill(i < ci ? Color.green : Color.gray.opacity(0.2)).frame(height: 2).frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Step 1: Upload

    private var uploadStep: some View {
        VStack(spacing: 16) {
            Text("Import your clients from a Yardbook CSV export.").font(.subheadline).foregroundColor(theme.textSecondary).multilineTextAlignment(.center)
            Button(action: { showFilePicker = true }) {
                VStack(spacing: 12) {
                    Image(systemName: "doc.badge.arrow.up").font(.system(size: 36)).foregroundColor(MowGoTheme.deepGreen)
                    Text("Tap to select a CSV file").font(.headline).foregroundColor(theme.textPrimary)
                    Text("Supports CSV exports from Yardbook and other tools").font(.caption).foregroundColor(theme.textSecondary)
                }
                .frame(maxWidth: .infinity).padding(40).background(theme.surface).cornerRadius(16)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(MowGoTheme.deepGreen.opacity(0.3), style: StrokeStyle(lineWidth: 2, dash: [8])))
            }
            if !rawText.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(MowGoTheme.deepGreen)
                    Text("\(parsedRows.count) rows loaded").font(.subheadline).foregroundColor(theme.textPrimary)
                }.padding().frame(maxWidth: .infinity).background(theme.surface).cornerRadius(12)
                if !parseErrors.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(parseErrors.count) warning(s)").font(.caption).foregroundColor(.orange)
                        ForEach(parseErrors.prefix(3), id: \.rowIndex) { Text("Row \($0.rowIndex): \($0.message)").font(.caption2).foregroundColor(theme.textSecondary) }
                    }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.orange.opacity(0.1)).cornerRadius(12)
                }
                Button("Continue →") { goToPreview() }.buttonStyle(PrimaryButton(theme: theme)).padding(.top).disabled(!existingLoaded)
                if !existingLoaded && !rawText.isEmpty {
                    HStack {
                        ProgressView().tint(MowGoTheme.deepGreen)
                        Text("Checking your existing clients for duplicates…").font(.caption).foregroundColor(theme.textSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Step 2: Preview

    private var previewStep: some View {
        VStack(spacing: 16) {
            Text("Map columns from your CSV to MowGo fields").font(.subheadline).foregroundColor(theme.textSecondary)
            ForEach(parsedHeaders.indices, id: \.self) { columnIndex in
                let h = parsedHeaders[columnIndex]
                HStack {
                    Text(h).font(.subheadline).foregroundColor(theme.textPrimary).frame(width: 100, alignment: .leading)
                    Image(systemName: "arrow.right").font(.caption).foregroundColor(theme.textSecondary)
                    Picker("", selection: Binding<CsvField?>(
                        get: { columnMap[h] },
                        set: { if let v = $0 { columnMap[h] = v } else { columnMap.removeValue(forKey: h) } }
                    )) {
                        Text("—").tag(nil as CsvField?)
                        ForEach(CsvField.allCases, id: \.rawValue) { Text($0.label).tag($0 as CsvField?) }
                    }.pickerStyle(.menu).tint(MowGoTheme.deepGreen)
                }.padding(12).background(theme.surface).cornerRadius(10)
            }
            if !parsedRows.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Preview (first \(min(5, parsedRows.count)) of \(parsedRows.count) rows)").font(.caption).foregroundColor(theme.textSecondary)
                    ForEach(0..<min(5, parsedRows.count), id: \.self) { rowIdx in
                        Text(parsedHeaders.indices.compactMap { colIdx in colIdx < parsedRows[rowIdx].count ? parsedRows[rowIdx][colIdx] : nil }.joined(separator: " · ")).font(.caption2).foregroundColor(theme.textPrimary).lineLimit(1).padding(8).frame(maxWidth: .infinity, alignment: .leading).background(theme.surface).cornerRadius(6)
                    }
                }
            }
            HStack(spacing: 16) {
                Button("Back") { step = .upload }.buttonStyle(SecondaryButton(theme: theme))
                Button("Next →") { goToConfigure() }.buttonStyle(PrimaryButton(theme: theme)).disabled(!columnMap.values.contains(.name))
            }
        }
    }

    // MARK: - Step 3: Configure

    private var configureStep: some View {
        VStack(spacing: 16) {
            Text("Configure import settings").font(.headline)
            VStack(alignment: .leading, spacing: 4) {
                Text("Default rate per cut").font(.subheadline).foregroundColor(theme.textSecondary)
                HStack {
                    Text("$").foregroundColor(theme.textSecondary)
                    TextField("0.00", value: $config.defaultRate, format: .number).keyboardType(.decimalPad).textFieldStyle(.plain).foregroundColor(theme.textPrimary)
                }.padding(12).background(theme.surface).cornerRadius(10)
            }
            if let p = importPreview {
                VStack(spacing: 8) {
                    Label("\(p.rows.count) clients will be imported", systemImage: "person.3").font(.subheadline).foregroundColor(MowGoTheme.deepGreen)
                    if p.skippedMissingName > 0 { Label("\(p.skippedMissingName) skipped (no name)", systemImage: "exclamationmark.triangle").font(.caption).foregroundColor(.orange) }
                    if p.skippedDuplicates > 0 { Label("\(p.skippedDuplicates) skipped (duplicates in CSV)", systemImage: "exclamationmark.triangle").font(.caption).foregroundColor(.orange) }
                    if p.skippedExisting > 0 { Label("\(p.skippedExisting) skipped (already in your client list)", systemImage: "exclamationmark.triangle").font(.caption).foregroundColor(.orange) }
                }.padding().frame(maxWidth: .infinity).background(theme.surface).cornerRadius(12)
            }
            HStack(spacing: 16) {
                Button("Back") { step = .preview }.buttonStyle(SecondaryButton(theme: theme))
                Button("Start Import") { Task { await runImport() } }.buttonStyle(PrimaryButton(theme: theme))
            }
        }
    }

    // MARK: - Step 4: Import Progress

    private var importProgressStep: some View {
        VStack(spacing: 24) {
            if importedCount > 0 {
                Text("\(importedCount) clients imported so far…").font(.subheadline).foregroundColor(theme.textSecondary)
                ProgressView().tint(MowGoTheme.deepGreen)
            } else {
                ProgressView().tint(MowGoTheme.deepGreen)
                Text("Importing clients…").font(.subheadline).foregroundColor(theme.textSecondary)
            }
        }.padding(40)
    }

    // MARK: - Step 5: Schedules

    private var schedulesStep: some View {
        VStack(spacing: 16) {
            Text("Set up recurring schedules").font(.headline)
            VStack(spacing: 8) {
                HStack {
                    Text("Frequency:")
                    Picker("", selection: $config.scheduleFrequency) {
                        Text("Weekly").tag("weekly"); Text("Biweekly").tag("biweekly"); Text("Monthly").tag("monthly")
                    }.pickerStyle(.segmented)
                }
                HStack(spacing: 4) {
                    ForEach(1...6, id: \.self) { toggleBulkDayButton($0) }
                }
                HStack {
                    Text("Time:")
                    DatePicker("", selection: Binding(get: {
                        let p = config.scheduleTime.split(separator: ":"); return Calendar.current.date(from: DateComponents(hour: Int(p.first ?? "8") ?? 8, minute: Int(p.last ?? "0") ?? 0)) ?? Date()
                    }, set: {
                        let c = Calendar.current.dateComponents([.hour, .minute], from: $0)
                        config.scheduleTime = String(format: "%02d:%02d", c.hour ?? 8, c.minute ?? 0)
                    }), displayedComponents: .hourAndMinute).labelsHidden()
                }
                HStack {
                    Text("Duration (min):")
                    TextField("60", value: $config.scheduleDuration, format: .number).keyboardType(.numberPad).textFieldStyle(.plain).foregroundColor(theme.textPrimary)
                }.padding(12).background(theme.surface).cornerRadius(10)
                TextField("Job title", text: $config.scheduleTitle).textFieldStyle(.plain).foregroundColor(theme.textPrimary).padding(12).background(theme.surface).cornerRadius(10)
                Button("Apply to all selected") { applyBulkToSelected() }.font(.caption).foregroundColor(MowGoTheme.deepGreen)
            }.padding().background(theme.surface).cornerRadius(12)

            ForEach(clientSchedules.indices, id: \.self) { idx in
                let r = clientSchedules[idx]
                VStack(spacing: 6) {
                    Toggle(r.name, isOn: Binding(get: { r.selected }, set: { clientSchedules[idx].selected = $0 })).font(.subheadline).foregroundColor(theme.textPrimary)
                    if r.selected {
                        HStack(spacing: 4) {
                            ForEach(1...6, id: \.self) { day in
                                Button(["", "M", "T", "W", "T", "F", "S"][day]) {
                                    if clientSchedules[idx].days.contains(day) { clientSchedules[idx].days.removeAll { $0 == day } }
                                    else { clientSchedules[idx].days.append(day); clientSchedules[idx].days.sort() }
                                }.font(.caption2).padding(4).background(r.days.contains(day) ? MowGoTheme.deepGreen : theme.surface).foregroundColor(r.days.contains(day) ? .white : theme.textPrimary).cornerRadius(4)
                            }
                        }
                    }
                }.padding(12).background(theme.surface).cornerRadius(10)
            }
            HStack(spacing: 16) {
                Button("Skip") { schedulesCreated = 0; step = .results }.buttonStyle(SecondaryButton(theme: theme))
                Button("Create schedules") { Task { await confirmSchedules() } }.buttonStyle(PrimaryButton(theme: theme)).disabled(scheduleSaving)
            }
        }
    }

    private func toggleBulkDayButton(_ day: Int) -> some View {
        let labels = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return Button(labels[day]) {
            if config.scheduleDays.contains(day) { config.scheduleDays.removeAll { $0 == day } }
            else { config.scheduleDays.append(day); config.scheduleDays.sort() }
        }.font(.caption).padding(8).background(config.scheduleDays.contains(day) ? MowGoTheme.deepGreen : theme.surface).foregroundColor(config.scheduleDays.contains(day) ? .white : theme.textPrimary).cornerRadius(6)
    }

    // MARK: - Step 6: Results

    private var resultsStep: some View {
        VStack(spacing: 16) {
            if let r = importResults {
                (r.status == "success" ? Image(systemName: "checkmark.circle.fill").font(.system(size: 48)).foregroundColor(.green)
                : r.status == "partial" ? Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 48)).foregroundColor(.orange)
                : Image(systemName: "xmark.circle.fill").font(.system(size: 48)).foregroundColor(.red))

                Text(r.status == "success" ? "\(r.count) clients imported"
                     : r.status == "partial" ? "\(r.count) of \(r.total) clients imported"
                     : "Import failed — no clients were added").font(.headline).foregroundColor(theme.textPrimary)

                if r.skipped > 0 { Text("\(r.skipped) rows skipped").font(.caption).foregroundColor(theme.textSecondary) }
                if let error = r.error { Text(error).font(.caption).foregroundColor(.red) }
                if schedulesCreated > 0 { Text("\(schedulesCreated) recurring schedules created").font(.subheadline).foregroundColor(MowGoTheme.deepGreen) }

                if !r.names.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Imported").font(.caption).foregroundColor(theme.textSecondary)
                        ForEach(r.names.prefix(10), id: \.self) { Text($0).font(.subheadline).foregroundColor(theme.textPrimary) }
                        if r.names.count > 10 { Text("+ \(r.names.count - 10) more").font(.caption).foregroundColor(theme.textSecondary) }
                    }.padding().frame(maxWidth: .infinity, alignment: .leading).background(theme.surface).cornerRadius(12)
                }
                if !r.names.isEmpty && schedulesCreated == 0 {
                    Text("Set up recurring schedules later from the Clients page.").font(.caption).foregroundColor(theme.textSecondary)
                }
            }
            Button("Import another file") { resetImport() }.buttonStyle(PrimaryButton(theme: theme))
            Button("Done") { dismiss() }.buttonStyle(SecondaryButton(theme: theme))
        }
    }

    // MARK: - Actions

    private func handleSelectedFile(_ url: URL) {
        guard url.startAccessingSecurityScopedResource() else { showError = "Could not access the selected file."; return }
        defer { url.stopAccessingSecurityScopedResource() }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= maxFileBytes else { showError = "File too large — 2MB max."; return }
            guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .ascii) else { showError = "Could not read file."; return }
            rawText = text
            let t = CsvParser.tokenize(text)
            parsedHeaders = t.headers; parsedRows = t.rows; parseErrors = t.errors
            columnMap = CsvParser.detectColumnMapping(headers: t.headers)
            // Don't default unmapped headers — let the user choose explicitly
        } catch { showError = error.localizedDescription }
    }

    private func goToPreview() {
        guard !rawText.isEmpty else { return }
        guard parsedRows.count <= maxRows else { showError = "CSV has \(parsedRows.count) rows — limit is \(maxRows)."; return }
        guard !parsedRows.isEmpty else { showError = "No rows found in that CSV."; return }
        step = .preview
    }

    private func goToConfigure() {
        guard columnMap.values.contains(.name) else { showError = "Map a column to Name before continuing."; return }
        importPreview = CsvParser.buildImportRows(rows: parsedRows, columnMap: columnMap, headers: parsedHeaders, existingClients: existingClients)
        step = .configure
    }

    private func runImport() async {
        guard let preview = importPreview, let userId = auth.user?.id else { return }
        isImporting = true; step = .import; importedCount = 0

        let tier = (auth.user?.tier ?? "free").lowercased()
        var rows = preview.rows
        let total = rows.count
        if tier == "free" || tier == "" {
            rows = Array(rows.prefix(max(0, freeClientLimit - existingClients.count)))
        }

        let rate = config.defaultRate
        var imported: [ClientBatchResult] = []
        var importError: String?
        let sb = SupabaseService.shared

        for start in stride(from: 0, to: rows.count, by: batchSize) {
            let batch = Array(rows[start..<min(start + batchSize, rows.count)])
            let items = batch.map { ClientBatchItem(user_id: userId.uuidString, name: $0.name, address: $0.address.isEmpty ? nil : $0.address, phone: $0.phone.isEmpty ? nil : $0.phone, email: $0.email.isEmpty ? nil : $0.email, cleaning_notes: $0.notes.isEmpty ? nil : $0.notes, rate: rate, tags: []) }
            do {
                let r: [ClientBatchResult] = try await sb.insertBatch("clients", items)
                imported.append(contentsOf: r)
                importedCount = imported.count
            } catch {
                importError = error.localizedDescription
                break
            }
        }

        if !imported.isEmpty {
            await store.loadAll()
        }

        if !imported.isEmpty {
            Task { await WebhookService.shared.fire(userId: userId, event: "clients.imported", payload: ["count": imported.count, "clients": imported.map { ["id": $0.id, "name": $0.name] }]) }
        }

        let status: String = imported.isEmpty ? "failure" : (imported.count < total ? "partial" : "success")
        importResults = ImportResultsState(status: status, count: imported.count, total: total, skipped: preview.skippedMissingName + preview.skippedDuplicates + preview.skippedExisting, names: imported.map(\.name), error: importError)
        isImporting = false

        if !imported.isEmpty {
            clientSchedules = imported.map { ClientScheduleRow(clientId: $0.id, name: $0.name, selected: true, frequency: config.scheduleFrequency, days: config.scheduleDays, time: config.scheduleTime, duration: config.scheduleDuration, title: config.scheduleTitle) }
            step = .schedules
        } else { step = .results }
    }

    private func applyBulkToSelected() {
        for i in clientSchedules.indices where clientSchedules[i].selected {
            clientSchedules[i].frequency = config.scheduleFrequency; clientSchedules[i].days = config.scheduleDays
            clientSchedules[i].time = config.scheduleTime; clientSchedules[i].duration = config.scheduleDuration; clientSchedules[i].title = config.scheduleTitle
        }
    }

    private func confirmSchedules() async {
        let selected = clientSchedules.filter { $0.selected && !$0.days.isEmpty }
        guard !selected.isEmpty, let userId = auth.user?.id else { step = .results; return }
        scheduleSaving = true
        let today = String(ISO8601DateFormatter.withFractionalSeconds.string(from: Date()).prefix(10))
        let items = selected.map { RecurringJobPayload(user_id: userId.uuidString, client_id: $0.clientId, title: $0.title, scheduled_time: $0.time, duration_minutes: max(1, min(480, $0.duration)), frequency: $0.frequency, days_of_week: $0.days, is_active: true, start_date: today) }
        do {
            let _: [RecurringJobResult] = try await SupabaseService.shared.insertBatch("recurring_jobs", items)
            schedulesCreated = items.count
        } catch { schedulesCreated = 0 }
        scheduleSaving = false; step = .results
    }

    private func loadExistingClients() {
        Task {
            do { existingClients = try await SupabaseService.shared.fetchExportClients() }
            catch { existingClients = [] }
            existingLoaded = true
        }
    }

    private func resetImport() {
        step = .upload; rawText = ""; parsedHeaders = []; parsedRows = []; parseErrors = []; columnMap = [:]
        importPreview = nil; importResults = nil; clientSchedules = []; schedulesCreated = 0
        config = ImportConfig(); importedCount = 0; isImporting = false
    }
}

// MARK: - Supporting Types

private struct ImportResultsState {
    let status: String
    let count: Int
    let total: Int
    let skipped: Int
    let names: [String]
    let error: String?
}

private struct ClientScheduleRow {
    let clientId: String; let name: String
    var selected: Bool; var frequency: String; var days: [Int]
    var time: String; var duration: Int; var title: String
}

// MARK: - Button Styles

private struct PrimaryButton: ButtonStyle {
    let theme: MowGoTheme
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.subheadline.bold()).foregroundColor(.white).padding(.horizontal, 24).padding(.vertical, 12).background(MowGoTheme.deepGreen).cornerRadius(10).opacity(configuration.isPressed ? 0.8 : 1)
    }
}

private struct SecondaryButton: ButtonStyle {
    let theme: MowGoTheme
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.subheadline.bold()).foregroundColor(theme.textPrimary).padding(.horizontal, 24).padding(.vertical, 12).background(theme.surface).cornerRadius(10).overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3))).opacity(configuration.isPressed ? 0.8 : 1)
    }
}

private extension ISO8601DateFormatter {
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
}
