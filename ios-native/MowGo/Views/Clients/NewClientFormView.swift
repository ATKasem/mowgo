//
//  NewClientFormView.swift
//  MowGo
//
//  Form to create or edit a client with validation.
//

import SwiftUI

struct NewClientFormView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var focusedField: Field?

    let client: Client?

    @State private var name: String
    @State private var address: String
    @State private var phone: String
    @State private var email: String
    @State private var rate: String
    @State private var keyCode: String
    @State private var alarmCode: String
    @State private var petInstructions: String
    @State private var cleaningNotes: String
    @State private var isSaving = false
    @State private var error: String?

    private enum Field { case name, address, phone, email, rate, keyCode, alarmCode, pets, notes }
    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    init(client: Client? = nil) {
        self.client = client
        _name = State(initialValue: client?.name ?? "")
        _address = State(initialValue: client?.address ?? "")
        _phone = State(initialValue: client?.phone ?? "")
        _email = State(initialValue: client?.email ?? "")
        _rate = State(initialValue: client.map { NSDecimalNumber(decimal: $0.rate).stringValue } ?? "")
        _keyCode = State(initialValue: client?.keyCode ?? "")
        _alarmCode = State(initialValue: client?.alarmCode ?? "")
        _petInstructions = State(initialValue: client?.petInstructions ?? "")
        _cleaningNotes = State(initialValue: client?.cleaningNotes ?? "")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                Form {
                    Section("Client Info") {
                        TextField("Name", text: $name)
                            .textContentType(.name)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .name)
                            .onSubmit { focusedField = .address }
                        TextField("Address", text: $address)
                            .textContentType(.fullStreetAddress)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .address)
                            .onSubmit { focusedField = .phone }
                        TextField("Phone", text: $phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .phone)
                            .onSubmit { focusedField = .email }
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .email)
                            .onSubmit { focusedField = .rate }
                        TextField("Rate ($)", text: $rate)
                            .keyboardType(.decimalPad)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .rate)
                    }
                    .listRowBackground(theme.surface)

                    Section("Access") {
                        TextField("Gate/Key Code", text: $keyCode)
                            .keyboardType(.numberPad)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .keyCode)
                            .onSubmit { focusedField = .alarmCode }
                        TextField("Alarm Code", text: $alarmCode)
                            .keyboardType(.numberPad)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .alarmCode)
                            .onSubmit { focusedField = .pets }
                        TextField("Pet Instructions", text: $petInstructions)
                            .submitLabel(.next)
                            .focused($focusedField, equals: .pets)
                            .onSubmit { focusedField = .notes }
                    }
                    .listRowBackground(theme.surface)

                    Section("Notes") {
                        TextField("Service Notes", text: $cleaningNotes, axis: .vertical)
                            .lineLimit(3)
                            .focused($focusedField, equals: .notes)
                    }
                    .listRowBackground(theme.surface)
                }
                .scrollContentBackground(.hidden)
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle(client == nil ? "New Client" : "Edit Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
            }
            .alert("Couldn’t Save Client", isPresented: Binding(
                get: { error != nil },
                set: { if !$0 { error = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? "Please check the form and try again.")
            }
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            error = "Enter a client name."
            return
        }

        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        isSaving = true
        let editableClient = Client(
            id: client?.id ?? UUID(),
            userId: client?.userId,
            name: trimmedName,
            address: address.isEmpty ? nil : address,
            phone: phone.isEmpty ? nil : phone,
            email: email.isEmpty ? nil : email,
            rate: Decimal(string: rate) ?? 0,
            cleaningNotes: cleaningNotes.isEmpty ? nil : cleaningNotes,
            keyCode: keyCode.isEmpty ? nil : keyCode,
            alarmCode: alarmCode.isEmpty ? nil : alarmCode,
            petInstructions: petInstructions.isEmpty ? nil : petInstructions,
            createdAt: client?.createdAt
        )
        Task {
            error = nil
            do {
                if client == nil {
                    let newClient = editableClient
                    try await store.createClient(newClient)
                } else {
                    let updated = editableClient
                    try await store.updateClient(updated)
                }
                dismiss()
            } catch {
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}
