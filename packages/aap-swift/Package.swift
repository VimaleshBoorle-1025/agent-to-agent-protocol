// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AAPKit",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
        .tvOS(.v16),
        .watchOS(.v9),
    ],
    products: [
        .library(name: "AAPKit", targets: ["AAPKit"]),
    ],
    dependencies: [
        // Apple's swift-crypto for Ed25519 + HKDF
        .package(url: "https://github.com/apple/swift-crypto", from: "3.0.0"),
    ],
    targets: [
        .target(
            name: "AAPKit",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
            ]
        ),
        .testTarget(
            name: "AAPKitTests",
            dependencies: ["AAPKit"]
        ),
    ]
)
