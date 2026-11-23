import cargoConfigRaw from '../../.cargo/config.toml?raw';
import cargoTomlRaw from '../../crates/liquid_ffi/Cargo.toml?raw';
import libRsRaw from '../../crates/liquid_ffi/src/lib.rs?raw';
import arenaRsRaw from '../../crates/liquid_ffi/src/arena.rs?raw';
import coreLogicRsRaw from '../../crates/liquid_ffi/src/core_logic.rs?raw';
import cAbiRsRaw from '../../crates/liquid_ffi/src/c_abi.rs?raw';
import jniBridgeRsRaw from '../../crates/liquid_ffi/src/jni_bridge.rs?raw';
import liquidHeaderRaw from '../../crates/liquid_ffi/include/liquid_kernel.h?raw';
import moduleMapRaw from '../../crates/liquid_ffi/include/module.modulemap?raw';
import androidManifestRaw from '../../android-liquid-aar/src/main/AndroidManifest.xml?raw';
import buildGradleRaw from '../../android-liquid-aar/build.gradle.kts?raw';
import proguardRaw from '../../android-liquid-aar/proguard-rules.pro?raw';
import kotlinBridgeRaw from '../../android-liquid-aar/src/main/kotlin/com/liquidos/kernel/LiquidKernelBridge.kt?raw';
import packageSwiftRaw from '../../ios-liquid-kit/Package.swift?raw';
import swiftWrapperRaw from '../../ios-liquid-kit/Sources/LiquidKernelKit/LiquidKernel.swift?raw';
import buildAndroidShRaw from '../../scripts/build_android_hybrid.sh?raw';
import buildIosShRaw from '../../scripts/build_ios_xcframework.sh?raw';

export interface HybridArtifactFile {
  path: string;
  target: 'Rust FFI Core' | 'Android AAR/AAB' | 'iOS XCFramework' | 'Build Scripts';
  language: string;
  purpose: string;
  content: string;
}

export const HYBRID_ARTIFACT_FILES: HybridArtifactFile[] = [
  {
    path: '.cargo/config.toml',
    target: 'Rust FFI Core',
    language: 'toml',
    purpose: '16 KiB ELF page alignment (-z max-page-size=16384) for Google Play Android targets.',
    content: cargoConfigRaw,
  },
  {
    path: 'crates/liquid_ffi/Cargo.toml',
    target: 'Rust FFI Core',
    language: 'toml',
    purpose: 'Shared cdylib + staticlib manifest with optional android-jni feature and size-optimized LTO profile.',
    content: cargoTomlRaw,
  },
  {
    path: 'crates/liquid_ffi/src/lib.rs',
    target: 'Rust FFI Core',
    language: 'rust',
    purpose: 'Strict #![deny(warnings, clippy::all, clippy::unwrap_used)] crate root.',
    content: libRsRaw,
  },
  {
    path: 'crates/liquid_ffi/src/arena.rs',
    target: 'Rust FFI Core',
    language: 'rust',
    purpose: '64-bit generational handle arena + Mutex serialization + legacy Swift chain verifier.',
    content: arenaRsRaw,
  },
  {
    path: 'crates/liquid_ffi/src/core_logic.rs',
    target: 'Rust FFI Core',
    language: 'rust',
    purpose: 'Canonical Turn 09/19 SHA-256 append, PaR v1.0 validator, and 1,232-byte WireGuard 5-field packer.',
    content: coreLogicRsRaw,
  },
  {
    path: 'crates/liquid_ffi/src/c_abi.rs',
    target: 'Rust FFI Core',
    language: 'rust',
    purpose: 'C-ABI POD structs (LiquidOwnedBuf) and std::panic::catch_unwind FFI boundary.',
    content: cAbiRsRaw,
  },
  {
    path: 'crates/liquid_ffi/src/jni_bridge.rs',
    target: 'Rust FFI Core',
    language: 'rust',
    purpose: 'Android JNI exports using DirectByteBuffer zero-copy reads.',
    content: jniBridgeRsRaw,
  },
  {
    path: 'crates/liquid_ffi/include/liquid_kernel.h',
    target: 'Rust FFI Core',
    language: 'c',
    purpose: 'C header consumed by SwiftPM XCFramework and KMP cinterop.',
    content: liquidHeaderRaw,
  },
  {
    path: 'crates/liquid_ffi/include/module.modulemap',
    target: 'Rust FFI Core',
    language: 'text',
    purpose: 'Clang modulemap exposing CLiquidKernel to Swift.',
    content: moduleMapRaw,
  },
  {
    path: 'android-liquid-aar/build.gradle.kts',
    target: 'Android AAR/AAB',
    language: 'kotlin',
    purpose: 'Android library module targeting minSdk 26, arm64-v8a, and R8 release minification.',
    content: buildGradleRaw,
  },
  {
    path: 'android-liquid-aar/src/main/AndroidManifest.xml',
    target: 'Android AAR/AAB',
    language: 'xml',
    purpose: 'Minimal manifest retaining only INTERNET permission.',
    content: androidManifestRaw,
  },
  {
    path: 'android-liquid-aar/proguard-rules.pro',
    target: 'Android AAR/AAB',
    language: 'proguard',
    purpose: 'R8 keep guards preserving LiquidKernelBridge native JNI signatures.',
    content: proguardRaw,
  },
  {
    path: 'android-liquid-aar/src/main/kotlin/com/liquidos/kernel/LiquidKernelBridge.kt',
    target: 'Android AAR/AAB',
    language: 'kotlin',
    purpose: 'Kotlin JNI facade with DirectByteBuffer allocation helper.',
    content: kotlinBridgeRaw,
  },
  {
    path: 'ios-liquid-kit/Package.swift',
    target: 'iOS XCFramework',
    language: 'swift',
    purpose: 'SwiftPM package linking LiquidKernel.xcframework binaryTarget.',
    content: packageSwiftRaw,
  },
  {
    path: 'ios-liquid-kit/Sources/LiquidKernelKit/LiquidKernel.swift',
    target: 'iOS XCFramework',
    language: 'swift',
    purpose: 'Swift wrapper using UnsafeRawBufferPointer and deinit generational cleanup.',
    content: swiftWrapperRaw,
  },
  {
    path: 'scripts/build_android_hybrid.sh',
    target: 'Build Scripts',
    language: 'bash',
    purpose: 'Compiles aarch64-linux-android .so, verifies 16 KiB ELF alignment + JNI symbols, and builds .aar.',
    content: buildAndroidShRaw,
  },
  {
    path: 'scripts/build_ios_xcframework.sh',
    target: 'Build Scripts',
    language: 'bash',
    purpose: 'Builds iOS device + simulator slices and packages LiquidKernel.xcframework.',
    content: buildIosShRaw,
  },
];
