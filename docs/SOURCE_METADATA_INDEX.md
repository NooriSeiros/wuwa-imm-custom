# Source Metadata Index

The app already stores mod source metadata inside `configWW.json`, but that config can be replaced, migrated, or lost when moving between IMM versions.

To make update/source metadata more durable, WuWa IMM Custom now also writes a separate file:

`mod-source-indexWW.json`

It is stored under `%LOCALAPPDATA%\Integrated Mod Manager (IMM)`, outside the project and `src-tauri` folders. This prevents Tauri's development watcher from treating runtime metadata writes as source-code changes and restarting the app.

## What it stores

Only source/update metadata is stored here:

- mod path;
- `source`;
- `updatedAt`;
- `viewedAt`;
- `sourceKind`, when available;
- `sourceFingerprint`, when available.

It does not store presets, enabled state, hotkeys, notes, color settings, or other personal setup data.

## When it is saved

Every normal config save also refreshes this index.

## When it is restored

On app/game initialization, the app reads this index and fills missing source metadata in `configWW.json`.

Existing config values win. The index only restores fields that are missing or empty, so it should not overwrite newer/current data.

## Why it exists

If a future config migration, app version change, or switch between IMM builds loses `source` / `updatedAt`, the app can recover the metadata from this small index file and keep update checks working for already-known mods.
