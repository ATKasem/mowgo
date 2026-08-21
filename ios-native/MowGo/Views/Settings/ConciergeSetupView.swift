//
//  ConciergeSetupView.swift
//  MowGo
//
//  Done-for-you client import and first-week scheduling request.
//

import SwiftUI
import UniformTypeIdentifiers

private struct ConciergeSubmitPayload: Encodable {
    let businessName: String
    let clientCount: Int?
    let csvContent: String

    enum CodingKeys: String, CodingKey {
        case businessName = "business_name"
        case clientCount = "client_count"
        case csvContent = "csv_content"
    }
}

private struct ConciergeErrorResponse: Decodable {
    let error: String
}

struct ConciergeSetupView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var businessName = ""
    @State private var clientCount = ""
    @State private var csvContent = ""
    @State private var parsedRowCount = 0
    @State private var showFileImporter = false
    @State private var isSubmitting = false
    @State private var successMessage: String?
    @State private var errorMessage: String?

    private let endpoint = URL(string: "https://mowgoapp.com/api/concierge-submit")!
    private let maxCsvCharacters = 100_000
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        Form {
            Section {
                TextField("Business Name", text: $businessName)
                    .textInputAutocapitalization(.words)
                TextField("Client Count (optional)", text: $clientCount)
                    .keyboardType(.numberPad)
            } footer: {
                Text("We import your clients and prepare your first operating week within 48 hours.")
            }

            Section {
                Button {
                    showFileImporter = true
                } label: {
                    Label("Upload a CSV or text file", systemImage: "doc.badge.arrow.up")
                        .foregroundColor(MowGoTheme.deepGreen)
                }

                TextEditor(text: $csvContent)
                    .frame(minHeight: 140)
                    .onChange(of: csvContent) { _, newValue in
                        parse(newValue)
                    }

                if !csvContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Label("\(parsedRowCount) rows loaded", systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundColor(MowGoTheme.deepGreen)
                }
            } header: {
                Text("Client list")
            } footer: {
                Text("Paste your client list from Excel or CSV if you do not have a file.")
            }

            if let successMessage {
                Section {
                    Label(successMessage, systemImage: "checkmark.circle.fill")
                        .foregroundColor(MowGoTheme.deepGreen)
                }
            }

            if let errorMessage {
                Section {
                    Text(errorMessage).foregroundColor(.red)
                }
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        Spacer()
                        if isSubmitting { ProgressView().tint(.white) }
                        Text("Submit setup request").fontWeight(.semibold)
                        Spacer()
                    }
                }
                .disabled(!canSubmit)
                .listRowBackground(MowGoTheme.deepGreen)
                .foregroundColor(.white)
            }
        }
        .scrollContentBackground(.hidden)
        .background(theme.background)
        .navigationTitle("Concierge Setup")
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(
            isPresented: $showFileImporter,
            allowedContentTypes: [.commaSeparatedText, .plainText],
            allowsMultipleSelection: false
        ) { result in
            handleFileImport(result)
        }
    }

    private var canSubmit: Bool {
        !isSubmitting
            && !businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && businessName.count <= 200
            && !csvContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && parsedRowCount > 0
            && csvContent.count <= maxCsvCharacters
            && parsedClientCount != .invalid
    }

    private enum ParsedClientCount: Equatable {
        case value(Int?)
        case invalid
    }

    private var parsedClientCount: ParsedClientCount {
        let trimmed = clientCount.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .value(nil) }
        guard let value = Int(trimmed), value >= 0 else { return .invalid }
        return .value(value)
    }

    private func parse(_ text: String) {
        parsedRowCount = CsvParser.tokenize(text).rows.filter { row in
            row.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        }.count
        successMessage = nil
        errorMessage = nil
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = NSLocalizedString("Could not access the selected file.", comment: "Concierge file access error")
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey])
            if let fileSize = resourceValues?.fileSize, fileSize > maxCsvCharacters {
                errorMessage = NSLocalizedString("That file is too large. Concierge uploads are limited to 100,000 characters.", comment: "Concierge file size error")
                return
            }

            let data = try Data(contentsOf: url)
            guard data.count <= maxCsvCharacters else {
                errorMessage = NSLocalizedString("That file is too large. Concierge uploads are limited to 100,000 characters.", comment: "Concierge file size error")
                return
            }
            guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .ascii) else {
                errorMessage = NSLocalizedString("Could not read that file.", comment: "Concierge file decoding error")
                return
            }
            guard text.count <= maxCsvCharacters else {
                errorMessage = NSLocalizedString("That file is too large. Concierge uploads are limited to 100,000 characters.", comment: "Concierge file size error")
                return
            }
            csvContent = text
            parse(text)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func submit() async {
        errorMessage = nil
        successMessage = nil

        guard case .value(let count) = parsedClientCount else {
            errorMessage = NSLocalizedString("Client count must be a whole number of zero or more.", comment: "Concierge client count validation error")
            return
        }
        guard let token = await SupabaseService.shared.token, !token.isEmpty else {
            errorMessage = NSLocalizedString("Your session has expired. Please sign in again.", comment: "Concierge authentication error")
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }

        do {
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.httpBody = try JSONEncoder().encode(ConciergeSubmitPayload(
                businessName: businessName.trimmingCharacters(in: .whitespacesAndNewlines),
                clientCount: count,
                csvContent: csvContent
            ))

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw URLError(.badServerResponse)
            }

            if (200..<300).contains(httpResponse.statusCode) {
                successMessage = NSLocalizedString("Request received — we will prepare your first operating week within 48 hours.", comment: "Concierge submission success")
            } else if httpResponse.statusCode == 403 {
                errorMessage = NSLocalizedString("This feature requires a Solo, Crew, or Premium plan.", comment: "Concierge paid tier error")
            } else {
                let serverError = try? JSONDecoder().decode(ConciergeErrorResponse.self, from: data)
                errorMessage = serverError?.error ?? NSLocalizedString("Could not submit your request.", comment: "Concierge submission fallback error")
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
