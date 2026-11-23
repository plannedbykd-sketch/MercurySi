// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LiquidKernelKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "LiquidKernelKit", targets: ["LiquidKernelKit"])
    ],
    targets: [
        .binaryTarget(
            name: "LiquidKernelBinary",
            path: "Artifacts/LiquidKernel.xcframework"
        ),
        .target(
            name: "LiquidKernelKit",
            dependencies: ["LiquidKernelBinary"],
            path: "Sources/LiquidKernelKit"
        )
    ]
)
