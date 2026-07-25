// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MowFlow",
    platforms: [.iOS(.v17)],
    dependencies: [
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
        ),
    ]
)
