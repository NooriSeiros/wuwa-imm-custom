import { Input } from "@/components/ui/input";
import {
	DATA,
	GAME,
	INIT_DONE,
	MOD_LIST,
	ONLINE,
	openConflict,
	RIGHT_SIDEBAR_WIDTH,
	SELECTED,
	SOURCE,
	store,
	TEST_PIN_STATE,
	TEXT_DATA,
} from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	ArrowUpRightFromSquareIcon,
	DownloadIcon,
	ArrowLeftIcon,
	LinkIcon,
	PaletteIcon,
	PinIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	Settings2Icon,
	ShuffleIcon,
	SwordsIcon,
	TrashIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { GAME_GB_IDS, GAMES, managedSRC } from "@/utils/consts";
import { getImageUrl, handleImageError, handleInAppLink, join } from "@/utils/utils";
import { Sidebar, SidebarContent, SidebarGroup } from "@/components/ui/sidebar";
// @ts-ignore: no type declarations available for this optional Tauri plugin
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import {
	changeModName,
	ASTRAL_HAIR_COLOR_PRESETS,
	clearTestPinnedMod,
	CYCLER_TIMER_MINUTE_OPTIONS,
	deleteMod,
	getCyclerTimerMinutes,
	getModDetails,
	installFromArchives,
	rebuildEffectColorsIni,
	rebuildRoverEyeHairRecolorIni,
	rebuildCyclerIni,
	refreshModList,
	ROVER_EYE_COLOR_PRESETS,
	ROVER_HAIR_COLOR_PRESETS,
	saveConfigs,
	selectPath,
	setCyclerTimerMinutes,
	toggleMod,
} from "@/utils/filesys";
import { Label } from "@/components/ui/label";
import { Games, Mod } from "@/utils/types";
import ManageCategories from "./components/ManageCategories";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatHotkeyDisplay, normalizeHotkey } from "@/utils/hotkeyUtils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence, motion } from "motion/react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { addToast } from "@/_Toaster/ToastProvider";
import ModPreferences from "./components/ModPreferences";
import { info } from "@/lib/logger";
import { useCustomI18n } from "@/utils/customI18n";

let text = "";
let curUrlIndex = 0;
let cachcedDetails: any = {};
const timeKey = Date.now().toString();
const DEFAULT_EFFECT_COLORS = {
	enabled: false,
	red: 1,
	green: 1,
	blue: 1,
	redOffset: 0,
	greenOffset: 0,
	blueOffset: 0,
};
const DEFAULT_ROVER_EYE_HAIR = {
	enabled: false,
	eye: "amber_glow",
	hair: "dark_brown",
};
const EFFECT_COLOR_PRESET_GROUPS = [
	{
		name: "Dark",
		presets: [
			{
				name: "Abyss Violet",
				color: "#7a35ff",
				values: { red: 0.18, green: 0, blue: 0.52, redOffset: 0.04, greenOffset: 0, blueOffset: 0.24 },
			},
			{
				name: "Blood Moon",
				color: "#ff2447",
				values: { red: 0.58, green: 0, blue: 0.08, redOffset: 0.22, greenOffset: 0, blueOffset: 0.04 },
			},
			{
				name: "Shadow Rose",
				color: "#d52b91",
				values: { red: 0.5, green: 0, blue: 0.35, redOffset: 0.13, greenOffset: 0, blueOffset: 0.14 },
			},
			{
				name: "Poison Night",
				color: "#54ff83",
				values: { red: 0.02, green: 0.55, blue: 0.1, redOffset: 0, greenOffset: 0.22, blueOffset: 0.04 },
			},
			{
				name: "Void Blue",
				color: "#2f5dff",
				values: { red: 0.02, green: 0.08, blue: 0.62, redOffset: 0, greenOffset: 0.02, blueOffset: 0.24 },
			},
			{
				name: "Cursed Flame",
				color: "#ff4d18",
				values: { red: 0.7, green: 0.08, blue: 0, redOffset: 0.16, greenOffset: 0.02, blueOffset: 0 },
			},
			{
				name: "Night Cyan",
				color: "#22d9ff",
				values: { red: 0, green: 0.38, blue: 0.55, redOffset: 0, greenOffset: 0.1, blueOffset: 0.18 },
			},
			{
				name: "Witch Gold",
				color: "#d6a52b",
				values: { red: 0.55, green: 0.34, blue: 0, redOffset: 0.12, greenOffset: 0.08, blueOffset: 0 },
			},
		],
	},
	{
		name: "Bright",
		presets: [
			{
				name: "Radiant Gold",
				color: "#ffe36a",
				values: { red: 1, green: 0.82, blue: 0.08, redOffset: 0.26, greenOffset: 0.2, blueOffset: 0.02 },
			},
			{
				name: "Solar Flare",
				color: "#ff9f35",
				values: { red: 1, green: 0.42, blue: 0.02, redOffset: 0.28, greenOffset: 0.12, blueOffset: 0 },
			},
			{
				name: "Fairy Cyan",
				color: "#62f2ff",
				values: { red: 0.05, green: 0.9, blue: 1, redOffset: 0, greenOffset: 0.22, blueOffset: 0.28 },
			},
			{
				name: "Bloom Pink",
				color: "#ff70d7",
				values: { red: 1, green: 0.14, blue: 0.62, redOffset: 0.24, greenOffset: 0.03, blueOffset: 0.18 },
			},
			{
				name: "Pure White",
				color: "#ffffff",
				values: { red: 1, green: 0.96, blue: 0.9, redOffset: 0.24, greenOffset: 0.24, blueOffset: 0.22 },
			},
			{
				name: "Lime Burst",
				color: "#c8ff35",
				values: { red: 0.65, green: 1, blue: 0.04, redOffset: 0.16, greenOffset: 0.24, blueOffset: 0 },
			},
			{
				name: "Neon Blue",
				color: "#2aa2ff",
				values: { red: 0.02, green: 0.42, blue: 1, redOffset: 0, greenOffset: 0.12, blueOffset: 0.3 },
			},
			{
				name: "Cherry Pop",
				color: "#ff3f6c",
				values: { red: 1, green: 0.08, blue: 0.22, redOffset: 0.24, greenOffset: 0.02, blueOffset: 0.08 },
			},
		],
	},
	{
		name: "Elements",
		presets: [
			{
				name: "Inferno",
				color: "#ff5d1d",
				values: { red: 1, green: 0.18, blue: 0, redOffset: 0.22, greenOffset: 0.05, blueOffset: 0 },
			},
			{
				name: "Cryo Spark",
				color: "#73d9ff",
				values: { red: 0.04, green: 0.62, blue: 1, redOffset: 0, greenOffset: 0.16, blueOffset: 0.3 },
			},
			{
				name: "Voltaic Arc",
				color: "#9d62ff",
				values: { red: 0.32, green: 0, blue: 1, redOffset: 0.08, greenOffset: 0, blueOffset: 0.26 },
			},
			{
				name: "Aero Mint",
				color: "#55ffc9",
				values: { red: 0, green: 1, blue: 0.55, redOffset: 0, greenOffset: 0.2, blueOffset: 0.1 },
			},
			{
				name: "Spectro Gold",
				color: "#ffe27a",
				values: { red: 1, green: 0.78, blue: 0.16, redOffset: 0.2, greenOffset: 0.16, blueOffset: 0.04 },
			},
			{
				name: "Havoc Violet",
				color: "#8e38ff",
				values: { red: 0.38, green: 0, blue: 0.9, redOffset: 0.1, greenOffset: 0, blueOffset: 0.22 },
			},
			{
				name: "Glacio Blue",
				color: "#5fbfff",
				values: { red: 0.02, green: 0.48, blue: 1, redOffset: 0, greenOffset: 0.1, blueOffset: 0.28 },
			},
			{
				name: "Pneuma Green",
				color: "#6affb6",
				values: { red: 0.02, green: 1, blue: 0.42, redOffset: 0, greenOffset: 0.18, blueOffset: 0.08 },
			},
		],
	},
	{
		name: "Mixed",
		presets: [
			{
				name: "Violet Frost",
				color: "#9c7dff",
				values: { red: 0.3, green: 0.12, blue: 1, redOffset: 0.08, greenOffset: 0.12, blueOffset: 0.24 },
			},
			{
				name: "Blood Gold",
				color: "#ff7b38",
				values: { red: 1, green: 0.16, blue: 0.02, redOffset: 0.22, greenOffset: 0.14, blueOffset: 0 },
			},
			{
				name: "Toxic Cyan",
				color: "#4dffbf",
				values: { red: 0, green: 1, blue: 0.55, redOffset: 0, greenOffset: 0.14, blueOffset: 0.2 },
			},
			{
				name: "Rose Lightning",
				color: "#df66ff",
				values: { red: 0.8, green: 0.04, blue: 1, redOffset: 0.14, greenOffset: 0, blueOffset: 0.2 },
			},
			{
				name: "Solar Ocean",
				color: "#42c8ff",
				values: { red: 0.08, green: 0.55, blue: 1, redOffset: 0.16, greenOffset: 0.12, blueOffset: 0.2 },
			},
			{
				name: "Ember Violet",
				color: "#ff5fd2",
				values: { red: 1, green: 0.08, blue: 0.52, redOffset: 0.16, greenOffset: 0.02, blueOffset: 0.16 },
			},
			{
				name: "Holy Venom",
				color: "#d6ff5c",
				values: { red: 0.45, green: 1, blue: 0.08, redOffset: 0.18, greenOffset: 0.18, blueOffset: 0 },
			},
			{
				name: "Abyss Flame",
				color: "#b43bff",
				values: { red: 0.42, green: 0, blue: 0.85, redOffset: 0.18, greenOffset: 0.04, blueOffset: 0.16 },
			},
		],
	},
	{
		name: "Other",
		presets: [
			{
				name: "Default",
				color: "#bbbbbb",
				values: { red: 1, green: 1, blue: 1, redOffset: 0, greenOffset: 0, blueOffset: 0 },
			},
			{
				name: "Deep Ocean",
				color: "#248dff",
				values: { red: 0.02, green: 0.28, blue: 1, redOffset: 0, greenOffset: 0.06, blueOffset: 0.24 },
			},
			{
				name: "Cyber Mint",
				color: "#4dffe6",
				values: { red: 0, green: 1, blue: 0.82, redOffset: 0, greenOffset: 0.16, blueOffset: 0.14 },
			},
			{
				name: "Royal Violet",
				color: "#b04cff",
				values: { red: 0.58, green: 0, blue: 1, redOffset: 0.12, greenOffset: 0, blueOffset: 0.18 },
			},
			{
				name: "Amber",
				color: "#ffb12e",
				values: { red: 1, green: 0.52, blue: 0.02, redOffset: 0.2, greenOffset: 0.1, blueOffset: 0 },
			},
			{
				name: "Sakura",
				color: "#ff8fbd",
				values: { red: 1, green: 0.25, blue: 0.48, redOffset: 0.2, greenOffset: 0.06, blueOffset: 0.12 },
			},
			{
				name: "Aquamarine",
				color: "#2effd0",
				values: { red: 0, green: 0.9, blue: 0.65, redOffset: 0, greenOffset: 0.18, blueOffset: 0.16 },
			},
			{
				name: "Prismatic",
				color: "#c777ff",
				values: { red: 0.72, green: 0.22, blue: 1, redOffset: 0.12, greenOffset: 0.06, blueOffset: 0.18 },
			},
		],
	},
];
function RightLocal() {
	const t = useCustomI18n();
	const [tab, setTab] = useState<"notes" | "hotkeys" | "eyehair">("hotkeys");
	const [modToolsTab, setModToolsTab] = useState<"cycler" | "colors">("cycler");
	const [colorPresetGroup, setColorPresetGroup] = useState<string | null>(null);
	const [roverColorPage, setRoverColorPage] = useState<"menu" | "eyes" | "hair">("menu");
	const [roverPresetGroup, setRoverPresetGroup] = useState<string | null>(null);
	const setOnline = useSetAtom(ONLINE);
	const game = useAtomValue(GAME);
	const initDone = useAtomValue(INIT_DONE);
	// const setSettings = useSetAtom(SETTINGS);

	const [urls, setUrls] = useState<string[]>([]);
	const handleURLGame = useCallback(
		async (urls: string[]) => {
			const final = urls[urls.length - 1];
			if (final) getCurrentWebviewWindow()?.setFocus();
			if (final.includes("/game/")) {
				const url: any = final.split("/game/");
				url[1] = url[1].split("/");
				const urlGame = GAME_GB_IDS[url[1].shift()];
				info(`urlGame: ${urlGame} game: ${game}`);
				url[1] = url[1].join("/");
				urls[urls.length - 1] = url.join("/");
				if (urlGame && urlGame != game) {
					addToast({
						message: textData._Toasts.SwitchGame.replace("<game/>", urlGame),
					});
					sessionStorage.setItem("imm-deep-link-game", urlGame);
					info("Setting deep link game in sessionStorage:", urls[urls.length - 1]);
					sessionStorage.setItem("imm-session-timestamp", timeKey);
					sessionStorage.setItem("imm-deep-link-url", urls[urls.length - 1]);
					window.location.reload();
				} else {
					throw new Error("Invalid game in URL or same as current game.");
				}
			} else if (final.includes("/mode/")) {
				const urlGame = final.split("/mode/")[1].split("/")[0].toUpperCase();
				if (urlGame && urlGame != game && GAMES.includes(urlGame as Games)) {
					sessionStorage.setItem("imm-deep-link-game", urlGame);
					window.location.reload();
				} else {
					throw new Error("Invalid game in URL or same as current game.");
				}
			}
		},
		[game]
	);
	useEffect(() => {
		if (!game) {
			return () => {};
		}
		let unlisten: (() => void) | undefined;

		const initDeepLink = async () => {
			// 1. Check if app was launched via deep link
			// We use sessionStorage to ensure we only process the launch URL once per session.
			// This prevents the deep link from re-triggering on page reload (F5),
			// as the CLI args (returned by getCurrent) persist for the process lifetime.
			const initialUrls = await getCurrent();
			const isDeepLinkHandled = sessionStorage.getItem("deep-link-initial-handled");
			info("Initial URLs:", initialUrls, "Handled:", isDeepLinkHandled);
			if (initialUrls && !isDeepLinkHandled) {
				info("Launched with URLs:", initialUrls);
				sessionStorage.setItem("deep-link-initial-handled", "true");
				await handleURLGame(initialUrls).catch(() => {
					setUrls((prev) => [...prev, ...initialUrls]);
				});
			}
			// 2. Listen for deep links while app is running
			// The single-instance plugin forwards Windows deep links here automatically
			unlisten = await onOpenUrl(async (newUrls) => {
				info("Received new URLs:", newUrls);
				await handleURLGame(newUrls).catch(() => {
					setUrls((prev) => [...prev, ...newUrls]);
				});
			});
		};

		initDeepLink();

		return () => {
			if (unlisten) unlisten();
		};
	}, [handleURLGame, game]);
	useEffect(() => {
		if (!initDone) return;
		info("Checking URLs after init:", sessionStorage.getItem("imm-deep-link-url"), urls);
		if (sessionStorage.getItem("imm-deep-link-url") && timeKey != sessionStorage.getItem("imm-session-timestamp")) {
			const url = sessionStorage.getItem("imm-deep-link-url")!;
			info("Processing pending deep link URL from sessionStorage:", url);
			handleInAppLink(url);
			sessionStorage.removeItem("imm-deep-link-url");
			return;
		}
		if (urls.length === 0 || curUrlIndex >= urls.length) return;
		info("Processing URLs after init:", urls);
		handleInAppLink(urls[urls.length - 1]);
		setUrls([]);
	}, [urls, initDone]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogType, setDialogType] = useState("");
	useEffect(() => {
		if (dialogOpen && dialogType.startsWith("preview")) return () => {};
		const handlePaste = (event: ClipboardEvent) => {
			let activeEl = document.activeElement;
			if (activeEl?.tagName === "BUTTON") activeEl = null;
			if (activeEl === document.body || activeEl === null) {
				let text = event.clipboardData?.getData("Text");
				if (text?.startsWith("http")) {
					event.preventDefault();
					handleInAppLink(text);
				}
			}
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, [dialogOpen, dialogType]);
	const source = useAtomValue(SOURCE);
	const [deleteItemData, setDeleteItemData] = useState<Mod | null>(null);
	// const decor = useAtomValue(SETTINGS).global.winType
	const [modList, setModList] = useAtom(MOD_LIST);
	const [selected, setSelected] = useAtom(SELECTED);
	const testPinState = useAtomValue(TEST_PIN_STATE);
	const textData = useAtomValue(TEXT_DATA);
	const [data, setData] = useAtom(DATA);
	const [item, setItem] = useState<Mod | undefined>();
	const rightSidebarWidth = useAtomValue(RIGHT_SIDEBAR_WIDTH);
	const [cyclerTimerMinutes, setCyclerTimerMinutesState] = useState(getCyclerTimerMinutes);
	const itemTags = useMemo(() => new Set(item?.tags || []), [item?.tags]);
	const isRoverFemaleSkin = item?.parent === "Rover Female" && item?.name !== "Rover Female - Eye Hair Recolor Addon";
	const isAstralModulatorSkin = item?.path === "Rover Female\\Astral Modulator Rover";
	const characterCyclerMods = useMemo(
		() => (item ? modList.filter((mod) => mod.parent === item.parent && (mod.tags || []).includes("cycler")) : []),
		[item, modList]
	);
	const pinnedTestMod = useMemo(
		() => (testPinState.path ? modList.find((mod) => mod.path === testPinState.path) : undefined),
		[modList, testPinState.path]
	);
	const effectColors = useMemo(
		() => ({
			...DEFAULT_EFFECT_COLORS,
			...(item ? data[item.path]?.effectColors || {} : {}),
		}),
		[data, item]
	);
	const roverEyeHair = useMemo(
		() => ({
			...DEFAULT_ROVER_EYE_HAIR,
			...(item ? data[item.path]?.roverEyeHair || {} : {}),
		}),
		[data, item]
	);
	const selectedEffectPresetGroup = useMemo(
		() => EFFECT_COLOR_PRESET_GROUPS.find((group) => group.name === colorPresetGroup),
		[colorPresetGroup]
	);

	const [alertOpen, setAlertOpen] = useState(false);
	const [details, setDetails] = useState<any>({});
	useEffect(() => {
		if (!alertOpen) {
			setDeleteItemData(null);
		}
	}, [alertOpen]);
	useEffect(() => {
		if (initDone && testPinState.path && !pinnedTestMod) {
			store.set(TEST_PIN_STATE, { path: "", wasEnabled: false, suspendedPaths: [] });
		}
	}, [initDone, pinnedTestMod, testPinState.path]);
	function renameMod(path: string, newPath: string) {
		changeModName(path, newPath)
			.then((newPath) => {
				if (newPath) {
					const name = newPath.split("\\").pop();
					name &&
						newPath &&
						setModList((prev) => {
							return prev.map((m) => {
								if (m.path == path) {
									return { ...m, path: newPath, name, parent: newPath.split("\\")[0] };
								}
								return m;
							});
						});
					setSelected(newPath);
				}
			})
			.catch(() => {
				addToast({
					message: textData._Toasts.FailedRename,
					type: "error",
				});
			});
	}
	function updateCyclerTags(nextTags: string[]) {
		if (!item) return [] as Mod[];
		const sanitizedTags = nextTags.filter((tag) => tag !== "cycler_pin");
		const nextData = (() => {
			const prev = store.get(DATA);
			const nextData = { ...prev };
			nextData[item.path] = {
				...nextData[item.path],
				tags: sanitizedTags,
			};
			return nextData;
		})();
		const nextModList = store.get(MOD_LIST).map((mod) => {
			if (mod.path === item.path) return { ...mod, tags: sanitizedTags };
			return mod;
		});
		store.set(DATA, nextData);
		store.set(MOD_LIST, nextModList);
		setData(nextData);
		setModList(nextModList);
		saveConfigs();
		return nextModList;
	}
	function syncCyclerAfterTagChange(disableRemovedPath = "") {
		if (disableRemovedPath) {
			toggleMod(disableRemovedPath, false).catch((err) => {
				addToast({ type: "error", message: `Could not disable removed Cycler mod: ${String(err)}` });
			});
			setModList((prev) => prev.map((mod) => (mod.path === disableRemovedPath ? { ...mod, enabled: false } : mod)));
		}
	}
	function updateEffectColors(patch: Partial<typeof DEFAULT_EFFECT_COLORS>) {
		if (!item) return;
		const nextColors = {
			...DEFAULT_EFFECT_COLORS,
			...(store.get(DATA)[item.path]?.effectColors || {}),
			...patch,
		};
		const nextData = {
			...store.get(DATA),
			[item.path]: {
				...store.get(DATA)[item.path],
				effectColors: nextColors,
			},
		};
		store.set(DATA, nextData);
		setData(nextData);
		saveConfigs();
	}
	function updateRoverEyeHair(patch: Partial<typeof DEFAULT_ROVER_EYE_HAIR>) {
		if (!item) return;
		const nextRoverEyeHair = {
			...DEFAULT_ROVER_EYE_HAIR,
			...(store.get(DATA)[item.path]?.roverEyeHair || {}),
			...patch,
		};
		const nextData = {
			...store.get(DATA),
			[item.path]: {
				...store.get(DATA)[item.path],
				roverEyeHair: nextRoverEyeHair,
			},
		};
		store.set(DATA, nextData);
		setData(nextData);
		saveConfigs();
	}
	async function resetAllEffectColors() {
		try {
			const nextData = { ...store.get(DATA) };
			for (const path of Object.keys(nextData)) {
				if (nextData[path]?.effectColors) {
					nextData[path] = { ...nextData[path] };
					delete nextData[path].effectColors;
				}
			}
			store.set(DATA, nextData);
			setData(nextData);
			saveConfigs();
			await rebuildEffectColorsIni();
			addToast({ type: "success", message: "All effect colors reset. Press F10 in-game to reload." });
		} catch (err) {
			addToast({ type: "error", message: `Could not reset effect colors: ${String(err)}` });
		}
	}
	function resetCurrentEffectColors() {
		updateEffectColors({ ...DEFAULT_EFFECT_COLORS });
	}
	async function toggleCyclerMembership() {
		if (!item) return;
		if (testPinState.path === item.path && !(await clearTestPinnedMod(false))) return;
		const modPath = item.path;
		const tags = new Set(item.tags || []);
		const wasInCycler = tags.has("cycler");
		if (tags.has("cycler")) {
			tags.delete("cycler");
			tags.delete("cycler_pin");
		} else {
			tags.add("cycler");
		}
		updateCyclerTags(Array.from(tags));
		syncCyclerAfterTagChange(wasInCycler ? modPath : "");
	}
	async function rebuildCycler() {
		try {
			const result = await rebuildCyclerIni();
			if (result.ok) {
				setModList(await refreshModList());
			}
		} catch (err) {
			addToast({ type: "error", message: `Cycler rebuild failed: ${String(err)}` });
		}
	}
	async function applyEffectColors() {
		try {
			await rebuildEffectColorsIni();
		} catch (err) {
			addToast({ type: "error", message: `Effect colors failed: ${String(err)}` });
		}
	}
	async function applyRoverEyeHairColors() {
		try {
			await rebuildRoverEyeHairRecolorIni();
		} catch (err) {
			addToast({ type: "error", message: `Rover eye/hair colors failed: ${String(err)}` });
		}
	}
	async function resetRoverEyeHairToDefault() {
		if (!item) return;
		try {
			const nextData = { ...store.get(DATA) };
			if (nextData[item.path]?.roverEyeHair) {
				nextData[item.path] = { ...nextData[item.path] };
				delete nextData[item.path].roverEyeHair;
			}
			store.set(DATA, nextData);
			setData(nextData);
			saveConfigs();
			await rebuildRoverEyeHairRecolorIni();
			addToast({ type: "success", message: "Rover eye/hair reset to original. Press F10 in-game to reload." });
		} catch (err) {
			addToast({ type: "error", message: `Rover eye/hair reset failed: ${String(err)}` });
		}
	}
	function renderRoverEyeHairPanel() {
		const roverHairPresets = isAstralModulatorSkin ? ASTRAL_HAIR_COLOR_PRESETS : ROVER_HAIR_COLOR_PRESETS;
		const allPresets = roverColorPage === "eyes" ? ROVER_EYE_COLOR_PRESETS : roverHairPresets;
		const presets = roverPresetGroup ? allPresets.filter((preset) => preset.group === roverPresetGroup) : allPresets;
		const currentId = roverColorPage === "eyes" ? roverEyeHair.eye : roverEyeHair.hair;
		const groupLabels = Array.from(new Set(allPresets.map((preset) => preset.group)));
		const openRoverColorPage = (page: "eyes" | "hair") => {
			setRoverColorPage(page);
			setRoverPresetGroup(null);
		};
		return (
			<div className="flex h-full min-h-0 w-full flex-col gap-2 p-2">
				<div className="flex items-center justify-between gap-2 rounded-md border bg-background/30 px-2 py-1">
					<div className="min-w-0">
						<div className="text-sm font-semibold text-accent">{t("Rover eye / hair")}</div>
						<div className="text-[10px] leading-tight text-muted-foreground">{t("Per Rover skin")}</div>
					</div>
					<div className="flex items-center gap-1">
						<Button onClick={resetRoverEyeHairToDefault} className="h-8 px-2 text-[10px]" variant="ghost">
							{t("Default")}
						</Button>
						<Button
							onClick={() => updateRoverEyeHair({ enabled: !roverEyeHair.enabled })}
							className="h-8 min-w-16 justify-center"
							style={{
								color: roverEyeHair.enabled ? "var(--background)" : "",
								backgroundColor: roverEyeHair.enabled ? "var(--accent)" : "",
							}}
						>
							{roverEyeHair.enabled ? "On" : "Off"}
						</Button>
					</div>
				</div>
				{roverColorPage === "menu" ? (
					<>
						<div className="grid grid-cols-2 gap-2">
							<Button
								onClick={() => openRoverColorPage("eyes")}
								className="h-16 flex-col items-start justify-center gap-1 px-2 text-xs"
								variant="ghost"
								style={{ border: "1px solid var(--border)" }}
							>
								<span className="font-semibold">{t("Eyes")}</span>
								<span className="flex -space-x-1">
									{ROVER_EYE_COLOR_PRESETS.slice(0, 5).map((preset) => (
										<span
											key={preset.id}
											className="h-4 w-4 rounded-full border border-background"
											style={{ backgroundColor: preset.color, boxShadow: `0 0 7px ${preset.color}` }}
										/>
									))}
								</span>
							</Button>
							<Button
								onClick={() => openRoverColorPage("hair")}
								className="h-16 flex-col items-start justify-center gap-1 px-2 text-xs"
								variant="ghost"
								style={{ border: "1px solid var(--border)" }}
							>
								<span className="font-semibold">{t("Hair")}</span>
								<span className="flex -space-x-1">
									{roverHairPresets.slice(0, 5).map((preset) => (
										<span
											key={preset.id}
											className="h-4 w-4 rounded-full border border-background"
											style={{ backgroundColor: preset.color, boxShadow: `0 0 7px ${preset.color}` }}
										/>
									))}
								</span>
							</Button>
						</div>
					</>
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border bg-background/25 p-2">
						<div className="flex items-center justify-between gap-2">
							<Button
								onClick={() => {
									if (roverPresetGroup) {
										setRoverPresetGroup(null);
									} else {
										setRoverColorPage("menu");
									}
								}}
								className="h-8 px-2 text-xs"
								variant="ghost"
							>
								<ArrowLeftIcon className="h-3.5 w-3.5" />
								{roverPresetGroup ? (roverColorPage === "eyes" ? "Eyes" : "Hair") : "Eye / Hair"}
							</Button>
							<div className="truncate text-sm font-semibold text-accent">
								{roverPresetGroup || (roverColorPage === "eyes" ? "Eyes" : "Hair")}
							</div>
						</div>
						{!roverPresetGroup ? (
							<div className="grid grid-cols-1 gap-2">
								{groupLabels.map((group) => {
									const groupPresets = allPresets.filter((preset) => preset.group === group);
									return (
										<Button
											key={group}
											onClick={() => setRoverPresetGroup(group)}
											className="h-14 flex-col items-start justify-center gap-1 px-2 text-xs"
											variant="ghost"
											style={{ border: "1px solid var(--border)" }}
										>
											<span className="font-semibold">{group}</span>
											<span className="flex -space-x-1">
												{groupPresets.slice(0, 6).map((preset) => (
													<span
														key={preset.id}
														className="h-4 w-4 rounded-full border border-background"
														style={{ backgroundColor: preset.color, boxShadow: `0 0 7px ${preset.color}` }}
													/>
												))}
											</span>
										</Button>
									);
								})}
							</div>
						) : (
							<div className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-y-auto pr-1">
								{presets.map((preset) => (
									<Button
										key={preset.id}
										onClick={() =>
											updateRoverEyeHair({
												enabled: true,
												...(roverColorPage === "eyes" ? { eye: preset.id } : { hair: preset.id }),
											})
										}
										className="h-12 justify-start gap-2 px-2 text-xs"
										variant="ghost"
										style={{
											border: currentId === preset.id ? "1px solid var(--accent)" : "1px solid var(--border)",
											color: currentId === preset.id ? "var(--accent)" : "",
										}}
									>
										<span
											className="h-5 w-5 shrink-0 rounded-full border border-background"
											style={{ backgroundColor: preset.color, boxShadow: `0 0 10px ${preset.color}` }}
										/>
										<span className="truncate">{preset.name}</span>
									</Button>
								))}
							</div>
						)}
					</div>
				)}
				<Button onClick={applyRoverEyeHairColors} className="h-8 w-full justify-center">
					<PaletteIcon className="h-4 w-4" />
					{t("Apply Rover Colors")}
				</Button>
			</div>
		);
	}
	useEffect(() => {
		setRoverColorPage("menu");
		setRoverPresetGroup(null);
		if (!isRoverFemaleSkin) {
			setTab((prev) => (prev === "eyehair" ? "hotkeys" : prev));
		}
	}, [selected, isRoverFemaleSkin]);
	useEffect(() => {
		text = "";
		if (selected) {
			const mod = { ...modList.find((m) => m.path == selected) } as Mod;
			text = mod?.note || "";
			if (mod) {
				setItem(mod);
				if (cachcedDetails[mod.path]) {
					setDetails(cachcedDetails[mod.path]);
				} else {
					setDetails({
						keys: item?.keys || [],
						files: item?.files || {},
					});
				}
				getModDetails(mod.path).then((details) => {
					// cachcedDetails[mod.path] = details;
					const modData = data[mod.path]?.vars;
					if (modData) {
						details.keys = details.keys.map((key: any) => {
							if (modData[key.file] && modData[key.file][key.target]) {
								key.pref = modData[key.file][key.target].pref;
								key.reset = modData[key.file][key.target].reset;
								key.name = modData[key.file][key.target].name || key.target;
								key.state = modData[key.file][key.target].state || null;
							}
							if (key.namespace && modData["namespace"] && modData["namespace"][key.target]) {
								key.pref = modData["namespace"][key.target].pref;
								key.state = modData["namespace"][key.target].state || null;
							}
							return key;
						});
						Object.keys(details.files).forEach((file) => {
							details.files[file] = details.files[file].map((key: any) => {
								if (modData[file] && modData[file][key.target]) {
									key.pref = modData[file][key.target].pref;
									key.reset = modData[file][key.target].reset;
									key.name = modData[file][key.target].name || key.target;
									key.state = modData[file][key.target].state || null;
								}
								if (key.namespace && modData["namespace"] && modData["namespace"][key.target]) {
									key.pref = modData["namespace"][key.target].pref;
									key.state = modData["namespace"][key.target].state || null;
								}
								return key;
							});
						});
					}
					details.keys = details.keys
						.map((key: any) => ({ ...key, key: formatHotkeyDisplay(normalizeHotkey(key.key)) }))
						.sort((a: any, b: any) => a.key.localeCompare(b.key));

					setDetails(details);
					cachcedDetails[mod.path] = details;
				});
				return;
			}
		}
		setItem(undefined);
	}, [selected, modList, data]);
	//info(item?.keys);
	return (
		<Sidebar
			side="right"
			className="pt-8 duration-300"
			style={{ "--sidebar-width": `${rightSidebarWidth}px` } as CSSProperties}
		>
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				{dialogType == "edit-mod-config" && details ? (
					<ModPreferences item={item} details={details} />
				) : (
					<ManageCategories />
				)}
			</Dialog>
			<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
				<AlertDialogContent>
					<div className="max-w-96 flex flex-col items-center gap-6 mt-6 text-center">
						<div className="max-w-96 text-xl text-gray-200 wrap-break-words">
							{textData._Main._MainLocal.Delete} <span className="text-accent ">{deleteItemData?.name}</span>?
						</div>
						<div className="text-destructive">{textData._Main._MainLocal.Irrev}</div>
					</div>
					<div className="flex justify-between w-full gap-4 mt-4">
						<AlertDialogCancel variant="default" className="w-24 duration-300">
							{textData.Cancel}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							className=" w-24"
							onClick={async () => {
								if (!deleteItemData) return;
								if (testPinState.path === deleteItemData.path && !(await clearTestPinnedMod(false))) return;
								setData((prev) => {
									const newData = { ...prev };
									if (deleteItemData.path) {
										delete newData[deleteItemData.path];
									}
									return newData;
								});
								deleteMod(deleteItemData.path);
								saveConfigs();
								setModList((prev) => {
									const newData = prev.filter((m) => m.path != deleteItemData.path);
									return newData;
								});
								setAlertOpen(false);
								setSelected("");
							}}
						>
							{textData._Main._MainLocal.Delete}
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialog>
			<SidebarContent className="bgpattern bg-sidebar flex flex-row w-full h-full gap-0 p-0 overflow-hidden duration-300 border border-t-0">
				<div className=" flex flex-col items-center h-full min-w-full overflow-y-hidden" key={item?.path || "no-item"}>
					<div className="text-accent min-h-10 flex items-center justify-center h-10 min-w-full gap-3 px-3 border-b">
						{item ? (
							<>
								<Button
									className="aspect-square max-h-6"
									onClick={() => {
										openPath(join(source, managedSRC, item.path));
									}}
								>
									<ArrowUpRightFromSquareIcon className="max-h-3" />
								</Button>
								<Input
									onFocus={(e) => {
										e.target.select();
									}}
									onBlur={(e) => {
										if (e.currentTarget.value != item.name) {
											renameMod(item.path, join(...item.path.split("\\").slice(0, -1), e.currentTarget.value));
										}
									}}
									type="text"
									key={item?.name || "no-item"}
									className="label text-muted-foreground text-ellipsis"
									defaultValue={item?.name || ""}
								/>
								<Button
									className="aspect-square max-h-6"
									onClick={() => {
										setSelected("");
									}}
									title="Close mod details"
								>
									<XIcon className="max-h-3" />
								</Button>
							</>
						) : (
							"---"
						)}
					</div>
					{!item && (
						<SidebarGroup className="shrink-0 px-2 py-2">
							<div className="flex flex-col gap-2 rounded-lg border bg-background/25 p-2">
								<div className="flex items-center gap-2 text-xs font-semibold text-accent">
									<PinIcon className="h-3.5 w-3.5" />
									{t("Temporary test pin")}
								</div>
								{pinnedTestMod ? (
									<div
										role="button"
										tabIndex={0}
										onClick={() => setSelected(pinnedTestMod.path)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") setSelected(pinnedTestMod.path);
										}}
										className="group flex w-full items-center gap-2 rounded-md border bg-sidebar/70 p-2 text-left hover:border-accent"
									>
										<img
											src={getImageUrl(pinnedTestMod.path)}
											onError={(event) => handleImageError(event)}
											className="h-12 w-12 shrink-0 rounded-md object-cover"
										/>
										<div className="min-w-0 flex-1">
											<div className="truncate text-xs font-semibold text-foreground group-hover:text-accent">
												{pinnedTestMod.name}
											</div>
											<div className="truncate text-[10px] text-muted-foreground">{pinnedTestMod.parent}</div>
										</div>
										<Button
											onClick={async (event) => {
												event.stopPropagation();
												await clearTestPinnedMod();
											}}
											title="Clear temporary test pin"
											className="h-8 w-8 shrink-0 p-0 text-accent"
										>
											<PinIcon className="h-4 w-4 fill-current" />
										</Button>
									</div>
								) : (
									<div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
										{t("No pinned mod.")}
									</div>
								)}
							</div>
						</SidebarGroup>
					)}
					<SidebarGroup className="shrink-0 px-1 my-1">
						<div className="flex flex-col w-full gap-1 py-1 border rounded-lg">
							<div className="bg-pat2 flex flex-col gap-1.5 px-2 py-1.5 rounded-lg">
								<Tabs value={modToolsTab} onValueChange={(val: any) => setModToolsTab(val)} className="w-full">
									<TabsList className="bg-background/0 grid h-8 w-full grid-cols-2 gap-1">
										<TabsTrigger
											value="cycler"
											nbg2
											className="transparent-bg h-8"
											style={{
												color: modToolsTab === "cycler" ? "var(--accent)" : "var(--muted-foreground)",
												border: "1px solid var(--border)",
												opacity: modToolsTab === "cycler" ? 1 : 0.55,
											}}
										>
											<ShuffleIcon className="h-3.5 w-3.5" />
											Cycler
										</TabsTrigger>
										<TabsTrigger
											value="colors"
											nbg2
											className="transparent-bg h-8"
											style={{
												color: modToolsTab === "colors" ? "var(--accent)" : "var(--muted-foreground)",
												border: "1px solid var(--border)",
												opacity: modToolsTab === "colors" ? 1 : 0.55,
											}}
										>
											<PaletteIcon className="h-3.5 w-3.5" />
											Colors
										</TabsTrigger>
									</TabsList>
								</Tabs>
								{modToolsTab === "cycler" ? (
									<>
										<div className="flex items-center justify-end gap-2">
											<span className="text-[10px] text-muted-foreground">
												{characterCyclerMods.length} in {item?.parent || "character"}
											</span>
										</div>
										<div>
											<Button
												onClick={toggleCyclerMembership}
												className="h-8 w-full justify-center"
												style={{
													color: itemTags.has("cycler") ? "var(--background)" : "",
													backgroundColor: itemTags.has("cycler") ? "var(--accent)" : "",
												}}
											>
												{itemTags.has("cycler") ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
												{itemTags.has("cycler") ? "Remove" : "Add"}
											</Button>
										</div>
										<div className="flex items-center justify-between gap-2 rounded-md border bg-background/30 px-2 py-1">
											<div className="min-w-0 text-[10px] leading-tight text-muted-foreground">
												<div className="truncate">
													{itemTags.has("cycler")
														? t("This mod will be available for no-reload cycling.")
														: t("This mod is outside the Cycler.")}
												</div>
											</div>
											<ShuffleIcon className="h-4 w-4 shrink-0 text-accent" />
										</div>
										<div className="flex items-center justify-between gap-2 rounded-md border bg-background/30 px-2 py-1">
											<div className="min-w-0">
												<div className="text-xs font-semibold text-accent">{t("Cycle every")}</div>
												<div className="text-[10px] leading-tight text-muted-foreground">
													{t("Used after Rebuild Cycler/F11")}
												</div>
											</div>
											<select
												value={cyclerTimerMinutes}
												onChange={(event) => {
													const nextMinutes = Number(event.currentTarget.value);
													setCyclerTimerMinutes(nextMinutes);
													setCyclerTimerMinutesState(nextMinutes);
												}}
												className="h-8 rounded-md border bg-sidebar px-2 text-xs font-semibold text-accent outline-none"
											>
												{CYCLER_TIMER_MINUTE_OPTIONS.map((minutes) => (
													<option key={minutes} value={minutes}>
														{minutes} min
													</option>
												))}
											</select>
										</div>
										<Button onClick={rebuildCycler} className="h-8 w-full justify-center">
											<RefreshCwIcon className="h-4 w-4" />
											{t("Rebuild Cycler")}
										</Button>
									</>
								) : (
									<div className="flex flex-col gap-2">
										<div className="flex items-center justify-between gap-2 rounded-md border bg-background/30 px-2 py-1">
											<div className="min-w-0">
												<div className="text-xs font-semibold text-accent">{t("Effect colors")}</div>
												<div className="text-[10px] leading-tight text-muted-foreground">{t("Per mod")}</div>
											</div>
											<div className="flex items-center gap-1">
												<Button onClick={resetCurrentEffectColors} className="h-8 px-2 text-[10px]" variant="ghost">
													{t("Default")}
												</Button>
												<Button onClick={resetAllEffectColors} className="h-8 px-2 text-[10px]" variant="ghost">
													{t("Reset all")}
												</Button>
												<Button
													onClick={() => updateEffectColors({ enabled: !effectColors.enabled })}
													className="h-8 min-w-16 justify-center"
													style={{
														color: effectColors.enabled ? "var(--background)" : "",
														backgroundColor: effectColors.enabled ? "var(--accent)" : "",
													}}
												>
													{effectColors.enabled ? t("On") : t("Off")}
												</Button>
											</div>
										</div>
										<div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 rounded-md border bg-background/30 px-2 py-2 text-xs">
											{[
												["Red", "red", "#ff6f6f"],
												["Green", "green", "#7dff9f"],
												["Blue", "blue", "#75baff"],
											].map(([label, key, color]) => (
												<div key={key} className="contents">
													<span className="w-10 text-muted-foreground">{t(label)}</span>
													<input
														type="range"
														min="0"
														max="1"
														step="0.01"
														value={effectColors[key as "red" | "green" | "blue"]}
														onChange={(event) => updateEffectColors({ [key]: Number(event.currentTarget.value) })}
														className="w-full accent-[var(--accent)]"
														style={{ accentColor: color }}
													/>
													<span className="w-8 text-right font-semibold text-accent">
														{effectColors[key as "red" | "green" | "blue"].toFixed(2)}
													</span>
												</div>
											))}
										</div>
										<div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 rounded-md border bg-background/30 px-2 py-2 text-xs">
											{[
												["R+", "redOffset", "#ff6f6f"],
												["G+", "greenOffset", "#7dff9f"],
												["B+", "blueOffset", "#75baff"],
											].map(([label, key, color]) => (
												<div key={key} className="contents">
													<span className="w-10 text-muted-foreground">{label}</span>
													<input
														type="range"
														min="0"
														max="1"
														step="0.01"
														value={effectColors[key as "redOffset" | "greenOffset" | "blueOffset"]}
														onChange={(event) => updateEffectColors({ [key]: Number(event.currentTarget.value) })}
														className="w-full accent-[var(--accent)]"
														style={{ accentColor: color }}
													/>
													<span className="w-8 text-right font-semibold text-accent">
														{effectColors[key as "redOffset" | "greenOffset" | "blueOffset"].toFixed(2)}
													</span>
												</div>
											))}
										</div>
										<div className="flex items-center justify-between gap-2 rounded-md border bg-background/30 px-2 py-1">
											<div
												className="h-8 w-16 rounded-md border"
												style={{
													backgroundColor: `rgb(${Math.round(Math.min(1, effectColors.red * 0.45 + effectColors.redOffset) * 255)}, ${Math.round(Math.min(1, effectColors.green * 0.45 + effectColors.greenOffset) * 255)}, ${Math.round(Math.min(1, effectColors.blue * 0.45 + effectColors.blueOffset) * 255)})`,
													boxShadow: "0 0 14px currentColor",
													color: `rgb(${Math.round(Math.min(1, effectColors.red * 0.45 + effectColors.redOffset) * 255)}, ${Math.round(Math.min(1, effectColors.green * 0.45 + effectColors.greenOffset) * 255)}, ${Math.round(Math.min(1, effectColors.blue * 0.45 + effectColors.blueOffset) * 255)})`,
												}}
											/>
											<div className="min-w-0 text-[10px] leading-tight text-muted-foreground">
												<div>{t("RGB multiplies the original effect color.")}</div>
												<div>{t("Offset adds extra tint/intensity.")}</div>
											</div>
										</div>
										<Button onClick={applyEffectColors} className="h-8 w-full justify-center">
											<RefreshCwIcon className="h-4 w-4" />
											{t("Apply Colors")}
										</Button>
									</div>
								)}
								{false && isRoverFemaleSkin ? (
									<div className="flex flex-col gap-2 rounded-md border bg-background/25 p-2">
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="text-xs font-semibold text-accent">{t("Rover eye / hair")}</div>
												<div className="text-[10px] leading-tight text-muted-foreground">{t("Per Rover skin")}</div>
											</div>
											<Button
												onClick={() => updateRoverEyeHair({ enabled: !roverEyeHair.enabled })}
												className="h-8 min-w-16 justify-center"
												style={{
													color: roverEyeHair.enabled ? "var(--background)" : "",
													backgroundColor: roverEyeHair.enabled ? "var(--accent)" : "",
												}}
											>
												{roverEyeHair.enabled ? t("On") : t("Off")}
											</Button>
										</div>
										<div className="rounded-md border bg-background/30 p-2">
											<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
												{t("Eyes")}
											</div>
											<div className="grid grid-cols-2 gap-1">
												{ROVER_EYE_COLOR_PRESETS.map((preset) => (
													<Button
														key={preset.id}
														onClick={() => updateRoverEyeHair({ enabled: true, eye: preset.id })}
														className="h-8 justify-start gap-2 px-2 text-[11px]"
														variant="ghost"
														style={{
															border:
																roverEyeHair.eye === preset.id ? "1px solid var(--accent)" : "1px solid var(--border)",
															color: roverEyeHair.eye === preset.id ? "var(--accent)" : "",
														}}
													>
														<span
															className="h-4 w-4 shrink-0 rounded-full border border-background"
															style={{ backgroundColor: preset.color, boxShadow: `0 0 8px ${preset.color}` }}
														/>
														<span className="truncate">{preset.name}</span>
													</Button>
												))}
											</div>
										</div>
										<div className="rounded-md border bg-background/30 p-2">
											<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
												{t("Hair")}
											</div>
											<div className="grid grid-cols-2 gap-1">
												{ROVER_HAIR_COLOR_PRESETS.map((preset) => (
													<Button
														key={preset.id}
														onClick={() => updateRoverEyeHair({ enabled: true, hair: preset.id })}
														className="h-8 justify-start gap-2 px-2 text-[11px]"
														variant="ghost"
														style={{
															border:
																roverEyeHair.hair === preset.id ? "1px solid var(--accent)" : "1px solid var(--border)",
															color: roverEyeHair.hair === preset.id ? "var(--accent)" : "",
														}}
													>
														<span
															className="h-4 w-4 shrink-0 rounded-full border border-background"
															style={{ backgroundColor: preset.color, boxShadow: `0 0 8px ${preset.color}` }}
														/>
														<span className="truncate">{preset.name}</span>
													</Button>
												))}
											</div>
										</div>
										<Button onClick={applyRoverEyeHairColors} className="h-8 w-full justify-center">
											<PaletteIcon className="h-4 w-4" />
											{t("Apply Rover Colors")}
										</Button>
									</div>
								) : null}
							</div>
						</div>
					</SidebarGroup>
					<SidebarGroup
						className="min-h-0 flex-1 duration-200 opacity-0"
						style={{
							opacity: item ? 1 : 0,
							marginBottom: item ? "0rem" : "-20rem",
						}}
					>
						<div className=" flex flex-col w-full h-full min-h-0 p-2 overflow-hidden">
							{modToolsTab === "colors" ? (
								<div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden rounded-md border p-2">
									<div className="flex items-center justify-between gap-2">
										<div>
											<div className="text-sm font-semibold text-accent">{t("Color presets")}</div>
											<div className="text-[10px] leading-tight text-muted-foreground">
												{t("Pick a theme, then choose a color.")}
											</div>
										</div>
										<div
											className="h-8 w-10 rounded-md border"
											style={{
												backgroundColor: `rgb(${Math.round(Math.min(1, effectColors.red * 0.45 + effectColors.redOffset) * 255)}, ${Math.round(Math.min(1, effectColors.green * 0.45 + effectColors.greenOffset) * 255)}, ${Math.round(Math.min(1, effectColors.blue * 0.45 + effectColors.blueOffset) * 255)})`,
											}}
										/>
									</div>
									{!selectedEffectPresetGroup ? (
										<>
											<div className="grid grid-cols-2 gap-1">
												{EFFECT_COLOR_PRESET_GROUPS.map((group) => (
													<Button
														key={group.name}
														onClick={() => setColorPresetGroup(group.name)}
														className="h-14 flex-col items-start justify-center gap-1 px-2 text-xs"
														variant="ghost"
														style={{ border: "1px solid var(--border)" }}
													>
														<span className="truncate font-semibold">{t(group.name)}</span>
														<span className="flex shrink-0 -space-x-1">
															{group.presets.slice(0, 4).map((preset) => (
																<span
																	key={preset.name}
																	className="h-4 w-4 rounded-full border border-background"
																	style={{ backgroundColor: preset.color, boxShadow: `0 0 7px ${preset.color}` }}
																/>
															))}
														</span>
													</Button>
												))}
											</div>
											<div className="rounded-md border bg-background/30 p-2 text-[10px] leading-tight text-muted-foreground">
												{t("Choose a theme to open its preset colors.")}
											</div>
										</>
									) : (
										<div className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border bg-background/25 p-2">
											<div className="flex items-center justify-between gap-2">
												<Button onClick={() => setColorPresetGroup(null)} className="h-8 px-2 text-xs" variant="ghost">
													<ArrowLeftIcon className="h-3.5 w-3.5" />
													{t("Themes")}
												</Button>
												<div className="flex min-w-0 flex-1 items-center justify-end gap-2">
													<div className="truncate text-sm font-semibold text-accent">
														{t(selectedEffectPresetGroup.name)}
													</div>
													<div className="flex gap-1">
														{selectedEffectPresetGroup.presets.map((preset) => (
															<span
																key={preset.name}
																className="h-2.5 w-2.5 rounded-full"
																style={{ backgroundColor: preset.color, boxShadow: `0 0 6px ${preset.color}` }}
															/>
														))}
													</div>
												</div>
											</div>
											<div className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-y-auto pr-1">
												{selectedEffectPresetGroup.presets.map((preset) => (
													<Button
														key={preset.name}
														onClick={() => updateEffectColors({ enabled: true, ...preset.values })}
														className="h-12 justify-start gap-2 px-2 text-xs"
														variant="ghost"
														style={{ border: "1px solid var(--border)" }}
													>
														<span
															className="h-5 w-5 shrink-0 rounded-full border"
															style={{
																backgroundColor: preset.color,
																boxShadow: `0 0 10px ${preset.color}`,
															}}
														/>
														<span className="truncate">{preset.name}</span>
													</Button>
												))}
											</div>
											<div className="rounded-md border bg-background/30 p-2 text-[10px] leading-tight text-muted-foreground">
												Tip: black effects need a dark color plus a little offset. Pure black usually hides the glow.
											</div>
										</div>
									)}
								</div>
							) : (
								<Tabs value={tab} onValueChange={(val: any) => setTab(val)} className="w-full h-full min-h-0">
									<TabsList
										className={`bg-background/0 grid w-full h-8 gap-2 ${isRoverFemaleSkin ? "grid-cols-3" : "grid-cols-2"}`}
									>
										<TabsTrigger
											value="hotkeys"
											nbg2
											className="transparent-bg h-8"
											style={{
												color: tab == "hotkeys" ? "var(--accent)" : "var(--muted-foreground)",
												border: "1px solid var(--border)",
												opacity: tab == "hotkeys" ? 1 : 0.4,
											}}
										>
											{textData._RightSideBar._RightLocal.HotKeys}
										</TabsTrigger>
										<TabsTrigger
											nbg2
											value="notes"
											className="transparent-bg h-8"
											style={{
												color: tab === "notes" ? "var(--accent)" : "var(--muted-foreground)",
												border: "1px solid var(--border)",
												opacity: tab === "notes" ? 1 : 0.4,
											}}
										>
											{textData._RightSideBar._RightLocal.Notes}
										</TabsTrigger>
										{isRoverFemaleSkin ? (
											<TabsTrigger
												nbg2
												value="eyehair"
												className="transparent-bg h-8"
												style={{
													color: tab === "eyehair" ? "var(--accent)" : "var(--muted-foreground)",
													border: "1px solid var(--border)",
													opacity: tab === "eyehair" ? 1 : 0.4,
												}}
											>
												Eye/Hair
											</TabsTrigger>
										) : null}
									</TabsList>
									<AnimatePresence mode="wait" initial={false}>
										<motion.div
											key={tab + item?.note}
											initial={{ opacity: 0, x: tab == "hotkeys" ? "-25%" : "25%" }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: tab == "hotkeys" ? "-25%" : "25%" }}
											transition={{ duration: 0.2 }}
											className="flex w-full h-full gap-2 border rounded-md"
										>
											{tab == "hotkeys" ? (
												<div className="text-gray-300 h-full min-h-0 flex flex-col w-full overflow-y-auto overflow-x-hidden">
													{item &&
														details?.keys?.map((hotkey: any, index: number) => (
															<div
																key={index + item.path}
																className={
																	"flex border-b justify-center text-border items-center gap-2 w-full min-h-10 px-4 py-2 bg-pat" +
																	(1 + (index % 2))
																}
															>
																<label className="min-w-1/3 max-w-1/3 text-accent flex-1 text-sm truncate">
																	{hotkey.name}
																</label>
																|
																<div className=" flex items-center w-2/3 gap-1">
																	{(hotkey.key as string).split(" ﹢ ").map((key, i, arr) => (
																		<span key={i} className="flex items-center">
																			<kbd className="text-accent bg-sidebar border-border min-w-8 px-2 py-1 text-sm font-semibold text-center border rounded-md shadow-sm">
																				{key}
																			</kbd>
																			{i < arr.length - 1 && (
																				<span className="text-muted-foreground mx-1 text-xs">+</span>
																			)}
																		</span>
																	))}
																</div>
															</div>
														))}
												</div>
											) : tab == "eyehair" ? (
												renderRoverEyeHairPanel()
											) : (
												<div className="w-full h-full p-2">
													<textarea
														onBlur={(e) => {
															text = e.currentTarget.value;
															if (item && e.currentTarget.value !== item?.note) {
																setData((prev) => {
																	prev[item.path] = {
																		...prev[item.path],
																		note: e.currentTarget.value,
																	};
																	return { ...prev };
																});
																setModList((prev) => {
																	return prev.map((m) => {
																		if (m.path == item.path) {
																			return { ...m, note: e.currentTarget.value };
																		}
																		return m;
																	});
																});
																saveConfigs();
															}
														}}
														className="w-full focus-within:outline-0 resize-none  select-none focus-within:select-auto overflow-y-scroll h-full  focus-visible:ring-[0px] border-0  text-ellipsis"
														style={{ backgroundColor: "#fff0" }}
														key={item?.note}
														placeholder={textData._RightSideBar._RightLocal.NoNotes}
														defaultValue={text}
													/>
												</div>
											)}
										</motion.div>
									</AnimatePresence>
								</Tabs>
							)}
						</div>
					</SidebarGroup>
					<SidebarGroup
						className="min-h-10 p-2 pt-0 mb-2 overflow-hidden"
						style={{
							maxHeight: item ? "2.5rem" : "",
						}}
					>
						{item && (
							<Button
								className="w-full h-10"
								onClick={() => {
									setDialogType("edit-mod-config");
									setDialogOpen(true);
								}}
							>
								<Settings2Icon className="w-4 h-4" />
								{textData._RightSideBar._components._ModPreferences.EditConf}
							</Button>
						)}

						<div className="w-full -mb-2 pointer-events-auto justify-between flex">
							<Button
								className="w-38.75 h-12"
								onClick={async () => {
									const files = (await selectPath({
										multiple: true,
										title: "Select .7z/.zip/.rar Archive(s) to Install Mod(s) From",
									})) as string[] | null;
									if (!files || files.length === 0) return;
									installFromArchives(files || ([] as string[])).then(async () => {
										setModList(await refreshModList());
									});
								}}
							>
								<DownloadIcon className="w-4 h-4" />
								{textData._RightSideBar._RightLocal.ManualInstall}
							</Button>
							<Button
								className="w-38.75 h-12"
								variant="destructive"
								onClick={() => {
									openConflict();
								}}
							>
								<SwordsIcon className="w-4 h-4" />
								{textData._RightSideBar._RightLocal.Conflicts}
							</Button>
						</div>
					</SidebarGroup>
					{item && (
						<SidebarGroup className="shrink-0 px-2 pt-0 mb-2">
							<div className="bg-pat1 flex justify-between w-full px-1 rounded-lg border">
								<Label className="bg-input/0 flex items-center justify-center hover:bg-input/0 h-10 w-24 text-accent ">
									{textData._RightSideBar._RightLocal.Source}
								</Label>
								<div className="min-w-0 flex flex-1 items-center px-1">
									<Input
										onBlur={(e) => {
											if (item && e.currentTarget.value !== item?.source) {
												setData((prev) => {
													prev[item.path] = {
														...prev[item.path],
														source: e.currentTarget.value,
														updatedAt: Date.now(),
														viewedAt: 0,
													};
													return { ...prev };
												});
												setModList((prev) => {
													return prev.map((m) => {
														if (m.path == item.path) {
															return { ...m, source: e.currentTarget.value };
														}
														return m;
													});
												});
												saveConfigs();
											}
										}}
										type="text"
										placeholder={textData._RightSideBar._RightLocal.NoSource}
										className="w-full select-none focus-within:select-auto overflow-hidden h-10 focus-visible:ring-[0px] border-0 text-ellipsis"
										style={{ backgroundColor: "#fff0" }}
										key={item?.source}
										defaultValue={item?.source}
									/>
									{item?.source ? (
										<Button
											className="bg-pat2"
											onClick={() => {
												if (item?.source && item?.source != "") {
													handleInAppLink(item.source || "");
												}
											}}
										>
											<Tooltip>
												<TooltipTrigger>
													<LinkIcon className=" w-4 h-4" />
												</TooltipTrigger>
												<TooltipContent className="flex items-center justify-center w-20">
													<p className="max-w-20 w-full text-center">
														{textData._RightSideBar._RightLocal.ViewModOnline}
													</p>
												</TooltipContent>
											</Tooltip>
										</Button>
									) : (
										<Button
											onClick={() => {
												setOnline(true);
												const search = document.getElementById("search-input") as HTMLInputElement;
												setTimeout(() => {
													search.focus();
													search.value = item?.name.replaceAll("_", " ");
													search.blur();
												}, 100);
												setSelected("");
											}}
											className="bg-pat2"
										>
											<Tooltip>
												<TooltipTrigger>
													<SearchIcon className=" w-4 h-4 pointer-events-none" />
												</TooltipTrigger>
												<TooltipContent className="w-15 flex items-center justify-center">
													<p className="max-w-15 w-full text-center">
														{textData._RightSideBar._RightLocal.SearchOnline}
													</p>
												</TooltipContent>
											</Tooltip>
										</Button>
									)}
								</div>
								<Button
									className="h-8 w-8 shrink-0 p-0"
									variant="destructive"
									title="Delete mod"
									onClick={() => {
										setDeleteItemData((prev) => {
											if (prev) return prev;
											setAlertOpen(true);
											return item;
										});
									}}
								>
									<TrashIcon className="h-4 w-4" />
								</Button>
							</div>
						</SidebarGroup>
					)}
				</div>
			</SidebarContent>
		</Sidebar>
	);
}

export default RightLocal;
