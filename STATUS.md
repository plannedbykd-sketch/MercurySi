# STATUS.md — LiquidOS Hybrid Recovery & Build Workbench

## Claim Taxonomy
- **EXECUTED**: TypeScript PaR v1.0 validator, canonical SHA-256 chain engine, WireGuard 5-field MTU packer, Vite SPA build (`npm run build`), and `tsc --noEmit` verification.
- **PLANNED**: Native Rust `cargo test` / `cargo ndk` (`aarch64-linux-android`), Android Gradle `:android-liquid-aar:assembleRelease` / `:app:bundleRelease`, and macOS `xcodebuild -create-xcframework` / `swift build` (toolchains not present in container).
- **MOCK**: None (browser workbench runs real WebCrypto SHA-256 and deterministic validation logic on user or fixture JSON).
- **STUB**: None in `crates/liquid_ffi`; legacy `sovereign_dispatcher.py` non-MicroVM branch remains flagged in Gap #9.
