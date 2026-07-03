import { Games } from "./types";
import { LANG, store } from "./vars";

type GameTheme = "wuwa" | "zzz" | "gi" | "sr" | "ef";
export type WuWaElementTheme = "spectro" | "crio" | "fusion" | "electro" | "aero" | "havoc";
export type Language = "en" | "cn" | "jp" | "kr" | "ru" | "ptbr";

export const WUWA_ELEMENT_THEME_STORAGE_KEY = "wuwa-element-theme";
export const WUWA_ELEMENT_THEMES: { value: WuWaElementTheme; label: string; hint: string }[] = [
	{ value: "spectro", label: "Spectro", hint: "Light gold" },
	{ value: "crio", label: "Criogenic", hint: "Glacio blue" },
	{ value: "fusion", label: "Termic", hint: "Warm orange" },
	{ value: "electro", label: "Voltaic", hint: "Electric violet" },
	{ value: "aero", label: "Pneuma", hint: "Wind teal" },
	{ value: "havoc", label: "Aniquilant", hint: "Dark crimson" },
];

export function getSavedWuWaElementTheme(): WuWaElementTheme {
	const savedTheme = localStorage.getItem(WUWA_ELEMENT_THEME_STORAGE_KEY) as WuWaElementTheme | null;
	return WUWA_ELEMENT_THEMES.some((theme) => theme.value === savedTheme) ? savedTheme! : "spectro";
}

export function switchWuWaElementTheme(theme: WuWaElementTheme): void {
	const root = document.documentElement;

	root.setAttribute("data-element-theme", theme);
	document.body?.setAttribute("data-element-theme", theme);
	localStorage.setItem(WUWA_ELEMENT_THEME_STORAGE_KEY, theme);
}

function gameToTheme(game: Games): GameTheme {
	return ({ WW: "wuwa", ZZ: "zzz", GI: "gi", "": "", SR: "sr", EF: "ef" }[game] || "wuwa") as GameTheme;
}
function themeToGame(theme: GameTheme): Games {
	return ({ wuwa: "WW", zzz: "ZZ", gi: "GI", sr: "SR", ef: "EF" }[theme] || "WW") as Games;
}

/**
 * Switch between WuWa and ZZZ themes
 * @param theme - The theme to switch to ('wuwa' or 'zzz')
 */
// let interval = null as any;
export function switchGameTheme(theme: Games): void {
	const root = document.documentElement;

	// Remove any existing theme data attribute
	root.removeAttribute("data-theme");

	// Set the new theme
	root.setAttribute("data-theme", gameToTheme(theme));

	// Optional: Store theme preference in localStorage
	localStorage.setItem("game-theme", gameToTheme(theme));

	//info(`Switched to ${theme.toUpperCase()} theme`);
}

/**
 * Switch language and update data attribute
 * @param language - The language to switch to ('en' | 'cn' | 'jp' | 'kr' | 'ru' | 'ptbr')
 */
export function switchLanguage(): void {
	const language = getCurrentLanguage();
	const root = document.documentElement;
	// Set the language data attribute
	root.setAttribute("data-lang", language);
}

store.sub(LANG, () => {
	switchLanguage();
});

/**
 * Get the current active theme
 * @returns The current theme ('wuwa' or 'zzz')
 */
export function getCurrentTheme(): GameTheme {
	const root = document.documentElement;
	const currentTheme = root.getAttribute("data-theme") as GameTheme;

	// Default to 'wuwa' if no theme is set
	return currentTheme || "wuwa";
}

/**
 * Get the current active language
 * @returns The current language ('en' | 'cn' | 'jp' | 'kr' | 'ru' | 'ptbr')
 */
export function getCurrentLanguage(): Language {
	try {
		const savedLanguage = JSON.parse(localStorage.getItem("imm-lang") || "null") as Language;
		return savedLanguage || "en";
	} catch {
		return "en";
	}
}

/**
 * Initialize theme from localStorage or default to WuWa
 */
export function initializeThemes(): void {
	const savedTheme = localStorage.getItem("game-theme") as GameTheme;
	const themeToUse = savedTheme || "wuwa";
	switchGameTheme(themeToGame(themeToUse));
	switchWuWaElementTheme(getSavedWuWaElementTheme());
	switchLanguage();
}



/**
 * Toggle between WuWa and ZZZ themes
 */
export function toggleGameTheme(): void {
	const currentTheme = getCurrentTheme();
	const newTheme: GameTheme = currentTheme === "wuwa" ? "zzz" : "wuwa";

	switchGameTheme(themeToGame(newTheme));
}
