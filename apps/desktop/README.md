# Doflow Desktop

Doflow Desktop is a cloud-first Tauri 2 shell for `https://app.doflow.it`. It does not copy the product frontend into the installer: the local React/Vite surface owns only splash, bootstrap, profile selection, update/error states, and native window controls. The authenticated product remains the deployed Doflow web application.

## Runtime architecture

At launch, the local `bootstrap` WebView paints `#05070E` immediately and resolves the Stable updater manifest and release policy before it loads the profile registry or creates any remote WebView. If a signed newer version is available, both optional and mandatory updates start automatically, stream progress to the local surface, install passively, and restart Doflow. The old cloud application is never loaded after a valid update has been selected. Only after the updater gate returns `none`, or after an explicitly supported fallback following an update failure, does profile loading and remote preparation begin while the one-shot GSAP logo reveal completes.

The last valid release policy is cached atomically. A failed update check or installation offers retry; “Continue with this version” is allowed unless the last valid policy proves that the installed version is below `minimumSupportedVersion`. A version known to be below the minimum remains blocked. Concurrent UI requests and React StrictMode effects are coalesced in TypeScript, while the Rust updater independently rejects concurrent installations. Tauri’s updater verifies the release signature before installation and never accepts a downgrade or prerelease on the Stable channel.

Each saved profile has an opaque UUIDv4 and its own Windows WebView2 data directory under the application data boundary. Cookies, cache, and storage therefore do not cross profile contexts. `profiles.json` stores only non-secret display metadata and is atomically replaced after strict schema validation. Passwords, session cookies, CSRF tokens, JWTs, and OAuth credentials are never copied into the registry.

The browser session model remains authoritative: the backend owns the HttpOnly session cookie, CSRF protection, `/auth/me`, MFA, and tenant authorization. Password login continues inside the fixed Doflow origin. Google login starts in the system browser, returns through an ephemeral `127.0.0.1` listener with a constant-time checked nonce, and sends only an opaque, short-lived, single-use server handoff to the fixed Doflow origin. No JWT is placed in a URL.

## Trust boundary and bridge versions

The remote capability is pinned to exactly `https://app.doflow.it` and grants only:

- `desktop_ready`
- `register_profile_metadata`
- `request_profile_switch`
- `get_update_state`
- `install_current_verified_update`
- `start_desktop_google_oauth`

Bridge v2 adds only the fixed Desktop Calls commands listed by `capabilities/doflow-remote.json`; it does not widen the origin or add a generic native proxy.

There is no remote filesystem, shell, process, generic HTTP, secret, generic updater, or generic window access. Native commands additionally validate the calling origin, bridge version, active profile, and WebView label. Navigation outside the fixed application origin is denied; safe external links are opened by the operating system.

Cloud and Desktop deploy independently. The current local Phase 1 native bridge is version 3. The published Desktop 1.1.3 bridge v2 remains fully supported by the shared frontend for login, profiles, updater and Calls; the v3 secure-credential option is simply absent and all credential methods are inert. The published Desktop 1.0.1 bridge v1 remains a deliberate compatibility boundary: a small coordinator at the root cloud layout detects exactly bridge v1, reads its native update state, and invokes its already-published `installCurrentVerifiedUpdate` capability once. It is inert in normal browsers and on bridge v2 or newer, and does not expose generic Tauri invocation.

Any future cloud feature that uses native behavior must feature-detect `window.__DOFLOW_DESKTOP__`, check `bridgeVersion`, preserve a browser fallback, and tolerate older Desktop versions. Bump the bridge only for incompatible contracts and retain the previous contract for already-installed clients.

## Development and verification

Prerequisites are Node 20.19.6, pnpm 10.24.0, the stable Rust MSVC toolchain, WebView2, and Windows build tools.

```powershell
pnpm install --frozen-lockfile
pnpm desktop:type-check
pnpm desktop:test
pnpm -C apps/desktop build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm desktop:dev
```

Local development and unsigned local bundles do not require production updater secrets. Without a compiled updater public key, the updater enters its controlled unavailable state and never simulates a signed update. After the automatic attempt, the user may continue unless a valid current or cached Stable policy marks that version unsupported.

## Signed automatic releases

`.github/workflows/desktop-release.yml` validates Desktop changes on Windows x64. The closed-gate validation includes deterministic brand assets, Desktop/UI/secure-store/bridge-v2 tests, Rust formatting/clippy/tests, a RustSec audit of `Cargo.lock`, packaged Calls IPC, frontend type-check/lint/production build, and backend build. Publication is a distinct job in the protected `desktop-release` environment with only `contents: write`. It serializes releases, parses existing `desktop-v*` tags with SemVer, increments the patch without committing a version change, builds NSIS and MSI artifacts at the triggering `main` SHA, creates a draft, validates `latest.json`, artifact presence, updater signatures and tag target, attaches `desktop-policy.json`, and only then publishes.

The explicit repository/environment variable `DESKTOP_RELEASE_ENABLED` must equal `true`; otherwise validation runs and no release is created. A publish also fails before build if the updater private or public signing material is missing or structurally invalid. The updater prefers the NSIS artifact and uses passive Windows installation.

### First 1.1 Stable rollout order

The transition from the published 1.0.1 client to 1.1.0 must keep `release-policy.json` at `minimumSupportedVersion: 1.0.0` for the first 1.1.0 publication. The safe order is:

1. Keep `DESKTOP_RELEASE_ENABLED=false` while validating and merging the 1.1 updater code.
2. Deploy the frontend containing the bridge v1 compatibility coordinator to `app.doflow.it` through the separately authorized normal deployment process.
3. Reconfirm from the immutable `desktop-v1.0.1` tag that bridge v1 exposes `appVersion`, `bridgeVersion`, `getUpdateState`, and `installCurrentVerifiedUpdate`.
4. Keep the published policy minimum at 1.0.0 so 1.0.1 can load the coordinator instead of entering its old click-only mandatory screen.
5. In a separately authorized release operation, explicitly open the release gate and publish signed 1.1.0 artifacts plus `latest.json` from the exact approved SHA.
6. Start a real installed 1.0.1 client and verify automatic discovery, signed download, passive installation, and restart.
7. Verify from the tray that the restarted process reports 1.1.0 on the Stable channel.
8. Reclose the release gate according to the authorized release procedure.
9. Preserve the 1.0.0 minimum while adoption and rollback evidence are collected.
10. Only in a future release operation may `minimumSupportedVersion` be raised to 1.1.0.

This code task stops after merge and push; it does not deploy the coordinator, open the gate, publish 1.1.0, or run the signed installed-client transition.

The version shown in the local profile/update surfaces and tray menu comes from Tauri runtime package metadata; it is not independently hardcoded. The channel label is `Stable`.

### One-time setup before the first public release

1. Generate a production updater signing key with the official Tauri signer tooling and keep the private key outside the repository.
2. Configure `TAURI_SIGNING_PRIVATE_KEY` in the `desktop-release` GitHub environment.
3. Configure `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` there if the key is password protected.
4. Configure the real public key as the environment/repository variable `TAURI_SIGNING_PUBLIC_KEY`.
5. Set `DESKTOP_RELEASE_ENABLED=true` only after the protected environment and signing values are ready.
6. Treat Windows Authenticode as a separate future operation; it is not configured by this repository state.

Updater signing and Windows Authenticode are separate. The former protects Doflow update integrity and is mandatory for publication. Authenticode is not currently configured, so Windows may show Unknown Publisher or SmartScreen warnings even for updater-signed artifacts.

Small-mark branding is derived only from the approved black and white SVG authorities documented in `docs/desktop-secure-credentials-window-branding.md`; complete wordmarks remain only on the explicit allowlist.
