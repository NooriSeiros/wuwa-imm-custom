import { PRIORITY_KEYS } from "./consts";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { DATA, MOD_LIST, PRESETS, SELECTED, SOURCE, TARGET, TEST_PIN_STATE, store } from "./vars";
import { getModDetails, rebuildCyclerIni, refreshModList } from "./filesys";
import { info } from "@/lib/logger";
import { addToast } from "@/_Toaster/ToastProvider";
import { HOTKEYS_OVERLAY_STORAGE_KEY } from "@/_Main/components/HotkeysOverlayWindow";
import { getCustomHotkey, hasNonModifierKey, normalizeHotkeyForCompare } from "./customHotkeys";
import { join } from "./hotreload";
import type { Mod } from "./types";
import { applyPresetFromGlobalHotkey } from "./presetRuntime";

const HOTKEYS_OVERLAY_LABEL = "hotkeys-overlay";
const hotkeysOverlayKeyCache = new Map<string, Mod["keys"]>();

type CyclerGroupMap = {
	id: number;
	character: string;
	slots: Map<number, string>;
};

export function processHotkeyCode(code: string): string {
	return code
		.toLowerCase()
		.replaceAll("key", "")
		.replaceAll("digit", "")
		.replaceAll("numpad", "")
		.replaceAll("plus", "+")
		.replaceAll("minus", "-")
		.replaceAll("multiply", "*")
		.replaceAll("divide", "/")
		.replaceAll("decimal", ".")
		.replaceAll("enter", "↵")
		.replaceAll("altright", "Alt")
		.replaceAll("controlright", "Ctrl")
		.replaceAll("shiftright", "Shift")
		.replaceAll("altleft", "Alt")
		.replaceAll("controlleft", "Ctrl")
		.replaceAll("shiftleft", "Shift")
		.replaceAll("arrow", "")
		.replaceAll("backquote", "`")
		.replaceAll("backslash", "\\")
		.replaceAll("bracketleft", "[")
		.replaceAll("bracketright", "]")
		.replaceAll("semicolon", ";")
		.replaceAll("quote", "'")
		.replaceAll("comma", ",")
		.replaceAll("period", ".")
		.replaceAll("slash", "/")
		.replaceAll("equal", "=")
		.replaceAll("minus", "-")
		.replace(/^f(\d+)$/, "F$1")
		.replaceAll("space", "Space");
}
export function formatHotkeyDisplay(hotkey: string): string {
	return hotkey
		.replaceAll("+", "xx+xx")
		.replaceAll("comma", ",")
		.replaceAll("space", "Space")
		.replaceAll("plus", "+")
		.replaceAll("minus", "-")
		.replaceAll("multiply", "*")
		.replaceAll("divide", "/")
		.replaceAll("decimal", ".")
		.replaceAll("enter", "↵")
		.replaceAll("backquote", "`")
		.replaceAll("backslash", "\\")
		.replaceAll("bracketleft", "[")
		.replaceAll("bracketright", "]")
		.replaceAll("semicolon", ";")
		.replaceAll("quote", "'")
		.replaceAll("period", ".")
		.replaceAll("slash", "/")
		.replaceAll("equal", "=")
		.replaceAll("up", "🠉")
		.replaceAll("down", "🠋")
		.replaceAll("left", "🠈")
		.replaceAll("right", "🠊")
		.replaceAll("lbutton", "LMB")
		.replaceAll("rbutton", "RMB")

		.replaceAll("xx+xx", " ﹢ ");
}
export function encodeHotkeyForStorage(displayString: string): string {
	return displayString
		.replaceAll(" ﹢ ", "xxplusxx")
		.replaceAll(",", "comma")
		.replaceAll("Space", "space")
		.replaceAll("+", "plus")
		.replaceAll("-", "minus")
		.replaceAll("*", "multiply")
		.replaceAll("/", "divide")
		.replaceAll(".", "decimal")
		.replaceAll("↵", "enter")
		.replaceAll("`", "backquote")
		.replaceAll("\\", "backslash")
		.replaceAll("[", "bracketleft")
		.replaceAll("]", "bracketright")
		.replaceAll(";", "semicolon")
		.replaceAll("'", "quote")
		.replaceAll("=", "equal")
		.replaceAll("🠊", "right")
		.replaceAll("🠈", "left")
		.replaceAll("🠋", "down")
		.replaceAll("🠉", "up")
		.replaceAll("xxplusxx", "+");
}
export function sortHotkeys(keys: string[]): string[] {
	const prioritySet = new Set<string>(PRIORITY_KEYS);
	const regularKeys = keys.filter((key) => !prioritySet.has(key));

	regularKeys.sort((a, b) => {
		if (a.length !== b.length) {
			return a.length - b.length;
		}
		return a.localeCompare(b);
	});

	const inputKeysSet = new Set(keys);
	const presentPriorityKeys = PRIORITY_KEYS.filter((key) => inputKeysSet.has(key));
	return [...presentPriorityKeys, ...regularKeys];
}
export function normalizeHotkey(hotkey: string): string {
	return hotkey
		.toLowerCase()
		.replaceAll("alt", "Alt")
		.replaceAll("ctrl", "Ctrl")
		.replaceAll("control", "Ctrl")
		.replaceAll("shift", "Shift")
		.replaceAll("key", "")
		.replaceAll("digit", "")
		.replaceAll("numpad", "Num ");
}

function getConfiguredModsRoot() {
	return store.get(SOURCE) || store.get(TARGET) || "";
}

function getWwmiRootFromModsRoot(modsRoot: string) {
	return modsRoot.split("\\").slice(0, -1).join("\\");
}

function parseNumberValue(content: string, variableName: string) {
	const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = content.match(new RegExp(`${escaped}\\s*=\\s*([-\\d.]+)`, "i"));
	if (!match) return 0;
	const value = Number(match[1]);
	return Number.isFinite(value) ? value : 0;
}

function parseActiveCyclerSlots(content: string) {
	const result = new Map<number, number>();
	for (const line of content.split(/\r?\n/)) {
		const groupMatch = line.match(/^\$\\modmanageragl\\group_(\d+)\\active_slot\s*=\s*(\d+)/i);
		const slotMatch = line.match(/^\$\\mod_cycler_indie\\cycler\\g(\d+)_slot\s*=\s*(\d+)/i);
		const match = groupMatch || slotMatch;
		if (!match) continue;
		result.set(Number(match[1]), Number(match[2]));
	}
	return result;
}

function parseCyclerGroupMap(content: string): CyclerGroupMap[] {
	const groups: CyclerGroupMap[] = [];
	let current: CyclerGroupMap | null = null;
	for (const line of content.split(/\r?\n/)) {
		const groupMatch = line.match(/^;\s*group_(\d+):\s*(.+)$/i);
		if (groupMatch) {
			current = {
				id: Number(groupMatch[1]),
				character: groupMatch[2].trim(),
				slots: new Map<number, string>(),
			};
			groups.push(current);
			continue;
		}

		const slotMatch = line.match(/^;\s*slot\s+(\d+):\s*(.+)$/i);
		if (current && slotMatch) {
			current.slots.set(Number(slotMatch[1]), slotMatch[2].trim());
		}
	}
	return groups;
}

function findModByCyclerSlot(group: CyclerGroupMap, slot: number, modList: Mod[]) {
	const slotName = group.slots.get(slot);
	if (!slotName) return undefined;
	const normalize = (value: string) => value.trim().toLowerCase();
	return modList.find(
		(mod) =>
			mod.isDir &&
			(mod.tags || []).includes("cycler") &&
			normalize(mod.parent) === normalize(group.character) &&
			normalize(mod.name) === normalize(slotName)
	);
}

async function getActiveCyclerMod(modList: Mod[]) {
	const modsRoot = getConfiguredModsRoot();
	if (!modsRoot) return { blocked: false, mod: undefined as Mod | undefined, ambiguous: false };

	try {
		// XXMI persists the in-memory Cycler slot asynchronously. The local
		// installation is configured to save once per second, so wait for that
		// snapshot instead of displaying the previously active skin.
		await new Promise((resolve) => window.setTimeout(resolve, 1100));
		const wwmiRoot = getWwmiRootFromModsRoot(modsRoot);
		const [cyclerIni, d3dxUserIni] = await Promise.all([
			readTextFile(join(modsRoot, "mod_cycler.ini")),
			readTextFile(join(wwmiRoot, "d3dx_user.ini")),
		]);

		const autoEnabled = parseNumberValue(d3dxUserIni, "$\\mod_cycler_indie\\cycler\\auto_enable") > 0;
		const shuffleAutoEnabled = parseNumberValue(d3dxUserIni, "$\\mod_cycler_indie\\cycler\\shuffle_auto_enable") > 0;
		if (autoEnabled || shuffleAutoEnabled) {
			return { blocked: true, mod: undefined as Mod | undefined, ambiguous: false };
		}

		const activeSlots = parseActiveCyclerSlots(d3dxUserIni);
		const groups = parseCyclerGroupMap(cyclerIni);
		const currentGroupId = parseNumberValue(d3dxUserIni, "$\\mod_cycler_indie\\cycler\\current_group");
		const activeGroups = currentGroupId > 0 ? groups.filter((group) => group.id === currentGroupId) : groups;
		const candidates = activeGroups
			.map((group) => findModByCyclerSlot(group, activeSlots.get(group.id) || 1, modList))
			.filter((mod): mod is Mod => !!mod);

		return {
			blocked: false,
			mod: candidates.length === 1 ? candidates[0] : undefined,
			ambiguous: candidates.length > 1,
		};
	} catch {
		return { blocked: false, mod: undefined as Mod | undefined, ambiguous: false };
	}
}

async function resolveCurrentHotkeysMod() {
	const modList = store.get(MOD_LIST).filter((mod) => mod.isDir);
	const pinnedPath = store.get(TEST_PIN_STATE).path;
	const pinnedMod = pinnedPath ? modList.find((mod) => mod.path === pinnedPath && mod.enabled) : undefined;
	if (pinnedMod) {
		return { blocked: false, mod: pinnedMod, ambiguous: false };
	}

	const cyclerState = await getActiveCyclerMod(modList);
	if (cyclerState.blocked || cyclerState.mod || cyclerState.ambiguous) return cyclerState;

	const selectedPath = store.get(SELECTED);
	const selectedMod = selectedPath ? modList.find((mod) => mod.path === selectedPath) : undefined;
	const normalActiveMods = modList.filter((mod) => mod.enabled && !(mod.tags || []).includes("cycler"));
	if (normalActiveMods.length === 1) {
		return { blocked: false, mod: normalActiveMods[0], ambiguous: false };
	}
	if (normalActiveMods.length > 1 && selectedMod && normalActiveMods.some((mod) => mod.path === selectedMod.path)) {
		return { blocked: false, mod: selectedMod, ambiguous: false };
	}

	if (selectedMod) {
		return { blocked: false, mod: selectedMod, ambiguous: false };
	}

	return {
		blocked: false,
		mod: undefined as Mod | undefined,
		ambiguous: normalActiveMods.length > 1,
	};
}

async function openModHotkeysOverlay(mod: Mod) {
	let sourceKeys = mod.keys.length > 0 ? mod.keys : hotkeysOverlayKeyCache.get(mod.path);
	if (!sourceKeys) {
		sourceKeys = (await getModDetails(mod.path)).keys;
		hotkeysOverlayKeyCache.set(mod.path, sourceKeys);
	}
	const keys = sourceKeys.map((key) => ({ ...key }));
	const modData = store.get(DATA)[mod.path]?.vars;
	if (modData) {
		keys.forEach((key: any) => {
			if (modData[key.file] && modData[key.file][key.target]) {
				key.name = modData[key.file][key.target].name || key.target;
			}
			if (key.namespace && modData["namespace"] && modData["namespace"][key.target]) {
				key.name = modData["namespace"][key.target].name || key.name || key.target;
			}
		});
	}

	const hotkeys = keys
		.map((key: any) => ({
			name: key.name || key.target || "Hotkey",
			key: formatHotkeyDisplay(normalizeHotkey(key.key || "")),
		}))
		.filter((key: { key: string }) => key.key.trim() !== "")
		.sort((a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key));

	localStorage.setItem(
		HOTKEYS_OVERLAY_STORAGE_KEY,
		JSON.stringify({
			modName: mod.name,
			characterName: mod.parent || "",
			hotkeys,
		})
	);

	const url = new URL(window.location.href);
	url.search = "?hotkeysOverlay=1";
	url.hash = "";

	const overlay = new WebviewWindow(HOTKEYS_OVERLAY_LABEL, {
		url: url.toString(),
		title: `Hotkeys - ${mod.name}`,
		width: 520,
		height: 520,
		minWidth: 360,
		minHeight: 240,
		center: true,
		resizable: true,
		decorations: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		visible: false,
		focus: true,
		shadow: true,
	});

	overlay.once("tauri://created", () => {
		overlay.setAlwaysOnTop(true).catch(() => {});
		overlay.show().catch(() => {});
		overlay.setFocus().catch(() => {});
	});
	overlay.once("tauri://error", (event) => {
		addToast({ type: "error", message: `Could not open hotkeys overlay: ${String(event.payload)}` });
	});
}

async function toggleCurrentModHotkeysOverlay() {
	const existing = await WebviewWindow.getByLabel(HOTKEYS_OVERLAY_LABEL);
	if (existing) {
		await existing.close();
		return;
	}

	const current = await resolveCurrentHotkeysMod();
	if (current.blocked) {
		addToast({ type: "error", message: "Hotkeys overlay is disabled while Auto Cycle or Auto Shuffle is active." });
		return;
	}
	if (current.ambiguous) {
		addToast({ type: "error", message: "Could not detect a single current mod. Keep only one normal mod active, or use one Cycler group." });
		return;
	}
	if (!current.mod) {
		addToast({ type: "error", message: "No active mod hotkeys found." });
		return;
	}

	await openModHotkeysOverlay(current.mod);
}

export async function registerGlobalHotkeys(): Promise<void> {
	try {
		await unregisterAll();
	} catch (error) {
		info("Error unregistering hotkeys:", error);
	}

	const validHotkeys = [
		...new Set([
			getCustomHotkey("rebuildCycler"),
			getCustomHotkey("hotkeysOverlay"),
			...store.get(PRESETS).map((preset) => preset.hotkey || ""),
		]),
	].filter((hotkey) => hotkey && hasNonModifierKey(hotkey));
	//info("Valid hotkeys to register:", validHotkeys);
	if (validHotkeys.length === 0) {
		//logger.log("No valid hotkeys found to register");
		return;
	}

	const handleGlobalShortcut = (event: any) => {
		//logger.log("Hotkey pressed:", event);
		if (event.state === "Pressed") {
			const normalizedShortcut = normalizeHotkeyForCompare(event.shortcut);
			//info("Hotkey pressed:", normalizedShortcut);

			const preset = store
				.get(PRESETS)
				.find((item) => item.hotkey && normalizeHotkeyForCompare(item.hotkey) === normalizedShortcut);
			if (preset) {
				applyPresetFromGlobalHotkey(preset);
				return;
			}

			if (normalizedShortcut === normalizeHotkeyForCompare(getCustomHotkey("rebuildCycler"))) {
				(async () => {
					try {
						const result = await rebuildCyclerIni();
						if (result.ok) {
							store.set(MOD_LIST, await refreshModList());
						}
					} catch (error) {
						addToast({ type: "error", message: `Cycler rebuild failed: ${String(error)}` });
					}
				})();
				return;
			}

			if (normalizedShortcut === normalizeHotkeyForCompare(getCustomHotkey("hotkeysOverlay"))) {
				toggleCurrentModHotkeysOverlay().catch((error) => {
					addToast({ type: "error", message: `Hotkeys overlay failed: ${String(error)}` });
				});
				return;
			}
		}
	};

	try {
		await register(validHotkeys as any, handleGlobalShortcut);
	} catch (error) {
		addToast({ type: "error", message: `Could not register global hotkeys: ${String(error)}` });
		info("Error registering global hotkeys:", error);
		throw error;
	}
}
