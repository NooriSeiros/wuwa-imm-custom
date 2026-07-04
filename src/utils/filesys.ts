import defConfig from "../default.json";
import {
	copyFile,
	exists,
	mkdir,
	readDir,
	readTextFile,
	remove,
	rename,
	writeFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
	exts,
	IGNORE,
	LOCAL_SPECIAL_CATEGORIES,
	managedSRC,
	managedTGT,
	OLD_managedSRC,
	OLD_managedTGT,
	OLD_RESTORE,
	PREFS,
	RESTORE,
	UNCATEGORIZED,
	VERSION,
} from "./consts";
import {
	CATEGORIES,
	DATA,
	DOWNLOAD_LIST,
	ERR,
	LAST_UPDATED,
	MOD_LIST,
	PRESETS,
	PROGRESS_OVERLAY,
	SETTINGS,
	SOURCE,
	store,
	TARGET,
	TEST_PIN_STATE,
	TEXT_DATA,
	XXMI_DIR,
	XXMI_MODE,
} from "./vars";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { join } from "./utils";
import { main, updateConfig } from "./init";
import { addToast } from "@/_Toaster/ToastProvider";
import MiniSearch from "minisearch";
import { ChangeInfo, DirEntry, GameConfig, GlobalSettings, Mod, ModDataObj, ModHotKeys, Settings } from "./types";
import { openPath } from "@tauri-apps/plugin-opener";
import { error, info, warn } from "@/lib/logger";
import { addToExtracts } from "@/_LeftSidebar/components/Downloads";
import { getCustomHotkeyForMigoto } from "./customHotkeys";
import { saveSourceMetadataIndex } from "./sourceMetadataIndex";
import { applyImportedConfigExtras } from "./configImportExportExtras";
import { getModCollisionScopes } from "./modCollision";
export async function setGame(game: string) {
	try {
		const config = await readTextFile(`config.json`);
		const parsedConfig = JSON.parse(config);
		parsedConfig.game = game;
		await writeTextFile(`config.json`, JSON.stringify(parsedConfig, null, 2));
		return true;
	} catch {
		try {
			if (!(await exists(`config.json`))) {
				await writeTextFile(`config.json`, JSON.stringify({ ...defConfig, game }, null, 2));
				return true;
			}
			throw new Error("Config file exists but could not be read or updated.");
		} catch {
			return false;
		}
	}
}
const textMSG = {
	rem: "Removing current files",
	disc: "Discovering files",
	file: "File",
};
let completedFiles = 0;
let totalFiles = 0;
let canceled = false;
let result = "Ok";
let progressBar: HTMLElement | null = null;
let progressMessage: HTMLElement | null = null;
let progressPerct: HTMLElement | null = null;
// Initialize Intl.Collator for faster string comparison
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const sp = [UNCATEGORIZED, IGNORE, OLD_RESTORE];
let recentlyDownloaded: string[] = [];
store.sub(DOWNLOAD_LIST, () => {
	recentlyDownloaded = store.get(DOWNLOAD_LIST).completed.map((item: any) => item.path);
});
let src = "";
let rootReplace = "";
let modRoot = "";
let tgt = "";
let textData = store.get(TEXT_DATA);
store.sub(TEXT_DATA, () => {
	textData = store.get(TEXT_DATA);
});
store.sub(SOURCE, () => {
	src = store.get(SOURCE);
	modRoot = join(src, managedSRC);
	rootReplace = modRoot;
});
store.sub(TARGET, () => {
	tgt = store.get(TARGET);
});
let catDB: MiniSearch | null = null;
const INTERNAL_CATEGORY_FILES = new Set([".imm-collision-checklist", "settings.json"]);

function resolveKnownCategory(name: string) {
	const normalizedName = name.trim().toLowerCase();
	const exact = [...store.get(CATEGORIES), ...LOCAL_SPECIAL_CATEGORIES, { _sName: UNCATEGORIZED, _sIconUrl: "" }].find(
		(category) => category._sName.trim().toLowerCase() === normalizedName
	);
	return exact || catDB?.search(name, { prefix: true, fuzzy: 0.2 })[0];
}

store.sub(CATEGORIES, () => {
	try {
		const categories = store.get(CATEGORIES) || [];
		catDB = new MiniSearch({
			idField: "_sName",
			fields: ["_sName"],
			storeFields: ["_sName", "_sIconUrl"],
			searchOptions: {
				boost: { name: 2 },
				fuzzy: 0.2,
			},
		});
		catDB.addAll([...categories, ...LOCAL_SPECIAL_CATEGORIES, { _sName: UNCATEGORIZED, _sIconUrl: "" }]);
	} catch (e) {
		error("Error building category search index:", e);
	}
});
export async function setConfig(config: any) {
	info("[IMM] Setting config...");
	if (!config) return;
	if (config.version && config.version < "2.1.0") {
		info("[IMM] Old config version, migrating...");
		await updateConfig(config);
		addToast({ type: "success", message: textData._Toasts.SuccessPort });
		main();
		return;
	}
	let { gameConfig: curConfig } = getConfig(store.get(SETTINGS));
	info("[IMM] Current config:", { ...curConfig });
	info("[IMM] New config:", config);
	if (!curConfig.game || !config.game || curConfig.game !== config.game) {
		addToast({ type: "error", message: textData._Toasts.GameConfigMismatch });
		return;
	}
	const importExtras = applyImportedConfigExtras(config);
	config.version = VERSION;
	await writeTextFile(`config${curConfig.game}.json`, JSON.stringify(config, null, 2));
	// store.set(INIT_DONE,false)
	addToast({
		type: "success",
		message:
			importExtras.missing.length > 0
				? `Config loaded. ${importExtras.missing.length} imported mod(s) are missing locally.`
				: textData._Toasts.ConfigLoaded,
	});
	main();
}
export function getConfig(settings: Settings) {
	const config: GlobalSettings = settings.global;
	config["updatedAt"] = new Date().toISOString();
	config["version"] = VERSION;
	config["XXMI"] = store.get(XXMI_DIR) || "";
	const xxmiMode = store.get(XXMI_MODE) || 0;
	const gameConfig: GameConfig = {
		version: VERSION,
		custom: xxmiMode,
		sourceDir: xxmiMode ? store.get(SOURCE) || "" : "",
		targetDir: xxmiMode ? store.get(TARGET) || "" : "",
		game: settings.global.game,
		settings: settings.game,
		data: store.get(DATA) || {},
		presets: store.get(PRESETS) || [],
		updatedAt: new Date().toISOString(),
		categories: store.get(CATEGORIES) || [],
	};
	return { config, gameConfig };
}
export async function saveConfigs(skip = false, settings = store.get(SETTINGS)) {
	info("[IMM] Saving configs...");
	try {
		const { config, gameConfig } = getConfig(settings);
		const promises: Promise<void>[] = [];
		promises.push(writeTextFile("config.json", JSON.stringify(config, null, 2)));
		if (config.game && !skip) {
			promises.push(writeTextFile(`config${config.game}.json`, JSON.stringify(gameConfig, null, 2)));
			promises.push(saveSourceMetadataIndex(config.game, gameConfig.data));
		}
		await Promise.all(promises);
	} catch (error) {
		//console.error("Error saving configs:", error);
		throw error;
	}
}
export async function selectPath(
	options = { multiple: false, directory: false } as {
		multiple?: boolean;
		directory?: boolean;
		defaultPath?: string;
		title?: string;
		filters?: { name: string; extensions: string[] }[];
	}
) {
	return await open(options);
}
export function folderSelector(path = "", title: string | undefined = undefined) {
	return selectPath({ directory: true, ...(path ? { defaultPath: path } : {}), ...(title ? { title } : {}) });
}
function replaceDisabled(name: string) {
	return name.replace("DISABLED_", "").replace("DISABLED", "").trim();
}
function formatDateTime() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(
		2,
		"0"
	)}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
		now.getSeconds()
	).padStart(2, "0")}`;
}
/**
 * Optimized sorting function using Intl.Collator for better performance
 * Handles case-insensitive sorting with uppercase precedence for same letters
 */
function sortMods(a: Mod | DirEntry, b: Mod | DirEntry) {
	const x = replaceDisabled(a.name);
	const y = replaceDisabled(b.name);

	// Use Intl.Collator for faster comparison
	const comparison = collator.compare(x, y);

	if (comparison !== 0) {
		return comparison;
	}

	// If names are equal after collation, prioritize uppercase
	const xFirstLower = x[0]?.toLowerCase();
	const yFirstLower = y[0]?.toLowerCase();

	if (xFirstLower === yFirstLower) {
		const xIsUpper = x[0] === x[0]?.toUpperCase();
		const yIsUpper = y[0] === y[0]?.toUpperCase();

		if (xIsUpper && !yIsUpper) return 1;
		if (!xIsUpper && yIsUpper) return -1;
	}

	return 0;
}
async function copyDir(src: string, dest: string, withProgress = false) {
	try {
		await mkdir(dest, { recursive: true });
		const entries = (await readDir(src)).filter(
			(item) =>
				!withProgress ||
				(item.name !== RESTORE &&
					item.name !== IGNORE &&
					item.name !== PREFS &&
					item.name !== managedSRC &&
					item.name !== managedTGT)
		);
		for (const entry of entries) {
			if (withProgress && canceled) {
				if (result == "Ok") result = "Operation Cancelled";
				return;
			}
			const srcPath = `${src}/${entry.name}`;
			const destPath = `${dest}/${entry.name}`;
			if (!entry.isDirectory) {
				await copyFile(srcPath, destPath);
				if (withProgress) {
					completedFiles++;
					if (progressBar && progressPerct && progressMessage) {
						const percentage = ((completedFiles / totalFiles) * 100).toFixed(2);
						progressBar.style.width = percentage + "%";
						progressPerct.innerText = percentage + "%";
						progressMessage.innerText = `${textMSG.file} ${completedFiles}/${totalFiles}: ${src.replace(
							rootReplace,
							""
						)}/${entry.name}`;
					}
				}
			} else {
				await copyDir(srcPath, destPath, withProgress);
			}
		}
	} catch (error) {
		canceled = true;
		result = "An Error Occurred";
		//console.error("Error copying directory:", error);
		throw error;
	}
}

async function countFilesInDir(path: string) {
	let entries = (await readDir(join(path, ""))).filter(
		(item) => item.name != RESTORE && item.name != IGNORE && item.name != PREFS
	);
	for (let entry of entries) {
		if (entry.isDirectory) {
			await countFilesInDir(join(path, entry.name));
		} else {
			totalFiles++;
			if (progressMessage) {
				progressMessage.innerText = textMSG.disc + " ( " + totalFiles + " / ? )";
			}
		}
	}
}
export function cancelRestore() {
	info("[IMM] Cancelling restore operation...");
	canceled = true;
}
export async function getRestorePoints(): Promise<string[]> {
	info("[IMM] Getting restore points...");
	try {
		const restoreDir = join(modRoot, RESTORE);
		if (!(await exists(restoreDir))) return [];
		const entries = await readDir(restoreDir);
		return entries
			.filter((item) => item.isDirectory)
			.map((item) => item.name)
			.sort()
			.reverse();
	} catch (error) {
		//console.error("Error getting restore points:", error);
		return [];
	}
}
export async function resetWithBackup() {
	info("[IMM] Resetting with backup...");
	const configs = ["", "WW"];
	for (let cfg of configs) {
		try {
			await rename(`config${cfg}.json`, `backups/MAN_${Date.now()}_config${cfg}.json.bak`);
		} catch {}
	}
	window.location.reload();
}
export async function previewRestorePoint(point: string) {
	info("[IMM] Previewing restore point:", point);
	let path = join(modRoot, RESTORE, point);
	if (!(await exists(path))) return [];
	let entries = await readDirRecr(path, "", 2);
	let categories = store.get(CATEGORIES) || [];
	//info(entries);
	return entries.map((entry: Mod) => {
		let category = categories.find((cat) => cat._sName == entry.name);
		if (category && entry.isDir) entry.icon = category._sIconUrl;
		return entry;
	});
}
export async function sourceBatchPreview(newCategory = "" as string) {
	info("[IMM] Previewing source batch...");
	let path = src;
	if (!(await exists(path))) return [];
	let categories = store.get(CATEGORIES) || [];
	try {
		if (newCategory) {
			await mkdir(join(modRoot, newCategory), { recursive: true });
		}
	} catch {}
	let entries = (await readDirRecr(path, "", 2)).map((entry: Mod) => {
		if (entry.name === managedSRC) {
			// entry.icon = "IMM2.png";

			entry.children.map((child: Mod) => {
				let category = categories.find((cat) => cat._sName == child.name);
				if (category && child.isDir) child.icon = category._sIconUrl;
				return child;
			});
		} else if (entry.name === managedTGT) {
			// entry.icon = "IMM2.png";
		}
		return entry;
	});
	info("[WWW]", entries);
	return entries;
}
export async function addToBatchPreview(opath: string) {
	info("[IMM] Adding to source batch preview:", opath);
	const path = join(src, opath);
	if (!(await exists(path))) return [];
	let entries = await readDirRecr(path, "", 0);
	info("[WWW]", path, " -> ", entries);
	return entries.map((entry: Mod) => {
		entry.path = join(opath, entry.path);
		entry.parent = opath;
		return entry;
	});
}
export async function restoreFromPoint(point: string) {
	info("[IMM] Restoring from point:", point);
	let path = join(modRoot, RESTORE, point);
	if (!(await exists(path))) return null;
	store.set(PROGRESS_OVERLAY, {
		title: "Restoring from " + name,
		finished: false,
		button: "Cancel",
		open: true,
		name: point,
	});
	progressBar = document.querySelector("#restore-progress");
	progressMessage = document.querySelector("#restore-progress-message");
	progressPerct = document.querySelector("#restore-progress-percentage");
	while (!progressBar || !progressMessage || !progressPerct) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		progressBar = progressBar || document.querySelector("#restore-progress");
		progressMessage = progressMessage || document.querySelector("#restore-progress-message");
		progressPerct = progressPerct || document.querySelector("#restore-progress-percentage");
	}
	progressMessage.innerText = textMSG.rem;
	let entries = (await readDir(modRoot)).filter((item) => item.name != RESTORE);
	for (let entry of entries) {
		try {
			await remove(join(modRoot, entry.name), { recursive: true });
		} catch {}
	}
	progressMessage.innerText = textMSG.disc;
	completedFiles = 0;
	totalFiles = 0;
	canceled = false;
	if (canceled) {
		result = "Operation Cancelled";
	} else {
		await countFilesInDir(path);
		result = "Ok";
		rootReplace = join(modRoot, RESTORE, point);
		await copyDir(path, point.startsWith("ORG") ? src : modRoot, true);
	}
	store.set(PROGRESS_OVERLAY, (prev) => ({
		title: result == "Ok" ? "Restoration Completed" : result,
		finished: true,
		button: "Close",
		open: prev.open,
		name: point,
	}));
	return null;
}
export async function createRestorePoint(prefix = "") {
	info("[IMM] Creating restore point with prefix:", prefix);
	store.set(PROGRESS_OVERLAY, {
		title: "Creating Restore Point",
		button: "Cancel",
		finished: false,
		open: true,
		name: prefix,
	});
	progressBar = document.querySelector("#restore-progress");
	progressMessage = document.querySelector("#restore-progress-message");
	progressPerct = document.querySelector("#restore-progress-percentage");
	while (!progressBar || !progressMessage || !progressPerct) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		progressBar = progressBar || document.querySelector("#restore-progress");
		progressMessage = progressMessage || document.querySelector("#restore-progress-message");
		progressPerct = progressPerct || document.querySelector("#restore-progress-percentage");
	}
	progressMessage.innerText = textMSG.disc;
	completedFiles = 0;
	totalFiles = 0;
	canceled = false;
	try {
		await mkdir(join(modRoot, RESTORE), { recursive: true });
	} catch (e) {}

	let restorePointName = prefix + "RESTORE-" + formatDateTime();
	const root = !prefix ? modRoot : src;
	rootReplace = root;
	await countFilesInDir(root);
	try {
		await mkdir(join(modRoot, RESTORE, restorePointName));
	} catch (e) {
		return false;
	}
	result = "Ok";
	await copyDir(root, join(modRoot, RESTORE, restorePointName), true);
	if (canceled) {
		if (result == "Ok") result = "Operation Cancelled";
		await remove(join(modRoot, RESTORE, restorePointName), { recursive: true });
		try {
			await remove(join(modRoot, RESTORE));
			await remove(join(modRoot));
		} catch (e) {}
	}
	store.set(PROGRESS_OVERLAY, (prev) => ({
		title: result == "Ok" ? "Restore Point Created" : result,
		button: "Close",
		finished: true,
		open: prev.open,
		name: prefix,
	}));
	return result == "Ok";
}
export async function checkOldVerDirs(src: string) {
	try {
		let checkFolders = 0;
		const entries = await readDir(src);
		for (const i of entries) {
			if (i.isDirectory && sp.includes(i.name)) {
				checkFolders++;
			}
		}
		return checkFolders === 3;
	} catch (error) {
		//console.error("Error checking old version directories:", error);
		return false;
	}
}

export async function categorizeDir(src: string, modifyIni = false) {
	info("[IMM] Categorizing directory:", src, "Skip restore:", modifyIni);
	const d3dx_path = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	let d3dx = "" as any;
	try {
		info("[IMM] Reading d3dx_user.ini...", await exists(d3dx_path));
		const backupPath = join(...tgt.split("\\").slice(0, -1), `d3dx_user_pre_imm.ini.bak`);
		if (!(await exists(backupPath))) {
			await copyFile(d3dx_path, backupPath);
		}
		if (modifyIni) d3dx = await readTextFile(d3dx_path);
	} catch {
		info("[IMM] d3dx_user.ini not found or could not be read.");
	}

	try {
		const categories = [...store.get(CATEGORIES), ...LOCAL_SPECIAL_CATEGORIES, { _sName: UNCATEGORIZED }].map(
			(cat) => cat._sName
		);

		const reqCategories: Record<string, Array<{ name: string; isDirectory: boolean }>> = {};
		const entries = await readDir(src);
		const ignore = [IGNORE, managedSRC, managedTGT, RESTORE, PREFS];
		let fullDirectoryRenames: string[] = []; // First pass: categorize items
		for (const item of entries) {
			if (!item.isDirectory && INTERNAL_CATEGORY_FILES.has(item.name.toLowerCase())) continue;
			if (item.isDirectory && ignore.includes(item.name)) continue;
			if (item.name === OLD_RESTORE) {
				if (modifyIni) continue;
				try {
					await rename(join(src, OLD_RESTORE), join(src, RESTORE));
				} catch (error) {
					//console.error("Error renaming OLD_RESTORE:", error);
				}
				continue;
			}
			if (categories.includes(item.name)) {
				fullDirectoryRenames.push(item.name);
				continue;
			}
			const category = resolveKnownCategory(item.name)?._sName || UNCATEGORIZED;
			// categories.find((cat: string) =>
			// 	cat
			// 		.toLowerCase()
			// 		.split(" ")
			// 		.some(
			// 			(catPart: string) =>
			// 				catPart.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(catPart)
			// 		)
			// ) || UNCATEGORIZED;
			if (item.isDirectory && item.name === category) {
				fullDirectoryRenames.push(category);
				continue;
			}

			if (!reqCategories[category]) {
				reqCategories[category] = [];
			}
			reqCategories[category].push({ name: item.name, isDirectory: item.isDirectory });
		}
		// Second pass: batch create directories and move items
		const mkdirPromises: Promise<void>[] = [];
		for (const key of Object.keys(reqCategories)) {
			mkdirPromises.push(mkdir(join(src, key), { recursive: true }));
		}
		await Promise.all(mkdirPromises);

		// Move items to categories
		const renamePromises: Promise<void>[] = [];
		const changesToD3dx: Record<string, string> = {};
		async function renameWithTry(key: string, name: string) {
			try {
				await rename(join(src, name), join(src, key, name));
				const oldPath = join(src, name);
				const newPath = join(src, key, name);
				info("[IMM] Renamed:", oldPath, "->", newPath);
				changesToD3dx[oldPath] = join(tgt, key, name);
			} catch (error) {
				warn("Error renaming:", key, "\\", name, error);
			}
			return;
		}
		// console.log("Full directory renames:", fullDirectoryRenames);
		(await Promise.all(fullDirectoryRenames.map((dir) => readDirRecr(src, dir, 0)))).flat().forEach((entry: any) => {
			const oldPath = join(src, entry.path);
			const newPath = join(tgt, entry.path);
			changesToD3dx[oldPath] = newPath;
		});

		for (const [key, list] of Object.entries(reqCategories)) {
			for (const item of list) {
				renamePromises.push(renameWithTry(key, item.name));
			}
		}
		await Promise.all(renamePromises);
		if (modifyIni && d3dx) {
			d3dx = d3dx.split("\n");
			for (const [oldPath, newPath] of Object.entries(changesToD3dx)) {
				const op = join("$\\mods", oldPath.replaceAll(tgt, "").replaceAll("/", "\\")).toLowerCase();
				const np = join(
					"$\\mods\\",
					managedTGT,
					replaceDisabled(newPath).replaceAll(tgt, "").replaceAll("/", "\\")
				).toLowerCase();
				info("[IMM] Updating d3dx_user.ini:", op, "->", np);
				d3dx = d3dx.map((line: string) => (line.startsWith(op) ? line.replace(op, np) : line));
			}
			await writeTextFile(d3dx_path, d3dx.join("\n"));
		}
	} catch (error) {
		//console.error("Error categorizing directory:", error);
		throw error;
	}
}
export async function verifyDirStruct() {
	const status: ChangeInfo = {
		before: [],
		after: [],
		map: {},
		title: "Confirm Changes",
		skip: false,
	};
	try {
		if (!(!!src && (await exists(src))) || !(!!tgt && (await exists(tgt))))
			throw new Error("Source or Target not found: " + src + " | " + tgt);

		if (!(await exists(tgt))) throw new Error("Target Directory not found: " + tgt);
		try {
			const oldTgtPath = join(tgt, OLD_managedTGT);
			const newTgtPath = join(tgt, managedTGT);
			if (await exists(oldTgtPath)) {
				await rename(oldTgtPath, newTgtPath);
				//add code to read the file d3dx_user.ini in the parent folder of oldTgtPath, and replace all instances of OLD_managedTGT with managedTGT
				const parentDir = tgt.split("\\").slice(0, -1).join("\\");
				const iniPath = join(parentDir, "d3dx_user.ini");
				info("[IMM] Updating d3dx_user.ini at:", iniPath);

				try {
					if (await exists(iniPath)) {
						let iniContent = await readTextFile(iniPath);
						const updatedContent = iniContent.split(OLD_managedTGT.toLowerCase()).join(managedTGT.toLowerCase());
						await writeTextFile(iniPath, updatedContent);
					}
				} catch (e) {
					error("Error updating d3dx_user.ini:", e);
				}
			}
			const oldSrcPath = join(src, OLD_managedSRC);
			const newSrcPath = join(src, managedSRC);
			if (await exists(oldSrcPath)) {
				await rename(oldSrcPath, newSrcPath);
				const targetEntries = (await readDirRecr(newTgtPath, "", 2)).flatMap((x) => x.children || []);
				info("[IMM] Fixing symlinks in target directory. Broken: ", targetEntries);
				for (const entry of targetEntries) {
					const linkPath = join(newTgtPath, entry.path);
					await remove(linkPath);
					await mkdir(join(newTgtPath, entry.parent), { recursive: true });
					try {
						await invoke("create_symlink", {
							linkPath: linkPath,
							targetPath: join(newSrcPath, entry.path),
						});
						info("[IMM] Fixed symlink:", linkPath, "->", join(newSrcPath, entry.path));
					} catch (err) {
						error("[IMM] Error creating symlink:", err);
					}
				}
			}
		} catch (e: any) {
			if (e.startsWith("failed to rename old path")) {
				store.set(ERR, textData["v2.1.2Warning"]);
			} else {
				store.set(ERR, e.toString());
			}
		}
		const modDir = join(src, managedSRC);
		const [modDirExists, isOldVersion] = await Promise.all([exists(modDir), checkOldVerDirs(src)]);

		if (modDirExists) {
			await categorizeDir(modDir);
			status.skip = true;
		}
		if (isOldVersion) {
			await applyChanges(true);
			status.skip = true;
		}
		if (status.skip) throw new Error("Migration done, please verify the directories again");
		// const categories: Category[] = [
		// 	...store.get(CATEGORIES),
		// 	{ _sName: UNCATEGORIZED, _sIconUrl: "", _idRow: 0, _nItemCount: 0, _nCategoryCount: 0, _sUrl: "" },
		// ];
		const reqCategories: Record<string, DirEntry> = {};

		const srcEntries = await readDir(src);
		if (srcEntries.length === 0) {
			status.skip = true;
			await mkdir(modDir, { recursive: true });
			throw new Error("Source directory is empty");
		}
		status.before = srcEntries
			.map((item) => ({
				name: item.name,
				isDirectory: item.isDirectory,
				children: [],
			}))
			.sort(sortMods)
			.filter((item) => item.name !== IGNORE || !item.isDirectory);

		const before = [...status.before].filter(
			(item) => item.isDirectory && item.name !== IGNORE && item.name !== managedTGT && item.name !== managedSRC
		);
		status.after = [
			{
				name: managedSRC,
				isDirectory: true,
				children: [],
			},
		];

	// Batch read directories for items that need it
	const readPromises: Promise<{ item: any; entries: any[] }>[] = [];
	for (const item of before) {
		const category =
			resolveKnownCategory(item.name) ||
				(item.name === RESTORE || item.name === OLD_RESTORE
					? { _sName: RESTORE, _sIconUrl: "" }
					: { _sName: UNCATEGORIZED, _sIconUrl: "" });

			if ((item.isDirectory && item.name === category._sName) || item.name === OLD_RESTORE) {
				readPromises.push(
					readDir(join(src, item.name))
						.then((entries) => ({ item, entries, category }))
						.catch(() => {
							//console.error(`Error reading directory ${item.name}:`, error);
							return { item, entries: [], category };
						})
				);
			} else {
				// Add item directly without reading
				if (!reqCategories[category._sName]) {
					reqCategories[category._sName] = {
						name: category._sName,
						icon: category._sIconUrl,
						isDirectory: true,
						children: [],
					};
				}
				reqCategories[category._sName].children?.push({ name: item.name, isDirectory: item.isDirectory });
			}
		}

		// Process all read operations in parallel
		const readResults = await Promise.all(readPromises);
		for (const { entries, category } of readResults as any) {
			if (!reqCategories[category._sName]) {
				reqCategories[category._sName] = {
					name: category._sName,
					icon: category._sIconUrl,
					isDirectory: true,
					children: [],
				};
			}
			reqCategories[category._sName].children?.push(
				...entries.map((i: DirEntry) => ({ name: i.name, isDirectory: i.isDirectory }))
			);
		}
		status.map = { ...reqCategories };
		status.skip = Object.keys(reqCategories).length === 0;
		if (status.skip) throw new Error("No categories found, please verify the directories again");

		// Process modDir if it exists
		if (modDirExists) {
			try {
				const modDirEntries = await readDir(modDir);
				const modDirReadPromises: Promise<{ category: any; entries: DirEntry[] }>[] = [];

				for (const item of modDirEntries) {
					if (!item.isDirectory) continue;

					const category =
						item.name === RESTORE
							? { _sName: RESTORE, _sIconUrl: "" }
							: resolveKnownCategory(item.name) || { _sName: UNCATEGORIZED, _sIconUrl: "" };

					if (category) {
						modDirReadPromises.push(
							readDir(join(modDir, item.name))
								.then((entries) => ({ category, entries }))
								.catch(() => {
									//console.error(`Error reading modDir category ${item.name}:`, error);
									return { category, entries: [] };
								})
						);
					}
				}

				const modDirResults = await Promise.all(modDirReadPromises);
				for (const { category, entries } of modDirResults) {
					if (!reqCategories[category._sName]) {
						reqCategories[category._sName] = {
							name: category._sName,
							icon: category._sIconUrl || "",
							isDirectory: true,
							children: [],
						};
					}
					reqCategories[category._sName].children?.push(
						...entries.map((i) => ({ name: i.name, isDirectory: i.isDirectory }))
					);
				}
			} catch (error) {
				//console.error("Error processing modDir:", error);
			}
		}
		for (const key of Object.keys(reqCategories)) {
			status.after[0].children?.push({
				...reqCategories[key],
				children: (reqCategories[key].children as DirEntry[]).sort(sortMods),
			});
		}
		status.after[0].children?.sort(sortMods);
		status.after.sort(sortMods);
	} catch (e) {
		info("[ERR] ", e);
	} finally {
		info("[IMM] Directory structure verified:", status);
		return status;
	}
}
export async function createManagedDir() {
	info("[IMM] Creating managed directories...");
	try {
		if (!src) return false;
		await mkdir(join(src, managedSRC), { recursive: true });
		if (!tgt) return false;
		await mkdir(join(tgt, managedTGT), { recursive: true });
		return true;
	} catch (err) {
		error("[IMM] Error creating managed directories:", err);
		throw err;
	}
}
export async function applyChanges(isMigration = false) {
	info("[IMM] Applying changes, isMigration:", isMigration);
	try {
		if (!src || !tgt) return false;

		let map: Record<string, DirEntry> = {};
		info("[IMM] Verifying directory structure before applying changes...");
		const target = join(tgt, managedTGT);
		if (!target) return true;
		info("[IMM] Target exists, creating managed directories...");
		await mkdir(join(src, managedSRC), { recursive: true });
		await mkdir(join(tgt, managedTGT), { recursive: true });
		info("[IMM] Managed directories created. Processing source directory...");
		await categorizeDir(src, true);

		const entries = true ? (await readDir(src)).map((item) => item.name) : Object.keys(map);

		info("[IMM] Processing entries:", entries);
		// Batch process entries
		for (const key of entries) {
			if (key === IGNORE || key === managedSRC || key === managedTGT || key === PREFS) continue;

			if (key === RESTORE || key === OLD_RESTORE) {
				try {
					await rename(join(src, OLD_RESTORE), join(src, managedSRC, RESTORE));
				} catch (e) {
					try {
						await copyDir(join(src, RESTORE), join(src, managedSRC, RESTORE));
					} catch (e) {
						//console.error(`Error handling RESTORE directory:`, e);
					}
				}
				continue;
			}

			try {
				info(`[IMM] Renaming ${key} to managedSRC...`);
				await rename(join(src, key), join(src, managedSRC, key));
			} catch (err) {
				error(`Error renaming ${key}:`, err);
				continue;
			}

			await mkdir(join(target, key), { recursive: true });

			const dirEntries = (true ? await readDir(join(src, managedSRC, key)) : map[key].children) || [];
			// Batch process directory entries
			const itemOperations: Promise<void>[] = [];
			for (const item of dirEntries) {
				const isDisabled = item.name.startsWith("DISABLED");
				const name = replaceDisabled(item.name);
				if (isDisabled) {
					itemOperations.push(
						rename(join(src, managedSRC, key, item.name), join(src, managedSRC, key, name)).catch(() => {
							//console.error(`Error renaming disabled item ${item.name}:`, error);
						})
					);
				} else {
					itemOperations.push(
						invoke<void>("create_symlink", {
							linkPath: join(target, key, name),
							targetPath: join(src, managedSRC, key, name),
						}).catch(() => {
							//console.error(`Error creating symlink for ${name}:`, error);
						}) as Promise<void>
					);
				}
			}
			await Promise.all(itemOperations);
		}
		return true;
	} catch (err) {
		error("[IMM] Error applying changes:", err);
		throw err;
	}
}
async function readDirRecr(root: string, path: string, maxDepth = 2, depth = 0, def = true): Promise<Mod[]> {
	if (depth > maxDepth) return [];
	let entries: DirEntry[] = [];
	try {
		entries = await readDir(join(root, path));
	} catch {
		return [];
	}
	const filePromises = entries.map(async (entry) => {
		if ((entry.name == RESTORE || entry.name == IGNORE || entry.name == PREFS) && def && depth == 0) return null;
		let children: Mod[] = [];
		if (entry.isDirectory) children = await readDirRecr(root, join(path, entry.name), maxDepth, depth + 1);
		return {
			isDir: entry.isDirectory,
			name: entry.name,
			parent: join(path),
			path: join(path, entry.name),
			keys: [],
			enabled: false,
			children,
			depth,
		};
	});
	const files = (await Promise.all(filePromises)).filter((file) => file !== null) as Mod[];
	return files.sort(sortMods);
}
export async function remSaveModData() {
	const modSrc = join(src, managedSRC);
	const entries = (await readDirRecr(modSrc, "", 1))
		.map((entry) => entry.children || [])
		.flat()
		.filter((child) => child.isDir);
	const data = store.get(DATA) || {};
	const promises = entries.map(async (entry) => {
		const modPath = join(modSrc, entry.path, "mod.json");

		if (data[entry.path]) {
			const modData = data[entry.path];
			delete modData.viewedAt;
			delete modData.updatedAt;
			await writeTextFile(modPath, JSON.stringify(modData, null, 2));
		}
	});
	await Promise.all(promises);
}
export async function remSavePresets() {
	const presets = store.get(PRESETS) || {};
	const presetFolder = join(tgt, "Presets");
	await mkdir(presetFolder, { recursive: true });
	const promises = presets.map(async (preset) => {
		const presetPath = join(presetFolder, `${preset.name}.txt`);
		await writeTextFile(presetPath, preset.data.join("\n"));
	});
	await Promise.all(promises);
}
export async function remMoveMods(categoryMode = true, enable = 0) {
	const allEntries = await readDirRecr(join(src, managedSRC), "", 1);
	const categories = allEntries
		.filter((entry) => entry.isDir && entry.children && entry.children.length > 0)
		.map((entry) => entry.name);
	if (categoryMode) {
		const categoryPromises = categories.map(async (category) => mkdir(join(tgt, category), { recursive: true }));
		await Promise.all(categoryPromises);
	}
	const entries = allEntries.map((entry) => entry.children || []).flat();
	const enabled = new Set(enable == 1 ? entries.map((entry) => entry.path) : []) as Set<string>;
	if (enable == 0) {
		const existsPromises = entries.map(async (entry) => {
			const targetPath = join(tgt, managedTGT, entry.path);
			if (await exists(targetPath)) {
				enabled.add(entry.path);
			}
		});
		await Promise.all(existsPromises);
	}
	const iniChanges: Record<string, string> = {};
	const movePromises = entries.map(async (entry) => {
		const srcPath = join(src, managedSRC, entry.path);
		const tgtPath = join(
			`${categoryMode ? entry.parent + "\\" : ""}${enabled.has(entry.path) ? "" : "DISABLED "}${entry.name}`
		);
		let finalTgt = tgtPath;
		let counter = 1;
		while (await exists(finalTgt)) {
			finalTgt = tgtPath + `_${counter}`;
			counter++;
		}
		await rename(srcPath, join(tgt, finalTgt));
		if (enabled.has(entry.path)) {
			iniChanges[join("$\\mods", managedTGT, entry.path).toLowerCase()] = join("$\\mods", finalTgt).toLowerCase();
		}
	});
	await Promise.all(movePromises);
	// console.log("All entries moved. Updating d3dx_user.ini if needed...", iniChanges);
	const d3dxPath = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	try {
		if (await exists(d3dxPath)) {
			let d3dx = await readTextFile(d3dxPath);
			for (const [oldPath, newPath] of Object.entries(iniChanges)) {
				d3dx = d3dx.split(oldPath).join(newPath);
			}
			await writeTextFile(d3dxPath, d3dx);
		}
	} catch (e) {
		error("Error updating d3dx_user.ini:", e);
	}
	try {
		await remove(join(tgt, managedTGT), { recursive: true });
	} catch {}
	const removeSrcPromises = allEntries.map(async (entry) => {
		try {
			await remove(join(src, managedSRC, entry.path));
		} catch {}
	});
	await Promise.all(removeSrcPromises);
	try {
		await remove(join(src, managedSRC, RESTORE));
	} catch {}
	try {
		await remove(join(src, managedSRC, PREFS));
	} catch {}
	try {
		await remove(join(src, managedSRC));
	} catch {}
}
async function detectHotkeys(
	entries: Mod[],
	data: ModDataObj,
	src: string,
	depth = 0,
	def = true
): Promise<[Mod[], any, ModHotKeys[], string, any]> {
	let namespace = "";
	let namespaces = {} as Record<string, string>;
	const entryPromises = entries.map(async (entry) => {
		let hkData: ModHotKeys[] = [];
		let hashes = new Set() as any;
		try {
			// // Apply stored data to entry
			if (data[entry.path]) {
				for (const key of Object.keys(data[entry.path])) {
					// @ts-ignore
					entry[key as "source" | "updatedAt" | "note"] =
						data[entry.path as keyof typeof data][key as "source" | "updatedAt" | "note"] ||
						(key === "updatedAt" ? 0 : "");
				}
			}

			// Parse .ini files for hotkeys
			if (entry.name.endsWith(".ini")) {
				try {
					const file = await readTextFile(join(src, entry.path));
					const lines = file.split("\n");
					let counter = 0;
					let key = "";
					let type = "";
					let target = "";
					let values = "";
					let tempKey = "";
					let tempVal = "";
					let section = "";
					let fileNamespace = "";
					let globalVars: Record<string, ModHotKeys> = {};
					let fileData: Record<string, ModHotKeys> = {};
					for (let line of lines) {
						let ln = line
							.trim()
							.replaceAll(/[\r\n]+/g, "")
							.replaceAll(" ", "");
						if (ln.startsWith("[") && ln.endsWith("]")) {
							section = ln.slice(1, -1).toLowerCase();
						}
						if (ln.startsWith("namespace=")) {
							fileNamespace = ln.split("=")[1]?.trim() || "";
							namespace = namespace || fileNamespace.toLowerCase();
							// console.log("Detected namespace:", namespace);
							continue;
						}
						if (section === "constants" && ln.includes("global")) {
							const afterGlobal = ln.split("global")[1];
							if (!afterGlobal.includes("$")) continue;
							const afterDlr = afterGlobal.split("$")[1];
							if (!afterDlr.includes("=")) continue;
							try {
								[tempKey, tempVal] = ln
									.split("$")[1]
									.split("=")
									.map((part) => part.trim());
								if (fileData.hasOwnProperty(tempKey)) {
									fileData[tempKey].default = tempVal;
								} else if (!globalVars.hasOwnProperty(tempKey))
									globalVars[tempKey] = {
										target: tempKey,
										file: entry.path.split("\\").slice(2).join("\\").toLowerCase(),
										namespace: fileNamespace.toLowerCase(),
										name: tempKey,
										default: tempVal,
										pref: null,
										reset: null,
										key: "",
										type: "",
										values: ["unknown"],
									};
							} catch {}
						}
						if (ln.startsWith("hash=")) {
							const val = line.split("=")[1]?.trim() || "";
							hashes.add(val);
						}
						if (counter === 0 && ln.startsWith("key=")) {
							key =
								line
									.split("=")[1]
									?.trim()
									.split(" ")
									.map((k) => {
										k = k.toLowerCase();
										if (k.startsWith("no_")) k = "";
										else {
											k = k.replace("vk_", "");
										}
										return k.trim();
									})
									.filter((k) => k)
									.join("+") || "";
							counter++;
						} else if (counter === 1 && ln.startsWith("type=")) {
							type = line.split("=")[1]?.trim() || "";
							counter++;
						} else if (counter === 2 && ln.startsWith("$")) {
							[target, values] = line.split("=").map((part) => part.trim());
							target = target?.slice(1) || "";
							counter = 0;
							if (!fileData.hasOwnProperty(target))
								fileData[target] = {
									...(globalVars[target] || {
										target,
										file: entry.path.split("\\").slice(2).join("\\").toLowerCase(),
										name: target,
										namespace: fileNamespace.toLowerCase(),
										default: "",
										pref: null,
										reset: null,
									}),
									key,
									type,
									values:
										values
											.split(",")
											.map((v) => v.trim())
											.filter((v) => v) || "",
								};
							delete globalVars[target];
						}
					}

					hkData.push(...Object.values(fileData), ...Object.values(globalVars));
				} catch (iniError) {
					//console.error(`Error parsing .ini file ${entry.name}:`, iniError);
				}
			}

			// Recursively process children
			if (entry.isDir && entry.children.length > 0) {
				try {
					if (depth == 1 && def) {
						const hashFile = await readTextFile(join(src, entry.path, ".imm-collision-checklist"));
						if (Math.random() < 0.1) throw new Error("Rechecking hashes for " + entry.path);
						hashes = new Set(
							hashFile
								.split("\n")
								.map((h) => h.trim())
								.filter((h) => h)
						);
					} else {
						throw new Error("Not depth 1");
					}
				} catch {
					const [updatedChildren, childHashes, childHK, namespace, newNamespaces] = await detectHotkeys(
						entry.children,
						data,
						src,
						depth + 1,
						def
					);
					hashes = new Set([...Array.from(hashes), ...Array.from(childHashes)]);
					entry.children = updatedChildren;
					if (childHK.length > 0 && depth > 0) {
						hkData = [...hkData, ...childHK];
					}
					if (depth == 1 && def) {
						writeTextFile(join(src, entry.path, ".imm-collision-checklist"), Array.from(hashes).join("\n"));
						if (namespace) namespaces[entry.path] = namespace;
					}
					if (depth < 2) {
						namespaces = { ...namespaces, ...newNamespaces };
					}
				}
			}
			if (depth == 1) {
				entry.keys = hkData;
				entry.hashes = Array.from(hashes);
			}
		} catch (entryError) {
			//console.error(`Error processing entry ${entry.name}:`, entryError);
		}
		return { entry, hkData, hashes };
	});

	const results = await Promise.all(entryPromises);
	const processedEntries = results.map((r) => r.entry);
	const hotkeyData = depth < 2 ? [] : results.flatMap((r) => r.hkData);
	const hashes = new Set<string>(results.flatMap((r) => Array.from(r.hashes)));
	return [processedEntries, hashes, hotkeyData, namespace, namespaces];
}
export async function getModDetails(relPath: string) {
	const [category, modName] = relPath.split("\\");
	const modSrc = join(src, managedSRC);
	try {
		const entries = await readDirRecr(modSrc, relPath, 5, 0, false);
		const new_entries = (
			await detectHotkeys(
				[
					{
						name: category,
						isDir: true,
						parent: "",
						path: category,
						keys: [],
						enabled: false,
						children: [
							{
								name: modName,
								isDir: true,
								parent: category,
								path: relPath,
								keys: [],
								enabled: false,
								children: entries,
								depth: 1,
								hashes: [],
							},
						],
						depth: 0,
						hashes: [],
					},
				],
				{},
				modSrc,
				0,
				false
			)
		)[0] as Mod[];
		const allVars = new_entries[0].children[0].keys || [];
		const keys = allVars.filter((v) => v.key);
		const files = {} as Record<string, ModHotKeys[]>;
		for (const varData of allVars) {
			if (!files[varData.file]) files[varData.file] = [];
			files[varData.file].push(varData);
		}
		Object.keys(files).forEach((file) => {
			files[file] = files[file].sort((a, b) => a.target.localeCompare(b.target));
		});
		return { keys, files };
	} catch {
		return { keys: [], files: {} };
	}
}
export async function refreshModList() {
	info("[IMM] Refreshing mod list...");
	let before = Date.now();
	try {
		const data = store.get(DATA);
		const modSrc = join(src, managedSRC);
		const modTgt = join(tgt, managedTGT);
		let categories = new Set([...store.get(CATEGORIES), ...LOCAL_SPECIAL_CATEGORIES, { _sName: UNCATEGORIZED }].map((cat) => cat._sName));
		while (categories.size < 10) {
			await new Promise((res) => setTimeout(res, 100));
			categories = new Set([...store.get(CATEGORIES), ...LOCAL_SPECIAL_CATEGORIES, { _sName: UNCATEGORIZED }].map((cat) => cat._sName));
		}
		await categorizeDir(modSrc);
		// console.log(await readDirRecr(modSrc, "", 3));
		const ret = await detectHotkeys(await readDirRecr(modSrc, "", 3), data, modSrc);
		const namespaces = ret[4];
		if (Object.keys(namespaces).length > 0) {
			store.set(DATA, (prev) => {
				Object.keys(namespaces).forEach((key) => {
					if (prev[key]) {
						prev[key].namespace = namespaces[key];
					}
				});
				return { ...prev };
			});
			saveConfigs();
		}
		let hasErr = "";
		const entries = (
			ret[0]
				.map((entry) =>
					categories.has(entry.name)
						? entry.children
						: (() => {
								hasErr = entry.name;
								return null;
							})()
				)
				.flat()
				.map((entry) => {
					if (entry && entry.depth == 1) entry.children = [];
					if (entry) {
						const allVars = entry.keys || [];
						const keys = allVars.filter((v) => v.key);
						const files = {} as Record<string, ModHotKeys[]>;
						for (const varData of allVars) {
							if (!files[varData.file]) files[varData.file] = [];
							files[varData.file].push(varData);
						}
						entry.keys = keys;
						entry.files = files;
					}
					return entry;
				})
				.filter(
					(entry) =>
						entry !== null && entry.depth < 2 && !INTERNAL_CATEGORY_FILES.has(entry.name.toLowerCase())
				) as Mod[]
		).sort(sortMods);

		// const entries = (await readDirRecr(modSrc, "", 2))
		// 	.map((entry) =>
		// 		categories.has(entry.name)
		// 			? entry.children.map((entry) => {
		// 					if (data[entry.path]) {
		// 						for (const key of Object.keys(data[entry.path])) {
		// 							// @ts-ignore
		// 							entry[key as "source" | "updatedAt" | "note"] =
		// 								data[entry.path as keyof typeof data][key as "source" | "updatedAt" | "note"] ||
		// 								(key === "updatedAt" ? 0 : "");
		// 						}
		// 					}
		// 					return entry;
		// 				})
		// 			: (() =>{hasErr = entry.name; return null;})()
		// 	)
		// 	.flat()
		// 	.filter((entry) => entry!==null)
		// 	.sort(sortMods);
		if (hasErr) {
			addToast({ type: "error", message: textData._Toasts.UnableCat.replace("<item/>", hasErr) });
		}

		// Batch process entries - separate rename operations from exists checks
		const renameOperations: Promise<void>[] = [];
		const existsChecks: Promise<{ entry: Mod; enabled: boolean }>[] = [];

		for (const entry of entries) {
			if (entry.name.startsWith("DISABLED")) {
				const newName = replaceDisabled(entry.name);
				const newPath = join(entry.parent, newName);

				renameOperations.push(
					rename(join(modSrc, entry.path), join(modSrc, newPath))
						.then(() => {
							entry.name = newName;
							entry.path = newPath;
						})
						.catch(() => {
							//console.error(`Error renaming ${entry.name}:`, error);
						})
				);
			}

			existsChecks.push(
				exists(join(modTgt, entry.path))
					.then((enabled) => ({ entry, enabled }))
					.catch(() => ({ entry, enabled: false }))
			);
		}

		// Wait for all renames to complete first
		await Promise.all(renameOperations);

		// Then process exists checks
		const existsResults = await Promise.all(existsChecks);
		for (const { entry, enabled } of existsResults) {
			entry.enabled = enabled;
		}
		//info(recentlyDownloaded);
		info(
			"[IMM] Mod list refreshed:",
			entries.map((e) => ({ path: e.path, enabled: e.enabled }))
		);
		info("[IMM] Mod list refresh took", Date.now() - before, "ms");
		return entries
			.filter((entry) => recentlyDownloaded.includes(entry.path))
			.concat(entries.filter((entry) => !recentlyDownloaded.includes(entry.path)));
	} catch (err) {
		error("[IMM] Error refreshing mod list:", err);
		throw err;
	}
}
export async function createModDownloadDir(cat: string, dir: string) {
	try {
		if (!cat || !dir) return;
		const path = join(src, managedSRC, cat, dir);
		if (await exists(path)) return path;
		await mkdir(path, { recursive: true });
		return path;
	} catch (err) {
		error("[IMM] Error creating mod download directory:", err);
		throw err;
	}
}
export async function validateModDownload(path: string, skip = false) {
	try {
		const entries = await readDir(path);
		// const previewCount = entries.filter((entry) => entry.name.startsWith("preview.") && !entry.isDirectory).length;
		const txtCount = entries.filter((entry) => entry.name.endsWith(".txt") && !entry.isDirectory).length;
		const imgCount = entries.filter((entry: any) => {
			const ext = entry.name.split(".").slice(-1)[0].toLowerCase();
			return exts.includes(ext) && !entry.isDirectory;
		}).length;
		if (entries.length - txtCount - imgCount === 1) {
			let hasIni = false;
			const dirs: string[] = [];

			for (const entry of entries) {
				if (entry.name.endsWith(".ini")) hasIni = true;
				if (entry.isDirectory) dirs.push(entry.name);
			}

			if (!hasIni && dirs.length === 1) {
				const uuid = "IMM_TEMP_" + Math.floor(Math.random() * 1000000000);
				const tempPath = path + "\\" + uuid;
				const dirPath = path + "\\" + dirs[0];

				try {
					await rename(dirPath, tempPath);
					await copyDir(tempPath, path);
					await remove(tempPath, { recursive: true });
				} catch (err) {
					error("[IMM] Error flattening mod directory structure:", err);
				}
			}
		}
		if (!skip) {
			const list = store.get(MOD_LIST);
			const relPath = path.split(managedSRC + "\\")[1];
			info("[IMM] Validating mod download for path:", relPath);
			const ele = list.find((mod) => mod.path === relPath);
			if (ele) {
				const keys = ele.keys || [];
				const files = {} as any;
				for (const hk of keys) {
					if (!files[hk.file]) files[hk.file] = {};
					if (hk.default) files[hk.file][hk.target] = hk.default;
				}
				const promises = [] as Promise<any>[];
				Object.keys(files).forEach((file) => {
					if (Object.keys(files[file]).length > 0) {
						promises.push(updateIniVars(join(relPath, file), files[file]));
					}
				});
				await Promise.all(promises);
			}
			const downloads = store.get(DOWNLOAD_LIST);
			const completed = downloads.completed.length + 1;
			const total = completed + downloads.queue.length;
			addToast({ type: "success", message: `${textData._Toasts.DownloadComplete} (${completed}/${total})` });
		}
	} catch (err) {
		if (!skip) addToast({ type: "error", message: textData._Toasts.ErrDownload });
		error("[IMM] Error validating mod download:", err);
	}
	return true;
}
export async function cleanCancelledDownload(path: string) {
	try {
		if (!(await exists(path))) return;
		const entries = await readDir(path);
		const hasPreview = entries.filter((entry) => entry.name.startsWith("preview.") && !entry.isDirectory).length;
		const hasArchive = entries.filter(
			(entry) => entry.name.endsWith(".zip") || entry.name.endsWith(".rar") || entry.name.endsWith(".7z")
		).length;
		if (entries.length === hasPreview + hasArchive && hasArchive <= 1 && hasPreview <= 1) {
			await remove(path, { recursive: true });
		}
	} catch (err) {
		error("[IMM] Error cleaning cancelled download:", err);
	}
}
export async function changeModName(path: string, newPath: string, add = false) {
	try {
		const enabled = add || (await toggleMod(path, false));
		await mkdir(join(src, managedSRC, ...newPath.split("\\").slice(0, -1)), { recursive: true });
		await rename(add ? join(src, path) : join(src, managedSRC, path), join(src, managedSRC, newPath));
		store.set(DATA, (prev) => {
			if (prev[path]) {
				prev[newPath] = { ...prev[path] };
				delete prev[path];
			}
			return prev;
		});
		store.set(PRESETS, (prev) => {
			for (let i = 0; i < prev.length; i++) {
				const preset = prev[i];
				if (!preset) continue;
				if (preset.data.includes(path)) {
					preset.data = preset.data.filter((p) => p !== path);
					preset.data.push(newPath);
				}
				if (preset.cycler?.mods?.includes(path)) {
					preset.cycler.mods = preset.cycler.mods.map((p) => (p === path ? newPath : p));
				}
			}
			return prev;
		});
		store.set(TEST_PIN_STATE, (prev) => ({
			...prev,
			path: prev.path === path ? newPath : prev.path,
			suspendedPaths: prev.suspendedPaths.map((item) => (item === path ? newPath : item)),
		}));
		saveConfigs();
		info("Mod name changed from", path, "to", newPath);
		await updatePrefsIniFromData(newPath, path);
		if (enabled) await toggleMod(newPath, true);
		return newPath;
	} catch (err) {
		error("[IMM] Error changing mod name:", err);
		throw err;
	}
}
export async function deleteCategory(cat: string) {
	const path = join(src, managedSRC, cat);
	if (!(await exists(path))) return true;
	try {
		await remove(path);
		return true;
	} catch (err) {
		error("[IMM] Error deleting category:", err);
		return false;
	}
}
export async function deleteRestorePoint(point: string) {
	try {
		const path = join(modRoot, RESTORE, point);
		await remove(path, { recursive: true });
		addToast({ type: "success", message: textData._Toasts.Deleted });
		return true;
	} catch (err) {
		error("[IMM] Error deleting restore point:", err);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		return false;
	}
}
export async function deleteMod(path: string) {
	const modSrc = join(src, managedSRC, path);
	const modTgt = join(tgt, managedTGT, path);

	try {
		await remove(modTgt);
	} catch (err) {
		error("[IMM] Error removing mod target:", err);
	}

	try {
		await remove(modSrc, { recursive: true });
		addToast({ type: "success", message: textData._Toasts.Deleted });
	} catch (err) {
		error("[IMM] Error removing mod source:", err);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}
async function updateDataFromD3DXIni(modPaths: string | string[], preservePrefs = false) {
	let mods = [] as string[];
	if (Array.isArray(modPaths)) {
		mods = modPaths;
	} else {
		mods = [modPaths];
	}
	const root = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	const lines = [] as string[];
	if (await exists(root)) {
		lines.push(
			...(await readTextFile(root))
				.toLowerCase()
				.split("\n")
				.map((line: string) => line.trim())
				.filter((line: string) => line && !line.startsWith(";") && line.includes("="))
		);
	}
	const data = store.get(DATA);
	let modified = false;
	for (let modPath of mods) {
		data[modPath] = data[modPath] || {};
		data[modPath].vars = data[modPath].vars || {};
		if (!preservePrefs) {
			try {
				await remove(join(tgt, managedTGT, PREFS, modPath + ".ini"));
			} catch {}
		}
		const path = `mods\\${managedTGT}\\${modPath}\\`.toLowerCase();
		const namespace = data[modPath]?.namespace ? data[modPath].namespace.toLowerCase() + "\\" : "";
		for (let line of lines) {
			const mode = line.includes(path) ? 0 : namespace && line.includes(namespace) ? 1 : -1;
			if (mode == -1) continue;
			const lineKey = mode ? namespace : path;
			const [KeyVar, Val] = line
				.split("=")
				.map((part: string, i: number) => (i ? part.trim() : part.trim().split(lineKey)[1]));
			const Var = (mode ? KeyVar : KeyVar.split("\\").pop() || "").toLowerCase().trim();
			const Key = mode ? "namespace" : KeyVar.split("\\").slice(0, -1).join("\\").toLowerCase().trim();
			if (Key && Var && Val) {
				if (!data[modPath].vars.hasOwnProperty(Key)) data[modPath].vars[Key] = {};
				if (!data[modPath].vars[Key].hasOwnProperty(Var)) data[modPath].vars[Key][Var] = {};
				data[modPath].vars[Key.trim()][Var.toLowerCase().trim()].state = Val.trim();
				modified = true;
			}
		}
	}
	if (modified) {
		store.set(DATA, (prev) => {
			prev = { ...prev };
			mods.forEach((modPath) => {
				if (Object.keys(data[modPath].vars || {}).length > 0) {
					prev[modPath] = {
						...prev[modPath],
						vars: data[modPath].vars,
					} as any;
				}
			});
			return prev;
		});
		saveConfigs();
	}
	info("[IMM] Updating data from ini for mod data:", data);
}
async function updatePrefsIniFromData(modPath: string, oldPath = "") {
	const data = store.get(DATA)[modPath];
	if (!data || !data.vars) return;
	const [category, name] = modPath.split("\\");
	const dir = join(tgt, managedTGT, PREFS, category);
	await mkdir(dir, { recursive: true });
	const root = join(dir, `${name}.ini`);
	if (oldPath) {
		const oldRoot = join(tgt, managedTGT, PREFS, oldPath);
		if (!(await exists(oldRoot))) return;
		await writeTextFile(root, (await readTextFile(oldRoot)).split(oldPath.toLowerCase()).join(modPath.toLowerCase()));
		remove(oldRoot);
	} else {
		const lines = {} as Record<string, string>;
		for (let key of Object.keys(data.vars)) {
			for (let Var of Object.keys(data.vars[key])) {
				const x = data.vars[key][Var];
				const line =
					`$\\${key == "namespace" ? data.namespace : `mods\\${managedTGT}\\${modPath}\\${key}`}\\${Var}`.toLowerCase();
				lines[line] = x.pref ?? x.state;
				if (lines[line] === undefined || lines[line] === null || lines[line] === "") delete lines[line];
				else info(`[IMM] Updating Mod: ${modPath} | File: ${key} | Added Line: ${line}`);
			}
		}
		await writeTextFile(
			root,
			[
				";-- set by imm --",
				"[constants]",
				...Object.entries(lines).map(([key, value]) => `${key}=${value}`),
				";-- end imm --",
			].join("\n")
		);
	}
}

function cloneJsonValue<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function countModLookValues(values: Record<string, Record<string, string>> | undefined) {
	if (!values) return 0;
	return Object.values(values).reduce((total, group) => total + Object.keys(group || {}).length, 0);
}

/** Capture the latest persisted WWMI variable state without removing IMM's preference file. */
export async function captureModLookValues(modPath: string) {
	await updateDataFromD3DXIni(modPath, true);
	const vars = store.get(DATA)[modPath]?.vars || {};
	const values: Record<string, Record<string, string>> = {};
	for (const [groupName, group] of Object.entries(vars)) {
		for (const [variableName, variableData] of Object.entries((group || {}) as Record<string, any>)) {
			const value = variableData?.state ?? variableData?.pref ?? variableData?.default;
			if (value === undefined || value === null || value === "") continue;
			values[groupName] = values[groupName] || {};
			values[groupName][variableName] = String(value);
		}
	}
	return cloneJsonValue(values);
}

async function updateD3DXUserFromLookValues(modPath: string, values: Record<string, Record<string, string>>) {
	const d3dxUserPath = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	if (!(await exists(d3dxUserPath))) return;

	const modData = store.get(DATA)[modPath];
	const replacements = new Map<string, string>();
	for (const [groupName, group] of Object.entries(values || {})) {
		for (const [variableName, value] of Object.entries(group || {})) {
			const qualifiedName =
				groupName === "namespace"
					? modData?.namespace
						? `$\\${modData.namespace}\\${variableName}`
						: ""
					: `$\\mods\\${managedTGT}\\${modPath}\\${groupName}\\${variableName}`;
			if (qualifiedName) replacements.set(qualifiedName.toLowerCase(), String(value));
		}
	}
	if (!replacements.size) return;

	const lines = (await readTextFile(d3dxUserPath)).split(/\r?\n/);
	const updatedKeys = new Set<string>();
	const updatedLines = lines.map((line) => {
		const separator = line.indexOf("=");
		if (separator < 0) return line;
		const key = line.slice(0, separator).trim().toLowerCase();
		const value = replacements.get(key);
		if (value === undefined) return line;
		updatedKeys.add(key);
		return `${line.slice(0, separator).trimEnd()} = ${value}`;
	});

	for (const [key, value] of replacements) {
		if (!updatedKeys.has(key)) updatedLines.push(`${key} = ${value}`);
	}
	await writeTextFile(d3dxUserPath, updatedLines.join("\n"));
}

async function writePendingModLookApply(modPath: string, values: Record<string, Record<string, string>>) {
	const modsRoot = src || tgt;
	if (!modsRoot) throw new Error("Mods folder is not configured.");
	const applyPath = join(modsRoot, "WuWaIMM_LookApply.ini");
	let requestToken = 1;
	if (await exists(applyPath)) {
		const previous = await readTextFile(applyPath);
		const match = previous.match(/global\s+\$request_token\s*=\s*(\d+)/i);
		if (match?.[1]) requestToken = (Number(match[1]) % 1000000) + 1;
	}

	const modData = store.get(DATA)[modPath];
	const assignments: string[] = [];
	for (const [groupName, group] of Object.entries(values || {})) {
		for (const [variableName, rawValue] of Object.entries(group || {})) {
			const value = String(rawValue).trim();
			if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) continue;
			const qualifiedName =
				groupName === "namespace"
					? modData?.namespace
						? `$\\${modData.namespace}\\${variableName}`
						: ""
					: `$\\mods\\${managedTGT}\\${modPath}\\${groupName}\\${variableName}`;
			if (qualifiedName) assignments.push(`        ${qualifiedName.toLowerCase()} = ${value}`);
		}
	}
	if (!assignments.length) throw new Error("This Look has no WWMI values that can be applied.");

	await writeTextFile(
		applyPath,
		[
			"; Generated by WuWa IMM Custom",
			"; Applies the selected Mod Look once, after d3dx_user.ini is restored.",
			"namespace = wuwa_imm_custom\\look_apply",
			"",
			"[Constants]",
			"global persist $applied_token = 0",
			`global $request_token = ${requestToken}`,
			"global $pending = 0",
			"post $pending = 1",
			"",
			"[Present]",
			"if $pending == 1",
			"    $pending = 0",
			"    if $applied_token != $request_token",
			...assignments,
			"        $applied_token = $request_token",
			"    endif",
			"endif",
		].join("\n")
	);
}

/** Apply a saved Look to IMM's preference state. The user reloads WWMI manually with F10. */
export async function applyModLookValues(modPath: string, values: Record<string, Record<string, string>>) {
	store.set(DATA, (previous) => {
		const next = { ...previous };
		const modData = { ...(next[modPath] || {}) };
		const vars = cloneJsonValue(modData.vars || {});
		for (const [groupName, group] of Object.entries(values || {})) {
			vars[groupName] = vars[groupName] || {};
			for (const [variableName, value] of Object.entries(group || {})) {
				vars[groupName][variableName] = {
					...(vars[groupName][variableName] || {}),
					pref: String(value),
					state: String(value),
				};
			}
		}
		next[modPath] = { ...modData, vars };
		return next;
	});
	await updatePrefsIniFromData(modPath);
	// WWMI restores persistent variables from d3dx_user.ini during F10. Keep it
	// aligned with IMM's preference file so the old live value cannot win.
	await updateD3DXUserFromLookValues(modPath, values);
	// F10 writes the live state before reloading d3dx_user.ini. This one-shot
	// WWMI command runs afterwards, so the selected Look wins without key input.
	await writePendingModLookApply(modPath, values);
	await saveConfigs();
}
export async function updateIniVars(relPath: string, keyVals: Record<string, string>) {
	const path = join(modRoot, relPath);
	info("Updating ini vars for:", relPath, "at", path, "with keyVals:", keyVals);
	if (!(await exists(path + ".bak"))) {
		await copyFile(path, path + ".bak");
	}
	const file = await readTextFile(path);
	const lines = file.split("\n");
	try {
		let section = "";
		for (let i = 0; i < lines.length; i++) {
			let ln = lines[i]
				.trim()
				.replaceAll(/[\r\n]+/g, "")
				.replaceAll(" ", "");
			if (ln.startsWith("[") && ln.endsWith("]")) {
				section = ln.slice(1, -1).toLowerCase();
			}
			if (section === "constants" && ln.includes("$") && ln.includes("=")) {
				const modKey = ln.split("$")[1].split("=")[0].trim().toLowerCase();
				if (keyVals.hasOwnProperty(modKey)) {
					lines[i] = `${lines[i].split("=")[0]}= ${keyVals[modKey]}`;
					info(`[IMM] Updating Mod: ${path} | Line${i}: ${lines[i]}`);
				}
				delete keyVals[modKey];
				if (Object.keys(keyVals).length === 0) break;
			}
		}
	} catch {
		return false;
	}
	await writeTextFile(path, lines.join("\n"));
	return true;
}
export function openFile(relPath: string) {
	openPath(join(modRoot, relPath));
}
export async function toggleMod(path: string, enabled: boolean, forced = false): Promise<boolean> {
	info("[IMM] Togglingx mod:", path, "Enabled:", enabled);
	try {
		const modSrc = join(src, managedSRC, path);
		const modTgt = join(tgt, managedTGT, path);

		if (enabled) {
			if (path.toLowerCase() === EFFECT_COLORS_MOD_PATH.toLowerCase()) {
				await disableBundledEffectColorExample();
			}
			const [srcExists, tgtExists] = await Promise.all([exists(modSrc), exists(modTgt)]);
			if ((srcExists && !tgtExists) || forced) {
				await updatePrefsIniFromData(path);
				if (forced) return true;
				await mkdir(join(tgt, managedTGT, ...path.split("\\").slice(0, -1)), { recursive: true });
				try {
					await invoke("create_symlink", {
						linkPath: modTgt,
						targetPath: modSrc,
					});
				} catch (err) {
					error("[IMM] Error creating symlink:", err);
					return false;
				}
			}
		} else {
			await updateDataFromD3DXIni(path);
			try {
				await remove(modTgt);
			} catch (err) {
				error("[IMM] Error removing mod:", err);
				return false;
			}
		}
	} catch (err) {
		error("[IMM] Error toggling mod:", err);
		return false;
	}
	info(`Success Mod ${enabled ? "enabled" : "disabled"}:`, path);
	return true;
}

function collisionScopesOverlap(left: Mod, right: Mod) {
	const leftScopes = new Set(getModCollisionScopes(left));
	return getModCollisionScopes(right).some((scope) => leftScopes.has(scope));
}

async function setModLinksEnabled(paths: string[], enabled: boolean) {
	const changed: string[] = [];
	for (const path of paths) {
		if (await toggleMod(path, enabled)) changed.push(path);
	}
	if (changed.length) {
		const changedSet = new Set(changed);
		store.set(MOD_LIST, (prev) =>
			prev.map((mod) => (changedSet.has(mod.path) ? { ...mod, enabled } : mod))
		);
	}
	return changed;
}

export async function clearTestPinnedMod(showToast = true) {
	const state = store.get(TEST_PIN_STATE);
	if (!state.path) return true;

	const modList = store.get(MOD_LIST);
	const pinnedMod = modList.find((mod) => mod.path === state.path);
	if (pinnedMod && !state.wasEnabled && pinnedMod.enabled) {
		const disabled = await setModLinksEnabled([pinnedMod.path], false);
		if (!disabled.length) {
			addToast({ type: "error", message: "Could not disable the temporary pinned mod." });
			return false;
		}
	}

	const restorablePaths = state.suspendedPaths.filter((path) => modList.some((mod) => mod.path === path));
	const restored = await setModLinksEnabled(restorablePaths, true);
	if (restored.length !== restorablePaths.length) {
		addToast({ type: "error", message: "Some mods suspended by the temporary pin could not be restored." });
		return false;
	}

	store.set(TEST_PIN_STATE, { path: "", wasEnabled: false, suspendedPaths: [] });
	if (showToast) addToast({ type: "success", message: "Temporary pin cleared. Press F10 in-game to reload." });
	return true;
}

export async function toggleTestPinnedMod(path: string) {
	const current = store.get(TEST_PIN_STATE);
	if (current.path === path) return clearTestPinnedMod();

	if (current.path && !(await clearTestPinnedMod(false))) return false;

	const modList = store.get(MOD_LIST);
	const mod = modList.find((item) => item.path === path && item.isDir);
	if (!mod) {
		addToast({ type: "error", message: "Could not find this mod for temporary pinning." });
		return false;
	}
	if ((mod.tags || []).includes("cycler")) {
		addToast({ type: "error", message: "Temporary pin is only available for Normal mods." });
		return false;
	}

	const collidingEnabledPaths = modList
		.filter((candidate) => candidate.path !== mod.path && candidate.isDir && candidate.enabled)
		.filter((candidate) => collisionScopesOverlap(mod, candidate))
		.map((candidate) => candidate.path);
	const suspendedPaths = await setModLinksEnabled(collidingEnabledPaths, false);
	if (suspendedPaths.length !== collidingEnabledPaths.length) {
		await setModLinksEnabled(suspendedPaths, true);
		addToast({ type: "error", message: "Temporary pin failed while suspending conflicting mods." });
		return false;
	}

	const wasEnabled = mod.enabled;
	if (!wasEnabled) {
		const enabled = await setModLinksEnabled([mod.path], true);
		if (!enabled.length) {
			await setModLinksEnabled(suspendedPaths, true);
			addToast({ type: "error", message: "Could not enable the temporary pinned mod." });
			return false;
		}
	}

	store.set(TEST_PIN_STATE, { path: mod.path, wasEnabled, suspendedPaths });
	addToast({
		type: "success",
		message: "Temporary pin active. Cycler mods in the same character slot are suspended. Press F10 in-game to reload.",
	});
	return true;
}
export async function savePreviewImageFromData(relPath: string, type: string, data: any) {
	const path = join(src, managedSRC, relPath);
	const previewPath = join(path, "preview." + type);
	info("Saving preview image for:", path, "at", previewPath);
	const removePromises = exts.map((ext) =>
		remove(path + "\\" + "preview." + ext).catch(() => {
			// Ignore errors if file doesn't exist
		})
	);
	await Promise.all(removePromises);
	await writeFile(previewPath, data);
	store.set(LAST_UPDATED, Date.now());
	store.set(DATA, (prev) => {
		if (!prev[relPath]) return prev;
		delete prev[relPath].crop;
		return { ...prev };
	});
	store.set(MOD_LIST, (prev) => {
		return prev.map((mod) => {
			if (mod.path === relPath) {
				delete mod.crop;
			}
			return mod;
		});
	});
	saveConfigs();

	addToast({ type: "success", message: textData._Toasts.ImgSaved });
}
export async function savePreviewImage(path: string) {
	try {
		path = join(src, managedSRC, path);
		const file = await open({
			multiple: false,
			directory: false,
			filters: [{ name: "Image", extensions: exts }],
		});

		if (!file) return false;

		// Remove existing preview images in parallel

		const removePromises = exts.map((ext) =>
			remove(path + "\\" + "preview." + ext).catch(() => {
				// Ignore errors if file doesn't exist
			})
		);
		await Promise.all(removePromises);

		// Copy new preview image
		const fileExt = file.split(".").pop();
		await copyFile(file, path + "\\" + "preview." + fileExt);
		store.set(LAST_UPDATED, Date.now());
		addToast({ type: "success", message: textData._Toasts.ImgSaved });
	} catch (err) {
		//console.error("Error saving preview image:", error);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		return false;
		throw error;
	}
	return true;
}
export async function applyPreset(data: string[], name = "") {
	try {
		const entries = (await readDirRecr(join(tgt, managedTGT), "", 2)).flatMap((x) => x.children || []);
		const disablePromises: Promise<boolean>[] = entries.map((entry) => toggleMod(entry.path, false));
		await Promise.all(disablePromises);
		await remove(join(tgt, managedTGT), { recursive: true });
		await mkdir(join(tgt, managedTGT), { recursive: true });

		// Apply mods in parallel batches to improve performance
		const batchSize = 10;
		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);
			await Promise.all(
				batch.map((mod) =>
					toggleMod(mod, true).catch((err = "unknown") => {
						error(`[IMM] Error toggling mod ${mod}:`, err);
					})
				)
			);
		}
		if (name) {
			addToast({ type: "success", message: textData._Toasts.PresetApplied });
		}
	} catch (err) {
		error("[IMM] Error applying preset:", err);
		if (name) addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}

function shuffleNumbers(values: number[]) {
	const result = [...values];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

const CYCLER_CONST_START = ";-- WuWa IMM Custom Cycler constants start --";
const CYCLER_CONST_END = ";-- WuWa IMM Custom Cycler constants end --";
const CYCLER_GATE_START = ";-- WuWa IMM Custom Cycler gate start --";
const CYCLER_GATE_END = ";-- WuWa IMM Custom Cycler gate end --";
const CYCLER_CLOSE_START = ";-- WuWa IMM Custom Cycler gate close start --";
const CYCLER_CLOSE_END = ";-- WuWa IMM Custom Cycler gate close end --";
const CYCLER_KEY_CONDITION_START = ";-- WuWa IMM Custom Cycler key condition start --";
const CYCLER_KEY_CONDITION_END = ";-- WuWa IMM Custom Cycler key condition end --";
const CYCLER_KEY_ORIGINAL_PREFIX = ";-; original condition = ";
const CYCLER_BACKUP_EXT = ".wuwa-imm-cycler.bak";
const CYCLER_GROUP_FILE_PREFIX = "WuWaIMM_Cycler_Group_";
const CYCLER_MANIFEST_FILE = "WuWaIMM_Cycler_Manifest.json";
const CYCLER_OVERLAY_DIR = "WuWaIMM_Cycler_Overlay";
const PRESET_NOTICE_FILE = "WuWaIMM_PresetNotice.ini";
const CYCLER_TIMER_MINUTES_STORAGE = "wuwa-imm-cycler-timer-minutes";
const EFFECT_COLORS_FILE = "WuWaIMM_EffectColors.ini";
const EFFECT_COLORS_FIXES_DIR = "WuWaIMM_EffectColors_Fixes";
const EFFECT_COLORS_MOD_PATH = join("Other", "All Characters Effect Color Modify");
const EFFECT_COLORS_BASE_PATH = join(
	EFFECT_COLORS_MOD_PATH,
	"v3_CharacterEffectColorChange.ini"
);
const EFFECT_COLORS_FIXES_PATH = join("Other", "All Characters Effect Color Modify", "fixes");
const EFFECT_COLORS_EXAMPLE_PATH = join(EFFECT_COLORS_MOD_PATH, "example.ini");

async function disableBundledEffectColorExample() {
	const examplePath = join(src, managedSRC, EFFECT_COLORS_EXAMPLE_PATH);
	if (!(await exists(examplePath))) return;

	const disabledPath = `${examplePath}.disabled`;
	await remove(disabledPath).catch(() => {});
	await rename(examplePath, disabledPath);
}
const ROVER_FEMALE_CATEGORY = "Rover Female";
const ROVER_EYE_HAIR_ADDON_NAME = "Rover Female - Eye Hair Recolor Addon";
const ROVER_EYE_HAIR_ADDON_PATH = join(ROVER_FEMALE_CATEGORY, ROVER_EYE_HAIR_ADDON_NAME);
const ROVER_EYE_HAIR_GENERATED_FILE = "WuWaIMM_RoverEyeHairRecolor.ini";
const ASTRAL_MODULATOR_PATH = join(ROVER_FEMALE_CATEGORY, "Astral Modulator Rover");
const LADY_ARBITER_PATH = join(ROVER_FEMALE_CATEGORY, "Rover Female Lady Arbiter");
const ROVER_HAIR_RECOLOR_UNSAFE_PATHS = new Set([
	ASTRAL_MODULATOR_PATH,
	join(ROVER_FEMALE_CATEGORY, "Rover Female Gold x 5M"),
]);
const LADY_ARBITER_EYE_TEXTURE = join(LADY_ARBITER_PATH, "Textures", "Components-5 t=52c18227.dds");
const LADY_ARBITER_EYE_BACKUP = `${LADY_ARBITER_EYE_TEXTURE}.wuwaimmcustom-original`;
export const ROVER_EYE_COLOR_PRESETS = [
	{ id: "amber_glow", group: "Light", name: "Amber Glow", color: "#ffc04d", file: "Variants/Eyes/amber_glow.dds" },
	{ id: "current_blue", group: "Light", name: "Soft Blue", color: "#9cc9ff", file: "Variants/Eyes/current_blue.dds" },
	{ id: "ice_blue", group: "Light", name: "Ice Blue", color: "#b2f5ff", file: "Variants/Eyes/ice_blue.dds" },
	{ id: "rose_pearl", group: "Light", name: "Rose Pearl", color: "#ffacd9", file: "Variants/Eyes/rose_pearl.dds" },
	{ id: "moon_silver", group: "Light", name: "Moon Silver", color: "#d9e0ff", file: "Variants/Eyes/moon_silver.dds" },
	{ id: "mint_light", group: "Light", name: "Mint Light", color: "#a8ffd1", file: "Variants/Eyes/mint_light.dds" },
	{ id: "aqua_glow", group: "Vivid", name: "Aqua Glow", color: "#00fff0", file: "Variants/Eyes/aqua_glow.dds" },
	{ id: "electric_blue", group: "Vivid", name: "Electric Blue", color: "#0066ff", file: "Variants/Eyes/electric_blue.dds" },
	{ id: "violet_star", group: "Vivid", name: "Violet Star", color: "#a000ff", file: "Variants/Eyes/violet_star.dds" },
	{ id: "golden_shine", group: "Vivid", name: "Golden Shine", color: "#ffd400", file: "Variants/Eyes/golden_shine.dds" },
	{ id: "crimson_glow", group: "Vivid", name: "Crimson Glow", color: "#ff003f", file: "Variants/Eyes/crimson_glow.dds" },
	{ id: "emerald_flash", group: "Vivid", name: "Emerald Flash", color: "#00ff4a", file: "Variants/Eyes/emerald_flash.dds" },
	{ id: "onyx_glow", group: "Dark", name: "Onyx Glow", color: "#080a12", file: "Variants/Eyes/onyx_glow.dds" },
	{ id: "blood_onyx", group: "Dark", name: "Blood Onyx", color: "#990010", file: "Variants/Eyes/blood_onyx.dds" },
	{ id: "abyss_violet", group: "Dark", name: "Abyss Violet", color: "#3b00ff", file: "Variants/Eyes/abyss_violet.dds" },
	{ id: "deep_teal", group: "Dark", name: "Deep Teal", color: "#003f46", file: "Variants/Eyes/deep_teal.dds" },
	{ id: "smoky_gold", group: "Dark", name: "Smoky Gold", color: "#5e4100", file: "Variants/Eyes/smoky_gold.dds" },
	{ id: "night_ice", group: "Dark", name: "Night Ice", color: "#1d3fb8", file: "Variants/Eyes/night_ice.dds" },
];
export const ROVER_HAIR_COLOR_PRESETS = [
	{ id: "silver_white", group: "Light", name: "Silver White", color: "#eef3ff", front: "Variants/HairFront/silver_white.dds", back: "Variants/HairBack/silver_white.dds" },
	{ id: "golden_blonde", group: "Light", name: "Golden Blonde", color: "#ffd06a", front: "Variants/HairFront/golden_blonde.dds", back: "Variants/HairBack/golden_blonde.dds" },
	{ id: "pearl_blonde", group: "Light", name: "Pearl Blonde", color: "#ffe7b8", front: "Variants/HairFront/pearl_blonde.dds", back: "Variants/HairBack/pearl_blonde.dds" },
	{ id: "ice_silver", group: "Light", name: "Ice Silver", color: "#c8efff", front: "Variants/HairFront/ice_silver.dds", back: "Variants/HairBack/ice_silver.dds" },
	{ id: "lavender_mist", group: "Light", name: "Lavender Mist", color: "#d7c2ff", front: "Variants/HairFront/lavender_mist.dds", back: "Variants/HairBack/lavender_mist.dds" },
	{ id: "rose_pearl", group: "Light", name: "Rose Pearl", color: "#ffacd4", front: "Variants/HairFront/rose_pearl.dds", back: "Variants/HairBack/rose_pearl.dds" },
	{ id: "rose_pink", group: "Vivid", name: "Rose Pink", color: "#ff2f91", front: "Variants/HairFront/rose_pink.dds", back: "Variants/HairBack/rose_pink.dds" },
	{ id: "crimson_red", group: "Vivid", name: "Crimson Red", color: "#ff172c", front: "Variants/HairFront/crimson_red.dds", back: "Variants/HairBack/crimson_red.dds" },
	{ id: "electric_blue", group: "Vivid", name: "Electric Blue", color: "#006cff", front: "Variants/HairFront/electric_blue.dds", back: "Variants/HairBack/electric_blue.dds" },
	{ id: "aqua_teal", group: "Vivid", name: "Aqua Teal", color: "#00dbc8", front: "Variants/HairFront/aqua_teal.dds", back: "Variants/HairBack/aqua_teal.dds" },
	{ id: "violet", group: "Vivid", name: "Violet", color: "#8a00ff", front: "Variants/HairFront/violet.dds", back: "Variants/HairBack/violet.dds" },
	{ id: "sunset_orange", group: "Vivid", name: "Sunset Orange", color: "#ff7a00", front: "Variants/HairFront/sunset_orange.dds", back: "Variants/HairBack/sunset_orange.dds" },
	{ id: "dark_brown", group: "Dark", name: "Dark Brown", color: "#2a1309", front: "Variants/HairFront/dark_brown.dds", back: "Variants/HairBack/dark_brown.dds" },
	{ id: "midnight_black", group: "Dark", name: "Midnight Black", color: "#050810", front: "Variants/HairFront/midnight_black.dds", back: "Variants/HairBack/midnight_black.dds" },
	{ id: "ash_blue", group: "Dark", name: "Ash Blue", color: "#233f6b", front: "Variants/HairFront/ash_blue.dds", back: "Variants/HairBack/ash_blue.dds" },
	{ id: "deep_violet", group: "Dark", name: "Deep Violet", color: "#1e063f", front: "Variants/HairFront/deep_violet.dds", back: "Variants/HairBack/deep_violet.dds" },
	{ id: "wine_red", group: "Dark", name: "Wine Red", color: "#3b000c", front: "Variants/HairFront/wine_red.dds", back: "Variants/HairBack/wine_red.dds" },
	{ id: "dark_teal", group: "Dark", name: "Dark Teal", color: "#002b30", front: "Variants/HairFront/dark_teal.dds", back: "Variants/HairBack/dark_teal.dds" },
];
export const ASTRAL_HAIR_COLOR_PRESETS = [
	{ id: "astral_silver_white", group: "Light", name: "Silver White", color: "#eef3ff", front: "VariantsBySkin/AstralModulator/HairFront/silver_white.dds", back: "VariantsBySkin/AstralModulator/HairBack/silver_white.dds" },
	{ id: "astral_golden_blonde", group: "Light", name: "Golden Blonde", color: "#ffd06a", front: "VariantsBySkin/AstralModulator/HairFront/golden_blonde.dds", back: "VariantsBySkin/AstralModulator/HairBack/golden_blonde.dds" },
	{ id: "astral_pearl_blonde", group: "Light", name: "Pearl Blonde", color: "#ffe7b8", front: "VariantsBySkin/AstralModulator/HairFront/pearl_blonde.dds", back: "VariantsBySkin/AstralModulator/HairBack/pearl_blonde.dds" },
	{ id: "astral_ice_silver", group: "Light", name: "Ice Silver", color: "#c8efff", front: "VariantsBySkin/AstralModulator/HairFront/ice_silver.dds", back: "VariantsBySkin/AstralModulator/HairBack/ice_silver.dds" },
	{ id: "astral_lavender_mist", group: "Light", name: "Lavender Mist", color: "#d7c2ff", front: "VariantsBySkin/AstralModulator/HairFront/lavender_mist.dds", back: "VariantsBySkin/AstralModulator/HairBack/lavender_mist.dds" },
	{ id: "astral_rose_pearl", group: "Light", name: "Rose Pearl", color: "#ffacd4", front: "VariantsBySkin/AstralModulator/HairFront/rose_pearl.dds", back: "VariantsBySkin/AstralModulator/HairBack/rose_pearl.dds" },
	{ id: "astral_rose_pink", group: "Vivid", name: "Rose Pink", color: "#ff2f91", front: "VariantsBySkin/AstralModulator/HairFront/rose_pink.dds", back: "VariantsBySkin/AstralModulator/HairBack/rose_pink.dds" },
	{ id: "astral_vivid_red", group: "Vivid", name: "Vivid Red", color: "#ed1028", front: "VariantsBySkin/AstralModulator/HairFront/vivid_red.dds", back: "VariantsBySkin/AstralModulator/HairBack/vivid_red.dds" },
	{ id: "astral_electric_blue", group: "Vivid", name: "Electric Blue", color: "#006cff", front: "VariantsBySkin/AstralModulator/HairFront/electric_blue.dds", back: "VariantsBySkin/AstralModulator/HairBack/electric_blue.dds" },
	{ id: "astral_aqua_teal", group: "Vivid", name: "Aqua Teal", color: "#00dbc8", front: "VariantsBySkin/AstralModulator/HairFront/aqua_teal.dds", back: "VariantsBySkin/AstralModulator/HairBack/aqua_teal.dds" },
	{ id: "astral_violet", group: "Vivid", name: "Violet", color: "#8a00ff", front: "VariantsBySkin/AstralModulator/HairFront/violet.dds", back: "VariantsBySkin/AstralModulator/HairBack/violet.dds" },
	{ id: "astral_sunset_orange", group: "Vivid", name: "Sunset Orange", color: "#ff7a00", front: "VariantsBySkin/AstralModulator/HairFront/sunset_orange.dds", back: "VariantsBySkin/AstralModulator/HairBack/sunset_orange.dds" },
	{ id: "astral_dark_brown", group: "Dark", name: "Dark Brown", color: "#2a1309", front: "VariantsBySkin/AstralModulator/HairFront/dark_brown.dds", back: "VariantsBySkin/AstralModulator/HairBack/dark_brown.dds" },
	{ id: "astral_midnight_black", group: "Dark", name: "Midnight Black", color: "#050810", front: "VariantsBySkin/AstralModulator/HairFront/midnight_black.dds", back: "VariantsBySkin/AstralModulator/HairBack/midnight_black.dds" },
	{ id: "astral_ash_blue", group: "Dark", name: "Ash Blue", color: "#233f6b", front: "VariantsBySkin/AstralModulator/HairFront/ash_blue.dds", back: "VariantsBySkin/AstralModulator/HairBack/ash_blue.dds" },
	{ id: "astral_deep_violet", group: "Dark", name: "Deep Violet", color: "#1e063f", front: "VariantsBySkin/AstralModulator/HairFront/deep_violet.dds", back: "VariantsBySkin/AstralModulator/HairBack/deep_violet.dds" },
	{ id: "astral_wine_red", group: "Dark", name: "Wine Red", color: "#3b000c", front: "VariantsBySkin/AstralModulator/HairFront/wine_red.dds", back: "VariantsBySkin/AstralModulator/HairBack/wine_red.dds" },
	{ id: "astral_dark_teal", group: "Dark", name: "Dark Teal", color: "#002b30", front: "VariantsBySkin/AstralModulator/HairFront/dark_teal.dds", back: "VariantsBySkin/AstralModulator/HairBack/dark_teal.dds" },
];
export const CYCLER_TIMER_MINUTE_OPTIONS = [0.5, 1, 2, 3, 5, 10];
const CYCLER_DRAW_2D_SHADER = `// Generated by WuWa IMM Custom
Texture1D<float4> IniParams : register(t120);

#define SIZE IniParams[87].xy
#define OFFSET IniParams[87].zw

struct vs2ps {
	float4 pos : SV_Position0;
	float2 uv : TEXCOORD1;
};

#ifdef VERTEX_SHADER
void main(out vs2ps output, uint vertex : SV_VertexID)
{
	float2 baseCoord, offset;
	offset.x = OFFSET.x * 2 - 1;
	offset.y = (1 - OFFSET.y) * 2 - 1;
	baseCoord.xy = float2(2 * SIZE.x, 2 * -SIZE.y);
	switch(vertex) {
		case 0:
			output.pos.xy = float2(baseCoord.x + offset.x, baseCoord.y + offset.y);
			output.uv = float2(1, 0);
			break;
		case 1:
			output.pos.xy = float2(baseCoord.x + offset.x, 0 + offset.y);
			output.uv = float2(1, 1);
			break;
		case 2:
			output.pos.xy = float2(0 + offset.x, baseCoord.y + offset.y);
			output.uv = float2(0, 0);
			break;
		case 3:
			output.pos.xy = float2(0 + offset.x, 0 + offset.y);
			output.uv = float2(0, 1);
			break;
		default:
			output.pos.xy = 0;
			output.uv = float2(0, 0);
			break;
	};
	output.pos.zw = float2(0, 1);
}
#endif

#ifdef PIXEL_SHADER
Texture2D<float4> tex : register(t100);

void main(vs2ps input, out float4 result : SV_Target0)
{
	float2 dims;
	tex.GetDimensions(dims.x, dims.y);
	if (!dims.x || !dims.y) discard;
	input.uv.y = 1 - input.uv.y;
	result = tex.Load(int3(input.uv.xy * dims.xy, 0));
}
#endif`;

export function getCyclerTimerMinutes() {
	const fallback = 0.5;
	try {
		const value = Number(localStorage.getItem(CYCLER_TIMER_MINUTES_STORAGE));
		return Number.isFinite(value) && value > 0 ? value : fallback;
	} catch {
		return fallback;
	}
}

export function setCyclerTimerMinutes(minutes: number) {
	try {
		localStorage.setItem(CYCLER_TIMER_MINUTES_STORAGE, String(minutes));
	} catch {}
}

function getCyclerTimerSeconds() {
	return Math.max(1, Math.round(getCyclerTimerMinutes() * 60));
}

function stripCyclerManagedBlocks(content: string) {
	const lines = content.split(/\r?\n/);
	const result: string[] = [];
	let skipUntil = "";
	let restoreAfterSkip: string | null = null;
	for (const line of lines) {
		const trimmed = line.trim();
		if (!skipUntil && trimmed === CYCLER_CONST_START) {
			skipUntil = CYCLER_CONST_END;
			continue;
		}
		if (!skipUntil && trimmed === CYCLER_GATE_START) {
			skipUntil = CYCLER_GATE_END;
			continue;
		}
		if (!skipUntil && trimmed === CYCLER_CLOSE_START) {
			skipUntil = CYCLER_CLOSE_END;
			continue;
		}
		if (!skipUntil && trimmed === CYCLER_KEY_CONDITION_START) {
			skipUntil = CYCLER_KEY_CONDITION_END;
			restoreAfterSkip = null;
			continue;
		}
		if (skipUntil) {
			if (skipUntil === CYCLER_KEY_CONDITION_END && trimmed.startsWith(CYCLER_KEY_ORIGINAL_PREFIX)) {
				restoreAfterSkip = trimmed.slice(CYCLER_KEY_ORIGINAL_PREFIX.length);
			}
			if (trimmed === skipUntil) {
				if (restoreAfterSkip) result.push(restoreAfterSkip);
				skipUntil = "";
				restoreAfterSkip = null;
			}
			continue;
		}
		const normalized = trimmed.toLowerCase().replaceAll(" ", "");
		if (
			normalized.startsWith("global$managed_slot_id=") ||
			normalized.startsWith("globalpersist$managed_slot_id=") ||
			normalized.startsWith("global$current_group=") ||
			normalized.startsWith("globalpersist$current_group=")
		) {
			continue;
		}
		result.push(line);
	}
	return result.join("\n");
}

function isCyclerGatedSection(sectionName: string) {
	const normalized = sectionName.trim().toLowerCase();
	return (
		normalized === "present" ||
		normalized === "clearrendertargetview" ||
		normalized === "cleardepthstencilview" ||
		normalized === "clearunorderedaccessviewuint" ||
		normalized === "clearunorderedaccessviewfloat" ||
		normalized.startsWith("builtincommandlist") ||
		normalized.startsWith("commandlist") ||
		normalized.startsWith("builtincustomshader") ||
		normalized.startsWith("customshader") ||
		normalized.startsWith("shaderoverride") ||
		normalized.startsWith("textureroverride") ||
		normalized.startsWith("textureoverride") ||
		normalized.startsWith("shaderregex")
	);
}

function isCyclerKeySection(sectionName: string) {
	return sectionName.trim().toLowerCase().startsWith("key");
}

function isCyclerRuntimeDetectionSection(sectionName: string) {
	const normalized = sectionName.trim().toLowerCase();
	return normalized === "textureoverridecomponent0";
}

function ensureCyclerConstants(lines: string[], slot: number) {
	const constLines = [CYCLER_CONST_START, `global $managed_slot_id = ${slot}`, CYCLER_CONST_END];
	const constantsIndex = lines.findIndex((line) => line.trim().toLowerCase() === "[constants]");
	if (constantsIndex >= 0) {
		lines.splice(constantsIndex + 1, 0, ...constLines);
		return;
	}

	let insertIndex = 0;
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim().toLowerCase();
		if (!trimmed || trimmed.startsWith(";")) continue;
		if (trimmed.startsWith("namespace")) {
			insertIndex = i + 1;
			continue;
		}
		break;
	}
	lines.splice(insertIndex, 0, "", "[Constants]", ...constLines, "");
}

function ensureCyclerModEnabled(lines: string[]) {
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*global\s+\$mod_enabled\s*=\s*0\s*$/i.test(lines[i])) {
			lines[i] = lines[i].replace(/=\s*0\s*$/i, "= 1");
			return;
		}
	}
}

function applyCyclerGateToSections(lines: string[], groupId: number) {
	const gateExpr = `$managed_slot_id == $\\modmanageragl\\group_${groupId}\\active_slot`;
	const closeGate = [CYCLER_CLOSE_START, "endif", CYCLER_CLOSE_END];
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].trim().match(/^\[([^\]]+)\]$/);
		if (!match || !isCyclerGatedSection(match[1])) continue;
		const openGate = [
			CYCLER_GATE_START,
			`if ${gateExpr}`,
			...(isCyclerRuntimeDetectionSection(match[1]) ? [`    $\\mod_cycler_indie\\cycler\\current_group = ${groupId}`] : []),
			CYCLER_GATE_END,
		];

		lines.splice(i + 1, 0, ...openGate);
		i += openGate.length + 1;

		let nextSection = i;
		while (nextSection < lines.length && !lines[nextSection].trim().match(/^\[[^\]]+\]$/)) {
			nextSection++;
		}
		lines.splice(nextSection, 0, ...closeGate);
		i = nextSection + closeGate.length - 1;
	}
}

function applyCyclerConditionToKeySections(lines: string[], groupId: number) {
	const gateExpr = `$managed_slot_id == $\\modmanageragl\\group_${groupId}\\active_slot`;
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].trim().match(/^\[([^\]]+)\]$/);
		if (!match || !isCyclerKeySection(match[1])) continue;

		let nextSection = i + 1;
		while (nextSection < lines.length && !lines[nextSection].trim().match(/^\[[^\]]+\]$/)) {
			nextSection++;
		}

		const conditionIndex = lines.findIndex((line, index) => {
			if (index <= i || index >= nextSection) return false;
			const normalized = line.trim().toLowerCase().replaceAll(" ", "");
			return normalized.startsWith("condition=");
		});

		if (conditionIndex >= 0) {
			const originalLine = lines[conditionIndex];
			const [lhs, ...rhsParts] = originalLine.split("=");
			const rhs = rhsParts.join("=").trim();
			const nextCondition = rhs ? `${lhs.trim()} = (${rhs}) && ${gateExpr}` : `${lhs.trim()} = ${gateExpr}`;
			lines.splice(
				conditionIndex,
				1,
				CYCLER_KEY_CONDITION_START,
				`${CYCLER_KEY_ORIGINAL_PREFIX}${originalLine}`,
				nextCondition,
				CYCLER_KEY_CONDITION_END
			);
			i = conditionIndex + 3;
			continue;
		}

		lines.splice(i + 1, 0, CYCLER_KEY_CONDITION_START, `condition = ${gateExpr}`, CYCLER_KEY_CONDITION_END);
		i += 3;
	}
}

function patchCyclerIniContent(content: string, groupId: number, slot: number) {
	const stripped = stripCyclerManagedBlocks(content);
	const lines = stripped.split(/\r?\n/);
	const hasCyclerSections = lines.some((line) => {
		const match = line.trim().match(/^\[([^\]]+)\]$/);
		return !!match && (isCyclerGatedSection(match[1]) || isCyclerKeySection(match[1]));
	});
	if (!hasCyclerSections) return stripped;

	ensureCyclerConstants(lines, slot);
	ensureCyclerModEnabled(lines);
	applyCyclerGateToSections(lines, groupId);
	applyCyclerConditionToKeySections(lines, groupId);
	return lines.join("\n");
}

function flattenModEntries(entries: Mod[]): Mod[] {
	return entries.flatMap((entry) => [entry, ...flattenModEntries(entry.children || [])]);
}

async function findIniFilesForMod(modPath: string) {
	const entries = await readDirRecr(join(src, managedSRC), modPath, 12, 0, false);
	return flattenModEntries(entries)
		.filter((entry) => !entry.isDir && entry.name.toLowerCase().endsWith(".ini"))
		.filter((entry) => !entry.name.toLowerCase().endsWith(".bak"))
		.map((entry) => join(src, managedSRC, entry.path));
}

async function patchModForCycler(mod: Mod, groupId: number, slot: number) {
	const iniFiles = await findIniFilesForMod(mod.path);
	for (const iniPath of iniFiles) {
		if (!(await exists(iniPath + CYCLER_BACKUP_EXT))) {
			await copyFile(iniPath, iniPath + CYCLER_BACKUP_EXT);
		}
		const original = await readTextFile(iniPath);
		const cleaned = stripCyclerManagedBlocks(original);
		const patched = patchCyclerIniContent(cleaned, groupId, slot);
		if (patched !== original) {
			await writeTextFile(iniPath, patched);
		}
	}
	return iniFiles.length;
}

async function cleanupModCyclerPatch(mod: Mod) {
	const iniFiles = await findIniFilesForMod(mod.path);
	let cleaned = 0;
	for (const iniPath of iniFiles) {
		const original = await readTextFile(iniPath);
		const cleanedContent = stripCyclerManagedBlocks(original);
		if (cleanedContent !== original) {
			await writeTextFile(iniPath, cleanedContent);
			cleaned++;
		}
	}
	return cleaned;
}

async function cleanupCyclerGroupFiles(modsRoot: string) {
	try {
		const entries = await readDir(modsRoot);
		await Promise.all(
			entries
				.filter((entry) => !entry.isDirectory)
				.filter((entry) => entry.name.startsWith(CYCLER_GROUP_FILE_PREFIX) && entry.name.endsWith(".ini"))
				.map((entry) => remove(join(modsRoot, entry.name)).catch(() => {}))
		);
	} catch {}
}

async function createCyclerNoticePng(text: string, accent: string) {
	const canvas = document.createElement("canvas");
	canvas.width = 560;
	canvas.height = 96;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas is not available.");

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "rgba(5, 12, 18, 0.82)";
	ctx.strokeStyle = accent;
	ctx.lineWidth = 3;
	ctx.shadowColor = accent;
	ctx.shadowBlur = 16;
	ctx.fillRect(5, 5, 550, 86);
	ctx.strokeRect(5, 5, 550, 86);
	ctx.shadowBlur = 0;

	ctx.fillStyle = accent;
	ctx.beginPath();
	ctx.arc(42, 48, 17, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = "rgba(215, 225, 235, 0.78)";
	ctx.font = "13px Segoe UI, Arial, sans-serif";
	ctx.fillText("WuWa IMM Custom", 78, 34);

	ctx.fillStyle = "rgba(246, 250, 255, 0.98)";
	ctx.font = "bold 27px Segoe UI, Arial, sans-serif";
	ctx.fillText(text, 76, 68);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not render Cycler notice image."))), "image/png");
	});
	return new Uint8Array(await blob.arrayBuffer());
}

function fitNoticeText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = "bold") {
	let fontSize = size;
	const safeText = text.trim() || "Preset";
	while (fontSize > 16) {
		ctx.font = `${weight} ${fontSize}px Segoe UI, Arial, sans-serif`;
		if (ctx.measureText(safeText).width <= maxWidth) break;
		fontSize -= 1;
	}
	return safeText;
}

async function createPresetNoticePng(presetName: string) {
	const canvas = document.createElement("canvas");
	canvas.width = 720;
	canvas.height = 112;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas is not available.");
	const accent = "#ffe17a";

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "rgba(8, 10, 15, 0.86)";
	ctx.strokeStyle = accent;
	ctx.lineWidth = 3;
	ctx.shadowColor = accent;
	ctx.shadowBlur = 18;
	ctx.fillRect(5, 5, 710, 102);
	ctx.strokeRect(5, 5, 710, 102);
	ctx.shadowBlur = 0;

	ctx.fillStyle = accent;
	ctx.beginPath();
	ctx.arc(46, 56, 18, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = "rgba(215, 225, 235, 0.78)";
	ctx.font = "13px Segoe UI, Arial, sans-serif";
	ctx.fillText("WuWa IMM Custom", 84, 36);

	ctx.fillStyle = "rgba(246, 250, 255, 0.98)";
	const title = fitNoticeText(ctx, `Preset ${presetName.trim() || "Preset"} activated`, 590, 28);
	ctx.fillText(title, 84, 72);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not render preset notice image."))), "image/png");
	});
	return new Uint8Array(await blob.arrayBuffer());
}

async function ensureCyclerOverlayAssets(modsRoot: string) {
	const overlayRoot = join(modsRoot, CYCLER_OVERLAY_DIR);
	await mkdir(overlayRoot, { recursive: true });
	await writeTextFile(join(overlayRoot, "Draw_2D.hlsl"), CYCLER_DRAW_2D_SHADER);
	await Promise.all([
		writeFile(join(overlayRoot, "auto_cycle_on.png"), await createCyclerNoticePng("AUTO CYCLE ON", "#74ffb8")),
		writeFile(join(overlayRoot, "auto_cycle_off.png"), await createCyclerNoticePng("AUTO CYCLE OFF", "#ff9474")),
		writeFile(join(overlayRoot, "auto_shuffle_on.png"), await createCyclerNoticePng("AUTO SHUFFLE ON", "#b88cff")),
		writeFile(join(overlayRoot, "auto_shuffle_off.png"), await createCyclerNoticePng("AUTO SHUFFLE OFF", "#ffb074")),
	]);
}

export async function preparePresetReloadNotice(presetName: string) {
	const modsRoot = src || tgt;
	if (!modsRoot) return { ok: false, path: "" };

	const overlayRoot = join(modsRoot, CYCLER_OVERLAY_DIR);
	const token = Date.now();
	const imageName = "preset_activated.png";
	await mkdir(overlayRoot, { recursive: true });
	await writeTextFile(join(overlayRoot, "Draw_2D.hlsl"), CYCLER_DRAW_2D_SHADER);
	await writeFile(join(overlayRoot, imageName), await createPresetNoticePng(presetName));
	const lines = [
		"; Generated by WuWa IMM Custom",
		"; Shows a one-shot in-game notice after a preset shortcut is applied.",
		"; The user still reloads WWMI manually with F10.",
		"namespace = wuwa_imm_custom\\preset_notice",
		"",
		"[Constants]",
		`global $preset_notice_token = ${token}`,
		"global persist $preset_notice_seen = 0",
		"global $preset_notice_frames = 0",
		"",
		"[Present]",
		"if $preset_notice_token != $preset_notice_seen",
		"    $preset_notice_seen = $preset_notice_token",
		"    $preset_notice_frames = 120",
		"endif",
		"if $preset_notice_frames > 0",
		"    $preset_notice_frames = $preset_notice_frames - 1",
		"    ps-t100 = ResourcePresetActivatedNotice",
		"    run = CustomShaderPresetActivatedNotice",
		"endif",
		"",
		"[ResourcePresetActivatedNotice]",
		`filename = ${CYCLER_OVERLAY_DIR}\\${imageName}`,
		"",
		"[CustomShaderPresetActivatedNotice]",
		"hs = null",
		"ds = null",
		"gs = null",
		"cs = null",
		`vs = ${CYCLER_OVERLAY_DIR}\\Draw_2D.hlsl`,
		`ps = ${CYCLER_OVERLAY_DIR}\\Draw_2D.hlsl`,
		"x87 = 720 / res_width",
		"y87 = 112 / res_height",
		"z87 = 0.5 - (360 / res_width)",
		"w87 = 0.08",
		"blend = ADD SRC_ALPHA INV_SRC_ALPHA",
		"cull = none",
		"topology = triangle_strip",
		"o0 = set_viewport bb",
		"Draw = 4,0",
		"clear = ps-t100",
	];
	const iniPath = join(modsRoot, PRESET_NOTICE_FILE);
	await writeTextFile(iniPath, lines.join("\n"));
	return { ok: true, path: iniPath };
}

async function readCyclerManifest(modsRoot: string) {
	try {
		const raw = await readTextFile(join(modsRoot, CYCLER_MANIFEST_FILE));
		const parsed = JSON.parse(raw) as { mods?: string[] };
		return new Set((parsed.mods || []).filter((path) => typeof path === "string"));
	} catch {
		return new Set<string>();
	}
}

async function writeCyclerManifest(modsRoot: string, paths: string[]) {
	await writeTextFile(
		join(modsRoot, CYCLER_MANIFEST_FILE),
		JSON.stringify(
			{
				version: 1,
				updatedAt: new Date().toISOString(),
				mods: paths,
			},
			null,
			2
		)
	);
}

type CyclerRebuildGroup = {
	id: number;
	character: string;
	mods: Mod[];
	initialSlot: number;
	deck: number[];
};

async function clampCyclerPersistentState(groups: CyclerRebuildGroup[]) {
	const rootPath = tgt || src;
	if (!rootPath || !groups.length) return;
	const d3dxUserPath = join(...rootPath.split("\\").slice(0, -1), "d3dx_user.ini");
	if (!(await exists(d3dxUserPath))) return;

	let content = await readTextFile(d3dxUserPath);
	let changed = false;
	for (const group of groups) {
		const maxSlot = group.mods.length;
		const slotPattern = new RegExp(`^(\\$\\\\mod_cycler_indie\\\\cycler\\\\g${group.id}_slot\\s*=\\s*)(\\d+)\\s*$`, "gm");
		content = content.replace(slotPattern, (line, prefix, value) => {
			const current = Number(value);
			if (Number.isFinite(current) && current >= 1 && current <= maxSlot) return line;
			changed = true;
			return `${prefix}${group.initialSlot}`;
		});

		const activeSlotPattern = new RegExp(`^(\\$\\\\modmanageragl\\\\group_${group.id}\\\\active_slot\\s*=\\s*)(\\d+)\\s*$`, "gm");
		content = content.replace(activeSlotPattern, (line, prefix, value) => {
			const current = Number(value);
			if (Number.isFinite(current) && current >= 1 && current <= maxSlot) return line;
			changed = true;
			return `${prefix}${group.initialSlot}`;
		});

		const positionPattern = new RegExp(`^(\\$\\\\mod_cycler_indie\\\\cycler\\\\g${group.id}_pos\\s*=\\s*)(\\d+)\\s*$`, "gm");
		content = content.replace(positionPattern, (line, prefix, value) => {
			const current = Number(value);
			if (Number.isFinite(current) && current >= 0 && current < maxSlot) return line;
			changed = true;
			return `${prefix}0`;
		});
	}

	if (changed) {
		await writeTextFile(d3dxUserPath, content);
		info("[IMM] Cycler persistent state clamped to current group sizes.");
	}
}

function getCyclerGroupsForRebuild() {
	return Object.entries(
		store
			.get(MOD_LIST)
			.filter((mod) => (mod.tags || []).includes("cycler"))
			.reduce<Record<string, Mod[]>>((groups, mod) => {
				if (!groups[mod.parent]) groups[mod.parent] = [];
				groups[mod.parent].push(mod);
				return groups;
			}, {})
	)
		.map(([character, mods]) => ({
			character,
			mods: mods.sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.filter((group) => group.mods.length >= 2)
		.sort((a, b) => a.character.localeCompare(b.character));
}

function buildCyclerRuntimeClampLines(groups: CyclerRebuildGroup[]) {
	return groups.flatMap((group) => [
		`if $\\modmanageragl\\group_${group.id}\\active_slot < 1 || $\\modmanageragl\\group_${group.id}\\active_slot > ${group.mods.length}`,
		`    $\\modmanageragl\\group_${group.id}\\active_slot = ${group.initialSlot}`,
		"endif",
		`if $g${group.id}_slot < 1 || $g${group.id}_slot > ${group.mods.length}`,
		`    $g${group.id}_slot = $\\modmanageragl\\group_${group.id}\\active_slot`,
		"endif",
		`if $g${group.id}_pos < 0 || $g${group.id}_pos >= ${group.mods.length}`,
		`    $g${group.id}_pos = 0`,
		"endif",
	]);
}

function clampEffectColorValue(value: unknown, fallback: number) {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) return fallback;
	return Math.max(0, Math.min(1, numberValue));
}

function formatEffectColorValue(value: unknown, fallback: number) {
	return clampEffectColorValue(value, fallback).toFixed(3).replace(/\.?0+$/, "");
}

function isEffectColorsEnabled(mod: Mod) {
	return !!store.get(DATA)[mod.path]?.effectColors?.enabled;
}

function buildEffectColorAssignments(mod: Mod, indent = "") {
	const colors = store.get(DATA)[mod.path]?.effectColors || {};
	return [
		`${indent}$\\CECChange\\red = ${formatEffectColorValue(colors.red, 1)}`,
		`${indent}$\\CECChange\\green = ${formatEffectColorValue(colors.green, 1)}`,
		`${indent}$\\CECChange\\blue = ${formatEffectColorValue(colors.blue, 1)}`,
		`${indent}$\\CECChange\\redOffset = ${formatEffectColorValue(colors.redOffset, 0)}`,
		`${indent}$\\CECChange\\greenOffset = ${formatEffectColorValue(colors.greenOffset, 0)}`,
		`${indent}$\\CECChange\\blueOffset = ${formatEffectColorValue(colors.blueOffset, 0)}`,
		`${indent}$\\CECChange\\activeVB = 1`,
	];
}

function safeIniSectionName(value: string) {
	return value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 90) || "Mod";
}

async function buildEffectColorFixSections(modsRoot: string) {
	const sourceFixDir = join(src, managedSRC, EFFECT_COLORS_FIXES_PATH);
	if (!(await exists(sourceFixDir))) return "";

	const sourceFixIni = join(sourceFixDir, "fix.ini");
	if (!(await exists(sourceFixIni))) return "";

	const targetFixDir = join(modsRoot, EFFECT_COLORS_FIXES_DIR);
	await remove(targetFixDir, { recursive: true }).catch(() => {});
	await mkdir(targetFixDir, { recursive: true });

	const copied = new Set<string>();
	for (const entry of await readDir(sourceFixDir)) {
		if (!entry.isFile || !entry.name.toLowerCase().endsWith(".txt")) continue;
		await copyFile(join(sourceFixDir, entry.name), join(targetFixDir, entry.name));
		copied.add(entry.name.toLowerCase());
	}

	let fixIni = await readTextFile(sourceFixIni);
	fixIni = fixIni.replace(/^(ps\s*=\s*)(.+)$/gim, (_match, prefix: string, fileName: string) => {
		const cleanName = fileName.trim().replace(/^\.?[\\/]/, "");
		if (!copied.has(cleanName.toLowerCase())) return `${prefix}${fileName.trim()}`;
		return `${prefix}.\\${EFFECT_COLORS_FIXES_DIR}\\${cleanName}`;
	});

	return [
		"",
		"; ------------------------------",
		"; WuWa IMM Custom copied fixes from All Characters Effect Color Modify",
		"; These overrides reduce known environment/boss/portal shader color leaks.",
		"; ------------------------------",
		fixIni.trimEnd(),
	].join("\n");
}

async function findComponent0Hash(mod: Mod) {
	const iniFiles = await findIniFilesForMod(mod.path);
	for (const iniPath of iniFiles) {
		const content = await readTextFile(iniPath).catch(() => "");
		if (!content) continue;
		const lines = content.split(/\r?\n/);
		let inComponent0 = false;
		for (const rawLine of lines) {
			const line = rawLine.trim();
			const sectionMatch = line.match(/^\[([^\]]+)\]$/);
			if (sectionMatch) {
				inComponent0 = sectionMatch[1].toLowerCase() === "textureoverridecomponent0";
				continue;
			}
			if (!inComponent0) continue;
			const hashMatch = line.match(/^hash\s*=\s*([0-9a-fA-F]{8})\b/);
			if (hashMatch) return hashMatch[1].toLowerCase();
		}
	}
	return (mod.hashes || []).find((hash) => /^[0-9a-fA-F]{8}$/.test(hash))?.toLowerCase() || "";
}

export async function rebuildEffectColorsIni(groupsFromCycler?: CyclerRebuildGroup[]) {
	const modsRoot = src || tgt;
	if (!modsRoot) {
		addToast({ type: "error", message: "Effect colors failed: Mods folder is not configured." });
		return { ok: false, colors: 0, path: "" };
	}

	await disableBundledEffectColorExample();
	const basePath = join(src, managedSRC, EFFECT_COLORS_BASE_PATH);
	if (!(await exists(basePath))) {
		addToast({ type: "error", message: "Effect colors failed: All Characters Effect Color Modify base file was not found." });
		return { ok: false, colors: 0, path: "" };
	}

	const cyclerGroups =
		groupsFromCycler ||
		getCyclerGroupsForRebuild().map((group, index) => {
			return {
				id: index + 1,
				...group,
				initialSlot: 1,
				deck: [],
			};
		});
	const cyclerSlotByPath = new Map<string, { groupId: number; slot: number }>();
	for (const group of cyclerGroups) {
		group.mods.forEach((mod, index) => {
			cyclerSlotByPath.set(mod.path, { groupId: group.id, slot: index + 1 });
		});
	}

	const candidates = store.get(MOD_LIST).filter((mod) => {
		if (!mod.isDir || !isEffectColorsEnabled(mod)) return false;
		if (cyclerSlotByPath.has(mod.path)) return true;
		return mod.enabled && !(mod.tags || []).includes("cycler");
	});

	const generated: string[] = [
		"",
		"; ------------------------------",
		"; WuWa IMM Custom generated colors",
		"; These sections are generated from each mod's Colors tab.",
		"; ------------------------------",
	];
	let generatedCount = 0;
	for (const mod of candidates) {
		const hash = await findComponent0Hash(mod);
		if (!hash) {
			warn(`[IMM] Effect colors skipped, Component0 hash not found: ${mod.path}`);
			continue;
		}
		const slot = cyclerSlotByPath.get(mod.path);
		generated.push("", `; ${mod.path}`, `[TextureOverrideWuWaIMMColor_${safeIniSectionName(mod.path)}]`, `hash = ${hash}`, "match_priority = 5");
		if (slot) {
			generated.push(`if $\\mod_cycler_indie\\cycler\\current_group == ${slot.groupId} && $\\modmanageragl\\group_${slot.groupId}\\active_slot == ${slot.slot}`);
			generated.push(...buildEffectColorAssignments(mod, "    "));
			generated.push("endif");
		} else {
			generated.push(...buildEffectColorAssignments(mod));
		}
		generatedCount++;
	}

	const iniPath = join(modsRoot, EFFECT_COLORS_FILE);
	if (!generatedCount) {
		await remove(iniPath).catch(() => {});
		await remove(join(modsRoot, EFFECT_COLORS_FIXES_DIR), { recursive: true }).catch(() => {});
		addToast({ type: "success", message: "Effect colors cleared: no enabled color configs found." });
		return { ok: true, colors: 0, path: "" };
	}

	const base = await readTextFile(basePath);
	const fixSections = await buildEffectColorFixSections(modsRoot);
	await writeTextFile(iniPath, [base.trimEnd(), fixSections, ...generated].filter(Boolean).join("\n"));
	addToast({ type: "success", message: `Effect colors applied: ${generatedCount} mod(s). Press F10 in-game to reload.` });
	return { ok: true, colors: generatedCount, path: iniPath };
}

function isRoverEyeHairEnabled(mod: Mod) {
	return mod.parent === ROVER_FEMALE_CATEGORY && mod.name !== ROVER_EYE_HAIR_ADDON_NAME && !!store.get(DATA)[mod.path]?.roverEyeHair?.enabled;
}

function getRoverEyePreset(id?: string) {
	return ROVER_EYE_COLOR_PRESETS.find((preset) => preset.id === id) || ROVER_EYE_COLOR_PRESETS[0];
}

function getRoverHairPreset(id?: string) {
	return ROVER_HAIR_COLOR_PRESETS.find((preset) => preset.id === id) || ROVER_HAIR_COLOR_PRESETS[0];
}

function getAstralHairPreset(id?: string) {
	return ASTRAL_HAIR_COLOR_PRESETS.find((preset) => preset.id === id);
}

type RoverEyeHairCandidate = {
	mod: Mod;
	slot: { groupId: number; slot: number } | undefined;
	eye: string;
	hair: string;
	hairSafe: boolean;
	eyeResourceId: string;
	eyeFile: string;
	hairFrontResourceId: string;
	hairFrontFile: string;
	hairBackResourceId: string;
	hairBackFile: string;
};

async function resolveRoverHairResource(hairId: string, kind: "front" | "back") {
	const preset = getRoverHairPreset(hairId);
	return {
		id: preset.id,
		file: kind === "front" ? preset.front : preset.back,
	};
}

function buildRoverTextureAssignments(
	candidates: RoverEyeHairCandidate[],
	kind: "eye" | "hairFront" | "hairBack"
) {
	const lines: string[] = [];
	for (const candidate of candidates) {
		const resource =
			kind === "eye"
				? `ResourceWuWaRoverEye_${safeIniSectionName(candidate.eyeResourceId)}`
				: kind === "hairFront"
					? `ResourceWuWaRoverHairFront_${safeIniSectionName(candidate.hairFrontResourceId)}`
					: `ResourceWuWaRoverHairBack_${safeIniSectionName(candidate.hairBackResourceId)}`;
		if (candidate.slot) {
			lines.push(
				`if $\\mod_cycler_indie\\cycler\\current_group == ${candidate.slot.groupId} && $\\modmanageragl\\group_${candidate.slot.groupId}\\active_slot == ${candidate.slot.slot}`,
				`    this = ${resource}`,
				"endif"
			);
		} else {
			lines.push(`this = ${resource}`);
		}
	}
	return lines;
}

function buildAstralHairAssignments(candidates: RoverEyeHairCandidate[], kind: "front" | "back") {
	const lines: string[] = [];
	for (const candidate of candidates) {
		const resource =
			kind === "front"
				? `ResourceWuWaAstralHairFront_${safeIniSectionName(candidate.hairFrontResourceId)}`
				: `ResourceWuWaAstralHairBack_${safeIniSectionName(candidate.hairBackResourceId)}`;
		if (candidate.slot) {
			// Do not depend on current_group here: Astral's first hair texture is
			// bound before its component has a chance to publish that value.
			lines.push(
				`if $\\modmanageragl\\group_${candidate.slot.groupId}\\active_slot == ${candidate.slot.slot}`,
				`    this = ${resource}`,
				"endif"
			);
		} else {
			lines.push(`this = ${resource}`);
		}
	}
	return lines;
}

async function syncLadyArbiterEyeTexture(
	addonPath: string,
	candidates: { mod: Mod; eye: string }[]
) {
	const currentLady = candidates.find((candidate) => candidate.mod.path === LADY_ARBITER_PATH);
	const texturePath = join(src, managedSRC, LADY_ARBITER_EYE_TEXTURE);
	const backupPath = join(src, managedSRC, LADY_ARBITER_EYE_BACKUP);
	if (currentLady) {
		const eyePreset = getRoverEyePreset(currentLady.eye);
		const sourceTexture = join(addonPath, "Textures", eyePreset.file);
		if (!(await exists(sourceTexture))) {
			warn(`[IMM] Rover Lady Arbiter eye skipped, texture not found: ${sourceTexture}`);
			return;
		}
		if ((await exists(texturePath)) && !(await exists(backupPath))) {
			await copyFile(texturePath, backupPath);
		}
		await remove(texturePath).catch(() => {});
		await copyFile(sourceTexture, texturePath);
		return;
	}
	if ((await exists(backupPath))) {
		await remove(texturePath).catch(() => {});
		await copyFile(backupPath, texturePath);
	}
}

export async function rebuildRoverEyeHairRecolorIni(groupsFromCycler?: CyclerRebuildGroup[], showToast = true) {
	const modsRoot = src || tgt;
	if (!modsRoot) {
		if (showToast) addToast({ type: "error", message: "Rover eye/hair colors failed: Mods folder is not configured." });
		return { ok: false, colors: 0, path: "" };
	}

	const addonPath = join(src, managedSRC, ROVER_EYE_HAIR_ADDON_PATH);
	const generatedPath = join(addonPath, ROVER_EYE_HAIR_GENERATED_FILE);
	if (!(await exists(addonPath))) {
		if (showToast) addToast({ type: "error", message: "Rover eye/hair colors failed: Rover recolor add-on was not found." });
		return { ok: false, colors: 0, path: "" };
	}

	const cyclerGroups =
		groupsFromCycler ||
		getCyclerGroupsForRebuild().map((group, index) => ({
			id: index + 1,
			...group,
			initialSlot: 1,
			deck: [],
		}));
	const cyclerSlotByPath = new Map<string, { groupId: number; slot: number }>();
	for (const group of cyclerGroups) {
		group.mods.forEach((mod, index) => {
			cyclerSlotByPath.set(mod.path, { groupId: group.id, slot: index + 1 });
		});
	}

	const candidates = await Promise.all(
		store.get(MOD_LIST).filter((mod) => {
			if (!mod.isDir || !isRoverEyeHairEnabled(mod)) return false;
			if (cyclerSlotByPath.has(mod.path)) return true;
			return mod.enabled && !(mod.tags || []).includes("cycler");
		}).map(async (mod): Promise<RoverEyeHairCandidate> => {
			const config = store.get(DATA)[mod.path]?.roverEyeHair || {};
			const eyePreset = getRoverEyePreset(config.eye);
			const astralHairPreset = mod.path === ASTRAL_MODULATOR_PATH ? getAstralHairPreset(config.hair) : undefined;
			const hairPreset = astralHairPreset || getRoverHairPreset(config.hair);
			const frontResource = astralHairPreset
				? { id: astralHairPreset.id, file: astralHairPreset.front }
				: await resolveRoverHairResource(hairPreset.id, "front");
			const backResource = astralHairPreset
				? { id: astralHairPreset.id, file: astralHairPreset.back }
				: await resolveRoverHairResource(hairPreset.id, "back");
			return {
				mod,
				slot: cyclerSlotByPath.get(mod.path),
				eye: eyePreset.id,
				hair: mod.path === ASTRAL_MODULATOR_PATH ? (astralHairPreset?.id || "") : hairPreset.id,
				hairSafe: !ROVER_HAIR_RECOLOR_UNSAFE_PATHS.has(mod.path),
				eyeResourceId: eyePreset.id,
				eyeFile: eyePreset.file,
				hairFrontResourceId: frontResource.id,
				hairFrontFile: frontResource.file,
				hairBackResourceId: backResource.id,
				hairBackFile: backResource.file,
			};
		})
	);

	await syncLadyArbiterEyeTexture(addonPath, candidates);

	if (!candidates.length) {
		await remove(generatedPath).catch(() => {});
		if (showToast) addToast({ type: "success", message: "Rover eye/hair colors cleared: no enabled Rover configs found." });
		return { ok: true, colors: 0, path: "" };
	}

	const usedEyeResources = new Map<string, string>();
	const usedHairFrontResources = new Map<string, string>();
	const usedHairBackResources = new Map<string, string>();
	const usedAstralHairFrontResources = new Map<string, string>();
	const usedAstralHairBackResources = new Map<string, string>();
	const hairCandidates = candidates.filter((candidate) => candidate.hairSafe);
	const astralHairCandidates = candidates.filter(
		(candidate) => candidate.mod.path === ASTRAL_MODULATOR_PATH && !!getAstralHairPreset(candidate.hair)
	);
	for (const candidate of candidates) {
		usedEyeResources.set(candidate.eyeResourceId, candidate.eyeFile);
	}
	for (const candidate of hairCandidates) {
		usedHairFrontResources.set(candidate.hairFrontResourceId, candidate.hairFrontFile);
		usedHairBackResources.set(candidate.hairBackResourceId, candidate.hairBackFile);
	}
	for (const candidate of astralHairCandidates) {
		usedAstralHairFrontResources.set(candidate.hairFrontResourceId, candidate.hairFrontFile);
		usedAstralHairBackResources.set(candidate.hairBackResourceId, candidate.hairBackFile);
	}
	const lines: string[] = [
		"; Generated by WuWa IMM Custom",
		"; Per-skin Rover Female eye/hair colors. Edit from the IMM right sidebar.",
		"",
	];

	for (const hash of ["52c18227", "8ee0408c", "8f9e1c00"]) {
		lines.push(`[TextureOverrideWuWaRoverEye_${hash}]`, `hash = ${hash}`, "match_priority = 250", ...buildRoverTextureAssignments(candidates, "eye"), "");
	}
	for (const hash of ["04192868", "64f39763", "072b55de", "d946b64f"]) {
		lines.push(`[TextureOverrideWuWaRoverHairFront_${hash}]`, `hash = ${hash}`, "match_priority = 250", ...buildRoverTextureAssignments(hairCandidates, "hairFront"), "");
	}
	for (const hash of ["a01c9b96", "b7f20fb3", "7d4305b1", "aea47749"]) {
		lines.push(`[TextureOverrideWuWaRoverHairBack_${hash}]`, `hash = ${hash}`, "match_priority = 250", ...buildRoverTextureAssignments(hairCandidates, "hairBack"), "");
	}
	if (astralHairCandidates.length) {
		lines.push(
			"[TextureOverrideWuWaAstralHairFront_04192868]",
			"hash = 04192868",
			"match_priority = 350",
			...buildAstralHairAssignments(astralHairCandidates, "front"),
			"",
			"[TextureOverrideWuWaAstralHairBack_a01c9b96]",
			"hash = a01c9b96",
			"match_priority = 350",
			...buildAstralHairAssignments(astralHairCandidates, "back"),
			"",
		);
	}
	for (const [id, file] of usedAstralHairFrontResources) {
		lines.push(`[ResourceWuWaAstralHairFront_${safeIniSectionName(id)}]`, `filename = Textures/${file}`, "");
	}
	for (const [id, file] of usedAstralHairBackResources) {
		lines.push(`[ResourceWuWaAstralHairBack_${safeIniSectionName(id)}]`, `filename = Textures/${file}`, "");
	}
	for (const [id, file] of usedEyeResources) {
		lines.push(`[ResourceWuWaRoverEye_${safeIniSectionName(id)}]`, `filename = Textures/${file}`, "");
	}
	for (const [id, file] of usedHairFrontResources) {
		lines.push(`[ResourceWuWaRoverHairFront_${safeIniSectionName(id)}]`, `filename = Textures/${file}`, "");
	}
	for (const [id, file] of usedHairBackResources) {
		lines.push(`[ResourceWuWaRoverHairBack_${safeIniSectionName(id)}]`, `filename = Textures/${file}`, "");
	}

	await writeTextFile(generatedPath, lines.join("\n"));
	if (showToast) addToast({ type: "success", message: `Rover eye/hair colors applied: ${candidates.length} skin(s). Press F10 in-game to reload.` });
	return { ok: true, colors: candidates.length, path: generatedPath };
}

let cyclerRebuildQueue: Promise<unknown> = Promise.resolve();

export async function rebuildCyclerIni(timerSeconds = getCyclerTimerSeconds()) {
	const nextRebuild = cyclerRebuildQueue
		.catch(() => {})
		.then(() => rebuildCyclerIniUnsafe(timerSeconds))
		.catch((err) => {
			error("[IMM] Cycler rebuild failed:", err);
			addToast({ type: "error", message: `Cycler rebuild failed: ${String(err)}` });
			return { ok: false, groups: 0, path: "" };
		});
	cyclerRebuildQueue = nextRebuild;
	return nextRebuild;
}

async function rebuildCyclerIniUnsafe(timerSeconds = 30) {
	const modsRoot = src || tgt;
	if (!modsRoot) {
		addToast({ type: "error", message: "Cycler rebuild failed: Mods folder is not configured." });
		return { ok: false, groups: 0, path: "" };
	}
	if (store.get(TEST_PIN_STATE).path) {
		addToast({ type: "error", message: "Clear the temporary pinned mod before rebuilding the Cycler." });
		return { ok: false, groups: 0, path: "" };
	}

	const cyclerGroups = getCyclerGroupsForRebuild();

	const cyclerPaths = new Set(cyclerGroups.flatMap((group) => group.mods.map((mod) => mod.path)));
	const previousCyclerPaths = await readCyclerManifest(modsRoot);
	const statePathsToPersist = [...new Set([...cyclerPaths, ...previousCyclerPaths])];
	if (statePathsToPersist.length > 0) {
		await updateDataFromD3DXIni(statePathsToPersist);
	}
	const modsByPath = new Map(store.get(MOD_LIST).map((mod) => [mod.path, mod]));
	const cleanupCandidates = [...previousCyclerPaths]
		.filter((path) => !cyclerPaths.has(path))
		.map((path) => modsByPath.get(path))
		.filter((mod): mod is Mod => !!mod?.isDir);
	let cleanedFiles = 0;
	for (const mod of cleanupCandidates) {
		cleanedFiles += await cleanupModCyclerPatch(mod);
	}

	if (!cyclerGroups.length) {
		await cleanupCyclerGroupFiles(modsRoot);
		await remove(join(modsRoot, "mod_cycler.ini")).catch(() => {});
		await writeCyclerManifest(modsRoot, []);
		await rebuildRoverEyeHairRecolorIni(undefined, false);
		addToast({ type: "success", message: `Cycler cleared: ${cleanedFiles} ini file(s) cleaned.` });
		return { ok: true, groups: 0, path: "" };
	}

	const lines: string[] = [
		"; Generated by WuWa IMM Custom",
		"; This file controls no-reload cycling for mods marked with the Cycler tag.",
		"namespace = mod_cycler_indie\\cycler",
		"",
		"[Constants]",
		"global $auto_enable = 0",
		"global $shuffle_auto_enable = 0",
		"global $last_cycle = 0",
		"global $cycler_toast_id = 0",
		"global $cycler_toast_frames = 0",
		"post $cycler_toast_id = 0",
		"post $cycler_toast_frames = 0",
		`global persist $current_group = ${cyclerGroups.length === 1 ? 1 : 0}`,
	];

	const groups = cyclerGroups.map((group, index) => {
		const groupId = index + 1;
		const initialSlot = 1;
		const deck = shuffleNumbers(group.mods.map((_, modIndex) => modIndex + 1));
		lines.push(`global persist $g${groupId}_pos = 0`);
		lines.push(`global persist $g${groupId}_slot = ${initialSlot}`);
		return { id: groupId, ...group, initialSlot, deck };
	});

	await clampCyclerPersistentState(groups);

	lines.push(
		"",
		"; Group map",
		...groups.flatMap((group) => [
			`; group_${group.id}: ${group.character}`,
			...group.mods.map((mod, index) => `;   slot ${index + 1}: ${mod.name}`),
		]),
		"",
		"[KeyNext]",
		`key = ${getCustomHotkeyForMigoto("cyclerNext")}`,
		"run = CommandListNext",
		"[KeyPrev]",
		`key = ${getCustomHotkeyForMigoto("cyclerPrevious")}`,
		"run = CommandListPrev",
		"[KeyRandom]",
		`key = ${getCustomHotkeyForMigoto("cyclerRandom")}`,
		"run = CommandListShuffle",
		"[KeyToggleAuto]",
		`key = ${getCustomHotkeyForMigoto("cyclerAutoCycle")}`,
		"run = CommandListToggleAuto",
		"[KeyToggleShuffleAuto]",
		`key = ${getCustomHotkeyForMigoto("cyclerAutoShuffle")}`,
		"run = CommandListToggleShuffleAuto",
		"",
		"[CommandListToggleAuto]",
		"$auto_enable = 1 - $auto_enable",
		"$shuffle_auto_enable = 0",
		"if $auto_enable == 1",
		"    $last_cycle = time",
		"    $cycler_toast_id = 2",
		"else",
		"    $cycler_toast_id = 3",
		"endif",
		"$cycler_toast_frames = 90",
		"",
		"[CommandListToggleShuffleAuto]",
		"$shuffle_auto_enable = 1 - $shuffle_auto_enable",
		"$auto_enable = 0",
		"if $shuffle_auto_enable == 1",
		"    $last_cycle = time",
		"    $cycler_toast_id = 4",
		"else",
		"    $cycler_toast_id = 5",
		"endif",
		"$cycler_toast_frames = 90",
		"",
		"[CommandListNext]"
	);

	for (const group of groups) {
		lines.push(`if $current_group == ${group.id}`);
		lines.push(
			`    $g${group.id}_slot = $g${group.id}_slot + 1`,
			`    if $g${group.id}_slot > ${group.mods.length}`,
			`        $g${group.id}_slot = 1`,
			"    endif",
			`    $\\modmanageragl\\group_${group.id}\\active_slot = $g${group.id}_slot`
		);
		lines.push("endif");
	}

	lines.push("", "[CommandListPrev]");
	for (const group of groups) {
		lines.push(`if $current_group == ${group.id}`);
		lines.push(
			`    $g${group.id}_slot = $g${group.id}_slot - 1`,
			`    if $g${group.id}_slot < 1`,
			`        $g${group.id}_slot = ${group.mods.length}`,
			"    endif",
			`    $\\modmanageragl\\group_${group.id}\\active_slot = $g${group.id}_slot`
		);
		lines.push("endif");
	}

	lines.push("", "[CommandListShuffle]");
	for (const group of groups) {
		lines.push(`if $current_group == ${group.id}`);
		lines.push(`    $g${group.id}_pos = ($g${group.id}_pos + 1) % ${group.mods.length}`);
		group.deck.forEach((modId, position) => {
			lines.push(`    if $g${group.id}_pos == ${position}`, `        $g${group.id}_slot = ${modId}`, "    endif");
		});
		lines.push(`    $\\modmanageragl\\group_${group.id}\\active_slot = $g${group.id}_slot`, "endif", "");
	}

	lines.push(
		"[Present]",
		...buildCyclerRuntimeClampLines(groups),
		"",
		"if $auto_enable == 1 || $shuffle_auto_enable == 1",
		`    if time - $last_cycle >= ${timerSeconds}`,
		"        $last_cycle = time",
		"        if $auto_enable == 1",
		"            run = CommandListNext",
		"        else",
		"            run = CommandListShuffle",
		"        endif",
		"    endif",
		"endif",
		"",
		"if $cycler_toast_frames > 0",
		"    $cycler_toast_frames = $cycler_toast_frames - 1",
		"    if $cycler_toast_id == 2",
		"        ps-t100 = ResourceCyclerNoticeAutoCycleOn",
		"    endif",
		"    if $cycler_toast_id == 3",
		"        ps-t100 = ResourceCyclerNoticeAutoCycleOff",
		"    endif",
		"    if $cycler_toast_id == 4",
		"        ps-t100 = ResourceCyclerNoticeAutoShuffleOn",
		"    endif",
		"    if $cycler_toast_id == 5",
		"        ps-t100 = ResourceCyclerNoticeAutoShuffleOff",
		"    endif",
		"    run = CustomShaderCyclerNotice",
		"else",
		"    $cycler_toast_id = 0",
		"endif",
		"",
		"[ResourceCyclerNoticeAutoCycleOn]",
		`filename = ${CYCLER_OVERLAY_DIR}\\auto_cycle_on.png`,
		"[ResourceCyclerNoticeAutoCycleOff]",
		`filename = ${CYCLER_OVERLAY_DIR}\\auto_cycle_off.png`,
		"[ResourceCyclerNoticeAutoShuffleOn]",
		`filename = ${CYCLER_OVERLAY_DIR}\\auto_shuffle_on.png`,
		"[ResourceCyclerNoticeAutoShuffleOff]",
		`filename = ${CYCLER_OVERLAY_DIR}\\auto_shuffle_off.png`,
		"",
		"[CustomShaderCyclerNotice]",
		"hs = null",
		"ds = null",
		"gs = null",
		"cs = null",
		`vs = ${CYCLER_OVERLAY_DIR}\\Draw_2D.hlsl`,
		`ps = ${CYCLER_OVERLAY_DIR}\\Draw_2D.hlsl`,
		"x87 = 560 / res_width",
		"y87 = 96 / res_height",
		"z87 = 0.5 - (280 / res_width)",
		"w87 = 0.08",
		"blend = ADD SRC_ALPHA INV_SRC_ALPHA",
		"cull = none",
		"topology = triangle_strip",
		"o0 = set_viewport bb",
		"Draw = 4,0",
		"clear = ps-t100"
	);

	await ensureCyclerOverlayAssets(modsRoot);
	await cleanupCyclerGroupFiles(modsRoot);
	let patchedFiles = 0;
	for (const group of groups) {
		const groupPath = join(modsRoot, `${CYCLER_GROUP_FILE_PREFIX}${group.id}.ini`);
		await writeTextFile(
			groupPath,
			[
				"; Generated by WuWa IMM Custom",
				`namespace = modmanageragl\\group_${group.id}`,
				"",
				"[Constants]",
				`persist global $active_slot = ${group.initialSlot}`,
			].join("\n")
		);
		for (const [slotIndex, mod] of group.mods.entries()) {
			patchedFiles += await patchModForCycler(mod, group.id, slotIndex + 1);
			await updatePrefsIniFromData(mod.path);
			if (!mod.enabled) await toggleMod(mod.path, true);
		}
	}

	const iniPath = join(modsRoot, "mod_cycler.ini");
	await writeTextFile(iniPath, lines.join("\n"));
	await writeCyclerManifest(modsRoot, [...cyclerPaths].sort((a, b) => a.localeCompare(b)));
	await rebuildEffectColorsIni(groups);
	await rebuildRoverEyeHairRecolorIni(groups, false);
	addToast({
		type: "success",
		message: `Cycler rebuilt: ${groups.length} character group(s), ${patchedFiles} ini file(s), ${cleanedFiles} cleaned.`,
	});
	return { ok: true, groups: groups.length, path: iniPath };
}

export async function installFromArchives(archives: string[]) {
	// const categories = store.get(CATEGORIES).map((cat) => cat._sName);
	let success = 0;
	async function extractArchive(archive: string) {
		if (!archive) return;
		const [name] = archive.split("\\").pop()!.split(".");
		const root = join(src, managedSRC, UNCATEGORIZED);
		await mkdir(root, { recursive: true });
		let counter = 0;
		let finalName = name;
		while (await exists(join(root, finalName))) {
			finalName = `${name} (${++counter})`;
		}
		const dest = join(root, finalName);
		await mkdir(dest, { recursive: true });
		try {
			info("[IMM] Extracting archive:", archive, "to", dest);
			const element = {
				name: finalName,
				path: UNCATEGORIZED + "\\" + finalName,
				source: "",
				fname: archive.split("\\").pop()!,
				category: UNCATEGORIZED,
				updatedAt: 0,
				dlPath: dest,
				key: `${finalName}_${archive.split("\\").pop()!}_${finalName}_0`,
			} as any;
			store.set(DOWNLOAD_LIST, (prev) => {
				prev.extracting.push(element);
				return { ...prev };
			});
			addToExtracts(element.key, element);
			await invoke("extract_archive", {
				filePath: archive,
				savePath: dest,
				fileName: name,
				del: false,
				emit: true,
				key: element.key,
				currentSid: 999,
			});
			info("[IMM] Archive extracted:", archive);
			// await validateModDownload(dest, true);
			success++;
		} catch (err) {
			error("[IMM] Error extracting archive:", err);
			addToast({ type: "error", message: textData._Toasts.ErrInstall.replace("<item/>", name) });
		}
	}
	const extractPromises = archives.map((archive) => extractArchive(archive));
	await Promise.all(extractPromises);
	addToast({
		type: "success",
		message: textData._Toasts.SuccessInstall.replace("<success/>", success.toString()).replace(
			"<total/>",
			archives.length.toString()
		),
	});
}
