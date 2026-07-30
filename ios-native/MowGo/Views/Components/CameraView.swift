//
//  CameraView.swift
//  MowGo
//
//  Captures and uploads a job photo.
//

import SwiftUI
import UIKit

struct CameraView: View {
    @Environment(\.dismiss) private var dismiss

    let jobId: UUID
    var onPhotoUploaded: ((String) -> Void)?

    @State private var isUploading = false
    @State private var uploadError: String?
    @State private var capturedImage: UIImage?

    var body: some View {
        ZStack {
            CameraPicker(
                onImageCaptured: upload,
                onCancel: { dismiss() }
            )
            .ignoresSafeArea()

            if isUploading {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()

                ProgressView("Uploading photo…")
                    .padding(20)
                    .background(.regularMaterial)
                    .cornerRadius(12)
            }
        }
        .alert(
            "Couldn’t Upload Photo",
            isPresented: Binding(
                get: { uploadError != nil },
                set: { if !$0 { uploadError = nil } }
            )
        ) {
            Button("Try Again") {
                if let capturedImage {
                    upload(capturedImage)
                }
            }
            Button("Cancel", role: .destructive) { dismiss() }
        } message: {
            Text(uploadError ?? "Please try again.")
        }
    }

    private func upload(_ image: UIImage) {
        guard !isUploading else { return }
        capturedImage = image
        guard let jpegData = image.jpegData(compressionQuality: 0.8) else {
            uploadError = "The captured image could not be prepared for upload."
            return
        }

        isUploading = true
        uploadError = nil

        Task {
            do {
                let url = try await SupabaseService.shared.uploadJobPhoto(
                    jobId: jobId,
                    imageData: jpegData
                )
                onPhotoUploaded?(url)
                dismiss()
            } catch {
                uploadError = "Upload failed: \(error.localizedDescription)"
                isUploading = false
            }
        }
    }
}

private struct CameraPicker: UIViewControllerRepresentable {
    let onImageCaptured: (UIImage) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(
        _ uiViewController: UIImagePickerController,
        context: Context
    ) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        private let parent: CameraPicker

        init(parent: CameraPicker) {
            self.parent = parent
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.onCancel()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            guard let image = info[.originalImage] as? UIImage else {
                parent.onCancel()
                return
            }
            parent.onImageCaptured(image)
        }
    }
}
