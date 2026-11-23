#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JNI_OUT="${ROOT_DIR}/android-liquid-aar/src/main/jniLibs"

rustup target add aarch64-linux-android

cargo ndk \
  -t arm64-v8a \
  -p 26 \
  -o "${JNI_OUT}" \
  build --manifest-path "${ROOT_DIR}/crates/liquid_ffi/Cargo.toml" \
  --features android-jni \
  --release

SO_FILE="${JNI_OUT}/arm64-v8a/libliquid_kernel.so"
echo "[verify] Checking exported JNI symbols & 16 KiB ELF alignment..."
if command -v llvm-readelf >/dev/null 2>&1; then
  llvm-readelf -l "${SO_FILE}" | grep -E "LOAD|Align"
fi
nm -D "${SO_FILE}" | grep "Java_com_liquidos_kernel_LiquidKernelBridge"

echo "[gradle] Building hardened .aar (and app .aab if :app exists)..."
(cd "${ROOT_DIR}" && ./gradlew :android-liquid-aar:assembleRelease)
