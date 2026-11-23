export interface TopologyNode {
  id: string;
  plane: 'Client & Mobile' | 'Control & Proxy' | 'Kernel & Enclave';
  name: string;
  endpointOrTarget: string;
  keyModules: string[];
  notes: string;
}

export interface GapItem {
  id: number;
  category: 'Governance & Build' | 'Monorepo Concurrency & Bugs' | 'Hybrid FFI & Transcript';
  title: string;
  detail: string;
  remediationStatus: 'Resolved in Hybrid Core' | 'Pending Host Execution' | 'Patch Specified';
  actionSummary: string;
}

export const TOPOLOGY_NODES: TopologyNode[] = [
  {
    id: 'jarvis-ios',
    plane: 'Client & Mobile',
    name: 'JarvisUltra-Native v4 (SwiftPM / iOS)',
    endpointOrTarget: 'ios-liquid-kit -> LiquidKernel.xcframework',
    keyModules: ['KnowledgeBase.swift', 'Ledger.swift', 'ParValidator', 'LiquidKernel.swift'],
    notes: 'H_k = SHA256(R_k || H_{k-1}) legacy chain bridged into shared Rust FFI core with QUARANTINE lockout.',
  },
  {
    id: 'duality-si',
    plane: 'Client & Mobile',
    name: 'Duality.SI (Expo / React Native + Web)',
    endpointOrTarget: 'FastAPI + Expo Local Module',
    keyModules: ['11-Model Router', 'RevenueCat', 'FOUNDER_EMAILS Gate', 'JarvisOrb.tsx'],
    notes: 'Server-side founder test flags and TOOL_ALLOWLIST gating; hybrid mobile invokes Android AAR & iOS XCFramework.',
  },
  {
    id: 'origin-os',
    plane: 'Client & Mobile',
    name: 'Origin Agent OS (React 19 + TS)',
    endpointOrTarget: 'Canary -> Sanitizer -> Allocator',
    keyModules: ['engine.ts', 'screen-payload.ts', 'Honesty-First Protocol', 'DAG Workflow'],
    notes: '4-state claim taxonomy (EXECUTED, MOCK, STUB, PLANNED) and vocabulary gate.',
  },
  {
    id: 'liquid-companion',
    plane: 'Client & Mobile',
    name: 'Liquid OS Companion (KMP / Flutter)',
    endpointOrTarget: 'Room KMP + sqlite-vec (768-dim)',
    keyModules: ['GgufNnapiEngine', 'A2DEncryptionVault', 'LiquidKernelBridge.kt'],
    notes: 'Shares libliquid_kernel.so via DirectByteBuffer JNI on Android and cinterop on iOS.',
  },
  {
    id: 'lmv-desktop',
    plane: 'Control & Proxy',
    name: '@lmv/desktop Electron Main Ingest',
    endpointOrTarget: '127.0.0.1:17373',
    keyModules: ['Timing-safe Bearer Auth', 'MV3 Extension'],
    notes: 'Localhost loopback ingest barrier.',
  },
  {
    id: 'dual-verify',
    plane: 'Control & Proxy',
    name: 'dual_verify_proxy.py',
    endpointOrTarget: '127.0.0.1:11435',
    keyModules: ['27B Q6_K Primary', '9B FP16 Verifier'],
    notes: 'Two-stage primary/verifier inference proxy.',
  },
  {
    id: 'ollama-runtime',
    plane: 'Control & Proxy',
    name: 'Ollama Local Inference Runtime',
    endpointOrTarget: '127.0.0.1:11434',
    keyModules: ['Local Model Runner'],
    notes: 'Loopback inference runtime.',
  },
  {
    id: 'strata-moe',
    plane: 'Control & Proxy',
    name: 'Strata MoE Tier T6',
    endpointOrTarget: '127.0.0.1:11436',
    keyModules: ['DeepSeek-V4.1-Flash-Uncensored', '8192-token cap'],
    notes: 'T6 context cap enforced by memory_mtu_barrier.ts.',
  },
  {
    id: 'kernel-sock',
    plane: 'Control & Proxy',
    name: 'Linux SO_PEERCRED UID/PID Gate',
    endpointOrTarget: '/run/liquid/kernel.sock (AF_UNIX)',
    keyModules: ['security.rs', 'liquid_daemon.rs'],
    notes: 'Kernel socket peer credential check.',
  },
  {
    id: 'kernel-rust',
    plane: 'Kernel & Enclave',
    name: 'kernel-rust & crates/liquid_ffi',
    endpointOrTarget: 'libliquid_kernel.so / .a',
    keyModules: ['spsc.rs (#[repr(align(64))])', 'audit.rs', 'arena.rs', 'c_abi.rs', 'jni_bridge.rs'],
    notes: 'Shared 64-bit generational handle arena, catch_unwind gate, and canonical SHA-256 ledger.',
  },
  {
    id: 'par-validator',
    plane: 'Kernel & Enclave',
    name: 'PaR v1.0 Validator',
    endpointOrTarget: 'Exit 0 PASS / 1 DRIFT / 2 STRUCTURAL',
    keyModules: ['check_structure', 'validate', 'Block 19 Escrow'],
    notes: 'Enforces cold-start attestation, qualifier preservation, and non-claims.',
  },
  {
    id: 'lmv-db',
    plane: 'Kernel & Enclave',
    name: '@lmv/hooks & @lmv/db',
    endpointOrTarget: 'Rule S4 SQL AST Allowlist',
    keyModules: ['sql-parser.ts', 'LanceDB ANN', 'DuckDB (>10k rows)', 'busy_barrier.ts'],
    notes: 'Enforces SELECT/WITH allowlist and disarms load_extension.',
  },
  {
    id: 'orchestrator',
    plane: 'Kernel & Enclave',
    name: 'orchestrator/',
    endpointOrTarget: 'QEMU/KVM (-nic none, AF_VSOCK)',
    keyModules: ['orchestrate_a2a_gate.py', 'sovereign_dispatcher.py', 'golden-base.pkr.hcl'],
    notes: 'Copy-on-Write microVM isolation with QMP control.',
  },
];

export const GAP_REGISTER: GapItem[] = [
  {
    id: 1,
    category: 'Governance & Build',
    title: 'PaR v1.0 Host Execution Pending (Turn 26)',
    detail: 'par-validator/src/main.rs requires local cargo build --release and 4-case YAML matrix execution.',
    remediationStatus: 'Pending Host Execution',
    actionSummary: 'Browser TypeScript engine mirrors all 4 cases; run cargo test on host with Rust toolchain.',
  },
  {
    id: 2,
    category: 'Governance & Build',
    title: 'Three Block 19 Freeze Blockers Unresolved',
    detail: 'Inline §[X] segment split threshold, recovery escrow bond magnitudes, and named veto adjudicator.',
    remediationStatus: 'Pending Host Execution',
    actionSummary: 'Requires human institutional governance sign-off before production freeze.',
  },
  {
    id: 3,
    category: 'Hybrid FFI & Transcript',
    title: '20-Turn Mobile Play Store Pipeline Pending Compilation',
    detail: 'aarch64-linux-android libliquid_kernel.so, JNI symbol verification, .aar, and R8 .aab generation.',
    remediationStatus: 'Resolved in Hybrid Core',
    actionSummary: 'Materialized crates/liquid_ffi, .cargo/config.toml (16 KiB align), android-liquid-aar, and build_android_hybrid.sh.',
  },
  {
    id: 4,
    category: 'Monorepo Concurrency & Bugs',
    title: 'OpenAI Chat Completion Indexing TypeError',
    detail: 'sovereign_runtime_bridge.py & sovereign_inference_router.py index raw_resp["choices"]["message"]["content"].',
    remediationStatus: 'Patch Specified',
    actionSummary: 'Replace with raw_resp["choices"][0]["message"]["content"] with bounds guard.',
  },
  {
    id: 5,
    category: 'Monorepo Concurrency & Bugs',
    title: 'Concurrent Ledger Write Race',
    detail: 'Python and Rust append to audit_ledger.jsonl without exclusive flock or single-writer IPC.',
    remediationStatus: 'Resolved in Hybrid Core',
    actionSummary: 'Mobile hybrid serializes sequence & prev_hash inside Mutex<HandleArena> in Rust.',
  },
  {
    id: 6,
    category: 'Hybrid FFI & Transcript',
    title: 'Ledger Hash Format Drift Across Generations',
    detail: 'Turn 04 pipe format vs Turn 09/19 raw byte concat vs JarvisUltra Swift SHA256(R_k || H_{k-1}).',
    remediationStatus: 'Resolved in Hybrid Core',
    actionSummary: 'Unified mobile clients onto Turn 09/19 canonical append + verify_legacy_swift_chain() migration helper.',
  },
  {
    id: 7,
    category: 'Monorepo Concurrency & Bugs',
    title: 'SPSC Queue Multi-Worker Race (spsc.rs)',
    detail: 'liquid_daemon.rs uses single-producer SpscRing; multi-threaded accept workers risk tail corruption.',
    remediationStatus: 'Patch Specified',
    actionSummary: 'Upgrade socket-to-daemon ingress to MPSC or shard per-worker SPSC rings.',
  },
  {
    id: 8,
    category: 'Monorepo Concurrency & Bugs',
    title: 'Shell Quoting Injection in cloud-init',
    detail: 'orchestrate_a2a_gate.py interpolates instance_params into export K=\'V\' lines inside user-data.',
    remediationStatus: 'Patch Specified',
    actionSummary: 'Write JSON parameter file with write_files and parse safely inside guest init.',
  },
  {
    id: 9,
    category: 'Monorepo Concurrency & Bugs',
    title: 'Stubbed Non-MicroVM Handlers',
    detail: 'execute_sovereign_tool() in sovereign_dispatcher.py returns {"executed": True} when requires_microvm is false.',
    remediationStatus: 'Patch Specified',
    actionSummary: 'Dispatch against explicit TOOL_ALLOWLIST handlers or return explicit STUB error.',
  },
  {
    id: 10,
    category: 'Hybrid FFI & Transcript',
    title: 'Dunder Stripping in Raw Transcript',
    detail: 'Search.md/Search.txt transcript stripped __init__, __name__, and __import__.',
    remediationStatus: 'Patch Specified',
    actionSummary: 'Restore Python dunder methods before executing offline fine-tuning scaffold.',
  },
  {
    id: 11,
    category: 'Hybrid FFI & Transcript',
    title: 'Swift-to-Rust FFI Gap',
    detail: 'JarvisUltra-Native v4 lacked Rust C-ABI POD structs, generational handles, and catch_unwind gates.',
    remediationStatus: 'Resolved in Hybrid Core',
    actionSummary: 'Materialized c_abi.rs, arena.rs, liquid_kernel.h, module.modulemap, LiquidKernel.swift, and XCFramework script.',
  },
  {
    id: 12,
    category: 'Governance & Build',
    title: 'Platform Execution Boundary',
    detail: 'Chat/web sandbox lacks Rust/Cargo, Android NDK/Gradle, and macOS Xcode toolchains.',
    remediationStatus: 'Pending Host Execution',
    actionSummary: 'All native builds remain marked PLANNED until run locally via scripts/build_*.sh.',
  },
];

export interface TopologyEdge {
  source: string;
  target: string;
  protocol: string;
}

export const TOPOLOGY_EDGES: TopologyEdge[] = [
  { source: 'jarvis-ios', target: 'kernel-sock', protocol: 'C-ABI / SwiftPM' },
  { source: 'jarvis-ios', target: 'par-validator', protocol: 'ParArtifact JSON' },
  { source: 'duality-si', target: 'dual-verify', protocol: 'HTTP :11435' },
  { source: 'duality-si', target: 'strata-moe', protocol: 'HTTP :11436' },
  { source: 'origin-os', target: 'lmv-desktop', protocol: 'HTTP :17373' },
  { source: 'origin-os', target: 'lmv-db', protocol: 'MCP Barriers' },
  { source: 'liquid-companion', target: 'kernel-sock', protocol: 'JNI / AF_UNIX' },
  { source: 'liquid-companion', target: 'ollama-runtime', protocol: 'HTTP :11434' },
  { source: 'lmv-desktop', target: 'lmv-db', protocol: 'Rule S4 AST' },
  { source: 'dual-verify', target: 'par-validator', protocol: 'Cold-Start Gate' },
  { source: 'ollama-runtime', target: 'kernel-rust', protocol: 'SpscRing IPC' },
  { source: 'strata-moe', target: 'lmv-db', protocol: '8192 MTU Cap' },
  { source: 'kernel-sock', target: 'kernel-rust', protocol: 'SO_PEERCRED' },
  { source: 'kernel-rust', target: 'orchestrator', protocol: 'AF_VSOCK / QMP' },
  { source: 'par-validator', target: 'orchestrator', protocol: 'Exit 0/1/2 Gate' },
];

export interface SovereignPlaneSummary {
  plane: string;
  range: string;
  moduleCount: number;
  domain: string;
  highlights: string[];
}

export const SOVEREIGN_PLANES: SovereignPlaneSummary[] = [
  {
    plane: 'Plane 0',
    range: '00',
    moduleCount: 1,
    domain: 'Orchestration Master Spec',
    highlights: ['00-ultra-prompt.md', '4 Orchestration Planes', 'Sovereign Prefect'],
  },
  {
    plane: 'Plane I',
    range: '01–05',
    moduleCount: 5,
    domain: 'Memory & Bare-Metal Concurrency',
    highlights: ['AVX-512/NEON SIMD', 'Bump Arenas', 'Page-Aligned mmap', 'Lock-Free SPSC', 'io_uring/kqueue'],
  },
  {
    plane: 'Plane II',
    range: '06–10',
    moduleCount: 5,
    domain: 'Deterministic Binary & Build',
    highlights: ['SOURCE_DATE_EPOCH=0', 'Fat LTO', 'Static musl', 'W^X & Full RELRO', 'R8 / Dart Keep Guards'],
  },
  {
    plane: 'Plane III',
    range: '11–15',
    moduleCount: 5,
    domain: 'Zero-Copy FFI & POD Contracts',
    highlights: ['#[repr(C)] POD', '64-bit Gen Handles', 'Dart_PostCObject', 'Swift/JNI DirectByteBuffer', 'PyMemoryView'],
  },
  {
    plane: 'Plane IV',
    range: '16–20',
    moduleCount: 5,
    domain: 'Storage, Lockbox & Tensor Integrity',
    highlights: ['SHA-256 Vector Slabs', '3-Stage Lockbox', 'JSONL Stepper', 'GGUF Validator', 'CRC32 Guard'],
  },
  {
    plane: 'Plane V',
    range: '21–25',
    moduleCount: 5,
    domain: 'Static Analysis, Fuzzing & Lints',
    highlights: ['AST Call-Graph', 'Plane Router', 'Reactive Unions', 'ASAN/libFuzzer', '#![deny(clippy::unwrap_used)]'],
  },
  {
    plane: 'Plane VI',
    range: '26–30',
    moduleCount: 5,
    domain: 'Recon & Secret Hygiene',
    highlights: ['CIDR Allowlists', 'CT Log/DNS', 'OpenAPI/GraphQL Diff', 'APK Extractor', 'Shannon Entropy Scanner'],
  },
  {
    plane: 'Plane VII',
    range: '31–35',
    moduleCount: 5,
    domain: 'AuthN / AuthZ & Concurrency',
    highlights: ['IDOR/BFLA Matrix', 'OIDC PKCE S256', 'TOCTOU Row Lock', '__Host- Cookies/CORS', 'MFA CSPRNG'],
  },
  {
    plane: 'Plane VIII',
    range: '36–40',
    moduleCount: 5,
    domain: 'Injection & Parser Barriers',
    highlights: ['SQL/NoSQL AST Guard', 'IP-Pinning SSRF', 'SSTI Schema Guard', 'Trusted Types CSP', 'Path/Archive-Slip Guard'],
  },
  {
    plane: 'Plane IX',
    range: '41–45',
    moduleCount: 5,
    domain: 'FFI Taint, Mobile & Crypto',
    highlights: ['Checked Arithmetic', 'catch_unwind FFI Gate', 'Mobile IPC/WebView', 'XChaCha20/Argon2id', 'CycloneDX SBOM'],
  },
  {
    plane: 'Plane X',
    range: '46–50',
    moduleCount: 5,
    domain: 'Synthesis & Heuristic Hardening',
    highlights: ['Grammar Fuzzer Corpus', 'Semgrep Taint Rules', 'CVSS 4.0 Advisories', 'Regression Tests', 'Duality Postmortem'],
  },
];

