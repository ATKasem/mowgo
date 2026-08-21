//
//  ReviewPrompt.swift
//  MowGo
//

import StoreKit
import UIKit

enum ReviewPrompt {
    static let completedJobThreshold = 10

    @MainActor
    static func requestReview() {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else { return }

        SKStoreReviewController.requestReview(in: scene)
    }
}
