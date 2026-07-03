import type { Mod } from "./types";
import { store, TEST_PIN_STATE } from "./vars";

const EXEMPT_CATEGORIES = new Set([
	"other",
	"uncategorized",
	"motorbike",
	"wings",
	"weapons",
	"utility",
	"ui",
	"npcs & entities",
	"npc & entities",
	"functionality",
	"weaponry",
]);

function normalize(value: string) {
	return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function includesAny(value: string, terms: string[]) {
	return terms.some((term) => value.includes(term));
}

export type RoverFemaleVariant = "rover" | "uniform" | "eye-hair";

/**
 * Keep Rover Female's visual subfolders and collision scopes on the same rule.
 * Uniform-model mods use a different game model, while the eye/hair addon is
 * intentionally composable with either outfit model.
 */
export function getRoverFemaleVariant(value: string): RoverFemaleVariant {
	const text = normalize(value);
	const isEyeHair =
		includesAny(text, ["eye/hair", "eye-hair", "eye hair", "eye_hair", "recolor addon", "hair options"])
		|| (text.includes("eye") && text.includes("hair"));
	if (isEyeHair) return "eye-hair";
	if (includesAny(text, ["uniform", "perpetual spark", "perpetual_spark", "school", "student", "campus"])) {
		return "uniform";
	}
	return "rover";
}

export function getModCollisionScopes(mod: Mod) {
	const parent = normalize(mod.parent || "");
	if (!parent || EXEMPT_CATEGORIES.has(parent)) return [];
	const name = normalize(mod.name || mod.path.split("\\").pop() || "");

	if (["aemeath", "aemeth", "ameath"].includes(parent)) {
		return [`${parent}:${includesAny(name, ["mecha", "mechanical"]) ? "mecha" : "normal"}`];
	}

	if (["cartethyia", "carthetia", "carthethya", "carthethyia", "cartethiya", "carthetiya"].includes(parent)) {
		const mentionsCartethyia = includesAny(name, ["cartethyia", "carthetia", "carthethya", "carthethyia", "cartethiya", "carthetiya"]);
		const mentionsFleurdelys = includesAny(name, ["flourdelys", "fleurdelys", "fluerdelys"]);
		if (mentionsCartethyia && mentionsFleurdelys) return [`${parent}:cartethyia`, `${parent}:fleurdelys`];
		return [`${parent}:${mentionsFleurdelys ? "fleurdelys" : "cartethyia"}`];
	}

	if (["rover female", "female rover", "rover_female"].includes(parent)) {
		const variant = getRoverFemaleVariant(`${mod.name || ""} ${mod.path || ""}`);
		return [`${parent}:${variant}`];
	}

	return [parent];
}

export function getModCollisionGroups(modList: Mod[], normalPaths: string[], cyclerPaths: string[]) {
	const modsByPath = new Map(modList.map((mod) => [mod.path, mod]));
	const groups: string[][] = [];
	const seen = new Set<string>();
	const pushGroup = (paths: string[]) => {
		const unique = [...new Set(paths)].filter((path) => modsByPath.has(path)).sort((a, b) => a.localeCompare(b));
		if (unique.length < 2) return;
		const key = unique.join("\u0000");
		if (seen.has(key)) return;
		seen.add(key);
		groups.push(unique);
	};

	const normalByScope = new Map<string, string[]>();
	const cyclerByScope = new Map<string, string[]>();
	for (const path of normalPaths) {
		const mod = modsByPath.get(path);
		if (!mod) continue;
		for (const scope of getModCollisionScopes(mod)) {
			normalByScope.set(scope, [...(normalByScope.get(scope) || []), path]);
		}
	}
	for (const path of cyclerPaths) {
		const mod = modsByPath.get(path);
		if (!mod) continue;
		for (const scope of getModCollisionScopes(mod)) {
			cyclerByScope.set(scope, [...(cyclerByScope.get(scope) || []), path]);
		}
	}
	for (const [scope, normal] of normalByScope) {
		const cycler = cyclerByScope.get(scope) || [];
		if (cycler.length) pushGroup([...normal, ...cycler]);
	}

	const normalHashes = new Map<string, string[]>();
	for (const path of normalPaths) {
		const mod = modsByPath.get(path);
		if (!mod) continue;
		for (const scope of getModCollisionScopes(mod)) {
			for (const hash of mod.hashes || []) {
				const key = `${scope}\u0000${hash}`;
				normalHashes.set(key, [...(normalHashes.get(key) || []), path]);
			}
		}
	}
	for (const paths of normalHashes.values()) pushGroup(paths);
	return groups;
}

export function getActiveModCollisionGroups(modList: Mod[]) {
	const temporaryPinnedPath = store.get(TEST_PIN_STATE).path;
	const normalPaths = modList
		.filter(
			(mod) =>
				mod.isDir &&
				mod.enabled &&
				mod.path !== temporaryPinnedPath &&
				!(mod.tags || []).includes("cycler")
		)
		.map((mod) => mod.path);
	const cyclerPaths = modList
		.filter((mod) => mod.isDir && (mod.tags || []).includes("cycler"))
		.map((mod) => mod.path);
	return getModCollisionGroups(modList, normalPaths, cyclerPaths);
}
