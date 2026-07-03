import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, localDataDir } from "@tauri-apps/api/path";
import type { Games, ModDataObj } from "./types";
import { info, warn } from "@/lib/logger";

const SOURCE_METADATA_INDEX_VERSION = 1;
const SOURCE_METADATA_FIELDS = ["source", "updatedAt", "viewedAt", "sourceKind", "sourceFingerprint"] as const;

type SourceMetadataField = (typeof SOURCE_METADATA_FIELDS)[number];
type SourceMetadataEntry = Partial<Record<SourceMetadataField, string | number>>;

interface SourceMetadataIndex {
	version: number;
	game: Games | string;
	updatedAt: string;
	entries: Record<string, SourceMetadataEntry>;
}

export function getSourceMetadataIndexFileName(game: Games | string) {
	return `mod-source-index${game || "WW"}.json`;
}

async function getSourceMetadataIndexPath(game: Games | string) {
	const directory = await join(await localDataDir(), "WuWa IMM Custom");
	await mkdir(directory, { recursive: true });
	return join(directory, getSourceMetadataIndexFileName(game));
}

function hasValue(value: unknown) {
	return value !== undefined && value !== null && value !== "" && value !== 0;
}

function getModField(modData: unknown, field: SourceMetadataField) {
	return (modData as Record<string, unknown> | undefined)?.[field];
}

function setModField(modData: Record<string, unknown>, field: SourceMetadataField, value: string | number) {
	modData[field] = value;
}

export function buildSourceMetadataIndex(game: Games | string, data: ModDataObj): SourceMetadataIndex {
	const entries: Record<string, SourceMetadataEntry> = {};
	for (const [path, modData] of Object.entries(data || {})) {
		const entry: SourceMetadataEntry = {};
		for (const field of SOURCE_METADATA_FIELDS) {
			const value = getModField(modData, field);
			if (hasValue(value) && (typeof value === "string" || typeof value === "number")) {
				entry[field] = value;
			}
		}
		if (Object.keys(entry).length > 0) {
			entries[path] = entry;
		}
	}
	return {
		version: SOURCE_METADATA_INDEX_VERSION,
		game,
		updatedAt: new Date().toISOString(),
		entries,
	};
}

export async function saveSourceMetadataIndex(game: Games | string, data: ModDataObj) {
	if (!game) return;
	const index = buildSourceMetadataIndex(game, data);
	await writeTextFile(await getSourceMetadataIndexPath(game), JSON.stringify(index, null, 2));
}

export async function mergeSourceMetadataIndex(game: Games | string, data: ModDataObj) {
	const fileName = getSourceMetadataIndexFileName(game);
	const persistentPath = await getSourceMetadataIndexPath(game);
	const legacyPath = fileName;
	let readPath = persistentPath;
	if (!(await exists(persistentPath)) && (await exists(legacyPath))) {
		try {
			await writeTextFile(persistentPath, await readTextFile(legacyPath));
			info(`[IMM] Migrated source metadata index to ${persistentPath}.`);
		} catch (error) {
			warn(`[IMM] Could not migrate source metadata index ${legacyPath}:`, error);
			readPath = legacyPath;
		}
	}
	if (!(await exists(readPath))) {
		return { data, restoredCount: 0 };
	}

	try {
		const index = JSON.parse(await readTextFile(readPath)) as Partial<SourceMetadataIndex>;
		const entries = index.entries || {};
		const nextData: ModDataObj = { ...(data || {}) };
		let restoredCount = 0;

		for (const [path, entry] of Object.entries(entries)) {
			if (!entry || typeof entry !== "object") continue;
			const current = { ...(nextData[path] || {}) } as Record<string, unknown>;
			let changed = false;
			for (const field of SOURCE_METADATA_FIELDS) {
				const value = (entry as SourceMetadataEntry)[field];
				if (!hasValue(value) || (typeof value !== "string" && typeof value !== "number")) continue;
				if (!hasValue(current[field])) {
					setModField(current, field, value);
					changed = true;
				}
			}
			if (changed) {
				nextData[path] = current as ModDataObj[string];
				restoredCount += 1;
			}
		}

		if (restoredCount > 0) {
			info(`[IMM] Restored source metadata for ${restoredCount} mod(s) from ${readPath}.`);
		}
		return { data: nextData, restoredCount };
	} catch (error) {
		warn(`[IMM] Could not read source metadata index ${readPath}:`, error);
		return { data, restoredCount: 0 };
	}
}
