// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MowGo",
    platforms: [.iOS(.v17)],
    targets: [
        .target(
            name: "MowGo",
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
