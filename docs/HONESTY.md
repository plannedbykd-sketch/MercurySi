# Honesty-First Protocol (`docs/HONESTY.md`)

1. Four-state taxonomy: `EXECUTED`, `MOCK`, `STUB`, `PLANNED`.
2. Un-cited claims (`verified`, `live`, `complete`, `operational`, `integrated`, `production`, `real-time`) are prohibited unless backed by an executed tool run in the current session.
3. Simulated or client-local preview vectors must carry explicit `DEMO` or `PLANNED` markers.
4. Platform execution boundaries (missing `cargo`, `gradle`, `xcodebuild`) must be disclosed before giving local build instructions.
