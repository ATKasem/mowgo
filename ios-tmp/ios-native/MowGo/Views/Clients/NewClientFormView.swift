//
//  NewClientFormView.swift
//  MowGo
//
//  Form to create a new client with validation.
//

import SwiftUI

struct NewClientFormView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) var dismiss
    @FocusState private var focusedField: Field?

    @State private var name = ""
    @State private var address = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var rate = ""
    @State private var keyCode = ""
    @State private var alarmCode = ""
    @State private var petInstructions = ""
    @State private var cleaningNotes = ""
    @State private var isSaving = false
    @State private var error: String?

    private enum Field { case name, address, phone, email, rate, keyCode, alarmCode, pets, notes }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "111827").ignoresSafeArea()
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
                    .listRowBackground(Color(hex: "1f2937"))

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
                    .listRowBackground(Color(hex: "1f2937"))

                    Section("Notes") {
                        TextField("Service Notes", text: $cleaningNotes, axis: .vertical)
                            .lineLimit(3)
                            .focused($focusedField, equals: .notes)
                    }
                    .listRowBackground(Color(hex: "1f2937"))
                }
                .scrollContentBackground(.hidden)
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("New Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.isEmpty || isSaving)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
            }
        }
    }

    private func save() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        isSaving = true
        let client = Client(
            id: UUID(),
            name: name,
            address: address.isEmpty ? nil : address,
            phone: phone.isEmpty ? nil : phone,
            email: email.isEmpty ? nil : email,
            rate: Double(rate) ?? 0,
            cleaningNotes: cleaningNotes.isEmpty ? nil : cleaningNotes,
            keyCode: keyCode.isEmpty ? nil : keyCode,
            alarmCode: alarmCode.isEmpty ? nil : alarmCode,
            petInstructions: petInstructions.isEmpty ? nil : petInstructions
        )
        Task {
            do {
                try await store.createClient(client)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}
