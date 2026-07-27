// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MowGo",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(url: "https://github.com/stripe/stripe-ios.git", from: "23.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "MowGo",
            dependencies: [
                .product(name: "StripePayments", package: "stripe-ios"),
            ],
            path: "MowGo",
            resources: [
                .process("Assets.xcassets"),
            ]
        ),
    ]
)
