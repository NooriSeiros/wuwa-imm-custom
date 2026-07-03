export type CustomHotkeyId =
	| "cyclerNext"
	| "cyclerPrevious"
	| "cyclerRandom"
	| "cyclerAutoCycle"
	| "cyclerAutoShuffle"
	| "rebuildCycler"
	| "hotkeysOverlay"
	| "characterSearch";

export type CustomHotkeyDefinition = {
	id: CustomHotkeyId;
	label: string;
	description: string;
	defaultHotkey: string;
	scope: "In-game Cycler" | "Global" | "IMM";
};

export const CUSTOM_HOTKEYS_STORAGE_KEY = "wuwa-imm-custom-hotkeys";

export const CUSTOM_HOTKEY_DEFINITIONS: CustomHotkeyDefinition[] = [
	{
		id: "cyclerNext",
		label: "Cycler Next",
		description: "Move to the next Cycler skin in-game.",
		defaultHotkey: "Alt+D",
		scope: "In-game Cycler",
	},
	{
		id: "cyclerPrevious",
		label: "Cycler Previous",
		description: "Move to the previous Cycler skin in-game.",
		defaultHotkey: "Alt+A",
		scope: "In-game Cycler",
	},
	{
		id: "cyclerRandom",
		label: "Cycler Random",
		description: "Pick the next random/shuffled Cycler skin once.",
		defaultHotkey: "Alt+R",
		scope: "In-game Cycler",
	},
	{
		id: "cyclerAutoCycle",
		label: "Auto Cycle",
		description: "Toggle automatic Cycler rotation on/off.",
		defaultHotkey: "Alt+Q",
		scope: "In-game Cycler",
	},
	{
		id: "cyclerAutoShuffle",
		label: "Auto Shuffle",
		description: "Toggle automatic shuffled Cycler rotation on/off.",
		defaultHotkey: "Alt+S",
		scope: "In-game Cycler",
	},
	{
		id: "rebuildCycler",
		label: "Rebuild Cycler",
		description: "Rebuild Cycler files globally, even with the game focused.",
		defaultHotkey: "F11",
		scope: "Global",
	},
	{
		id: "hotkeysOverlay",
		label: "Pinned Hotkeys Overlay",
		description: "Show/hide the always-on-top hotkeys window for the current active mod.",
		defaultHotkey: "Alt+K",
		scope: "Global",
	},
	{
		id: "characterSearch",
		label: "Character Search",
		description: "Open the character jump/search window inside IMM.",
		defaultHotkey: "Ctrl+Space",
		scope: "IMM",
	},
];

function normalizeStoredHotkey(hotkey: string) {
	return hotkey.replaceAll(" ﹢ ", "+").replaceAll(" ï¹¢ ", "+").trim();
}

export function normalizeHotkeyForCompare(hotkey: string) {
	return normalizeStoredHotkey(hotkey)
		.toLowerCase()
		.split("+")
		.map((part) => part.trim())
		.map((part) =>
			part
				.replace(/^control$/, "ctrl")
				.replace(/^commandorcontrol$/, "ctrl")
				.replace(/^cmdorcontrol$/, "ctrl")
				.replace(/^key([a-z])$/, "$1")
				.replace(/^digit(\d)$/, "$1")
				.replace(/^numpad(\d)$/, "num $1")
				.replace(/^arrow/, "")
		)
		.filter(Boolean)
		.sort()
		.join("+");
}

export function hasNonModifierKey(hotkey: string) {
	return normalizeHotkeyForCompare(hotkey)
		.split("+")
		.filter(Boolean)
		.some((part) => !["alt", "ctrl", "control", "shift"].includes(part));
}

function readCustomHotkeyOverrides() {
	try {
		const raw = localStorage.getItem(CUSTOM_HOTKEYS_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		return typeof parsed === "object" && parsed ? (parsed as Partial<Record<CustomHotkeyId, string>>) : {};
	} catch {
		return {};
	}
}

export function getCustomHotkeyOverridesForExport() {
	return Object.fromEntries(getCustomHotkeys().map((hotkey) => [hotkey.id, hotkey.hotkey]));
}

export function importCustomHotkeyOverrides(overrides: unknown) {
	if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return;
	const allowedIds = new Set(CUSTOM_HOTKEY_DEFINITIONS.map((definition) => definition.id));
	const next: Partial<Record<CustomHotkeyId, string>> = {};
	Object.entries(overrides as Record<string, unknown>).forEach(([id, hotkey]) => {
		if (!allowedIds.has(id as CustomHotkeyId) || typeof hotkey !== "string") return;
		const normalized = normalizeStoredHotkey(hotkey);
		if (normalized && hasNonModifierKey(normalized)) {
			next[id as CustomHotkeyId] = normalized;
		}
	});
	localStorage.setItem(CUSTOM_HOTKEYS_STORAGE_KEY, JSON.stringify(next, null, 2));
}

export function getCustomHotkeys() {
	const overrides = readCustomHotkeyOverrides();
	return CUSTOM_HOTKEY_DEFINITIONS.map((definition) => {
		const override = normalizeStoredHotkey(overrides[definition.id] || "");
		return {
			...definition,
			hotkey: override && hasNonModifierKey(override) ? override : definition.defaultHotkey,
		};
	});
}

export function getDefaultCustomHotkeys() {
	return CUSTOM_HOTKEY_DEFINITIONS.map((definition) => ({
		...definition,
		hotkey: definition.defaultHotkey,
	}));
}

export function getCustomHotkey(id: CustomHotkeyId) {
	const definition = CUSTOM_HOTKEY_DEFINITIONS.find((hotkey) => hotkey.id === id);
	const hotkey = getCustomHotkeys().find((item) => item.id === id)?.hotkey || "";
	if (!hasNonModifierKey(hotkey)) return definition?.defaultHotkey || "";
	return hotkey;
}

export function setCustomHotkey(id: CustomHotkeyId, hotkey: string) {
	const overrides = readCustomHotkeyOverrides();
	overrides[id] = normalizeStoredHotkey(hotkey);
	localStorage.setItem(CUSTOM_HOTKEYS_STORAGE_KEY, JSON.stringify(overrides, null, 2));
}

export function resetCustomHotkeys() {
	localStorage.removeItem(CUSTOM_HOTKEYS_STORAGE_KEY);
}

export function getCustomHotkeyForMigoto(id: CustomHotkeyId) {
	const parts = normalizeStoredHotkey(getCustomHotkey(id))
		.split("+")
		.map((part) => part.trim())
		.filter(Boolean);
	return parts
		.map((part) => {
			const lower = part.toLowerCase();
			if (lower === "ctrl" || lower === "control") return "CTRL";
			if (lower === "alt") return "ALT";
			if (lower === "shift") return "SHIFT";
			if (/^f\d+$/i.test(part)) return part.toUpperCase();
			if (part.length === 1) return part.toLowerCase();
			return part;
		})
		.join(" ");
}

export function eventMatchesCustomHotkey(event: KeyboardEvent, id: CustomHotkeyId) {
	const parts = normalizeStoredHotkey(getCustomHotkey(id)).split("+").map((part) => part.trim().toLowerCase());
	const wantsCtrl = parts.includes("ctrl") || parts.includes("control");
	const wantsAlt = parts.includes("alt");
	const wantsShift = parts.includes("shift");
	const keyPart = parts.find((part) => !["ctrl", "control", "alt", "shift"].includes(part));
	if (!keyPart) return false;
	if (event.ctrlKey !== wantsCtrl || event.altKey !== wantsAlt || event.shiftKey !== wantsShift) return false;
	if (keyPart === "space") return event.code === "Space";
	if (/^f\d+$/.test(keyPart)) return event.key.toLowerCase() === keyPart;
	if (keyPart.length === 1) return event.key.toLowerCase() === keyPart;
	return event.code.toLowerCase().replace("key", "").replace("digit", "") === keyPart;
}
