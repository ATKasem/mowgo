// swift-tools-version: 5.9
//  Package.swift
//  MowFlow
//
//  SPM manifest for iOS app.
//  Open this file in Xcode: File → Open → select Package.swift

import PackageDescription

let package = Package(
    name: "MowFlow",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "MowFlow", targets: ["MowFlow"])
    ],
    dependencies: [
        .package(url: "https://github.com/stripe/stripe-ios.git", from: "23.0.0"),
    ],
    targets: [
        .target(
            name: "MowFlow",
            dependencies: [
                .product(name: "StripePayments", package: "stripe-ios"),
            ],
            path: "MowFlow",
            resources: [
                .process("Assets.xcassets"),
            ]
        )
    ]
)
