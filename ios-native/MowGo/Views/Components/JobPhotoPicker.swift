//
//  JobPhotoPicker.swift
//  MowGo
//
//  Photo picker for job photos — select from library or take a photo.
//

import SwiftUI
import PhotosUI
import UIKit

struct JobPhotoPicker: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss

    let jobId: UUID
    var onPhotoUploaded: ((String) -> Void)?

    @State private var selectedItem: PhotosPickerItem? = nil
    @State private var selectedImage: UIImage? = nil
    @State private var isUploading = false
    @State private var uploadError: String? = nil
    @State private var showSourcePicker = false
    @State private var showLibraryPicker = false
    @State private var showCamera = false

    private var theme: MowGoTheme { MowGoTheme.themed(colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                VStack(spacing: 20) {
                    if let image = selectedImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 300)
                            .cornerRadius(12)
                            .padding(.horizontal, 16)
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "photo.on.rectangle.angled")
                                .font(.system(size: 48))
                                .foregroundColor(theme.textMuted)
                            Text("Select a photo for this job")
                                .font(.subheadline)
                                .foregroundColor(theme.textSecondary)
                        }
                        .frame(maxHeight: 150)
                    }

                    Button {
                        showSourcePicker = true
                    } label: {
                        Label("Add Photo", systemImage: "camera")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(MowGoTheme.deepGreen)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal, 16)

                    if selectedImage != nil {
                        Button {
                            Task { await upload() }
                        } label: {
                            if isUploading {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                            } else {
                                Label("Upload Photo", systemImage: "arrow.up.circle.fill")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                            }
                        }
                        .background(selectedImage != nil && !isUploading ? Color.green : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .disabled(isUploading || selectedImage == nil)
                        .padding(.horizontal, 16)
                    }

                    if let error = uploadError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal, 16)
                    }

                    Spacer()
                }
            }
            .navigationTitle("Job Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onChange(of: selectedItem) { _, newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self),
                       let uiImage = UIImage(data: data) {
                        selectedImage = uiImage
                    }
                }
            }
            .sheet(isPresented: $showSourcePicker) {
                VStack(spacing: 0) {
                    Button {
                        showSourcePicker = false
                        showCamera = true
                    } label: {
                        Label("Take Photo", systemImage: "camera.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                    }
                    .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))

                    Divider()

                    Button {
                        showSourcePicker = false
                        showLibraryPicker = true
                    } label: {
                        Label("Choose from Library", systemImage: "photo.on.rectangle")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                    }
                }
                .presentationDetents([.medium])
            }
            .photosPicker(
                isPresented: $showLibraryPicker,
                selection: $selectedItem,
                matching: .images
            )
            .fullScreenCover(isPresented: $showCamera) {
                CameraView(jobId: jobId) { url in
                    onPhotoUploaded?(url)
                    dismiss()
                }
            }
        }
    }

    private func upload() async {
        guard let image = selectedImage, let jpegData = image.jpegData(compressionQuality: 0.8) else { return }
        isUploading = true
        uploadError = nil
        do {
            let url = try await SupabaseService.shared.uploadJobPhoto(jobId: jobId, imageData: jpegData)
            onPhotoUploaded?(url)
            dismiss()
        } catch {
            uploadError = "Upload failed: \(error.localizedDescription)"
            isUploading = false
        }
    }
}
