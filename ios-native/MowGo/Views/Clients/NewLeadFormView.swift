import SwiftUI

struct NewLeadFormView: View {
    @EnvironmentObject private var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var address = ""
    @State private var source = "Other"
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?

    private let sources = ["Referral", "Website", "Google", "Facebook", "Yard Sign", "Other"]
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    /// Stored lead-source values stay English (matches the lowercased DB
    /// column); only the on-screen label is localized.
    private static func sourceLabel(_ raw: String) -> LocalizedStringKey {
        switch raw {
        case "Referral": return "Referral"
        case "Website": return "Website"
        case "Google": return "Google"
        case "Facebook": return "Facebook"
        case "Yard Sign": return "Yard Sign"
        default: return "Other"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Lead Info") {
                    TextField("Name", text: $name).textContentType(.name)
                    TextField("Phone", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                    TextField("Email", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress)
                    TextField("Address", text: $address).textContentType(.fullStreetAddress)
                    Picker("Source", selection: $source) {
                        ForEach(sources, id: \.self) { Text(Self.sourceLabel($0)).tag($0) }
                    }
                }
                .listRowBackground(theme.surface)

                Section("Notes") {
                    TextField("Optional notes", text: $notes, axis: .vertical).lineLimit(3...6)
                }
                .listRowBackground(theme.surface)

                if let error {
                    Text(error).foregroundColor(.red)
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.background)
            .navigationTitle("New Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        error = nil
        let lead = Lead(
            id: UUID(),
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            phone: phone.nilIfBlank,
            email: email.nilIfBlank,
            address: address.nilIfBlank,
            source: source.lowercased(),
            notes: notes.nilIfBlank
        )
        Task<Void, Never> {
            do {
                try await store.createLead(lead)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
