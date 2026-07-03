# WuWa IMM Custom 3.1.0 Review 1

This prerelease is provided for testing and upstream code review. It is not an official Integrated Mod Manager release.

## Included

- Visual character and mod library
- Preset Gallery
- Cycler integration and controls
- Mod Looks
- In-game preview capture
- Effect-color tools
- Rover eye/hair recolor tools
- Custom shortcuts and hotkey overlay
- Resizable sidebars, themes and Brazilian Portuguese localization
- Expanded import/export and source metadata tracking

## Safety and isolation

- No mods or personal configuration files are included.
- The build uses the separate `WuWa IMM Custom` identity and local-data directory.
- The official IMM updater is disabled.
- Back up existing mod configuration before testing advanced WWMI features.
- F10 reload remains a manual user action where indicated.

## Validation

- `npm.cmd run type-check`
- `npm.cmd run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm.cmd run tauri:build`

Installer SHA-256:

`BF9F2CC218563A2C8952407F2B5CC48CD1D006D8432AB93B02469F3AD11339AC`
