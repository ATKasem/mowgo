// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MowGo",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(url: "https://github.com/stripe/stripe-ios.git", "23.2.0"..<"24.0.0"),
    ],
    targets: [
        .target(
            name: "MowGo",
            dependencies: [
                .product(name: "StripePayments", package: "stripe-ios"),
                .product(name: "StripePaymentSheet", package: "stripe-ios"),
            ],
            path: "MowGo",
            resources: [
                .process("Assets.xcassets"),
            ]
        ),
        .testTarget(
            name: "MowGoTests",
            dependencies: ["MowGo"],
            path: "Tests",
            exclude: ["theme_audit.sh"]
        ),
    ]
)
