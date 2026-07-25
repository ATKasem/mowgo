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
            ],
            swiftSettings: [
                .define("SUPABASE_URL_VALUE", to: "\"https://vqgiynfrpsqddjrayczc.supabase.co\""),
                .define("SUPABASE_ANON_KEY_VALUE", to: "\"sb_publishable_C10u9M0wmcgAqDgkZoxm6g_eAsQSjpz\""),
            ]
        ),
    ]
)
