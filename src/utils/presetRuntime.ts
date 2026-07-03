import { addToast } from "@/_Toaster/ToastProvider";
import {
	applyPreset,
	preparePresetReloadNotice,
	rebuildCyclerIni,
	refreshModList,
	saveConfigs,
	setCyclerTimerMinutes,
} from "./filesys";
import { CONFLICTS, DATA, MOD_LIST, store } from "./vars";
import type { Preset } from "./types";
import { getModCollisionGroups } from "./modCollision";

let applyingPresetHotkey = false;

export async function applyPresetFromGlobalHotkey(preset: Preset) {
	if (applyingPresetHotkey) {
		addToast({ type: "info", message: "A preset is already being applied." });
		return false;
	}
	applyingPresetHotkey = true;
	try {
		if (store.get(CONFLICTS).conflicts.length > 0) {
			addToast({ type: "error", message: "Preset not applied. Resolve active mod conflicts first." });
			return false;
		}

		const modList = store.get(MOD_LIST);
		if (getModCollisionGroups(modList, preset.data || [], preset.cycler?.mods || []).length > 0) {
			addToast({ type: "error", message: "Preset not applied. This preset contains Normal/Cycler conflicts." });
			return false;
		}

		const cyclerPaths = new Set(preset.cycler?.mods || []);
		const nextData = { ...store.get(DATA) };
		for (const path of Object.keys(nextData)) {
			if (nextData[path]?.effectColors) {
				nextData[path] = { ...nextData[path] };
				delete nextData[path].effectColors;
			}
		}
		for (const [path, effectColors] of Object.entries(preset.effectColors || {})) {
			nextData[path] = { ...nextData[path], effectColors };
		}
		for (const mod of modList.filter((item) => item.isDir)) {
			const tags = new Set(nextData[mod.path]?.tags || mod.tags || []);
			tags.delete("cycler");
			tags.delete("cycler_pin");
			if (cyclerPaths.has(mod.path)) tags.add("cycler");
			nextData[mod.path] = { ...nextData[mod.path], tags: [...tags] };
		}

		const nextModList = modList.map((mod) => {
			const tags = new Set(nextData[mod.path]?.tags || mod.tags || []);
			return { ...mod, tags: [...tags] };
		});
		store.set(DATA, nextData);
		store.set(MOD_LIST, nextModList);
		if (preset.cycler?.timerMinutes) setCyclerTimerMinutes(preset.cycler.timerMinutes);
		await saveConfigs();
		await applyPreset(preset.data || [], preset.name);
		store.set(MOD_LIST, await refreshModList());
		const rebuild = await rebuildCyclerIni();
		if (!rebuild.ok) throw new Error("Cycler rebuild failed");
		store.set(MOD_LIST, await refreshModList());

		await preparePresetReloadNotice(preset.name || "Preset").catch((error) => {
			console.warn("[IMM] Could not prepare preset reload notice:", error);
		});
		// Do not send any key input to Wuthering Waves. The shortcut only applies
		// the preset and prepares the overlay notice; the user reloads WWMI manually.
		addToast({ type: "success", message: `${preset.name || "Preset"} applied. Press F10 in-game to reload WWMI.` });
		return true;
	} catch (error) {
		addToast({ type: "error", message: `Could not apply preset: ${String(error)}` });
		return false;
	} finally {
		applyingPresetHotkey = false;
	}
}
