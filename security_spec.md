# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. `/users/{userId}` can only be read (`get`), created, updated, or deleted by the authenticated owner whose `request.auth.uid == userId` AND `request.auth.token.email_verified == true`.
2. `list` queries on `/users` are strictly denied (`allow list: if false;`) to prevent account enumeration or PII scraping.
3. `uid` must match `userId` and `request.auth.uid`, and is immutable after creation (`incoming().uid == existing().uid`).
4. `createdAt` must equal `request.time` on creation and is immutable on update; `updatedAt` must equal `request.time` on creation and update.
5. Only whitelisted keys (`uid`, `displayName`, `email`, `providerId`, `themePreference`, `createdAt`, `updatedAt`) are allowed; shadow fields (e.g., `role`, `isAdmin`, `isVerified`) are rejected.

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated `get` on `/users/userA` -> `PERMISSION_DENIED`
2. Cross-user `get` on `/users/userB` signed in as `userA` -> `PERMISSION_DENIED`
3. Collection `list` query on `/users` -> `PERMISSION_DENIED`
4. Unverified email write (`email_verified == false`) -> `PERMISSION_DENIED`
5. Shadow field injection (`{ ..., isAdmin: true }`) on create -> `PERMISSION_DENIED`
6. Identity spoofing (`{ uid: "userB" }`) under `/users/userA` -> `PERMISSION_DENIED`
7. Oversized `displayName` (> 80 chars) -> `PERMISSION_DENIED`
8. Invalid `themePreference` (`"neon-purple"`) -> `PERMISSION_DENIED`
9. Invalid `providerId` (`"anonymous"`) -> `PERMISSION_DENIED`
10. Client-forged `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`
11. Mutating `uid` or `createdAt` on `update` -> `PERMISSION_DENIED`
12. Path poisoning (`/users/..invalid..id..`) violating `isValidId` -> `PERMISSION_DENIED`
