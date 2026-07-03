# WuWa IMM Custom

> Review preview — unofficial custom fork of Integrated Mod Manager.

WuWa IMM Custom extends the original IMM with a visual library and Wuthering Waves-oriented workflows for large mod collections. This repository and its test builds contain **no game mods**.

## Upstream and credits

Based on [Integrated Mod Manager](https://github.com/jpbhatt21/integrated-mod-manager) by **jpbhatt21 / YourBadLuck**.

- Original repository: https://github.com/jpbhatt21/integrated-mod-manager
- Original GameBanana page: https://gamebanana.com/mods/593490
- Mod loader ecosystem: [XXMI Launcher](https://github.com/SpectrumQT/XXMI-Launcher), WWMI and 3DMigoto

This fork is unofficial and is being shared so the upstream author can test and review the implementation. Its development was directed by NooriSeiros with extensive AI-assisted implementation and testing.

The upstream repository currently contains no license file. No additional license is claimed here; redistribution terms remain subject to the upstream author's permission and review.

## Main additions

- Visual character library with large character and mod cards.
- Favorites and active Normal mods sorted to the front.
- Character subgroups such as Aemeth/Mecha, Cartethyia/Flourdelys and Rover variants.
- Resizable sidebars, compact navigation, themes and PT-BR localization.
- In-game preview capture with crop confirmation.
- Preset Gallery with editable contents, covers, Cycler state and effect-color state.
- No-reload Cycler generation with per-character navigation, automatic cycling and shuffle modes.
- Mod Looks: saved persistent hotkey-variable configurations per mod.
- Effect-color controls and per-skin Rover eye/hair recolor tools.
- Persistent source/update metadata and expanded configuration import/export.
- Global shortcut customization and an always-on-top hotkey reference window.

The complete implementation overview is in [docs/CUSTOM_CHANGES.md](docs/CUSTOM_CHANGES.md).

## Test-build warning

This is a review build, not an official IMM release.

- Back up IMM and mod configuration before testing.
- Advanced WWMI helpers modify or generate INI files and may require a manual F10 reload.
- Cycler and recolor features are experimental and depend on current WWMI/3DMigoto behavior.
- The custom build uses its own application identity and local data folder, so it does not overwrite the official IMM installation data.
- The official IMM updater is disabled in this build.

## Development

Requirements:

- Node.js 22 or newer
- Rust stable toolchain
- Microsoft C++ Build Tools
- Microsoft Edge WebView2 Runtime

```powershell
npm ci
npm.cmd run type-check
npm.cmd run build
cargo check --manifest-path src-tauri/Cargo.toml
npm.cmd run tauri:build
```

Development mode requires administrator permissions for some mod-folder operations:

```powershell
npm.cmd run tauri:dev
```

## Review status

The immediate goal is upstream code review and discussion about which features belong in IMM itself and which could become optional plugins. Large features should be reviewed and proposed separately rather than merged as one monolithic pull request.

Please report issues with reproduction steps, logs and the affected feature. Do not include copyrighted mod files in issues.
