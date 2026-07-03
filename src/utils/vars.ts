import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
export const store = createStore();
import TEXT from "@/textData.json";
import { DEFAULTS, VERSION } from "./consts";
import {
	Category,
	ChangeInfo,
	DownloadList,
	Games,
	InstalledItem,
	ImportedMissingMod,
	Language,
	Mod,
	ModDataObj,
	OnlineData,
	Preset,
	ProgressData,
	Settings,
} from "./types";
interface UpdateInfo {
	version: string;
	status: "available" | "downloading" | "ready" | "error" | "installed" | "ignored";
	date: string;
	body: string;
	raw: any | null;
}
const INIT_DONE = atom(false);
const MAIN_FUNC_STATUS = atom("" as String);
const FIRST_LOAD = atom(false);
const GAME = atom<Games>("");
const LANG = atom<Language>("en");
const SAVED_LANG = atomWithStorage<Language | "">("imm-lang","");
const LAST_UPDATED = atom(Date.now());
const SETTINGS = atom<Settings>({
	global: {
		bgOpacity: 1,
		winOpacity: 1,
		winType: 0,
		bgType: 2,
		listType: 0,
		nsfw: 1,
		toggleClick: 2,
		ignore: VERSION,
		clientDate: "1759866302559426603",
		XXMI: "",
		lang: "",
		game: "",
		preReleases: false,
		chkModUpdates: true,
	},
	game: {
		launch: 0,
		hotReload: 1,
		onlineType: "Mod",
		customCategories: {},
	},
});
const SOURCE = atom<string>("");
const TARGET = atom<string>("");
const DATA = atom<ModDataObj>({});
const PRESETS = atom<Preset[]>([]);
const CATEGORIES = atom<Category[]>([]);
const TYPES = atom<Category[]>([]);
const XXMI_MODE = atom<0 | 1>(0);
const XXMI_DIR = atom<string>("");
const LEFT_SIDEBAR_OPEN = atom(true);
const RIGHT_SIDEBAR_OPEN = atom(true);
const LEFT_SIDEBAR_WIDTH = atomWithStorage("left-sidebar-width", 335);
const RIGHT_SIDEBAR_WIDTH = atomWithStorage("right-sidebar-width", 335);
const RIGHT_SLIDEOVER_OPEN = atom(false);
const ONLINE = atom(false);
const DOWNLOAD_LIST = atom<DownloadList>(DEFAULTS.DOWNLOAD_LIST);
const CURRENT_PRESET = atom(DEFAULTS.CURRENT_PRESET);
const MOD_LIST = atom<Mod[]>(DEFAULTS.MOD_LIST);
export interface TestPinState {
	path: string;
	wasEnabled: boolean;
	suspendedPaths: string[];
}
const TEST_PIN_STATE = atomWithStorage<TestPinState>("wuwa-imm-test-pin-state-v2", {
	path: "",
	wasEnabled: false,
	suspendedPaths: [],
});
const RECENT_CATEGORIES = atomWithStorage<string[]>("wuwa-imm-recent-categories", DEFAULTS.RECENT_CATEGORIES);
const PREVIEW_CATEGORY = atom<string>(DEFAULTS.PREVIEW_CATEGORY);
const SELECTED = atom(DEFAULTS.SELECTED);
const FILTER = atom(DEFAULTS.FILTER);
const SORT = atom(DEFAULTS.SORT);
const CATEGORY = atom(DEFAULTS.CATEGORY);
const SEARCH = atom(DEFAULTS.SEARCH);
const INSTALLED_ITEMS = atom<InstalledItem[]>(DEFAULTS.INSTALLED_ITEMS);
const IMPORT_MISSING_ITEMS = atomWithStorage<ImportedMissingMod[]>("wuwa-imm-import-missing-mods", DEFAULTS.IMPORT_MISSING_ITEMS);
const ONLINE_DATA = atom<OnlineData>(DEFAULTS.ONLINE_DATA);
const ONLINE_TYPE = atom(DEFAULTS.ONLINE_TYPE);
const ONLINE_SORT = atom(DEFAULTS.ONLINE_SORT);
const ONLINE_PATH = atom(DEFAULTS.ONLINE_PATH);
const ONLINE_SELECTED = atom(DEFAULTS.ONLINE_SELECTED);
const TOASTS = atom([] as any[]);
const CHANGES = atom<ChangeInfo>({
	before: [],
	after: [],
	map: {},
	skip: false,
	title: "",
});
const TEXT_DATA = atom(TEXT["en"]);
const PROGRESS_OVERLAY = atom<ProgressData>({ title: "", open: false, finished: false, button: "", name: "" });
const IMM_UPDATE = atom(null as UpdateInfo | null);
const UPDATER_OPEN = atom(false);
const NOTICE = atom({
	heading: "",
	subheading: "",
	ignoreable: 2,
	timer: 10,
	ver: VERSION,
	id: 0,
} as any);
const HELP_OPEN = atom(false);
const TUTORIAL_OPEN = atom(false);
const NOTICE_OPEN = atom(false);
const REMOVE_OPEN = atom(false);
const CONFLICTS_OPEN = atom(false);
const CONFLICTS = atom({
	conflicts: [] as string[][],
	mods: {} as Record<string, number>,
});
const CONFLICT_INDEX = atom(0);
const PREVIEW_CAPTURE_TARGET = atom<
	null |
		{ kind?: "mod"; path: string; name: string } |
		{ kind: "preset"; presetIndex: number; coverKey: string; name: string } |
		{ kind: "look"; modPath: string; lookId: string; coverKey: string; name: string }
>(null);
const PREVIEW_CAPTURE_OVERLAY = atom(false);
export function openConflict(index=-1) {
	store.set(CONFLICTS_OPEN, (prev) => {
		if (!prev && index>=0) {
			store.set(CONFLICT_INDEX, index);
		}
		return true;
	});
}
const FILE_TO_DL = atom("");
export function resetAtoms() {
	const atoms = {
		INIT_DONE,
		LANG,
		GAME,
		SETTINGS,
		SOURCE,
		TARGET,
		DATA,
		PRESETS,
		CATEGORIES,
		TYPES,
		CHANGES,
		ONLINE,
		DOWNLOAD_LIST,
		CURRENT_PRESET,
		MOD_LIST,
		PREVIEW_CATEGORY,
		SELECTED,
		FILTER,
		CATEGORY,
		SEARCH,
		SORT,
		INSTALLED_ITEMS,
		ONLINE_DATA,
		ONLINE_TYPE,
		ONLINE_PATH,
		ONLINE_SORT,
		ONLINE_SELECTED,
		XXMI_MODE,
	};
	store.set(FILE_TO_DL, "");
	Object.keys(atoms).forEach((atom) =>
		store.set(atoms[atom as keyof typeof atoms] as any, DEFAULTS[atom as keyof typeof DEFAULTS])
	);
}
const ERR = atom("");
export {
	CONFLICTS,
	PREVIEW_CAPTURE_TARGET,
	PREVIEW_CAPTURE_OVERLAY,
	FILE_TO_DL,
	ERR,
	XXMI_DIR,
	XXMI_MODE,
	FIRST_LOAD,
	HELP_OPEN,
	TUTORIAL_OPEN,
	NOTICE,
	NOTICE_OPEN,
	REMOVE_OPEN,
	UPDATER_OPEN,
	CONFLICTS_OPEN,
	CONFLICT_INDEX,
	IMM_UPDATE,
	PROGRESS_OVERLAY,
	TOASTS,
	CURRENT_PRESET,
	INSTALLED_ITEMS,
	IMPORT_MISSING_ITEMS,
	RIGHT_SLIDEOVER_OPEN,
	DOWNLOAD_LIST,
	TYPES,
	ONLINE_DATA,
	ONLINE_TYPE,
	ONLINE_PATH,
	ONLINE_SORT,
	ONLINE_SELECTED,
	CATEGORY,
	SEARCH,
	FILTER,
	GAME,
	INIT_DONE,
	MAIN_FUNC_STATUS,
	LANG,
	SAVED_LANG,
	SETTINGS,
	TEXT_DATA,
	SOURCE,
	TARGET,
	DATA,
	PRESETS,
	CATEGORIES,
	CHANGES,
	MOD_LIST,
	TEST_PIN_STATE,
	RECENT_CATEGORIES,
	PREVIEW_CATEGORY,
	ONLINE,
	LEFT_SIDEBAR_OPEN,
	RIGHT_SIDEBAR_OPEN,
	LEFT_SIDEBAR_WIDTH,
	RIGHT_SIDEBAR_WIDTH,
	LAST_UPDATED,
	SELECTED,
	SORT,
};
