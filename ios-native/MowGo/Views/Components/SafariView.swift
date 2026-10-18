//
//  SafariView.swift
//  MowGo
//
//  In-app Safari sheet for the payment provider's hosted pages. Keeps the
//  user in MowGo, and the presenter learns when it closes (to refresh state).
//

import SafariServices
import SwiftUI

/// Identifiable wrapper so a URL can drive `.sheet(item:)`.
struct HostedPage: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.dismissButtonStyle = .done
        return controller
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
