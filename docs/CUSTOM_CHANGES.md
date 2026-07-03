# WuWa IMM Custom - changes from upstream IMM

This document describes the custom behavior added on top of the original Integrated Mod Manager.

## Project intent

WuWa IMM Custom is an unofficial fork of Integrated Mod Manager whose custom features focus on Wuthering Waves. The original multi-game selector remains available, while the custom Cycler, recolor, capture, and visual-library workflows are designed for WWMI.

This fork does not include game mods by itself. It manages local mod folders and generates WWMI/3DMigoto `.ini` helper files when features such as Cycler, effect colors, and Rover eye/hair colors are used.

## Major UI changes

- The original multi-game selector is retained; most custom workflows focus on Wuthering Waves.
- The Installed view was rebuilt around a visual character library.
- Character folders are shown as large cards with character images.
- Character cards can be favorited; favorites rise to the top.
- Mod cards are larger than upstream IMM and prioritize preview visibility.
- Enabled Normal mods rise to the beginning of the character's Normal list.
- Characters can be filtered by a compact A-Z strip. Clicking a selected letter again clears the filter.
- Many scroll areas support drag scrolling with inertia.
- The left sidebar can be resized.
- The right sidebar can be resized.
- The old always-visible sections were reorganized to reduce clutter.
- Start Game was moved to the top area and visually changes by game state.
- Settings moved near the window controls.
- Theme dropdown was added with Wuthering Waves inspired themes:
  - Spectro
  - Pneuma
  - Voltaic
  - Aniquilant
  - Criogenic
  - Termic

## Preview capture

- Ctrl+click on a mod card starts a preview capture flow.
- IMM minimizes, brings the game forward, and opens a capture overlay.
- Left drag selects the capture rectangle.
- Holding right click pauses the overlay so the user can move the in-game camera.
- After capture, a confirmation screen shows the crop before saving.
- If accepted, the image is saved as `preview.png` in the mod folder.
- Existing preview images are moved into `_preview_backups/<timestamp>`.
- Preset covers can also be captured with the same capture system.

## Config import/export additions

- The existing Settings import/export flow is still used; no separate backup format was added.
- Exported `configWW.json` files now also include:
  - a manifest of local mod folders known by the app;
  - source/update metadata when available;
  - all current custom hotkeys;
  - presets, as in the original/custom config flow.
- Import restores presets and custom hotkeys through the same Config Import button.
- After import, the app compares the exported mod manifest against the current local Mods folder.
- Mods that existed in the imported config but are missing locally appear in the Installed/Updates dialog under `Missing from import`.
- Missing entries do not contain mod files; they are references that help the user identify what must be downloaded again.
- If a missing entry has a supported online source, the `Open online` button opens that mod so it can be downloaded again.

## Character organization

- Extra non-character library categories were added:
  - Motorbike
  - Wings
  - Weapons
  - Utility
  - Other
  - Uncategorized
- Some character folders can have internal subgroups, such as:
  - Aemeth / Mecha
  - Cartethyia / Flourdelys
  - Rover / Uniform / Eye/Hair inside Rover Female
- These subgroup rules are also used by collision detection, so compatible model variants and the composable Rover eye/hair addon are not reported as outfit conflicts.

## Cycler

The Cycler is a custom no-reload skin cycling system built around generated WWMI/3DMigoto `.ini` files.

Main behavior:

- Mods can be moved between Normal and Cycler.
- Normal means the mod works like a normal enabled skin.
- Cycler means several skins for the same character can stay active and be swapped by Cycler hotkeys.
- Normal and Cycler are mutually exclusive per character to avoid broken in-game visuals.
- Rebuild Cycler is manual. It no longer auto-runs on every add/remove/pin action.
- F11 triggers Rebuild Cycler from the app/global shortcut path.
- Alt+click on a mod card toggles it between Normal and Cycler.
- Cycler hotkeys are customizable from Settings.
- Cycler hotkey changes trigger a Cycler rebuild only when Confirm is clicked.
- Cycler does not intentionally send F10 or gameplay input to the game. The user reloads WWMI manually with F10.

Default/customizable Cycler actions:

- Next
- Previous
- Random
- Auto Cycle
- Auto Shuffle

Auto Cycle and Auto Shuffle use the same timer configured from the right sidebar.

## In-game overlay notices

Generated overlay images are used for small in-game status notices through WWMI/3DMigoto:

- Auto Cycle ON/OFF
- Auto Shuffle ON/OFF
- Preset activated notice

These are rendered by generated `.ini` files and image assets. They are not direct game input automation.

## Hotkeys

- Settings contains a Custom Hotkeys area.
- Custom hotkeys are edited in a larger modal rather than inline.
- The same editor also includes Click Shortcuts for hidden mouse actions such as preview capture, opening Mod Looks, and moving mods between Normal/Cycler.
- Global hotkeys can be used while the game is focused, where supported by Tauri global shortcuts.
- Alt+K opens a draggable hotkey helper overlay for the currently relevant active mod.
- The hotkey helper is blocked when Auto Cycle is active, because the currently visible Cycler skin may be changing automatically.

## Mod Looks

Mod Looks are a separate per-mod save system for outfits/variants controlled by a mod's own hotkey variables.

Use case:

- A mod such as Astral Modulator may have several internal clothing combinations controlled by its own hotkeys.
- Instead of remembering which hotkeys created a specific appearance, the user can save that current variable state as a Look.
- Looks are intentionally not called presets inside the UI, to avoid confusion with the main Preset Gallery.

How to use:

- Middle click a mod card to open its Mod Looks area by default. This click shortcut can be customized in Settings.
- Use `Save current Look` after configuring the mod in-game with its own hotkeys.
- Rename, duplicate, delete, or apply saved Looks from that mod's Look cards.
- Ctrl+click a Look card preview area by default to capture or replace that Look's image using the same in-game crop flow used for mod previews and preset covers. This click shortcut can also be customized in Settings.
- Applying a Look writes the saved persistent WWMI/3DMigoto variable values back into IMM/WWMI config.
- Applying a Look does not send key input to Wuthering Waves. If the mod is currently enabled, reload WWMI manually with F10.

Limitations:

- Looks only work for mod variables that IMM/WWMI can read from the mod's `.ini` and persistent prefs.
- Mods without persistent hotkey variables may show no values to save.

## Preset Gallery

The original preset system was reworked into a visual Preset Gallery.

Current behavior:

- Presets are displayed as cards.
- Presets can be created from current setup.
- Presets can be renamed.
- Presets can be duplicated.
- Presets can be deleted from the card.
- Presets can have custom captured covers.
- Preset details can be opened.
- Inside a preset, characters are shown as cards.
- Opening a character shows the mods inside that preset.
- Mods can be added to a preset through the existing search-like flow.
- Normal/Cycler conflict rules are enforced before saving/applying.
- Presets can store:
  - Normal active mods
  - Cycler mods
  - Cycler timer
  - Effect color configs

## Effect colors

The right sidebar has a Cycler / Colors tab area.

Effect Colors:

- Can be enabled per mod/skin.
- RGB multiplier and RGB offset sliders are saved per mod.
- Color presets are organized by themes.
- Theme navigation avoids a long always-visible color list.
- Reset All clears all effect color configs and rebuilds generated color files.
- Presets can store color configs.

Known limitation:

- The effect color system modifies the available effect color paths exposed by the underlying effect-color mod. It cannot recolor every possible visual effect on every character if the effect is not covered by that mod's shader/texture route.

## Rover Female eye/hair recolor

A custom Rover Female eye/hair recolor workflow was added.

Main behavior:

- Only shown for Rover Female skins.
- Saved per Rover Female skin/mod.
- Eye and hair colors can be configured independently.
- Eye colors are grouped by Light, Vivid, and Dark.
- Hair colors are grouped by Light, Vivid, and Dark.
- Rover eye/hair settings work with Normal or Cycler skins.
- Reset returns the selected skin to default/original eye/hair behavior.

Important notes:

- Some Rover skins need compatibility patches because they override or reroute eye/hair textures differently.
- Lady Arbiter required a specific RabbitFX texture path fix.
- Astral Modulator uses a dedicated, opt-in `Vivid Red` hair path. It recolors only its two diffuse maps and deliberately leaves its blue technical/light maps untouched.
- Rover Female Gold x 5M is currently considered unsafe/unresolved because the visual break appears broader than eye/hair recolor and likely comes from old-model compatibility issues.

## Online / GameBanana changes

- The online sidebar was simplified and visually aligned with the custom layout.
- GameBanana still uses dynamic loading behavior.
- Category strips were replaced with the compact character A-Z/search approach where applicable.
- Downloaded/installed online items can be viewed from a collapsible sidebar section rather than always occupying sidebar space.

## Safety decisions

- The app should not send automatic gameplay/F10 key input to Wuthering Waves.
- WWMI reload remains manual: the user presses F10.
- Global shortcuts trigger IMM-side actions, generated `.ini` changes, and notices, but should not emulate in-game keypresses.

## Build and validation commands

Used during development:

```powershell
npm.cmd run type-check
npm.cmd run build
cargo check
```

Additional check:

```powershell
npm.cmd run lint
```

currently runs the TypeScript check. It is not a style lint pass yet, but it is no longer broken.
