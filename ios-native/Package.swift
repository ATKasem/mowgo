// swift-tools-version: 5.9
//
//  Package.swift
//  MowFlow
//
//  SPM manifest — enables building without a .xcodeproj.
//  To use in Xcode: File → Open → select THIS file (Package.swift).
//
//  Build settings required (set in Xcode or xcconfig):
//    SUPABASE_URL=https://vqgiynfrpsqddjrayczc.supabase.co
//    SUPABASE_ANON_KEY=sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz
//    StripePublishableKey=pk_live_...

import PackageDescription

let package = Package(
    name: "MowFlow",
    platforms: [.iOS(.v17)],
    products: [
        .executable(name: "MowFlow", targets: ["MowFlow"])
    ],
    dependencies: [
        // Stripe iOS SDK — for PaymentSheet
        .package(url: "https://github.com/stripe/stripe-ios.git", from: "23.0.0"),
    ],
    targets: [
        .executableTarget(
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
