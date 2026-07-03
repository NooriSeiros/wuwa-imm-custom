import { importCustomHotkeyOverrides, getCustomHotkeyOverridesForExport } from "./customHotkeys";
import { getClickShortcutOverridesForExport, importClickShortcutOverrides } from "./customClickShortcuts";
import { DATA, IMPORT_MISSING_ITEMS, MOD_LIST, store } from "./vars";
import type { GameConfig, ImportedMissingMod, Mod, SetupManifestMod } from "./types";

function normalizeModPath(path: string) {
	return path.replaceAll("/", "\\").replace(/^\\+/, "").trim().toLocaleLowerCase();
}

function modToManifest(mod: Mod): SetupManifestMod {
	const data = store.get(DATA)[mod.path] || {};
	return {
		path: mod.path,
		name: mod.name,
		parent: mod.parent,
		enabled: mod.enabled,
		source: data.source || mod.source || "",
		sourceKind: data.sourceKind || mod.sourceKind || (data.source || mod.source ? "gamebanana" : "unknown"),
		sourceFingerprint: data.sourceFingerprint || mod.sourceFingerprint || "",
		updatedAt: data.updatedAt || mod.updatedAt || 0,
		viewedAt: data.viewedAt || mod.viewedAt || 0,
		tags: data.tags || mod.tags || [],
	};
}

export function buildConfigExportExtras() {
	const mods = store
		.get(MOD_LIST)
		.filter((mod) => mod.isDir)
		.map(modToManifest)
		.sort((a, b) => a.path.localeCompare(b.path));
	return {
		mods,
		customHotkeys: getCustomHotkeyOverridesForExport(),
		customClickShortcuts: getClickShortcutOverridesForExport(),
	};
}

export function applyImportedConfigExtras(config: Partial<GameConfig>) {
	const importedMods = Array.isArray(config.mods) ? config.mods : [];
	if (config.customHotkeys) {
		importCustomHotkeyOverrides(config.customHotkeys);
	}
	if (config.customClickShortcuts) {
		importClickShortcutOverrides(config.customClickShortcuts);
	}
	if (!importedMods.length) {
		store.set(IMPORT_MISSING_ITEMS, []);
		return { missing: [] as ImportedMissingMod[] };
	}
	const currentPaths = new Set(store.get(MOD_LIST).map((mod) => normalizeModPath(mod.path)));
	const importedAt = new Date().toISOString();
	const missing = importedMods
		.filter((mod) => mod?.path && !currentPaths.has(normalizeModPath(mod.path)))
		.map(
			(mod): ImportedMissingMod => ({
				path: mod.path,
				name: mod.name || mod.path.split("\\").pop() || mod.path,
				parent: mod.parent || "",
				enabled: !!mod.enabled,
				source: mod.source || "",
				sourceKind: mod.sourceKind || "unknown",
				sourceFingerprint: mod.sourceFingerprint || "",
				updatedAt: mod.updatedAt || 0,
				viewedAt: mod.viewedAt || 0,
				tags: mod.tags || [],
				importedAt,
			})
		)
		.sort((a, b) => a.path.localeCompare(b.path));
	store.set(IMPORT_MISSING_ITEMS, missing);
	return { missing };
}
