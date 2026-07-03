export type ClickShortcutId = "previewCapture" | "openLooks" | "toggleCycler";

export type ClickShortcutValue =
	| "ctrl-left"
	| "alt-left"
	| "shift-left"
	| "middle"
	| "ctrl-right"
	| "right"
	| "disabled";

export type ClickShortcutDefinition = {
	id: ClickShortcutId;
	label: string;
	description: string;
	defaultShortcut: ClickShortcutValue;
};

export const CLICK_SHORTCUTS_STORAGE_KEY = "wuwa-imm-click-shortcuts";

export const CLICK_SHORTCUT_OPTIONS: { value: ClickShortcutValue; label: string }[] = [
	{ value: "ctrl-left", label: "Ctrl + click" },
	{ value: "alt-left", label: "Alt + click" },
	{ value: "shift-left", label: "Shift + click" },
	{ value: "middle", label: "Middle click" },
	{ value: "ctrl-right", label: "Ctrl + right click" },
	{ value: "right", label: "Right click" },
	{ value: "disabled", label: "Disabled" },
];

export const CLICK_SHORTCUT_DEFINITIONS: ClickShortcutDefinition[] = [
	{
		id: "previewCapture",
		label: "Capture Preview",
		description: "Preview and cover capture.",
		defaultShortcut: "ctrl-left",
	},
	{
		id: "openLooks",
		label: "Open Mod Looks",
		description: "Open Looks.",
		defaultShortcut: "middle",
	},
	{
		id: "toggleCycler",
		label: "Move Normal / Cycler",
		description: "Move Normal ↔ Cycler.",
		defaultShortcut: "alt-left",
	},
];

const allowedValues = new Set(CLICK_SHORTCUT_OPTIONS.map((option) => option.value));

function readOverrides() {
	try {
		const raw = localStorage.getItem(CLICK_SHORTCUTS_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		return typeof parsed === "object" && parsed ? (parsed as Partial<Record<ClickShortcutId, ClickShortcutValue>>) : {};
	} catch {
		return {};
	}
}

function normalizeValue(value: unknown): ClickShortcutValue | "" {
	return typeof value === "string" && allowedValues.has(value as ClickShortcutValue) ? (value as ClickShortcutValue) : "";
}

export function getCustomClickShortcuts() {
	const overrides = readOverrides();
	return CLICK_SHORTCUT_DEFINITIONS.map((definition) => ({
		...definition,
		shortcut: normalizeValue(overrides[definition.id]) || definition.defaultShortcut,
	}));
}

export function getDefaultClickShortcuts() {
	return CLICK_SHORTCUT_DEFINITIONS.map((definition) => ({
		...definition,
		shortcut: definition.defaultShortcut,
	}));
}

export function getCustomClickShortcut(id: ClickShortcutId) {
	const definition = CLICK_SHORTCUT_DEFINITIONS.find((shortcut) => shortcut.id === id);
	return getCustomClickShortcuts().find((shortcut) => shortcut.id === id)?.shortcut || definition?.defaultShortcut || "disabled";
}

export function setCustomClickShortcut(id: ClickShortcutId, shortcut: ClickShortcutValue) {
	const overrides = readOverrides();
	overrides[id] = shortcut;
	localStorage.setItem(CLICK_SHORTCUTS_STORAGE_KEY, JSON.stringify(overrides, null, 2));
}

export function getClickShortcutOverridesForExport() {
	return Object.fromEntries(getCustomClickShortcuts().map((shortcut) => [shortcut.id, shortcut.shortcut]));
}

export function importClickShortcutOverrides(overrides: unknown) {
	if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return;
	const allowedIds = new Set(CLICK_SHORTCUT_DEFINITIONS.map((definition) => definition.id));
	const next: Partial<Record<ClickShortcutId, ClickShortcutValue>> = {};
	Object.entries(overrides as Record<string, unknown>).forEach(([id, value]) => {
		if (!allowedIds.has(id as ClickShortcutId)) return;
		const normalized = normalizeValue(value);
		if (normalized) next[id as ClickShortcutId] = normalized;
	});
	localStorage.setItem(CLICK_SHORTCUTS_STORAGE_KEY, JSON.stringify(next, null, 2));
}

export function formatClickShortcut(shortcut: ClickShortcutValue) {
	return CLICK_SHORTCUT_OPTIONS.find((option) => option.value === shortcut)?.label || "Disabled";
}

type ClickShortcutMouseEvent = {
	button: number;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
};

export function eventMatchesClickShortcut(event: ClickShortcutMouseEvent, id: ClickShortcutId) {
	const shortcut = getCustomClickShortcut(id);
	if (shortcut === "disabled") return false;
	if (shortcut === "ctrl-left") return event.button === 0 && event.ctrlKey;
	if (shortcut === "alt-left") return event.button === 0 && event.altKey;
	if (shortcut === "shift-left") return event.button === 0 && event.shiftKey;
	if (shortcut === "middle") return event.button === 1 && !event.ctrlKey && !event.altKey && !event.shiftKey;
	if (shortcut === "ctrl-right") return event.button === 2 && event.ctrlKey;
	if (shortcut === "right") return event.button === 2 && !event.ctrlKey && !event.altKey && !event.shiftKey;
	return false;
}
