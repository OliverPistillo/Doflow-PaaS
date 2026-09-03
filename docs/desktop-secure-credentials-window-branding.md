# Desktop secure credentials, main-window state, and brand assets

Status: Phase 1 local implementation decision record. This document contains no
credentials, customer data, or production configuration.

## Security assets and trust boundaries

The protected assets are the login password, its association with one local
Desktop profile/tenant/user tuple, the opaque browser session cookie, MFA
factors, profile-registry metadata, credential-store identifiers, and any logs,
crash reports, analytics, screenshots, or test evidence that could expose them.

The trust path is intentionally narrow:

1. the existing Next authentication form submits credentials to the existing
   backend authority;
2. only the exact `https://app.doflow.it` top-level WebView receives the
   versioned Doflow Desktop bridge;
3. dedicated Tauri commands validate the window label, exact origin, active
   profile UUID, bridge version, and authentication page before handling a
   password;
4. Rust holds an opted-in password only in zeroizing process memory until the
   fully authenticated profile metadata is registered;
5. Windows Credential Manager stores the password under a deterministic,
   application-specific target derived from profile UUID, tenant, and user;
6. the backend remains authoritative for passwords, MFA, lockout, rate limits,
   sessions, and tenant access.

The local filesystem stores only profile metadata and a separate, versioned
main-window geometry file. Neither may contain credentials, tokens, cookies,
MFA material, or a reversible credential-store secret.

## Threat analysis

| Threat | Control |
| --- | --- |
| Plaintext at rest | Passwords are stored only by Windows Credential Manager; no JSON, Web storage, database, URL, cookie, or cache fallback exists. |
| Accidental serialization/logging | Secret-bearing Rust types do not implement `Debug` or `Clone`; errors are redacted; tests use synthetic values and never print them. |
| Concurrent Windows vault operations | A short-lived keyed mutex serializes stage/store/read/invalidate/forget/profile-removal work for one validated profile target. Different targets use distinct mutexes and may progress independently; no lock is held across Web requests. |
| Generic IPC/command confusion | The remote bridge exposes named operations only. No arbitrary `invoke(command, payload)`, store enumeration, or generic keyring access is added. |
| Untrusted navigation | Existing exact-origin and active-window checks remain mandatory; credential commands additionally require the exact login route where applicable. |
| Same-origin XSS | Residual risk remains because the one-shot password must briefly cross the dedicated Auth bridge into JavaScript for the existing browser-auth flow. It is never placed in DOM, form state, storage, events, or globals, and is returned at most once per selected WebView cycle. |
| Profile or tenant confusion | Storage targets include independently validated profile UUID, tenant identity, and authenticated user identity. Reads and deletes resolve those values from the active local registry, never from client-supplied tenant/user identifiers. |
| Predictable target misuse | The target is only a non-secret locator. Rust still verifies the active profile and exact remote WebView before accessing it. |
| Retry loop or destructive false positive | A per-WebView one-shot claim prevents repeated automatic attempts. Deletion requires the typed `AUTH_INVALID_CREDENTIALS` response from exactly `/auth/login`; `/auth/me`, session expiry, handoff, application calls, network, timeout, 429, 5xx, and MFA states retain the entry and do not auto-retry during that cycle. |
| MFA bypass | A successful password response that requests MFA follows the existing MFA route. No OTP, recovery code, or MFA setup secret is stored. Credential enrollment is committed only after fully authenticated profile registration. |
| Downgrade/fallback | Secure-store failure is surfaced as an availability warning and the login continues without saving. There is no plaintext or home-grown encryption fallback. |
| Upgrade/uninstall | Stable application namespace and profile identity preserve entries across MSI/NSIS upgrades. Windows uninstall behavior does not guarantee credential removal; users can use “Dimentica password”, while profile removal always deletes its credential first. |
| Evidence leakage | Evidence uses synthetic accounts/values only; secret values and private Auth state are excluded from screenshots and reports. |

## Secure-store decision

### Selected: Windows Credential Manager through maintained Rust abstractions

The Desktop uses `keyring-core` with the platform-specific
`windows-native-keyring-store`, pinned exactly and accessed through an internal
adapter. The adapter is mockable for deterministic unit tests, while an
opt-in-safe Windows integration test exercises create/read/replace/delete with a
random synthetic entry and guaranteed cleanup. Every entry explicitly sets the
`persistence=Local` modifier, which maps to Windows
`CRED_PERSIST_LOCAL_MACHINE`; the integration test reads the stored entry
attributes and requires `persistence=Local`. The crate's Enterprise default is
therefore never relied upon. Its optional search feature is not used and default
features are disabled.

Namespace:

- service: `it.doflow.desktop.login.v1`;
- target: a versioned, unambiguous digest of `profile UUID + tenant identity +
  user identity`;
- username: a fixed application account label, because the target already
  binds the validated identity tuple.

The locator is not a secret and no email is used as the sole key.

### Alternatives rejected

- Direct DPAPI file encryption was rejected because it would require the app to
  own ciphertext lifecycle, format migration, ACLs, corruption handling, and
  crypto integration that Windows Credential Manager already provides.
- Cross-platform all-in-one keyring wrappers were not selected for this
  Windows-only release because they add unused backends and a larger dependency
  surface. The internal adapter keeps future platform work possible without
  weakening Windows behavior.
- Web storage, profile JSON, the business Credentials Vault, and custom crypto
  are prohibited: they either store login material in the wrong trust boundary
  or create an unsafe fallback.

## Credential lifecycle

- Manual login without the Desktop opt-in behaves exactly as before and clears
  any uncommitted in-memory candidate.
- After the backend reports password authentication success, an opted-in
  password is staged in zeroizing Rust memory. A failed or ambiguous login is
  never staged.
- MFA continues normally. The staged value is committed only when the existing
  fully authenticated identity flow registers the profile metadata.
- Selecting a saved profile with an expired session permits one credential
  claim from the exact active login WebView. The password is submitted directly
  to the existing login function and is never prefilled visibly.
- Only a typed invalid-credentials rejection from the exact password-login
  request removes the entry and shows the normal login. Generic 401 responses,
  `/auth/me` session expiry, handoff failures, application requests, offline,
  timeout, 429, 5xx, and MFA pending/setup conditions keep it without looping.
- A later successful opted-in login replaces the previous entry.
- “Dimentica password” deletes only the secure-store entry. Removing a profile
  deletes the entry and then the profile metadata/WebView directory.

## Main-window state decision

The user-facing main window is one logical device-local surface that alternates
between `bootstrap` and exactly one `remote-{profileUuid}` WebView. Geometry is
therefore global to the device and never keyed by user or tenant.

Only these labels participate. Incoming-call, active-call, OAuth, updater,
fixture, splash-only, and other secondary windows are excluded.

The versioned state stores normal physical-pixel bounds, maximized state,
monitor name, monitor work area, and scale factor. It never restores minimized state. Writes
are atomic and debounced, with explicit flush before hide, close, switch, or
exit. Restore uses the current monitor work area and minimum window size,
supports negative coordinates, scales saved physical bounds by the old/current
DPI ratio,
changes, and requires a meaningful visible area. A removed monitor recenters on
the primary monitor; corrupt or unsupported data falls back to defaults.

## Authoritative small-mark inventory

The workstation source was validated read-only at
`C:\Doflow-Reference_020926\marchio_logo_doflow`. It is never copied wholesale
into the repository.

The directory is outside the repository and contains exactly the two regular
SVG files listed below. No symlink, junction, reparse point, executable,
archive, raster, font, or unexpected format was found. Both SVGs use paths
only: there are no scripts, text/font dependencies, embedded raster images, or
external references.

Deterministic source-manifest SHA-256:
`2fe550d7d6aa7ccbe8e5df1470500f1a080682954f0d6d4fb0ee8dc2c5ac0c89`.

| Role | Exact source | Bytes | SHA-256 | Geometry | Canonical outputs |
| --- | --- | ---: | --- | --- | --- |
| White small mark | `marchio_logo_bianco.svg` | 965 | `2999462f624c90ad47ce080ce8c7115aa738472d74230fc29cd11bd63a2461dc` | SVG, `viewBox="0 0 107.59 39.28"`, transparent, one path, `#fefefe` | exact SVG copies for dark Web/Desktop surfaces |
| Black small mark | `marchio_logo_nero.svg` | 861 | `3c6fd0d06a59b31d15b631a53e9d7036a41d5378f90972ddb5e18fe456269313` | SVG, `viewBox="0 0 107.59 39.28"`, transparent, one path, black fill | exact SVG copies for light Web surfaces |

No color variant, raster, or full wordmark exists in the authoritative folder.
That absence is intentional and is not a blocker. The mark is never recolored,
cropped from a wordmark, or approximated in CSS.

## Surface mapping

| Surface | Mapping | Reason |
| --- | --- | --- |
| Light Web UI and light favicon | exact black SVG | Required contrast on light backgrounds. |
| Dark Web/Desktop/Calls UI and dark favicon | exact white SVG | Required contrast on dark backgrounds. |
| Theme `system` favicon | black/white exact SVG selected from the resolved theme | Matches application theme rather than only a static media query. |
| Windows executable, NSIS/MSI, shortcuts, taskbar, tray, notification | white mark centered without distortion on an opaque Doflow-dark square platform tile | These surfaces accept one static square asset and may appear on light or dark shells. The dark tile guarantees a defined contrast boundary while leaving the official white path unchanged. |
| PWA/install icon and Apple touch icon | same white-on-dark deterministic square tile | Stable install identity; runtime theme does not mutate installed icons. |
| Profile picker, status surfaces, incoming/active/loading/error Calls | exact white SVG on existing dark surfaces | Replaces small wordmark approximations while preserving Calls behavior. |
| Desktop splash | existing full Doflow wordmark | Large textual identity is intentional; not a small-mark surface. |

## Full-wordmark allowlist

Existing complete wordmarks are preserved only at these intentional, readable
sizes. They are not promoted to authoritative small-mark sources.

| Path/component | Variant | Reason |
| --- | --- | --- |
| `apps/desktop/src/components/Splash.tsx` via `src/assets/doflow-logo.svg` | complete wordmark on dark | The approved splash explicitly requires the complete Doflow name. |
| `apps/frontend/src/components/auth/auth-shell.tsx` | black/white complete wordmark | Primary authentication brand header. |
| `apps/frontend/src/components/auth/login-experience.tsx` | black/white complete wordmark | Primary login brand header. |
| `apps/frontend/src/components/team-switcher.tsx` expanded state | black/white complete wordmark | Expanded navigation has enough width and intentionally shows the full name. |
| `apps/frontend/src/features/chat/team-space-sidebar.tsx` expanded state | black/white complete wordmark | Expanded Team Space navigation has enough width. |
| `apps/frontend/src/components/tenant-collaboration/team-space-sidebar.tsx` expanded state | black/white complete wordmark | Compatibility Team Space navigation remains visually explicit. |
| `apps/frontend/src/features/commercial/components/quote-document.tsx` | black complete wordmark | Formal document masthead requires the complete supplier brand. |
| `apps/frontend/src/app/onboarding/page.tsx` | white complete wordmark | Onboarding brand header intentionally names Doflow. |
| `apps/frontend/src/app/superadmin/components/super-admin-sidebar.tsx` | black/white complete wordmark | Expanded platform-admin navigation intentionally shows the complete brand. |

Any favicon, tray, taskbar, notification, collapsed navigation, profile/status,
or Calls fallback usage is not allowlisted and must use the official small mark.

## Legacy non-Windows icon inventory

The current Tauri configuration has an explicit Windows-only icon list and the
release workflow builds only `x86_64-pc-windows-msvc` NSIS/MSI artifacts.
`icon.icns` and every file under `icons/android/` and `icons/ios/` are therefore
classified, one by one, in `scripts/doflow-brand-assets.manifest.json` as
`legacy-reference-non-canonical`. They are retained only to avoid unrelated
platform churn. The brand validator compares that declaration with the complete
on-disk inventory and rejects any current bundle or release reference to those
files. A future macOS, Android, or iOS release must regenerate its platform
assets from the two approved black/white authorities and update the manifest
before enabling that target.

The local untracked `apps/desktop/src-tauri/icons/doflow_favicon.png` is listed
only as an excluded user duplicate. It is never read, hashed, copied, staged, or
accepted as a brand authority.

## Windows notification attribution icon — accepted limitation

The initial goal was to show the official Doflow small mark both inside the
Windows Calls toast and in the small attribution row controlled by the Windows
11 shell. The application-controlled visual is complete: the Windows-specific
WinRT helper uses the deterministic packaged `notification-app-logo.png` as a
local `appLogoOverride`, while preserving the existing Calls title, body,
duration, and failure isolation. The shell-controlled attribution row may still
show Windows' generic placeholder. That placeholder is not the former blue
Doflow asset and is not treated as Doflow brand content.

The investigation covered the original Tauri/`notify-rust` path, the direct
WinRT helper, process and shortcut AUMID alignment, normal shortcut and
executable icons, NSIS/MSI metadata, and an isolated unpackaged Windows App SDK
spike. The spike reported `IsSupported`, `Register`, and `Show` success and its
notification was present in API history while
`SHQueryUserNotificationState` remained `QUNS_ACCEPTS_NOTIFICATIONS`; the shell
did not render a live banner in the valid run. The self-contained deployment
was not sustainable in the test environment, while the framework-dependent
path would add Windows App Runtime prerequisite and packaging lifecycle work.

Oliver explicitly accepted this Windows shell limitation on 3 September 2026.
Phase 1 therefore does not integrate Windows App SDK, add a manual COM toast
activator, adopt MSIX or sparse package identity, change the production
identifier, or add a new runtime prerequisite. Installer registry and shortcut
properties introduced solely to influence the attribution icon were removed;
normal Tauri product, executable, shortcut, taskbar, tray, NSIS, and MSI icons
continue to use the deterministic official asset set.

Any future attempt to change the attribution row is a separate Windows
packaging decision requiring explicit approval. This accepted limitation does
not change secure credentials, main-window state, Calls behavior, LiveKit, the
updater channel, or updater signing.

## Signing boundary

The Desktop release pipeline uses Tauri updater signatures for update integrity.
Windows Authenticode is not configured by this Phase 1 implementation. No
Authenticode certificate, key, password, or signing claim is added; locally
built NSIS/MSI packages may therefore show Unknown Publisher or SmartScreen.
