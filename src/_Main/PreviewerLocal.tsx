import { LOCAL_SPECIAL_CATEGORIES, PRESET_GALLERY_CATEGORY, UNCATEGORIZED } from "@/utils/consts";
import { getImageUrl, handleImageError } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	CATEGORIES,
	CONFLICTS,
	CONFLICT_INDEX,
	DATA,
	FILTER,
	INIT_DONE,
	INSTALLED_ITEMS,
	LAST_UPDATED,
	MOD_LIST,
	PRESETS,
	PREVIEW_CAPTURE_TARGET,
	PREVIEW_CATEGORY,
	RECENT_CATEGORIES,
	SELECTED,
	SETTINGS,
	TEXT_DATA,
	openConflict,
	store,
	TEST_PIN_STATE,
} from "@/utils/vars";
import {
	applyPreset,
	getCyclerTimerMinutes,
	preparePresetReloadNotice,
	rebuildEffectColorsIni,
	rebuildCyclerIni,
	refreshModList,
	saveConfigs,
	setCyclerTimerMinutes,
	toggleMod,
} from "@/utils/filesys";
import { useAtom, useAtomValue } from "jotai";
import {
	ArrowLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	FolderOpenIcon,
	HeartIcon,
	ImageOffIcon,
	KeyboardIcon,
	PaletteIcon,
	PencilIcon,
	PlusIcon,
	SearchIcon,
	TrashIcon,
	XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import CardLocal from "./components/CardLocal";
import ModLooksView from "./components/ModLooksView";
import { addToast } from "@/_Toaster/ToastProvider";
import PresetColorEditorModal from "./components/PresetColorEditorModal";
import { type EffectColors } from "@/utils/effectColors";
import { getCustomHotkeys, normalizeHotkeyForCompare } from "@/utils/customHotkeys";
import { eventMatchesClickShortcut } from "@/utils/customClickShortcuts";
import { processHotkeyCode, registerGlobalHotkeys } from "@/utils/hotkeyUtils";
import { getActiveModCollisionGroups, getModCollisionGroups, getRoverFemaleVariant } from "@/utils/modCollision";
import { useCustomI18n } from "@/utils/customI18n";
import { setChange } from "@/utils/hotreload";

type PreviewSubGroup = {
	id: string;
	label: string;
	matches: (text: string) => boolean;
};

const CHARACTER_FAVORITES_KEY = "__wuwa_imm_custom_character_favorites__";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
function normalizePreviewText(text: string) {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

function buildPresetHotkey(event: React.KeyboardEvent<HTMLInputElement>) {
	const key = processHotkeyCode(event.code)
		.split("")
		.map((character, index) => (index === 0 ? character.toUpperCase() : character))
		.join("");
	const modifiers = [
		event.ctrlKey && key !== "Ctrl" ? "Ctrl" : "",
		event.altKey && key !== "Alt" ? "Alt" : "",
		event.shiftKey && key !== "Shift" ? "Shift" : "",
	].filter(Boolean);
	const modifierOnly = ["Ctrl", "Alt", "Shift"].includes(key);
	return { value: modifierOnly ? key : [...modifiers, key].join("+"), complete: !modifierOnly };
}

function getPreviewSubGroups(characterName: string): PreviewSubGroup[] {
	const character = normalizePreviewText(characterName);
	if (character === "aemeath" || character === "aemeth" || character === "ameath") {
		const isMecha = (text: string) => text.includes("mecha") || text.includes("mechanical");
		return [
			{ id: "aemeth", label: "Aemeth", matches: (text) => !isMecha(text) },
			{ id: "mecha", label: "Mecha", matches: isMecha },
		];
	}
	if (character === "cartethyia" || character === "carthetia" || character === "carthethyia") {
		const isFlourdelys = (text: string) =>
			text.includes("flourdelys") || text.includes("fleurdelys") || text.includes("fluerdelys");
		return [
			{ id: "carthetia", label: "Carthetia", matches: (text) => !isFlourdelys(text) },
			{ id: "flourdelys", label: "Flourdelys", matches: isFlourdelys },
		];
	}
	if (character === "rover female" || character === "female rover" || character === "rover_female") {
		return [
			{ id: "rover", label: "Rover", matches: (text) => getRoverFemaleVariant(text) === "rover" },
			{ id: "uniform", label: "Uniform", matches: (text) => getRoverFemaleVariant(text) === "uniform" },
			{ id: "eye-hair", label: "Eye/Hair", matches: (text) => getRoverFemaleVariant(text) === "eye-hair" },
		];
	}
	return [];
}

function PreviewerLocal() {
	const t = useCustomI18n();
	const initDone = useAtomValue(INIT_DONE);
	const textData = useAtomValue(TEXT_DATA);
	const categories = useAtomValue(CATEGORIES);
	const [conflicts, setConflicts] = useAtom(CONFLICTS);
	const installedItems = useAtomValue(INSTALLED_ITEMS);
	const [presets, setPresets] = useAtom(PRESETS);
	const lastUpdated = useAtomValue(LAST_UPDATED);
	const [modList, setModList] = useAtom(MOD_LIST);
	const [filter, setFilter] = useAtom(FILTER);
	const [selected, setSelected] = useAtom(SELECTED);
	const [previewCategory, setPreviewCategory] = useAtom(PREVIEW_CATEGORY);
	const [, setRecentCategories] = useAtom(RECENT_CATEGORIES);
	const [, setCaptureTarget] = useAtom(PREVIEW_CAPTURE_TARGET);
	const [data, setData] = useAtom(DATA);
	const [selectedLetter, setSelectedLetter] = useState<string>("");
	const [characterModView, setCharacterModView] = useState<"normal" | "cycler">("normal");
	const testPinState = useAtomValue(TEST_PIN_STATE);
	const [selectedSubGroup, setSelectedSubGroup] = useState<string>("");
	const [selectedLookModPath, setSelectedLookModPath] = useState<string | null>(null);
	const [presetCreatorOpen, setPresetCreatorOpen] = useState(false);
	const [presetDraftName, setPresetDraftName] = useState("");
	const [presetHotkeyDraft, setPresetHotkeyDraft] = useState("");
	const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);
	const [selectedPresetCharacter, setSelectedPresetCharacter] = useState<string | null>(null);
	const [presetCharacterToAdd, setPresetCharacterToAdd] = useState("");
	const [presetModAddMode, setPresetModAddMode] = useState<"normal" | "cycler">("normal");
	const [presetAddSearchMode, setPresetAddSearchMode] = useState<"character" | "mod" | null>(null);
	const [presetModModeChoiceOpen, setPresetModModeChoiceOpen] = useState(false);
	const [presetAddSearchTerm, setPresetAddSearchTerm] = useState("");
	const [presetSelectedModPaths, setPresetSelectedModPaths] = useState<string[]>([]);
	const [presetColorEditorPath, setPresetColorEditorPath] = useState<string | null>(null);
	const [presetDeleteConfirmIndex, setPresetDeleteConfirmIndex] = useState<number | null>(null);
	const previousEnabledModsRef = useRef<string | null>(null);
	const hotReloadDebounceRef = useRef<number | null>(null);
	const presetAddSearchInputRef = useRef<HTMLInputElement | null>(null);
	const toggleOn = useAtomValue(SETTINGS).global.toggleClick;
	const enabledModsSignature = useMemo(
		() =>
			modList
				.filter((mod) => mod.enabled)
				.map((mod) => mod.path)
				.sort((left, right) => left.localeCompare(right))
				.join("\n"),
		[modList]
	);

	useEffect(() => {
		if (!initDone) {
			previousEnabledModsRef.current = null;
			return;
		}
		if (previousEnabledModsRef.current === null) {
			previousEnabledModsRef.current = enabledModsSignature;
			return;
		}
		if (previousEnabledModsRef.current === enabledModsSignature) return;
		previousEnabledModsRef.current = enabledModsSignature;
		if (hotReloadDebounceRef.current !== null) window.clearTimeout(hotReloadDebounceRef.current);
		hotReloadDebounceRef.current = window.setTimeout(() => {
			hotReloadDebounceRef.current = null;
			setChange().catch((error) => console.error("[IMM] Failed to arm automatic hot reload:", error));
		}, 250);
		return () => {
			if (hotReloadDebounceRef.current !== null) {
				window.clearTimeout(hotReloadDebounceRef.current);
				hotReloadDebounceRef.current = null;
			}
		};
	}, [enabledModsSignature, initDone]);

	const updateObj = useMemo(() => {
		const obj: { [key: string]: boolean } = {};
		installedItems.forEach((item) => {
			obj[item.name] = item.modStatus == 2;
		});
		return obj;
	}, [installedItems]);
	const hasActiveFilter = useMemo(
		() =>
			Object.entries(filter).some(([key, value]) => {
				if (key === "st") return value !== "all";
				if (typeof value === "string") return value !== "any";
				return Object.values(value).some((entry) => entry !== "any");
			}),
		[filter]
	);
	const filteredModList = useMemo(
		() =>
			modList.filter((mod) => {
				const status = filter.st;
				if (status === "enabled" && !mod.enabled) return false;
				if (status === "disabled" && mod.enabled) return false;

				const source = filter.src;
				if (source === "has" && !mod.source) return false;
				if (source === "lacks" && mod.source) return false;

				const tags = filter.tag as Record<string, string>;
				if (
					Object.entries(tags).some(([tag, value]) => {
						if (value === "has") return !(mod.tags || []).includes(tag);
						if (value === "lacks") return (mod.tags || []).includes(tag);
						return false;
					})
				)
					return false;

				const update = filter.upd;
				if (update === "has" && !updateObj[mod.path]) return false;
				if (update === "lacks" && updateObj[mod.path]) return false;
				return true;
			}),
		[filter, modList, updateObj]
	);

	useEffect(() => {
		const uniqueConflicts = getActiveModCollisionGroups(modList);

		const modsInvolved: Record<string, number> = {};
		uniqueConflicts.forEach((paths, index) => {
			paths.forEach((path) => {
				modsInvolved[path] = index;
			});
		});

		if (uniqueConflicts.length > 0 && JSON.stringify(conflicts.conflicts) !== JSON.stringify(uniqueConflicts)) {
			addToast({
				type: "error",
				message: textData._Toasts.CollisionsDetected,
				onClick: openConflict,
			});
			setConflicts({ conflicts: uniqueConflicts, mods: modsInvolved });
		} else if (uniqueConflicts.length === 0 && conflicts.conflicts.length > 0) {
			setConflicts({ conflicts: [], mods: {} });
		}
	}, [modList, conflicts.conflicts, setConflicts, textData]);

	useEffect(() => {
		setSelectedPresetCharacter(null);
		setPresetCharacterToAdd("");
		setPresetColorEditorPath(null);
		setPresetHotkeyDraft(selectedPresetIndex === null ? "" : presets[selectedPresetIndex]?.hotkey || "");
	}, [presets, selectedPresetIndex]);

	useEffect(() => {
		setPresetModAddMode("normal");
		setPresetModModeChoiceOpen(false);
		setPresetSelectedModPaths([]);
	}, [selectedPresetCharacter]);

	const characterCards = useMemo(() => {
		const favoriteCharacters = new Set(data[CHARACTER_FAVORITES_KEY]?.tags || []);
		const availableCategories = [...categories, ...LOCAL_SPECIAL_CATEGORIES].filter(
			(category, index, list) => list.findIndex((item) => item._sName === category._sName) === index
		);
		const alwaysVisibleCategories = new Set(LOCAL_SPECIAL_CATEGORIES.map((category) => category._sName));
		const knownCategories = availableCategories
			.filter((cat) =>
				hasActiveFilter
					? filteredModList.some((mod) => mod.parent === cat._sName)
					: alwaysVisibleCategories.has(cat._sName) || modList.some((mod) => mod.parent === cat._sName)
			)
			.map((cat) => {
				const mods = filteredModList.filter((mod) => mod.parent === cat._sName);
				return { name: cat._sName, icon: cat._sIconUrl, mods, favorite: favoriteCharacters.has(cat._sName) };
			});
		const uncategorized = filteredModList.filter((mod) => mod.parent === UNCATEGORIZED);
		return [
			...(uncategorized.length
				? [
						{
							name: UNCATEGORIZED,
							icon: "/icons/uncategorized.png",
							mods: uncategorized,
							favorite: favoriteCharacters.has(UNCATEGORIZED),
						},
					]
				: []),
			...knownCategories,
		].sort((a, b) => {
			if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
	}, [categories, data, filteredModList, hasActiveFilter, modList]);

	const characterGroups = useMemo(() => {
		const groups = new Map<string, typeof characterCards>();
		characterCards.forEach((card) => {
			const letter = /^[A-Z]/i.test(card.name) ? card.name[0].toUpperCase() : "#";
			groups.set(letter, [...(groups.get(letter) || []), card]);
		});
		return groups;
	}, [characterCards]);

	const characterAvailableLetters = useMemo(
		() => ALPHABET.filter((letter) => characterGroups.has(letter)),
		[characterGroups]
	);

	useEffect(() => {
		if (selectedLetter && !characterGroups.has(selectedLetter)) {
			setSelectedLetter("");
		}
	}, [characterGroups, selectedLetter]);

	const visibleCharacterCards = selectedLetter ? characterGroups.get(selectedLetter) || [] : characterCards;

	const selectedMods = useMemo(
		() =>
			filteredModList
				.filter((mod) => mod.parent === previewCategory)
				.sort((a, b) => {
					const favA = (a.tags || []).includes("fav");
					const favB = (b.tags || []).includes("fav");
					if (favA !== favB) return favA ? -1 : 1;
					return a.name.localeCompare(b.name);
				}),
		[filteredModList, previewCategory]
	);
	const cyclerModsCount = useMemo(
		() => selectedMods.filter((mod) => (mod.tags || []).includes("cycler")).length,
		[selectedMods]
	);
	const normalModsCount = selectedMods.length - cyclerModsCount;
	const previewSubGroups = useMemo(() => getPreviewSubGroups(previewCategory), [previewCategory]);
	useEffect(() => {
		if (!previewSubGroups.length) {
			setSelectedSubGroup("");
			return;
		}
		if (!selectedSubGroup || !previewSubGroups.some((group) => group.id === selectedSubGroup)) {
			setSelectedSubGroup(previewSubGroups[0].id);
		}
	}, [previewSubGroups, selectedSubGroup]);
	const selectedSubGroupData = previewSubGroups.find((group) => group.id === selectedSubGroup);
	const modsInCurrentMode = useMemo(() => {
		const mods = selectedMods.filter((mod) => {
			const inCycler = (mod.tags || []).includes("cycler");
			return characterModView === "cycler" ? inCycler : !inCycler;
		});
		if (characterModView === "normal") {
			mods.sort((a, b) => Number(b.enabled) - Number(a.enabled));
		}
		return mods;
	}, [selectedMods, characterModView]);
	const subGroupCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const group of previewSubGroups) {
			counts[group.id] = modsInCurrentMode.filter((mod) =>
				group.matches(normalizePreviewText(`${mod.name} ${mod.path}`))
			).length;
		}
		return counts;
	}, [previewSubGroups, modsInCurrentMode]);
	const visibleSelectedMods = useMemo(
		() =>
			modsInCurrentMode.filter((mod) => {
				if (!selectedSubGroupData) return true;
				return selectedSubGroupData.matches(normalizePreviewText(`${mod.name} ${mod.path}`));
			}),
		[modsInCurrentMode, selectedSubGroupData]
	);

	const handleModClick = async (event: React.MouseEvent, mod: (typeof modList)[number]) => {
		if (eventMatchesClickShortcut(event, "openLooks")) {
			event.preventDefault();
			event.stopPropagation();
			setSelected(mod.path);
			setSelectedLookModPath(mod.path);
			return;
		}
		if ((event.target as HTMLElement).tagName.toLowerCase() === "button") return;
		if (eventMatchesClickShortcut(event, "toggleCycler")) {
			event.preventDefault();
			event.stopPropagation();
			const tags = new Set(mod.tags || []);
			const wasInCycler = tags.has("cycler");
			if (wasInCycler) {
				tags.delete("cycler");
				tags.delete("cycler_pin");
			} else {
				tags.add("cycler");
			}
			const nextTags = Array.from(tags);
			setData((prev) => ({
				...prev,
				[mod.path]: {
					...prev[mod.path],
					tags: nextTags,
				},
			}));
			setModList((prev) =>
				prev.map((item) =>
					item.path === mod.path ? { ...item, tags: nextTags, enabled: wasInCycler ? false : item.enabled } : item
				)
			);
			saveConfigs();
			if (wasInCycler && mod.enabled) {
				const success = await toggleMod(mod.path, false);
				if (!success) {
					setModList((prev) => prev.map((item) => (item.path === mod.path ? { ...item, enabled: mod.enabled } : item)));
				}
			}
			return;
		}
		if (eventMatchesClickShortcut(event, "previewCapture")) {
			event.preventDefault();
			event.stopPropagation();
			setCaptureTarget({ path: mod.path, name: mod.name });
			return;
		}
		if (event.button === toggleOn) {
			const success = await toggleMod(mod.path, !mod.enabled);
			if (success) {
				setModList((prev) => prev.map((item) => (item.path === mod.path ? { ...item, enabled: !item.enabled } : item)));
			}
			return;
		}
		setSelected(mod.path);
	};

	const openCharacter = (characterName: string) => {
		setPreviewCategory(characterName);
		setCharacterModView("normal");
		setSelectedSubGroup("");
		setSelectedLookModPath(null);
		setRecentCategories((prev) => [characterName, ...prev.filter((name) => name !== characterName)].slice(0, 10));
	};

	const toggleCharacterFavorite = (event: React.MouseEvent, characterName: string) => {
		event.preventDefault();
		event.stopPropagation();
		const favoriteCharacters = new Set(data[CHARACTER_FAVORITES_KEY]?.tags || []);
		if (favoriteCharacters.has(characterName)) favoriteCharacters.delete(characterName);
		else favoriteCharacters.add(characterName);
		const nextData = {
			...data,
			[CHARACTER_FAVORITES_KEY]: {
				...data[CHARACTER_FAVORITES_KEY],
				tags: Array.from(favoriteCharacters),
			},
		};
		store.set(DATA, nextData);
		setData(nextData);
		saveConfigs();
	};

	const blockPresetForConflicts = (message: string, conflictGroups: string[][] = conflicts.conflicts) => {
		const modsInvolved: Record<string, number> = {};
		conflictGroups.forEach((paths, index) => {
			paths.forEach((path) => {
				modsInvolved[path] = index;
			});
		});
		if (conflictGroups.length > 0) {
			store.set(CONFLICTS, { conflicts: conflictGroups, mods: modsInvolved });
			store.set(CONFLICT_INDEX, 0);
			setConflicts({ conflicts: conflictGroups, mods: modsInvolved });
		}
		addToast({
			type: "error",
			message,
			onClick: () => openConflict(0),
		});
		openConflict(0);
	};

	const getPresetCollisionGroups = (normalPaths: string[], cyclerPaths: string[]) =>
		getModCollisionGroups(modList, normalPaths, cyclerPaths);

	const getDefaultPresetName = () =>
		`Preset ${new Date().toLocaleString(undefined, {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		})}`;

	const getCurrentPresetSetup = () => {
		const cyclerMods = modList.filter((mod) => (mod.tags || []).includes("cycler"));
		const cyclerCharacters = new Set(cyclerMods.map((mod) => mod.parent));
		const normalEnabledCandidates = modList.filter(
			(mod) => mod.enabled && mod.path !== testPinState.path && !(mod.tags || []).includes("cycler")
		);
		const normalByCharacter = new Map<string, typeof normalEnabledCandidates>();
		for (const mod of normalEnabledCandidates) {
			normalByCharacter.set(mod.parent, [...(normalByCharacter.get(mod.parent) || []), mod]);
		}
		const collisionGroups = getPresetCollisionGroups(
			normalEnabledCandidates.map((mod) => mod.path),
			cyclerMods.map((mod) => mod.path)
		);
		return {
			cyclerMods,
			cyclerCharacters,
			normalEnabledCandidates,
			normalByCharacter,
			collisionGroups,
		};
	};

	const currentPresetSetup = useMemo(getCurrentPresetSetup, [modList, testPinState.path]);
	const selectedPreset = selectedPresetIndex !== null ? presets[selectedPresetIndex] : null;

	const getPresetEffectColors = (paths: string[]) => {
		const selectedPaths = new Set(paths);
		return Object.fromEntries(
			Object.entries(store.get(DATA))
				.filter(([path, modData]) => selectedPaths.has(path) && !!modData?.effectColors?.enabled)
				.map(([path, modData]) => [path, { ...modData.effectColors! }])
		);
	};

	const getPresetMod = (path: string) => modList.find((mod) => mod.path === path);
	const getPresetPathParent = (path: string) => {
		const modParent = getPresetMod(path)?.parent;
		if (modParent) return modParent;
		const segments = path.replaceAll("/", "\\").split("\\").filter(Boolean);
		const knownCharacter = characterCards.find((card) => segments.includes(card.name))?.name;
		if (knownCharacter) return knownCharacter;
		return segments[0] || "Unknown";
	};
	const getPresetGroups = (preset: (typeof presets)[number]) => {
		const normalPaths = new Set(preset.data || []);
		const cyclerPaths = new Set(preset.cycler?.mods || []);
		const colorPaths = new Set(Object.keys(preset.effectColors || {}));
		const allPaths = [...new Set([...normalPaths, ...cyclerPaths, ...colorPaths])];
		const groups = new Map<string, { normal: string[]; cycler: string[]; colors: string[] }>();
		for (const character of preset.characters || []) {
			if (!groups.has(character)) groups.set(character, { normal: [], cycler: [], colors: [] });
		}
		for (const path of allPaths) {
			const parent = getPresetPathParent(path);
			if (!groups.has(parent)) groups.set(parent, { normal: [], cycler: [], colors: [] });
			const group = groups.get(parent)!;
			if (normalPaths.has(path)) group.normal.push(path);
			if (cyclerPaths.has(path)) group.cycler.push(path);
			if (colorPaths.has(path)) group.colors.push(path);
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	};

	const getPresetColorSwatch = (preset: (typeof presets)[number], path: string) => {
		const effect = preset.effectColors?.[path];
		if (!effect?.enabled) return "";
		return `rgb(${Math.round(Math.min(1, (effect.red ?? 1) * 0.45 + (effect.redOffset ?? 0)) * 255)}, ${Math.round(Math.min(1, (effect.green ?? 1) * 0.45 + (effect.greenOffset ?? 0)) * 255)}, ${Math.round(Math.min(1, (effect.blue ?? 1) * 0.45 + (effect.blueOffset ?? 0)) * 255)})`;
	};

	const getPresetGroupPaths = (group: { normal: string[]; cycler: string[]; colors: string[] }) => [
		...new Set([...group.normal, ...group.cycler, ...group.colors]),
	];

	const getAvailablePresetCharacters = (preset: (typeof presets)[number]) => {
		const existingCharacters = new Set(getPresetGroups(preset).map(([character]) => character));
		return characterCards.filter((card) => !existingCharacters.has(card.name));
	};

	const getAvailablePresetModsForCharacter = (preset: (typeof presets)[number], characterName: string) => {
		const presetPaths = new Set(getPresetGroups(preset).flatMap(([, group]) => getPresetGroupPaths(group)));
		return modList
			.filter((mod) => mod.parent === characterName && !presetPaths.has(mod.path))
			.sort((a, b) => a.name.localeCompare(b.name));
	};

	const openPresetAddSearch = (mode: "character" | "mod", addMode?: "normal" | "cycler") => {
		setPresetAddSearchMode(mode);
		setPresetAddSearchTerm("");
		setPresetSelectedModPaths([]);
		if (mode === "mod") {
			setPresetModModeChoiceOpen(!addMode);
			if (addMode) setPresetModAddMode(addMode);
		} else {
			setPresetModModeChoiceOpen(false);
		}
	};

	const closePresetAddSearch = () => {
		setPresetAddSearchMode(null);
		setPresetAddSearchTerm("");
		setPresetModModeChoiceOpen(false);
		setPresetSelectedModPaths([]);
	};

	const recalcPresetMeta = (preset: (typeof presets)[number]) => {
		const normalPaths = preset.data || [];
		const cyclerPaths = preset.cycler?.mods || [];
		return {
			...(preset.meta || {}),
			normalMods: normalPaths.length,
			cyclerMods: cyclerPaths.length,
			effectColorMods: Object.keys(preset.effectColors || {}).length,
			normalCharacters: new Set(normalPaths.map(getPresetPathParent)).size,
			cyclerCharacters: new Set(cyclerPaths.map(getPresetPathParent)).size,
		};
	};

	const updatePresetAtIndex = async (
		index: number,
		updater: (preset: (typeof presets)[number]) => (typeof presets)[number]
	) => {
		const nextPresets = presets.map((preset, presetIndex) => (presetIndex === index ? updater(preset) : preset));
		store.set(PRESETS, nextPresets);
		setPresets(nextPresets);
		await saveConfigs();
	};

	const savePresetHotkey = async (index: number, hotkey: string) => {
		const normalized = normalizeHotkeyForCompare(hotkey);
		if (normalized === "f10") {
			addToast({ type: "error", message: "F10 is reserved for WWMI reload. Choose another shortcut." });
			setPresetHotkeyDraft(presets[index]?.hotkey || "");
			return;
		}
		const duplicatePreset = presets.some(
			(preset, presetIndex) =>
				presetIndex !== index && preset.hotkey && normalizeHotkeyForCompare(preset.hotkey) === normalized
		);
		const duplicateCustom = getCustomHotkeys().some(
			(item) => item.hotkey && normalizeHotkeyForCompare(item.hotkey) === normalized
		);
		if (normalized && (duplicatePreset || duplicateCustom)) {
			addToast({ type: "error", message: "This shortcut is already used by another action." });
			setPresetHotkeyDraft(presets[index]?.hotkey || "");
			return;
		}

		const previous = presets[index]?.hotkey || "";
		try {
			await updatePresetAtIndex(index, (preset) => ({ ...preset, hotkey }));
			await registerGlobalHotkeys();
			setPresetHotkeyDraft(hotkey);
			addToast({ type: "success", message: hotkey ? `Preset shortcut set to ${hotkey}.` : "Preset shortcut cleared." });
		} catch (error) {
			await updatePresetAtIndex(index, (preset) => ({ ...preset, hotkey: previous }));
			await registerGlobalHotkeys().catch(() => {});
			setPresetHotkeyDraft(previous);
			addToast({ type: "error", message: `Could not register preset shortcut: ${String(error)}` });
		}
	};

	const savePresetEffectColors = async (colors: EffectColors) => {
		if (selectedPresetIndex === null || !presetColorEditorPath) return;
		const colorPath = presetColorEditorPath;
		await updatePresetAtIndex(selectedPresetIndex, (preset) => {
			const nextEffectColors = { ...(preset.effectColors || {}) };
			if (colors.enabled) nextEffectColors[colorPath] = { ...colors };
			else delete nextEffectColors[colorPath];
			const nextPreset = { ...preset, effectColors: nextEffectColors };
			return { ...nextPreset, meta: recalcPresetMeta(nextPreset) };
		});
		setPresetColorEditorPath(null);
		addToast({
			type: "success",
			message: colors.enabled ? "Effect colors saved to preset." : "Preset color override removed.",
		});
	};

	const removePathFromPreset = async (presetIndex: number, path: string) => {
		await updatePresetAtIndex(presetIndex, (preset) => {
			const nextEffectColors = { ...(preset.effectColors || {}) };
			delete nextEffectColors[path];
			const nextPreset = {
				...preset,
				data: (preset.data || []).filter((item) => item !== path),
				...(preset.cycler
					? {
							cycler: {
								...preset.cycler,
								mods: (preset.cycler.mods || []).filter((item) => item !== path),
							},
						}
					: {}),
				effectColors: nextEffectColors,
			};
			return { ...nextPreset, meta: recalcPresetMeta(nextPreset) };
		});
		addToast({ type: "success", message: "Removed from preset." });
	};

	const removeCharacterFromPreset = async (presetIndex: number, characterName: string) => {
		await updatePresetAtIndex(presetIndex, (preset) => {
			const belongsToCharacter = (path: string) => getPresetPathParent(path) === characterName;
			const nextEffectColors = Object.fromEntries(
				Object.entries(preset.effectColors || {}).filter(([path]) => !belongsToCharacter(path))
			);
			const nextPreset = {
				...preset,
				characters: (preset.characters || []).filter((item) => item !== characterName),
				data: (preset.data || []).filter((path) => !belongsToCharacter(path)),
				...(preset.cycler
					? {
							cycler: {
								...preset.cycler,
								mods: (preset.cycler.mods || []).filter((path) => !belongsToCharacter(path)),
							},
						}
					: {}),
				effectColors: nextEffectColors,
			};
			return { ...nextPreset, meta: recalcPresetMeta(nextPreset) };
		});
		setSelectedPresetCharacter((current) => (current === characterName ? null : current));
		addToast({ type: "success", message: `${characterName} removed from preset.` });
	};

	const addCharacterToPreset = async (presetIndex: number, characterName?: string) => {
		const nextCharacter = (characterName || presetCharacterToAdd).trim();
		if (!nextCharacter) {
			addToast({ type: "error", message: "Choose a character to add." });
			return;
		}
		await updatePresetAtIndex(presetIndex, (preset) => {
			const nextPreset = {
				...preset,
				characters: [...new Set([...(preset.characters || []), nextCharacter])],
			};
			return { ...nextPreset, meta: recalcPresetMeta(nextPreset) };
		});
		setSelectedPresetCharacter(nextCharacter);
		setPresetCharacterToAdd("");
		addToast({ type: "success", message: `${nextCharacter} added to preset.` });
	};

	const addModsToPreset = async (presetIndex: number, paths: string[], mode: "normal" | "cycler") => {
		const uniquePaths = [...new Set(paths)];
		const mods = uniquePaths.map((path) => getPresetMod(path)).filter(Boolean) as typeof modList;
		if (!mods.length) {
			addToast({ type: "error", message: "Choose at least one mod to add." });
			return false;
		}
		if (mode === "normal" && mods.length > 1) {
			addToast({ type: "error", message: "Normal presets can only add one mod for this character." });
			return false;
		}

		const characterName = mods[0].parent || selectedPresetCharacter || getPresetPathParent(mods[0].path);
		if (mods.some((mod) => (mod.parent || getPresetPathParent(mod.path)) !== characterName)) {
			addToast({ type: "error", message: "Choose mods from one character only." });
			return false;
		}

		const preset = presets[presetIndex];
		const normalPaths = preset.data || [];
		const cyclerPaths = preset.cycler?.mods || [];
		const existingPaths = new Set([...normalPaths, ...cyclerPaths]);
		const newPaths = mods.map((mod) => mod.path).filter((path) => !existingPaths.has(path));
		if (!newPaths.length) {
			addToast({ type: "error", message: "Selected mod(s) are already in the preset." });
			return false;
		}

		const normalInCharacter = normalPaths.filter((item) => getPresetPathParent(item) === characterName);
		const cyclerInCharacter = cyclerPaths.filter((item) => getPresetPathParent(item) === characterName);
		if (mode === "normal" && (normalInCharacter.length > 0 || cyclerInCharacter.length > 0)) {
			addToast({ type: "error", message: "This character already has a Normal or Cycler setup in this preset." });
			return false;
		}
		if (mode === "cycler" && normalInCharacter.length > 0) {
			addToast({ type: "error", message: "Remove the Normal mod before adding Cycler mods for this character." });
			return false;
		}

		await updatePresetAtIndex(presetIndex, (currentPreset) => {
			const nextEffectColors = { ...(currentPreset.effectColors || {}) };
			for (const mod of mods) {
				const currentEffectColors = store.get(DATA)[mod.path]?.effectColors;
				if (currentEffectColors?.enabled) nextEffectColors[mod.path] = { ...currentEffectColors };
			}
			const nextPreset = {
				...currentPreset,
				characters: [...new Set([...(currentPreset.characters || []), characterName])],
				data: mode === "normal" ? [...new Set([...(currentPreset.data || []), ...newPaths])] : currentPreset.data || [],
				cycler: {
					mods:
						mode === "cycler"
							? [...new Set([...(currentPreset.cycler?.mods || []), ...newPaths])]
							: currentPreset.cycler?.mods || [],
					timerMinutes: currentPreset.cycler?.timerMinutes || getCyclerTimerMinutes(),
				},
				effectColors: nextEffectColors,
			};
			return { ...nextPreset, meta: recalcPresetMeta(nextPreset) };
		});
		setPresetSelectedModPaths([]);
		addToast({
			type: "success",
			message: `${newPaths.length} mod(s) added as ${mode === "cycler" ? "Cycler" : "Normal"}.`,
		});
		return true;
	};

	const presetCharacterSearchResults = useMemo(() => {
		if (!selectedPreset) return [];
		const normalized = normalizePreviewText(presetAddSearchTerm.trim());
		const available = getAvailablePresetCharacters(selectedPreset);
		const filtered = normalized
			? available.filter((character) => normalizePreviewText(character.name).includes(normalized))
			: available;
		return filtered.slice(0, 18);
	}, [selectedPreset, presetAddSearchTerm, characterCards]);

	const presetModSearchResults = useMemo(() => {
		if (!selectedPreset || !selectedPresetCharacter) return [];
		const normalized = normalizePreviewText(presetAddSearchTerm.trim());
		const available = getAvailablePresetModsForCharacter(selectedPreset, selectedPresetCharacter);
		const filtered = normalized
			? available.filter((mod) => normalizePreviewText(`${mod.name} ${mod.path}`).includes(normalized))
			: available;
		return filtered.slice(0, 18);
	}, [selectedPreset, selectedPresetCharacter, presetAddSearchTerm, modList]);

	useEffect(() => {
		if (!presetAddSearchMode) return;
		const handler = setTimeout(() => presetAddSearchInputRef.current?.focus(), 0);
		return () => clearTimeout(handler);
	}, [presetAddSearchMode]);

	useEffect(() => {
		if (!presetAddSearchMode || selectedPresetIndex === null) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closePresetAddSearch();
			}
			if (event.key === "Enter") {
				event.preventDefault();
				if (presetAddSearchMode === "character" && presetCharacterSearchResults[0]) {
					addCharacterToPreset(selectedPresetIndex, presetCharacterSearchResults[0].name);
					closePresetAddSearch();
				}
				if (presetAddSearchMode === "mod" && !presetModModeChoiceOpen) {
					if (presetModAddMode === "normal" && presetModSearchResults[0]) {
						addModsToPreset(selectedPresetIndex, [presetModSearchResults[0].path], "normal").then((success) => {
							if (success) closePresetAddSearch();
						});
					}
					if (presetModAddMode === "cycler") {
						if (!presetSelectedModPaths.length) {
							addToast({ type: "error", message: "Select at least one Cycler mod first." });
							return;
						}
						addModsToPreset(selectedPresetIndex, presetSelectedModPaths, "cycler").then((success) => {
							if (success) closePresetAddSearch();
						});
					}
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		presetAddSearchMode,
		selectedPresetIndex,
		presetCharacterSearchResults,
		presetModSearchResults,
		presetModAddMode,
		presetModModeChoiceOpen,
		presetSelectedModPaths,
	]);

	const mergeCurrentSetupIntoPreset = async (presetIndex: number) => {
		const { cyclerMods, normalEnabledCandidates, normalByCharacter, cyclerCharacters } = currentPresetSetup;
		const colorPaths = [...normalEnabledCandidates, ...cyclerMods].map((mod) => mod.path);
		const effectColors = getPresetEffectColors(colorPaths);
		await updatePresetAtIndex(presetIndex, (preset) => {
			const nextData = [...new Set([...(preset.data || []), ...normalEnabledCandidates.map((mod) => mod.path)])];
			const nextCyclerMods = [...new Set([...(preset.cycler?.mods || []), ...cyclerMods.map((mod) => mod.path)])];
			const nextEffectColors = { ...(preset.effectColors || {}), ...effectColors };
			const nextCharacters = [
				...new Set([
					...(preset.characters || []),
					...normalEnabledCandidates.map((mod) => mod.parent),
					...cyclerMods.map((mod) => mod.parent),
				]),
			];
			return {
				...preset,
				characters: nextCharacters,
				data: nextData,
				cycler: {
					mods: nextCyclerMods,
					timerMinutes: getCyclerTimerMinutes(),
				},
				effectColors: nextEffectColors,
				meta: {
					...(preset.meta || {}),
					normalMods: nextData.length,
					cyclerMods: nextCyclerMods.length,
					effectColorMods: Object.keys(nextEffectColors).length,
					normalCharacters: Math.max(preset.meta?.normalCharacters || 0, normalByCharacter.size),
					cyclerCharacters: Math.max(preset.meta?.cyclerCharacters || 0, cyclerCharacters.size),
				},
			};
		});
		addToast({ type: "success", message: "Current setup merged into preset." });
	};

	const renamePresetAtIndex = async (presetIndex: number, name: string) => {
		const nextName = name.trim();
		if (!nextName) {
			addToast({ type: "error", message: "Preset name cannot be empty." });
			return;
		}
		const currentName = (presets[presetIndex]?.name || "Preset").trim();
		if (nextName === currentName) return;
		await updatePresetAtIndex(presetIndex, (preset) => ({ ...preset, name: nextName }));
		addToast({ type: "success", message: "Preset renamed." });
	};

	const duplicatePresetAtIndex = async (presetIndex: number) => {
		const sourcePreset = presets[presetIndex];
		if (!sourcePreset) return;
		const sourceName = sourcePreset.name || "Preset";
		const usedNames = new Set(presets.map((preset) => preset.name));
		let duplicateName = `${sourceName} Copy`;
		let copyNumber = 2;
		while (usedNames.has(duplicateName)) {
			duplicateName = `${sourceName} Copy ${copyNumber}`;
			copyNumber += 1;
		}
		const duplicatePreset = {
			...sourcePreset,
			name: duplicateName,
			hotkey: "",
			createdAt: new Date().toISOString(),
			data: [...(sourcePreset.data || [])],
			characters: [...(sourcePreset.characters || [])],
			...(sourcePreset.cycler
				? {
						cycler: {
							...sourcePreset.cycler,
							mods: [...(sourcePreset.cycler.mods || [])],
						},
					}
				: {}),
			...(sourcePreset.effectColors
				? {
						effectColors: Object.fromEntries(
							Object.entries(sourcePreset.effectColors).map(([path, colors]) => [path, { ...colors }])
						),
					}
				: {}),
			...(sourcePreset.meta ? { meta: { ...sourcePreset.meta } } : {}),
		};
		const nextPresets = [...presets];
		nextPresets.splice(presetIndex + 1, 0, duplicatePreset);
		store.set(PRESETS, nextPresets);
		setPresets(nextPresets);
		setSelectedPresetCharacter(null);
		setSelectedPresetIndex(presetIndex + 1);
		await saveConfigs();
		addToast({ type: "success", message: `Preset duplicated as ${duplicateName}.` });
	};

	const deletePresetAtIndex = async (presetIndex: number) => {
		const presetName = presets[presetIndex]?.name || "Preset";
		const nextPresets = presets.filter((_, index) => index !== presetIndex);
		store.set(PRESETS, nextPresets);
		setPresets(nextPresets);
		setSelectedPresetCharacter(null);
		setPresetColorEditorPath(null);
		setSelectedPresetIndex((currentIndex) => {
			if (currentIndex === null || currentIndex === presetIndex) return null;
			return currentIndex > presetIndex ? currentIndex - 1 : currentIndex;
		});
		setPresetDeleteConfirmIndex(null);
		await saveConfigs();
		await registerGlobalHotkeys();
		addToast({ type: "success", message: `${presetName} deleted.` });
	};

	const openPresetCreator = () => {
		setPresetDraftName(getDefaultPresetName());
		setPresetCreatorOpen(true);
	};

	const createPresetFromCurrentSetup = async () => {
		if (conflicts.conflicts.length > 0) {
			blockPresetForConflicts("Resolve active mod conflicts before saving a preset.");
			return;
		}

		const name = presetDraftName.trim();
		if (!name) {
			addToast({ type: "error", message: "Choose a preset name first." });
			return;
		}

		const { cyclerMods, cyclerCharacters, normalEnabledCandidates, normalByCharacter, collisionGroups } =
			currentPresetSetup;
		if (collisionGroups.length > 0) {
			blockPresetForConflicts(
				"Preset not saved. Resolve Normal/Cycler or active mod conflicts first.",
				collisionGroups
			);
			return;
		}

		const timerMinutes = getCyclerTimerMinutes();
		const presetPaths = [...normalEnabledCandidates, ...cyclerMods].map((mod) => mod.path);
		const effectColors = getPresetEffectColors(presetPaths);
		const nextPreset = {
			name,
			characters: [
				...new Set([...normalEnabledCandidates.map((mod) => mod.parent), ...cyclerMods.map((mod) => mod.parent)]),
			],
			data: normalEnabledCandidates.map((mod) => mod.path),
			createdAt: new Date().toISOString(),
			cycler: {
				mods: cyclerMods.map((mod) => mod.path),
				timerMinutes,
			},
			effectColors,
			meta: {
				normalMods: normalEnabledCandidates.length,
				cyclerMods: cyclerMods.length,
				effectColorMods: Object.keys(effectColors).length,
				normalCharacters: normalByCharacter.size,
				cyclerCharacters: cyclerCharacters.size,
			},
		};

		const nextPresets = [...presets, nextPreset];
		store.set(PRESETS, nextPresets);
		setPresets(nextPresets);
		await saveConfigs();
		setPresetCreatorOpen(false);
		addToast({
			type: "success",
			message: cyclerMods.length
				? `Preset saved with ${normalByCharacter.size} normal character(s) and ${cyclerCharacters.size} Cycler character(s).`
				: `Preset saved with ${normalByCharacter.size} normal character(s).`,
		});
	};

	const applyPresetFromGallery = async (preset: (typeof presets)[number]) => {
		try {
			if (conflicts.conflicts.length > 0) {
				blockPresetForConflicts("Resolve active mod conflicts before applying a preset.");
				return;
			}

			const cyclerPaths = new Set(preset.cycler?.mods || []);
			const collisionGroups = getPresetCollisionGroups(preset.data || [], Array.from(cyclerPaths));
			if (collisionGroups.length > 0) {
				blockPresetForConflicts(
					"Preset not applied. This preset has Normal/Cycler or active mod conflicts.",
					collisionGroups
				);
				return;
			}

			const presetEffectColors = preset.effectColors || {};
			const nextDataWithColors = { ...store.get(DATA) };
			for (const path of Object.keys(nextDataWithColors)) {
				if (nextDataWithColors[path]?.effectColors) {
					nextDataWithColors[path] = { ...nextDataWithColors[path] };
					delete nextDataWithColors[path].effectColors;
				}
			}
			for (const [path, effectColors] of Object.entries(presetEffectColors)) {
				nextDataWithColors[path] = {
					...nextDataWithColors[path],
					effectColors,
				};
			}

			if (preset.cycler) {
				if (preset.cycler.timerMinutes) {
					setCyclerTimerMinutes(preset.cycler.timerMinutes);
				}
				const nextData = { ...nextDataWithColors };
				for (const mod of modList.filter((item) => item.isDir)) {
					const tags = new Set(nextData[mod.path]?.tags || []);
					tags.delete("cycler");
					tags.delete("cycler_pin");
					if (cyclerPaths.has(mod.path)) tags.add("cycler");
					nextData[mod.path] = {
						...nextData[mod.path],
						tags: Array.from(tags),
					};
				}
				const nextModList = modList.map((mod) => {
					const tags = new Set(mod.tags || []);
					tags.delete("cycler");
					tags.delete("cycler_pin");
					if (cyclerPaths.has(mod.path)) tags.add("cycler");
					return { ...mod, tags: Array.from(tags) };
				});
				store.set(DATA, nextData);
				store.set(MOD_LIST, nextModList);
				setData(nextData);
				setModList(nextModList);
				await saveConfigs();
			} else {
				store.set(DATA, nextDataWithColors);
				setData(nextDataWithColors);
				await saveConfigs();
			}
			await applyPreset(preset.data || [], preset.name);
			if (preset.cycler?.mods?.length) {
				await rebuildCyclerIni();
			} else {
				await rebuildEffectColorsIni();
			}
			setModList(await refreshModList());
			await preparePresetReloadNotice(preset.name || "Preset").catch((error) => {
				console.warn("[IMM] Could not prepare preset reload notice:", error);
			});
			addToast({ type: "success", message: `${preset.name || "Preset"} applied. Press F10 in-game to reload WWMI.` });
		} catch (error) {
			addToast({ type: "error", message: `Could not apply preset: ${String(error)}` });
		}
	};

	if (previewCategory === PRESET_GALLERY_CATEGORY) {
		return (
			<div data-main-scroll className="thin flex h-full w-full flex-col overflow-y-auto px-5 pb-8">
				<AlertDialog
					open={presetDeleteConfirmIndex !== null}
					onOpenChange={(open) => {
						if (!open) setPresetDeleteConfirmIndex(null);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader className="w-full">
							<AlertDialogTitle className="font-serif text-2xl text-accent">{t("Delete preset?")}</AlertDialogTitle>
							<AlertDialogDescription>
								{presetDeleteConfirmIndex !== null
									? `${presets[presetDeleteConfirmIndex]?.name || "This preset"} will be permanently removed. Your mod files will not be deleted.`
									: "This preset will be permanently removed."}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter className="w-full">
							<AlertDialogCancel variant="secondary">{t("Cancel")}</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								onClick={() => {
									if (presetDeleteConfirmIndex !== null) deletePresetAtIndex(presetDeleteConfirmIndex);
								}}
							>
								{t("Delete preset")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<AnimatePresence>
					{presetColorEditorPath && selectedPreset && selectedPresetIndex !== null && (
						<PresetColorEditorModal
							key={`preset-color-${selectedPresetIndex}-${presetColorEditorPath}`}
							modName={
								getPresetMod(presetColorEditorPath)?.name ||
								presetColorEditorPath.split("\\").pop() ||
								presetColorEditorPath
							}
							initialColors={
								selectedPreset.effectColors?.[presetColorEditorPath] || data[presetColorEditorPath]?.effectColors
							}
							onClose={() => setPresetColorEditorPath(null)}
							onSave={savePresetEffectColors}
						/>
					)}
				</AnimatePresence>
				<AnimatePresence>
					{presetAddSearchMode && selectedPreset && selectedPresetIndex !== null && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="fixed inset-0 z-[220] flex items-center justify-center bg-background/65 p-6 backdrop-blur-md"
						>
							<div className="w-full max-w-3xl rounded-xl border bg-sidebar p-4 shadow-2xl">
								<div className="mb-3 flex items-center justify-between gap-3">
									<div>
										<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">
											{presetAddSearchMode === "character" ? t("Preset character search") : t("Preset mod search")}
										</p>
										<h2 className="font-serif text-2xl text-accent">
											{presetAddSearchMode === "character"
												? t("Add character to preset")
												: presetModModeChoiceOpen
													? t("How should this mod be added?")
													: t(presetModAddMode === "cycler" ? "Add Cycler mod" : "Add Normal mod")}
										</h2>
										{presetAddSearchMode === "mod" && (
											<p className="mt-1 text-xs text-muted-foreground">{selectedPresetCharacter}</p>
										)}
									</div>
									<Button onClick={closePresetAddSearch} className="h-9 w-9 p-0">
										<XIcon className="h-4 w-4" />
									</Button>
								</div>
								{presetAddSearchMode === "mod" && presetModModeChoiceOpen ? (
									<div className="grid gap-3 md:grid-cols-2">
										<button
											onClick={() => {
												setPresetModAddMode("normal");
												setPresetModModeChoiceOpen(false);
											}}
											className="group rounded-xl border bg-background/35 p-4 text-left duration-200 hover:border-accent hover:bg-background/60"
										>
											<div className="text-lg font-bold text-foreground group-hover:text-accent">{t("Normal")}</div>
											<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
												{t(
													"Add one fixed mod for this character. Blocked if this character already has Normal or Cycler in this preset."
												)}
											</p>
										</button>
										<button
											onClick={() => {
												setPresetModAddMode("cycler");
												setPresetModModeChoiceOpen(false);
											}}
											className="group rounded-xl border bg-background/35 p-4 text-left duration-200 hover:border-accent hover:bg-background/60"
										>
											<div className="text-lg font-bold text-foreground group-hover:text-accent">{t("Cycler")}</div>
											<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
												{t(
													"Select several mods for this character. Click mods to mark them, then press Enter to add all selected."
												)}
											</p>
										</button>
									</div>
								) : (
									<>
										<div className="button-like flex h-12 items-center overflow-hidden rounded-lg border bg-background/40 px-3">
											<SearchIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
											<Input
												ref={presetAddSearchInputRef}
												value={presetAddSearchTerm}
												placeholder={
													presetAddSearchMode === "character" ? t("Type a character name...") : t("Type a mod name...")
												}
												className="h-10 flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
												onChange={(event) => setPresetAddSearchTerm(event.target.value)}
											/>
										</div>
										{presetAddSearchMode === "mod" && presetModAddMode === "cycler" && (
											<div className="mt-3 rounded-lg border bg-background/30 px-3 py-2 text-xs text-muted-foreground">
												{presetSelectedModPaths.length} {t("selected")} ·{" "}
												{t("Click mods to select/unselect, then press Enter to add all.")}
											</div>
										)}
										<div className="mt-4 grid max-h-[54vh] grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3 overflow-y-auto pr-1">
											{presetAddSearchMode === "character" &&
												presetCharacterSearchResults.map((character) => (
													<button
														key={`preset-add-character-${character.name}`}
														onClick={() => {
															addCharacterToPreset(selectedPresetIndex, character.name);
															closePresetAddSearch();
														}}
														className="group flex min-h-16 items-center gap-3 rounded-lg border bg-background/30 p-2 text-left duration-200 hover:border-accent hover:bg-background/60"
													>
														<img
															src={character.icon || "/who.jpg"}
															onError={(event) => {
																event.currentTarget.src = "/who.jpg";
															}}
															className="h-12 w-12 rounded-md border bg-sidebar object-cover"
														/>
														<div className="min-w-0">
															<p className="truncate text-sm font-bold text-foreground group-hover:text-accent">
																{character.name}
															</p>
															<p className="text-[11px] text-muted-foreground">
																{character.mods.length} {t("mods")}
															</p>
														</div>
													</button>
												))}
											{presetAddSearchMode === "mod" &&
												presetModSearchResults.map((mod) => {
													const isSelectedForCycler = presetSelectedModPaths.includes(mod.path);
													return (
														<button
															key={`preset-add-mod-${mod.path}`}
															onClick={() => {
																if (presetModAddMode === "cycler") {
																	setPresetSelectedModPaths((prev) =>
																		prev.includes(mod.path)
																			? prev.filter((path) => path !== mod.path)
																			: [...prev, mod.path]
																	);
																	return;
																}
																addModsToPreset(selectedPresetIndex, [mod.path], "normal").then((success) => {
																	if (success) closePresetAddSearch();
																});
															}}
															className={`group overflow-hidden rounded-lg border bg-background/30 text-left duration-200 hover:border-accent hover:bg-background/60 ${
																isSelectedForCycler ? "border-accent ring-1 ring-accent" : ""
															}`}
														>
															<div className="h-28 overflow-hidden bg-background">
																<img
																	src={`${getImageUrl(mod.path)}?preset-add-${lastUpdated}`}
																	onError={handleImageError}
																	className="h-full w-full object-cover opacity-75 duration-200 group-hover:scale-105 group-hover:opacity-95"
																/>
															</div>
															<div className="p-2">
																<p className="line-clamp-2 text-sm font-bold text-foreground group-hover:text-accent">
																	{mod.name}
																</p>
																<p className="mt-1 text-[11px] text-muted-foreground">
																	{presetModAddMode === "cycler" && isSelectedForCycler
																		? t("Selected for Cycler")
																		: mod.parent}
																</p>
															</div>
														</button>
													);
												})}
											{((presetAddSearchMode === "character" && presetCharacterSearchResults.length === 0) ||
												(presetAddSearchMode === "mod" && presetModSearchResults.length === 0)) && (
												<div className="col-span-full rounded-lg border bg-background/30 p-5 text-center text-sm text-muted-foreground">
													{t("No results available.")}
												</div>
											)}
										</div>
										<div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
											<span>
												{presetAddSearchMode === "mod" && presetModAddMode === "cycler"
													? t("Enter adds selected mods")
													: t("Enter adds the first result")}
											</span>
											<span>{t("Esc closes")}</span>
										</div>
									</>
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
				<div className="sticky top-0 z-20 -mx-5 border-b bg-background/95 px-5 py-4 backdrop-blur">
					<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">WuWa IMM Custom</p>
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 className="font-serif text-3xl text-accent">{t("Preset Gallery")}</h2>
							<p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{t("Saved setups.")}</p>
						</div>
						<Button className="h-11 min-w-40" onClick={openPresetCreator}>
							{t("Create from current setup")}
						</Button>
					</div>
				</div>
				<AnimatePresence>
					{presetCreatorOpen && (
						<motion.div
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							className="mb-5 rounded-xl border bg-sidebar/80 p-4 shadow-lg"
						>
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="min-w-72 flex-1">
									<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">{t("Create preset")}</p>
									<h3 className="mt-1 text-xl font-bold text-foreground">{t("Review current setup")}</h3>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
										{t(
											"This will save the current normal enabled mods and the current Cycler setup. If there is a conflict, it will be blocked."
										)}
									</p>
								</div>
								<div className="grid min-w-80 flex-1 gap-3">
									<Input
										value={presetDraftName}
										onChange={(event) => setPresetDraftName(event.target.value)}
										placeholder={t("Preset name")}
										className="h-11"
									/>
									<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
										<div className="rounded-md border bg-background/40 px-3 py-2">
											<div className="text-[10px] uppercase tracking-[0.14em] text-accent">{t("Normal")}</div>
											<div>{currentPresetSetup.normalByCharacter.size} character(s)</div>
										</div>
										<div className="rounded-md border bg-background/40 px-3 py-2">
											<div className="text-[10px] uppercase tracking-[0.14em] text-accent">{t("Enabled")}</div>
											<div>{currentPresetSetup.normalEnabledCandidates.length} mod(s)</div>
										</div>
										<div className="rounded-md border bg-background/40 px-3 py-2">
											<div className="text-[10px] uppercase tracking-[0.14em] text-accent">{t("Cycler")}</div>
											<div>{currentPresetSetup.cyclerCharacters.size} character(s)</div>
										</div>
										<div className="rounded-md border bg-background/40 px-3 py-2">
											<div className="text-[10px] uppercase tracking-[0.14em] text-accent">{t("Cycler mods")}</div>
											<div>{currentPresetSetup.cyclerMods.length} mod(s)</div>
										</div>
									</div>
									{currentPresetSetup.collisionGroups.length > 0 && (
										<div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive">
											{t("Conflict detected. Resolve it before saving this preset.")}
										</div>
									)}
									<div className="flex justify-end gap-2">
										<Button variant="secondary" className="h-10 min-w-28" onClick={() => setPresetCreatorOpen(false)}>
											Cancel
										</Button>
										<Button className="h-10 min-w-36" onClick={createPresetFromCurrentSetup}>
											Save preset
										</Button>
									</div>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
				<AnimatePresence>
					{selectedPreset && selectedPresetIndex !== null && (
						<motion.div
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							className="mb-5 rounded-xl border bg-sidebar/85 p-4 shadow-lg"
						>
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">{t("Preset details")}</p>
									<div className="group/title mt-1 flex w-full max-w-xl items-center gap-2">
										<Input
											key={`preset-name-${selectedPresetIndex}-${selectedPreset.name}`}
											defaultValue={selectedPreset.name || "Preset"}
											onFocus={(event) => event.currentTarget.select()}
											onBlur={(event) => renamePresetAtIndex(selectedPresetIndex, event.currentTarget.value)}
											onKeyDown={(event) => {
												if (event.key === "Enter") event.currentTarget.blur();
											}}
											aria-label="Preset name"
											className="h-11 min-w-0 flex-1 rounded-none border-0 border-b border-transparent bg-transparent px-0 font-serif text-3xl font-semibold tracking-tight text-foreground shadow-none hover:border-accent/35 focus-visible:border-accent focus-visible:ring-0 dark:bg-transparent md:text-3xl"
										/>
										<PencilIcon className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 duration-200 group-hover/title:opacity-60 group-focus-within/title:text-accent group-focus-within/title:opacity-100" />
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<div
										className="flex h-9 items-center gap-2 rounded-md border bg-background/40 px-2"
										title={t("Global shortcut: applies this preset while the game is focused")}
									>
										<KeyboardIcon className="h-4 w-4 shrink-0 text-accent" />
										<Input
											value={presetHotkeyDraft}
											placeholder={t("Set hotkey")}
											aria-label="Preset global shortcut"
											className="h-7 w-24 border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
											onChange={() => {}}
											onBlur={() => {
												if (["Ctrl", "Alt", "Shift"].includes(presetHotkeyDraft)) {
													setPresetHotkeyDraft(selectedPreset.hotkey || "");
												}
											}}
											onKeyDown={(event) => {
												event.preventDefault();
												if (event.repeat) return;
												if (event.key === "Backspace" || event.key === "Delete") {
													setPresetHotkeyDraft("");
													void savePresetHotkey(selectedPresetIndex, "");
													return;
												}
												if (event.key === "Escape") {
													setPresetHotkeyDraft(selectedPreset.hotkey || "");
													event.currentTarget.blur();
													return;
												}
												const next = buildPresetHotkey(event);
												setPresetHotkeyDraft(next.value);
												if (next.complete) {
													void savePresetHotkey(selectedPresetIndex, next.value);
													event.currentTarget.blur();
												}
											}}
										/>
									</div>
									<Button
										className="h-9"
										variant="secondary"
										onClick={() => mergeCurrentSetupIntoPreset(selectedPresetIndex)}
									>
										<PlusIcon className="h-4 w-4" />
										{t("Add current setup")}
									</Button>
									<Button
										className="h-9"
										variant="secondary"
										onClick={() => duplicatePresetAtIndex(selectedPresetIndex)}
									>
										<CopyIcon className="h-4 w-4" />
										{t("Duplicate")}
									</Button>
									<Button
										className="h-9 w-9 p-0"
										variant="ghost"
										onClick={() => setSelectedPresetIndex(null)}
										aria-label={t("Close preset details")}
										title={t("Close preset details")}
									>
										<XIcon className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<div className="mt-4">
								{!selectedPresetCharacter ? (
									<>
										<Button
											className="mb-3 h-8 w-fit px-3 text-xs"
											variant="secondary"
											onClick={() => {
												setSelectedPresetCharacter(null);
												setSelectedPresetIndex(null);
											}}
										>
											<ArrowLeftIcon className="h-4 w-4" />
											{t("Back to Gallery")}
										</Button>
										<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/35 p-3">
											<div>
												<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
													{t("Manual edit")}
												</div>
												<div className="text-xs text-muted-foreground">
													{t("Add a character, then open it to add individual mods.")}
												</div>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<Button className="h-9" onClick={() => openPresetAddSearch("character")}>
													<PlusIcon className="h-4 w-4" />
													{t("Add character")}
												</Button>
											</div>
										</div>
										<div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
											{getPresetGroups(selectedPreset).map(([character, group]) => {
												const paths = getPresetGroupPaths(group);
												const coverPath = paths[0] || "";
												const characterCard = characterCards.find((card) => card.name === character);
												return (
													<div
														key={`${selectedPreset.name}-${character}`}
														onClick={() => setSelectedPresetCharacter(character)}
														className="group flex h-full flex-col overflow-hidden rounded-xl border bg-background/35 text-left shadow-sm duration-200 hover:-translate-y-0.5 hover:border-accent"
														role="button"
														tabIndex={0}
														onKeyDown={(event) => {
															if (event.key === "Enter" || event.key === " ") setSelectedPresetCharacter(character);
														}}
													>
														<div className="relative h-36 shrink-0 overflow-hidden bg-background">
															{coverPath ? (
																<img
																	src={`${getImageUrl(coverPath)}?preset-character=${selectedPresetIndex}-${lastUpdated}`}
																	onError={handleImageError}
																	className="h-full w-full object-cover opacity-70 duration-200 group-hover:scale-105 group-hover:opacity-90"
																/>
															) : (
																<div className="flex h-full items-center justify-center text-muted-foreground">
																	<FolderOpenIcon className="h-10 w-10 opacity-40" />
																</div>
															)}
															<div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background/80 to-transparent" />
														</div>
														<div className="relative flex min-h-32 flex-1 flex-col gap-2 bg-sidebar/85 p-3">
															<div className="absolute right-3 top-3 flex h-3 justify-end gap-1">
																{group.colors.slice(0, 5).map((path) => {
																	const swatch = getPresetColorSwatch(selectedPreset, path);
																	return swatch ? (
																		<span
																			key={path}
																			className="h-3 w-3 rounded-full border"
																			style={{ backgroundColor: swatch, boxShadow: `0 0 7px ${swatch}` }}
																		/>
																	) : null;
																})}
															</div>
															<div className="flex items-start gap-3 pr-20">
																<img
																	src={characterCard?.icon || "/who.jpg"}
																	onError={(event) => {
																		event.currentTarget.src = "/who.jpg";
																	}}
																	className="h-11 w-11 shrink-0 rounded-lg border bg-background object-cover"
																/>
																<div className="flex min-w-0 flex-1 flex-col">
																	<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
																		{t("Character")}
																	</div>
																	<div className="line-clamp-1 text-xl font-bold text-foreground">{character}</div>
																	<div className="hidden">
																		{group.normal.length} normal · {group.cycler.length} cycler · {group.colors.length}{" "}
																		color
																	</div>
																	<div className="absolute inset-x-3 bottom-12 grid min-h-6 grid-cols-3 gap-1 text-[10px]">
																		<span className="rounded border bg-background/65 px-1 py-1 text-center">
																			<b>{group.normal.length}</b> {t("Normal")}
																		</span>
																		<span className="rounded border bg-background/65 px-1 py-1 text-center text-accent">
																			<b>{group.cycler.length}</b> {t("Cycler")}
																		</span>
																		<span className="rounded border bg-background/65 px-1 py-1 text-center text-accent">
																			<b>{group.colors.length}</b> {t("Colors")}
																		</span>
																	</div>
																</div>
															</div>
															<div className="mt-auto flex items-center justify-end border-t pt-2">
																<Button
																	className="h-7 w-7 p-0"
																	variant="destructive"
																	onClick={(event) => {
																		event.preventDefault();
																		event.stopPropagation();
																		removeCharacterFromPreset(selectedPresetIndex, character);
																	}}
																	aria-label={`Remove ${character} from preset`}
																	title={`Remove ${character} from preset`}
																>
																	<TrashIcon className="h-3.5 w-3.5" />
																</Button>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									</>
								) : (
									<div>
										<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
											<div className="flex min-w-0 flex-col gap-2">
												<Button
													className="h-8 w-fit px-3 text-xs"
													variant="secondary"
													onClick={() => setSelectedPresetCharacter(null)}
												>
													<ArrowLeftIcon className="h-4 w-4" />
													{t("Back to preset")}
												</Button>
												<div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
													<button
														className="rounded-sm duration-200 hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
														onClick={() => {
															setSelectedPresetCharacter(null);
															setSelectedPresetIndex(null);
														}}
													>
														{t("Preset Gallery")}
													</button>
													<ChevronRightIcon className="h-3 w-3 shrink-0 opacity-60" />
													<button
														className="max-w-56 truncate rounded-sm duration-200 hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
														onClick={() => setSelectedPresetCharacter(null)}
													>
														{selectedPreset.name || "Preset"}
													</button>
													<ChevronRightIcon className="h-3 w-3 shrink-0 opacity-60" />
													<span className="truncate font-semibold text-accent">{selectedPresetCharacter}</span>
												</div>
											</div>
											<div className="text-right">
												<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
													{t("Preset character")}
												</div>
												<div className="text-xl font-bold text-foreground">{selectedPresetCharacter}</div>
											</div>
										</div>
										<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/35 p-3">
											<div>
												<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
													{t("Manual edit")}
												</div>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<Button className="h-9" onClick={() => openPresetAddSearch("mod")}>
													<PlusIcon className="h-4 w-4" />
													{t("Add mod")}
												</Button>
											</div>
										</div>
										{getPresetGroups(selectedPreset)
											.filter(([character]) => character === selectedPresetCharacter)
											.map(([character, group]) => (
												<div
													key={`${selectedPreset.name}-${character}-mods`}
													className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3"
												>
													{getPresetGroupPaths(group).map((path) => {
														const mod = getPresetMod(path);
														const isNormal = group.normal.includes(path);
														const isCycler = group.cycler.includes(path);
														const swatch = getPresetColorSwatch(selectedPreset, path);
														return (
															<div
																key={`${selectedPreset.name}-${path}`}
																className="group overflow-hidden rounded-xl border bg-background/35 shadow-sm"
															>
																<div className="relative h-42 overflow-hidden bg-background">
																	<img
																		src={`${getImageUrl(path)}?preset-mod=${selectedPresetIndex}-${lastUpdated}`}
																		onError={handleImageError}
																		className="h-full w-full object-cover opacity-75 duration-200 group-hover:scale-105 group-hover:opacity-95"
																	/>
																	<div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background/80 to-transparent" />
																</div>
																<div className="flex min-h-32 flex-col justify-between gap-2 bg-sidebar/85 p-3">
																	<div>
																		<div className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-foreground">
																			{mod?.name || path.split("\\").pop() || path}
																		</div>
																		<div className="mt-2 flex min-h-6 flex-wrap content-start gap-1 text-[10px]">
																			{isNormal && (
																				<span className="rounded border bg-background/70 px-1.5 py-0.5">
																					{t("Normal")}
																				</span>
																			)}
																			{isCycler && (
																				<span className="rounded border bg-background/70 px-1.5 py-0.5 text-accent">
																					{t("Cycler")}
																				</span>
																			)}
																			{swatch && (
																				<span className="rounded border bg-background/70 px-1.5 py-0.5 text-accent">
																					{t("Color")}
																				</span>
																			)}
																		</div>
																	</div>
																	<div className="flex items-center justify-between gap-2 border-t pt-2">
																		<Button
																			className="h-7 min-w-0 flex-1 justify-center px-2 text-[10px]"
																			variant="secondary"
																			onClick={() => setPresetColorEditorPath(path)}
																		>
																			{swatch ? (
																				<span
																					className="h-3 w-3 shrink-0 rounded-full border"
																					style={{ backgroundColor: swatch, boxShadow: `0 0 6px ${swatch}` }}
																				/>
																			) : (
																				<PaletteIcon className="h-3.5 w-3.5" />
																			)}
																			Change color
																		</Button>
																		<Button
																			className="h-7 w-7 p-0"
																			variant="destructive"
																			onClick={(event) => {
																				event.stopPropagation();
																				removePathFromPreset(selectedPresetIndex, path);
																			}}
																		>
																			<TrashIcon className="h-3.5 w-3.5" />
																		</Button>
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											))}
									</div>
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
				{selectedPresetIndex === null &&
					(presets.length > 0 ? (
						<div className="grid w-full grid-cols-[repeat(auto-fill,19rem)] justify-start gap-5">
							{presets.map((preset, index) => {
								const previewPath = preset.data?.[0] || preset.cycler?.mods?.[0] || "";
								const previewUrl = preset.cover
									? convertFileSrc(preset.cover)
									: previewPath
										? getImageUrl(previewPath)
										: "";
								const presetGroups = getPresetGroups(preset);
								const totalPresetCharacterCount = presetGroups.filter(
									([, group]) => group.normal.length > 0 || group.cycler.length > 0
								).length;
								const cyclerCharacterNames = presetGroups
									.filter(([, group]) => group.cycler.length > 0)
									.map(([character]) => character);
								const cyclerPreviewNames = cyclerCharacterNames.slice(0, 3).join(" · ");
								const cyclerExtraNames = cyclerCharacterNames.slice(3);
								const cyclerExtraCount = Math.max(0, cyclerCharacterNames.length - 3);
								return (
									<motion.div
										key={`preset-gallery-${preset.name}-${index}`}
										layout
										onClick={(event) => {
											if (eventMatchesClickShortcut(event, "previewCapture")) {
												event.preventDefault();
												setCaptureTarget({
													kind: "preset",
													presetIndex: index,
													coverKey: `preset-${preset.createdAt || index}`,
													name: preset.name || "Preset cover",
												});
												return;
											}
											setSelectedPresetIndex(selectedPresetIndex === index ? null : index);
										}}
										title="Open preset"
										className={
											"group min-h-96 cursor-pointer overflow-hidden rounded-xl border bg-sidebar text-left shadow-lg duration-200 hover:-translate-y-1 hover:border-accent " +
											(selectedPresetIndex === index ? "border-accent" : "")
										}
									>
										<div className="relative h-58 overflow-hidden bg-background">
											{previewUrl ? (
												<img
													src={`${previewUrl}?preset=${index}-${lastUpdated}`}
													onError={handleImageError}
													className="h-full w-full object-cover opacity-80 duration-200 group-hover:scale-105 group-hover:opacity-95"
												/>
											) : (
												<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
													No cover yet
												</div>
											)}
											<div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
											<Button
												className="absolute right-3 top-3 h-9 w-9 p-0"
												variant="destructive"
												onClick={(event) => {
													event.preventDefault();
													event.stopPropagation();
													setPresetDeleteConfirmIndex(index);
												}}
												aria-label={t("Delete preset")}
												title={t("Delete preset")}
											>
												<TrashIcon className="h-4 w-4" />
											</Button>
										</div>
										<div className="flex flex-col gap-3 p-4">
											<div>
												<div className="flex items-start justify-between gap-2">
													<h3 className="line-clamp-2 text-xl font-bold text-foreground">{preset.name || "Preset"}</h3>
													{preset.hotkey && (
														<span className="shrink-0 rounded border bg-background/65 px-2 py-1 text-[10px] text-accent">
															{preset.hotkey}
														</span>
													)}
												</div>
											</div>
											<div className="grid gap-2 text-sm">
												<div className="rounded-lg border bg-background/40 p-3">
													<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
														{t("Characters in preset")}
													</div>
													<div className="mt-1 font-semibold text-foreground">
														{totalPresetCharacterCount || 0}{" "}
														{t(totalPresetCharacterCount === 1 ? "character" : "characters")}
													</div>
												</div>
												<div className="rounded-lg border bg-background/40 p-3">
													<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
														{t("Cycler")}
													</div>
													<div className="mt-1 flex flex-wrap items-center gap-1 font-semibold text-foreground">
														{cyclerCharacterNames.length ? (
															<>
																<span className="line-clamp-2">{cyclerPreviewNames}</span>
																{cyclerExtraCount > 0 && (
																	<span
																		className="ml-1.5 rounded-full border border-accent/60 bg-background/70 px-1.5 py-0.5 text-[10px] text-accent"
																		title={cyclerExtraNames.join(", ")}
																	>
																		+{cyclerExtraCount}
																	</span>
																)}
															</>
														) : (
															t("None")
														)}
													</div>
												</div>
											</div>
											<Button
												className="h-10 w-full"
												onClick={(event) => {
													event.stopPropagation();
													applyPresetFromGallery(preset);
												}}
											>
												{t("Apply preset")}
											</Button>
										</div>
									</motion.div>
								);
							})}
						</div>
					) : (
						<div className="grid w-full grid-cols-[repeat(auto-fill,19rem)] justify-start gap-5">
							<div className="min-h-72 rounded-xl border bg-sidebar/70 p-5">
								<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">{t("Empty")}</p>
								<h3 className="mt-2 text-xl font-bold text-foreground">{t("No presets yet")}</h3>
							</div>
							<div className="min-h-72 rounded-xl border bg-sidebar/70 p-5">
								<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">{t("Start")}</p>
								<h3 className="mt-2 text-xl font-bold text-foreground">{t("Create from current setup")}</h3>
							</div>
						</div>
					))}
			</div>
		);
	}

	const selectedLookMod = selectedLookModPath
		? modList.find((mod) => mod.path === selectedLookModPath && mod.isDir)
		: undefined;
	if (previewCategory && selectedLookMod) {
		return <ModLooksView mod={selectedLookMod} onBack={() => setSelectedLookModPath(null)} />;
	}

	if (previewCategory) {
		return (
			<div className="flex flex-col w-full h-full overflow-hidden">
				<div className="flex items-center justify-between gap-3 px-5 py-3">
					<div>
						<p className="text-accent text-[10px] font-bold tracking-[0.2em] uppercase">{t("Character folder")}</p>
						<div className="flex flex-wrap items-center gap-3">
							<h2 className="text-3xl font-serif text-accent">{previewCategory}</h2>
							<div className="flex rounded-lg border bg-sidebar/80 p-1">
								<button
									onClick={() => setCharacterModView("normal")}
									className={
										"h-8 rounded-md px-3 text-xs font-semibold duration-200 " +
										(characterModView === "normal" ? "bg-accent text-background" : "text-accent hover:bg-accent/15")
									}
								>
									{t("Normal")}
									<span className="ml-1 opacity-70">{normalModsCount}</span>
								</button>
								<button
									onClick={() => setCharacterModView("cycler")}
									className={
										"h-8 rounded-md px-3 text-xs font-semibold duration-200 " +
										(characterModView === "cycler" ? "bg-accent text-background" : "text-accent hover:bg-accent/15")
									}
								>
									{t("Cycler")}
									<span className="ml-1 opacity-70">{cyclerModsCount}</span>
								</button>
							</div>
						</div>
						{previewSubGroups.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1.5">
								{previewSubGroups.map((group) => (
									<button
										key={`preview-subgroup-${group.id}`}
										onClick={() => setSelectedSubGroup(group.id)}
										className={
											"h-8 rounded-md border px-3 text-xs font-semibold duration-200 hover:border-accent hover:bg-accent hover:text-background " +
											(selectedSubGroup === group.id
												? "border-accent bg-accent text-background"
												: "bg-sidebar/80 text-accent")
										}
									>
										{group.label}
										<span className="ml-1 opacity-70">{subGroupCounts[group.id] || 0}</span>
									</button>
								))}
							</div>
						)}
						<p className="mt-1.5 text-muted-foreground text-xs">
							{`${visibleSelectedMods.length} ${t("visible")} - ${selectedMods.length} ${t("total mods")}`}
							{hasActiveFilter && (
								<button
									type="button"
									onClick={() => setFilter({ st: "all", src: "any", tag: { fav: "any", nsfw: "any" }, upd: "any" })}
									className="ml-2 text-accent underline-offset-2 hover:underline"
								>
									{t("Clear filter")}
								</button>
							)}
						</p>
					</div>
				</div>
				<div
					data-main-scroll
					className="previewer-mod-grid thin grid w-full h-full grid-cols-[repeat(auto-fill,19rem)] justify-start content-start gap-x-5 gap-y-7 overflow-y-auto px-5 pt-5 pb-8"
					style={{ "--card-height": "25.5rem" } as React.CSSProperties}
				>
					<AnimatePresence mode="popLayout">
						{visibleSelectedMods.map((mod) => (
							<motion.div
								key={`previewer-mod-${mod.path}`}
								layout
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -16 }}
								transition={{ duration: 0.18 }}
								onMouseDown={(event) => {
									if (eventMatchesClickShortcut(event, "openLooks")) {
										event.preventDefault();
										event.stopPropagation();
									}
								}}
								onMouseUp={(event) => handleModClick(event, mod)}
								onAuxClick={(event) => handleModClick(event, mod)}
								onContextMenu={(event) => {
									event.preventDefault();
									if (eventMatchesClickShortcut(event, "openLooks")) {
										setSelected(mod.path);
										setSelectedLookModPath(mod.path);
									}
								}}
								className="flex justify-center [&_.card-generic]:!h-[var(--card-height)] [&_.card-generic]:!w-[19rem]"
							>
								<CardLocal
									item={mod}
									selected={selected === mod.path}
									lastUpdated={lastUpdated}
									hasUpdate={updateObj[mod.path]}
									updateAvl={textData.UpdateAvl}
									inConflict={conflicts.mods[mod.path] ?? -1}
								/>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>
		);
	}

	return (
		<div data-main-scroll className="thin flex flex-col w-full h-full overflow-y-auto px-5 pb-8">
			<div className="sticky top-0 z-20 -mx-5 border-b bg-background/95 px-5 py-4 backdrop-blur">
				<div>
					<p className="text-accent text-[10px] font-bold tracking-[0.2em] uppercase">{t("Mod library")}</p>
					<h2 className="text-3xl font-serif text-accent">{t("Characters")}</h2>
					<p className="text-muted-foreground text-xs">
						{modList.length} {t("total mods")} · {t("Open a character folder to view its mods.")}
					</p>
				</div>
				<div className="mt-4 flex flex-wrap gap-1.5">
					{characterAvailableLetters.map((letter) => (
						<button
							key={`character-letter-${letter}`}
							onClick={() => setSelectedLetter((current) => (current === letter ? "" : letter))}
							title={`${t("Show characters starting with this letter")}: ${letter}`}
							className={
								"h-8 min-w-8 rounded-md border px-2 text-xs duration-200 hover:border-accent hover:bg-accent hover:text-background " +
								(selectedLetter === letter ? "border-accent bg-accent text-background" : "bg-sidebar text-accent")
							}
						>
							{letter}
						</button>
					))}
				</div>
			</div>
			<div className="mb-3 flex items-baseline gap-2 px-1">
				<h3 className="font-serif text-2xl text-accent">{selectedLetter || t("Characters")}</h3>
				<span className="text-xs text-muted-foreground">
					{visibleCharacterCards.length} {t("characters")}
				</span>
			</div>
			<div className="grid w-full grid-cols-[repeat(auto-fill,19rem)] justify-start gap-5">
				{visibleCharacterCards.map((card) => {
					const firstPreview = card.mods.find((mod) => mod.path);
					const enabledCount = card.mods.filter((mod) => mod.enabled).length;
					return (
						<motion.div
							key={`previewer-character-${card.name}`}
							layout
							onClick={() => openCharacter(card.name)}
							role="button"
							tabIndex={0}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									openCharacter(card.name);
								}
							}}
							className="group relative min-h-96 overflow-hidden rounded-xl border bg-sidebar text-left shadow-lg duration-200 hover:-translate-y-1 hover:border-accent"
						>
							<Button
								onMouseDown={(event) => event.stopPropagation()}
								onMouseUp={(event) => event.stopPropagation()}
								onClick={(event) => toggleCharacterFavorite(event, card.name)}
								title={card.favorite ? "Remove favorite character" : "Add favorite character"}
								className="absolute right-3 top-3 z-20 h-9 w-9 rounded-full border bg-background/70 p-0 backdrop-blur hover:bg-background"
							>
								<HeartIcon
									className="h-4 w-4"
									style={{
										color: card.favorite ? "var(--color-red-400)" : "",
										fill: card.favorite ? "currentColor" : "none",
									}}
								/>
							</Button>
							{firstPreview ? (
								<img
									src={`${getImageUrl(firstPreview.path)}?${lastUpdated}`}
									onError={(event) => {
										event.currentTarget.hidden = true;
									}}
									className="absolute inset-0 h-full w-full object-cover opacity-55 blur-[1px] duration-200 group-hover:opacity-70 group-hover:blur-0"
								/>
							) : (
								<div className="absolute inset-0 grid place-items-center bg-background/40">
									<ImageOffIcon className="h-12 w-12 text-muted-foreground" />
								</div>
							)}
							<div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
							<span className="absolute right-3 top-14 z-10 rounded-md border bg-background/70 px-2 py-1 text-[11px] text-accent">
								{enabledCount} {t(enabledCount === 1 ? "enabled mod" : "enabled mods")}
							</span>
							<div className="relative flex h-full min-h-96 flex-col justify-between p-4">
								<div className="flex items-start justify-between">
									<img
										src={card.icon || "/who.jpg"}
										onError={(event) => {
											event.currentTarget.src = "/who.jpg";
										}}
										className="h-14 w-14 rounded-lg border bg-background object-cover"
									/>
								</div>
								<div>
									<p className="text-accent text-[10px] font-bold tracking-[0.12em] uppercase">{t("Folder")}</p>
									<h3 className="line-clamp-2 text-xl font-bold text-foreground">{card.name}</h3>
									<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
										<FolderOpenIcon className="h-3.5 w-3.5" />
										{card.mods.length} mods
									</p>
								</div>
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}

export default PreviewerLocal;
