# WuWa IMM Custom - technical audit notes

This audit records code quality issues, stale leftovers, incomplete features, and publication risks found during review. It was later updated after the cleanup pass requested by the user.

## Validation performed

- `npm.cmd run type-check`: passed after cleanup.
- `npm.cmd run build`: run after cleanup during final validation.
- `cargo check`: passed after cleanup, with the old Rust warning removed.
- `npm.cmd run lint`: now runs `type-check` and passes.

## Cleanup applied after this audit

- Removed active preset `scope`, `pinned`, and `pinnedMods` fields from the custom preset schema and creation/edit flows.
- Kept `cycler_pin` tag cleanup only as legacy data migration, so old tags are silently removed when touched.
- Corrected comments around preset hotkeys and F10: the app applies presets and prepares the notice, but the user reloads WWMI manually.
- Removed the Tauri `devtools` feature and the capability that allowed internal devtools toggling.
- Fixed the Rust `std::env` warning in `src-tauri/src/main.rs`.
- Replaced the broken ESLint scripts with a working TypeScript check alias.
- Reduced noisy direct `console.log` usage; normal app logging now goes through the tracing logger and only mirrors to browser console when `localStorage.imm-debug-logs` is set to `"1"`.

## High priority before public release

### 1. Upstream license is unclear

The upstream GitHub repository is public, but this local checkout does not contain a `LICENSE` file and `package.json` does not declare a license.

Impact:

- Public GitHub source is not automatically permission to redistribute modified binaries.
- Publishing a public fork or executable without permission is risky.

Recommended action:

- Ask the original IMM author for permission before public distribution.
- If permission is granted, request a clear license or written redistribution terms.
- Keep credits and links to upstream in the README and About screen.

### 2. Public review identity

Status: resolved for the review build.

- Product name and window title are `WuWa IMM Custom`.
- Bundle identifier is `com.nooriseiros.wuwa-imm-custom`.
- Local application data is isolated under `WuWa IMM Custom`.
- The upstream updater endpoint and updater artifacts are disabled.
- Deep links use the separate `wuwa-imm-custom` scheme.

These changes prevent the review build from presenting itself as the official IMM or overwriting its local configuration.
- Consider changing deep-link schemes.

### 3. Broad filesystem and opener permissions

Tauri capabilities include:

- `fs:read-all`
- `fs:write-all`
- `fs:scope` with `**/*`
- `opener:allow-open-path` with `**/*`
- `assetProtocol.scope` with `**`

Impact:

- Practical for a local mod manager, but too broad for a public release without a careful security note.
- If any web content or parsed remote content gets a path/opening bug, the damage scope is large.

Recommended action:

- Narrow FS scope to configured mod/launcher directories where possible.
- Keep broad scope only if absolutely needed and document it.

### 4. CSP is disabled

Status after cleanup: unchanged for now. A strict CSP should be designed separately because this app renders local assets, remote preview images, and user-selected filesystem content.

`tauri.conf.json` uses:

```json
"csp": null
```

Impact:

- Easier during development, but weaker for a release app that renders online descriptions/images.

Recommended action:

- Add a stricter CSP before public release, especially for the Hui custom version.

### 5. Devtools feature was enabled in Tauri dependency

Status after cleanup: resolved. The Rust `devtools` feature and the internal devtools capability were removed.

Cargo previously enabled Tauri feature `devtools`.

Impact:

- Useful during development.
- Not ideal for a public release build.

Recommended action: completed.

## Stale or misleading code/comments

### 1. Preset reload comments mentioned automatic F10

Status after cleanup: resolved. Comments now say the user reloads WWMI manually.

Files:

- `src/utils/presetRuntime.ts`
- `src/utils/filesys.ts`

The code tells the user to press F10 manually, and the comments now match that behavior.

Impact:

- Confuses future maintenance.
- Could lead someone to re-add automatic key sending accidentally.

Recommended action: completed.

### 2. Old `pin/pinned/cycler_pin` residue

Status after cleanup: mostly resolved. New presets no longer create `pinned` or `pinnedMods`; `cycler_pin` remains only as a legacy cleanup tag.

Files:

- `src/utils/types.ts`
- `src/_Main/PreviewerLocal.tsx`
- `src/utils/presetRuntime.ts`
- `src/utils/filesys.ts`
- `src/_RightSidebar/RightLocal.tsx`

The UI pin feature was removed. New preset data no longer creates:

- `pinned`
- `pinnedMods`

The old `cycler_pin` tag is still removed when touched, as legacy cleanup.

Impact:

- Old saved configs/backups may still contain these fields.
- Active code no longer creates `pinned` or `pinnedMods`.

Recommended action: completed for active code; old user config files can be migrated later if desired.

### 3. Old preset scope residue remains

Status after cleanup: resolved for active preset schema and creation/edit flows.

Files:

- `src/utils/types.ts`
- `src/_Main/PreviewerLocal.tsx`

The visible scope feature was rejected, and active preset creation/editing no longer writes it.

Impact:

- Old saved configs may still contain `scope`.

Recommended action: completed for active code; old user config files can be migrated later if desired.

### 4. Existing Rover eye/hair documentation is partly stale

Status after cleanup: partially addressed. The document now says it is a technical history/current-design note and not a final compatibility guarantee.

File:

- `docs/ROVER_EYE_HAIR_RECOLOR.md`

It still mentions older texture/resource names and optimistic compatibility notes that no longer fully match the current generated variant system.

Impact:

- Useful history, but not fully reliable as current user-facing documentation.

Recommended action:

- Rename it to a technical history note or update it after the Rover recolor system stabilizes.

## Debug/noisy code

Several noisy direct `console.log` calls were found in production code, including:

- `src/utils/filesys.ts`
- `src/_Main/MainLocal.tsx`
- `src/_RightSidebar/RightLocal.tsx`
- `src/_RightSidebar/RightOnline.tsx`
- `src/_RightSidebar/components/ModPreview.tsx`
- `src/_RightSidebar/components/ModPreferences.tsx`
- `src/utils/theme.ts`

Examples:

- category search index test logs;
- mod toggle logs;
- deep link logs;
- preview debug logs;
- raw selected mod preference logs.

Impact:

- Noisy user logs.
- Harder support/debugging.
- Could expose local paths in logs.

Recommended action: mostly completed. Normal informational logs now go through the tracing logger; console mirroring is gated behind `localStorage.imm-debug-logs = "1"`.

## Broken or incomplete tooling

### 1. Lint script is present but unusable

Status after cleanup: resolved pragmatically. `npm run lint` now runs the TypeScript check instead of calling a missing ESLint binary.

`package.json` previously had:

```json
"lint": "npm run type-check"
```

but `eslint` was not installed/resolved.

Impact:

- CI/release quality check cannot rely on lint.

Recommended action: completed pragmatically by making `npm run lint` call `npm run type-check`.

### 2. Rust warning

Status after cleanup: resolved.

`cargo check` reports:

```text
unused import: std::env
```

in `src/main.rs`.

Impact:

- Minor, but should be cleaned before release.

## Potentially risky generated `.ini` architecture

### 1. Rover eye/hair recolor may still be flagged by WWMI

The heavy early implementation was reduced, but the add-on still uses global texture hash overrides in generated `.ini`.

Impact:

- WWMI may still show performance warnings for certain generated override patterns.
- Some skin-specific compatibility patches are fragile.

Recommended action:

- Keep Rover eye/hair recolor marked experimental.
- Prefer per-skin compatibility resources over broad global override expansion.

### 2. Cycler modifies user mod `.ini` files

Cycler patches mod `.ini` files and stores backups using `.wuwa-imm-cycler.bak`.

Impact:

- Powerful, but risky if the patcher misses an edge case.
- Requires robust cleanup if mods leave Cycler or if the app crashes.

Recommended action:

- Add a dedicated "Repair Cycler patches" / "Restore Cycler backups" maintenance action before public release.

## Data compatibility concerns

- Preset schema has grown organically.
- Old fields remain (`scope`, `pinned`, `pinnedMods`).
- Some data is stored in `DATA` tags rather than a dedicated custom namespace.

Impact:

- Harder migration between original IMM, Custom, and Hui Custom.
- Accidental old-field behavior can reappear.

Recommended action:

- Add a documented schema version for custom preset/data fields.
- Add migration code for old custom builds.

## Release hygiene

Before publishing, remove or verify:

- local log files;
- `dist` if source release should build fresh;
- `run-dev-admin.bat` if not meant for users;
- any generated local config/backups;
- any bundled private/custom mod assets;
- updater keys/endpoints that still point upstream.

## Summary

The project builds and the main custom systems are integrated, but it is not yet publication-clean. The biggest blockers are legal permission/licensing, upstream identity/updater settings, broad Tauri permissions, stale preset pin/scope schema, and misleading comments around F10/reload behavior.
