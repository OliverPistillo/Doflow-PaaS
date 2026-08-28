# Doflow Desktop V1

Doflow Desktop is a cloud-first Tauri 2 shell for `https://app.doflow.it`. It does not copy the product frontend into the installer: the local React/Vite surface owns only splash, bootstrap, profile selection, update/error states, and native window controls. The authenticated product remains the deployed Doflow web application.

## Runtime architecture

At launch, the local `bootstrap` WebView paints `#05070E` immediately and starts profile loading, update policy resolution, and remote preparation while the one-shot GSAP logo reveal runs. The remote Doflow WebView is hidden until the cloud application reports one of the versioned readiness states (`authenticated`, `needs-auth`, or `mfa`). A controlled 25-second readiness watchdog reports a recoverable network/bootstrap error; there is no artificial splash delay.

Each saved profile has an opaque UUIDv4 and its own Windows WebView2 data directory under the application data boundary. Cookies, cache, and storage therefore do not cross profile contexts. `profiles.json` stores only non-secret display metadata and is atomically replaced after strict schema validation. Passwords, session cookies, CSRF tokens, JWTs, and OAuth credentials are never copied into the registry.

The browser session model remains authoritative: the backend owns the HttpOnly session cookie, CSRF protection, `/auth/me`, MFA, and tenant authorization. Password login continues inside the fixed Doflow origin. Google login starts in the system browser, returns through an ephemeral `127.0.0.1` listener with a constant-time checked nonce, and sends only an opaque, short-lived, single-use server handoff to the fixed Doflow origin. No JWT is placed in a URL.

## Trust boundary and bridge version 1

The remote capability is pinned to exactly `https://app.doflow.it` and grants only:

- `desktop_ready`
- `register_profile_metadata`
- `request_profile_switch`
- `get_update_state`
- `install_current_verified_update`
- `start_desktop_google_oauth`

There is no remote filesystem, shell, process, generic HTTP, secret, generic updater, or generic window access. Native commands additionally validate the calling origin, bridge version, active profile, and WebView label. Navigation outside the fixed application origin is denied; safe external links are opened by the operating system.

Cloud and Desktop deploy independently. Any future cloud feature that uses native behavior must feature-detect `window.__DOFLOW_DESKTOP__`, check `bridgeVersion`, preserve a browser fallback, and tolerate older Desktop versions. Bump the bridge only for incompatible contracts and retain the previous contract for already-installed clients.

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

Local development and unsigned local bundles do not require production updater secrets. Without a compiled updater public key, update checks fail open and the cloud application remains usable unless a previously verified cached policy already establishes that the installed version is unsupported.

## Signed automatic releases

`.github/workflows/desktop-release.yml` validates Desktop changes on Windows x64. Publication is a distinct job in the protected `desktop-release` environment with only `contents: write`. It serializes releases, parses existing `desktop-v*` tags with SemVer, increments the patch without committing a version change, builds NSIS and MSI artifacts at the triggering `main` SHA, creates a draft, validates `latest.json`, artifact presence, updater signatures and tag target, attaches `desktop-policy.json`, and only then publishes.

The explicit repository/environment variable `DESKTOP_RELEASE_ENABLED` must equal `true`; otherwise validation runs and no release is created. A publish also fails before build if the updater private or public signing material is missing or structurally invalid. The updater prefers the NSIS artifact and uses passive Windows installation.

### One-time setup before the first public release

1. Generate a production updater signing key with the official Tauri signer tooling and keep the private key outside the repository.
2. Configure `TAURI_SIGNING_PRIVATE_KEY` in the `desktop-release` GitHub environment.
3. Configure `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` there if the key is password protected.
4. Configure the real public key as the environment/repository variable `TAURI_SIGNING_PUBLIC_KEY`.
5. Set `DESKTOP_RELEASE_ENABLED=true` only after the protected environment and signing values are ready.
6. Add a trusted Windows Authenticode certificate when available.

Updater signing and Windows Authenticode are separate. The former protects Doflow update integrity and is mandatory for publication. Until Authenticode is configured, Windows may show Unknown Publisher or SmartScreen warnings even for updater-signed artifacts.

The official SVG wordmark is reused from the existing Doflow frontend assets. No replacement brand asset is required for V1.
