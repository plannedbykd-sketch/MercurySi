# CHECKPOINTS.md

- [x] Materialize `crates/liquid_ffi` (`arena.rs`, `core_logic.rs`, `c_abi.rs`, `jni_bridge.rs`, `liquid_kernel.h`, `module.modulemap`)
- [x] Materialize `.cargo/config.toml` with 16 KiB ELF page-size alignment (`-z max-page-size=16384`)
- [x] Materialize `android-liquid-aar` (`build.gradle.kts`, `AndroidManifest.xml`, `proguard-rules.pro`, `LiquidKernelBridge.kt`)
- [x] Materialize `ios-liquid-kit` (`Package.swift`, `LiquidKernel.swift`)
- [x] Materialize build scripts (`scripts/build_android_hybrid.sh`, `scripts/build_ios_xcframework.sh`)
- [ ] Execute `cargo test --manifest-path crates/liquid_ffi/Cargo.toml` on host with Rust toolchain
- [ ] Execute `./scripts/build_android_hybrid.sh` on host with Android NDK + Gradle
- [ ] Execute `./scripts/build_ios_xcframework.sh` + `swift build --package-path ios-liquid-kit` on macOS
