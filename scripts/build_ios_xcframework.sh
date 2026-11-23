#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT_DIR}/crates/liquid_ffi/Cargo.toml"
HEADERS="${ROOT_DIR}/crates/liquid_ffi/include"
OUT_XCFW="${ROOT_DIR}/ios-liquid-kit/Artifacts/LiquidKernel.xcframework"

rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios

cargo build --manifest-path "${MANIFEST}" --release --target aarch64-apple-ios
cargo build --manifest-path "${MANIFEST}" --release --target aarch64-apple-ios-sim
cargo build --manifest-path "${MANIFEST}" --release --target x86_64-apple-ios

SIM_FAT_DIR="${ROOT_DIR}/target/ios-sim-fat/release"
mkdir -p "${SIM_FAT_DIR}"
lipo -create \
  "${ROOT_DIR}/target/aarch64-apple-ios-sim/release/libliquid_kernel.a" \
  "${ROOT_DIR}/target/x86_64-apple-ios/release/libliquid_kernel.a" \
  -output "${SIM_FAT_DIR}/libliquid_kernel.a"

rm -rf "${OUT_XCFW}"
mkdir -p "$(dirname "${OUT_XCFW}")"

xcodebuild -create-xcframework \
  -library "${ROOT_DIR}/target/aarch64-apple-ios/release/libliquid_kernel.a" -headers "${HEADERS}" \
  -library "${SIM_FAT_DIR}/libliquid_kernel.a" -headers "${HEADERS}" \
  -output "${OUT_XCFW}"

echo "[done] Generated ${OUT_XCFW}"
