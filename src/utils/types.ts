export type Games = "WW" | "ZZ" | "GI" | "SR" | "EF" | ""; //| "GI" ;
export type Language = "en" | "cn" | "ru" | "jp" | "kr" | "ptbr" | "";
export interface DirEntry {
	name: string;
	isDirectory: boolean;
	icon?: string;
	children?: DirEntry[];
}
export interface GlobalSettings {
	bgOpacity: number;
	winOpacity: number;
	winType: 0 | 1 | 2;
	bgType: 0 | 1 | 2;
	listType: 0;
	nsfw: 0 | 1 | 2;
	toggleClick: 0 | 2;
	ignore: string;
	clientDate: string;
	XXMI: string;
	lang: Language;
	game: Games;
	version?: string;
	updatedAt?: string;
	notice?: number;
	preReleases: boolean;
	chkModUpdates: boolean;
}
export interface GameSettings {
	launch: 0 | 1 | 2;
	hotReload: 0 | 1 | 2;
	onlineType: string;
	customCategories: { [key: string]: CustomCategory };
}
export interface Settings {
	global: GlobalSettings;
	game: GameSettings;
}
export interface CustomCategory {
	_sIconUrl: string;
	_sAltIconUrl?: string;
}

export interface Category {
	_idRow: number;
	_sName: string;
	_nItemCount: number;
	_nCategoryCount: number;
	_sUrl: string;
	_sIconUrl: string;
	_sAltIconUrl?: string;
	_special?: boolean;
}
export interface ModData {
	source?: string;
	sourceKind?: "gamebanana" | "huihui" | "unknown";
	sourceFingerprint?: string;
	updatedAt?: number;
	viewedAt?: number;
	tags?: string[];
	note?: string;
	effectColors?: {
		enabled?: boolean;
		red?: number;
		green?: number;
		blue?: number;
		redOffset?: number;
		greenOffset?: number;
		blueOffset?: number;
	};
	roverEyeHair?: {
		enabled?: boolean;
		eye?: string;
		hair?: string;
	};
	namespace?: string;
	// state?: { [key: string]: any };
	vars?: { [key: string]: any };
	looks?: ModLook[];
	crop?: {
		scale?: number;
		x?: number;
		y?: number;
		vertical?: boolean;
	};
}
export interface ModLook {
	id: string;
	name: string;
	createdAt: string;
	updatedAt?: string;
	cover?: string;
	values: Record<string, Record<string, string>>;
}
export interface ModDataObj {
	[key: string]: ModData;
}
export interface Preset {
	name: string;
	data: string[];
	characters?: string[];
	hotkey?: string;
	createdAt?: string;
	cover?: string;
	cycler?: {
		mods: string[];
		timerMinutes?: number;
	};
	effectColors?: {
		[path: string]: NonNullable<ModData["effectColors"]>;
	};
	meta?: {
		normalMods?: number;
		cyclerMods?: number;
		effectColorMods?: number;
		normalCharacters?: number;
		cyclerCharacters?: number;
		skippedNormalMods?: number;
	};
}
export interface SetupManifestMod {
	path: string;
	name: string;
	parent: string;
	enabled: boolean;
	source?: string;
	sourceKind?: "gamebanana" | "huihui" | "unknown";
	sourceFingerprint?: string;
	updatedAt?: number;
	viewedAt?: number;
	tags?: string[];
}
export interface ImportedMissingMod extends SetupManifestMod {
	importedAt: string;
}
export interface GameConfig {
	version: string;
	game: Games;
	custom: 0 | 1;
	sourceDir: string;
	targetDir: string;
	settings: GameSettings;
	data: ModDataObj;
	presets: Preset[];
	categories: Category[];
	mods?: SetupManifestMod[];
	customHotkeys?: Record<string, string>;
	customClickShortcuts?: Record<string, string>;
	updatedAt: string;
}
export interface DownloadItem {
	status: "pending" | "downloading" | "completed" | "failed" | "extracting";
	addon: boolean;
	preview: string;
	category: string;
	source: string;
	file: string;
	updated: number;
	name: string;
	fname: string;
	key?: string;
}
export interface DownloadList {
	queue: DownloadItem[];
	downloading: DownloadItem | null;
	completed: DownloadItem[];
	extracting: DownloadItem[];
}
export interface ModHotKeys {
	key: string;
	type: string;
	target: string;
	name: string;
	values: string[];
	default: string;
	file: string;
	namespace: string;
	pref: string | null;
	reset: string | null;
}
export interface Mod {
	isDir: boolean;
	name: string;
	parent: string;
	path: string;
	keys: ModHotKeys[];
	files?: Record<string, ModHotKeys[]>;
	namespace?: string;
	enabled: boolean;
	children: Mod[];
	depth: number;
	icon?: string;
	source?: string;
	sourceKind?: "gamebanana" | "huihui" | "unknown";
	sourceFingerprint?: string;
	updatedAt?: number;
	viewedAt?: number;
	note?: string;
	tags?: string[];
	hashes?: string[];
	crop?: {
		scale?: number;
		x?: number;
		y?: number;
		vertical?: boolean;
	};
}
export interface ProgressData {
	title: string;
	finished: boolean;
	button: string;
	open: boolean;
	name: string;
}
export interface InstalledItem {
	name: string;
	source: string;
	sourceKind?: "gamebanana" | "huihui" | "unknown";
	sourceFingerprint?: string;
	updated: number;
	viewed: number;
	modStatus: number;
}
export interface OnlineModImage {
	_sType: string;
	_sBaseUrl: string;
	_sFile: string;
	_sFile220?: string;
	_hFile220?: number;
	_wFile220?: number;
	_sFile530?: string;
	_hFile530?: number;
	_wFile530?: number;
	_sFile100: string;
	_hFile100: number;
	_wFile100: number;
}
export interface OnlineModPreviewMedia {
	_aImages: OnlineModImage[];
}
export interface OnlineModSubmitter {
	_idRow: number;
	_sName: string;
	_bIsOnline: boolean;
	_bHasRipe?: boolean;
	_sProfileUrl: string;
	_sAvatarUrl: string;
	_sHdAvatarUrl: string;
	_sUpicUrl?: string;
	_sMoreByUrl?: string;
}
export interface OnlineModCategory {
	_sName: string;
	_sProfileUrl: string;
	_sIconUrl: string;
}
export interface OnlineMod {
	_idRow: number;
	_sModelName: string;
	_sSingularTitle?: string;
	_sIconClasses?: string;
	_sName: string;
	_sProfileUrl: string;
	_tsDateAdded?: number;
	_tsDateModified?: number;
	_tsDateUpdated?: number;
	_bHasFiles?: boolean;
	_aTags?: any[];
	_aFiles?: any[];
	_aPreviewMedia?: OnlineModPreviewMedia;
	_aSubmitter: OnlineModSubmitter;
	_aRootCategory: OnlineModCategory;
	_sVersion?: string;
	_bIsObsolete?: boolean;
	_sInitialVisibility: string;
	_bHasContentRatings?: boolean;
	_nLikeCount: number;
	_nPostCount: number;
	_bWasFeatured?: boolean;
	_nViewCount?: number;
	_bIsOwnedByAccessor?: boolean;
	_sImageUrl?: string;
	_aComments?: any[];
	_sPeriod?: "today" | "yesterday" | "week" | "month" | "3month" | "6month" | "year" | "alltime";
}
export interface OnlineData {
	[key: string]: OnlineMod[] | OnlineMod;
}
export interface ChangeInfo {
	before: DirEntry[];
	after: DirEntry[];
	map: Record<string, DirEntry>;
	title: string;
	skip: boolean;
}
