import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCustomI18n } from "@/utils/customI18n";

export const HOTKEYS_OVERLAY_STORAGE_KEY = "wuwa-imm-hotkeys-overlay";

type HotkeysOverlayPayload = {
	modName: string;
	characterName?: string;
	hotkeys: {
		name: string;
		key: string;
	}[];
};

function readPayload(): HotkeysOverlayPayload {
	try {
		const raw = localStorage.getItem(HOTKEYS_OVERLAY_STORAGE_KEY);
		if (!raw) throw new Error("Missing payload");
		const parsed = JSON.parse(raw) as HotkeysOverlayPayload;
		return {
			modName: parsed.modName || "Selected mod",
			characterName: parsed.characterName || "",
			hotkeys: Array.isArray(parsed.hotkeys) ? parsed.hotkeys : [],
		};
	} catch {
		return {
			modName: "Selected mod",
			hotkeys: [],
		};
	}
}

function HotkeysOverlayWindow() {
	const t = useCustomI18n();
	const [payload] = useState(readPayload);
	const appWindow = useMemo(() => getCurrentWebviewWindow(), []);
	const displayedModName = payload.modName === "Selected mod" ? t("Selected mod") : payload.modName;

	useEffect(() => {
		appWindow.setAlwaysOnTop(true).catch(() => {});
		appWindow.setTitle(`${t("Hotkeys")} - ${displayedModName}`).catch(() => {});
	}, [appWindow, displayedModName, t]);

	return (
		<div className="game-font flex h-screen w-screen flex-col overflow-hidden border bg-background text-foreground shadow-2xl">
			<div
				onMouseDown={() => appWindow.startDragging().catch(() => {})}
				className="flex cursor-move select-none items-center justify-between gap-3 border-b bg-sidebar/95 px-3 py-2"
			>
				<div className="min-w-0">
					<div className="text-accent text-[10px] font-bold uppercase tracking-[0.18em]">{t("Pinned hotkeys")}</div>
					<div className="truncate text-sm font-semibold">{displayedModName}</div>
					{payload.characterName && (
						<div className="truncate text-[10px] text-muted-foreground">{payload.characterName}</div>
					)}
				</div>
				<button
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation();
						appWindow.close();
					}}
					className="grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-background/70 text-accent duration-200 hover:bg-accent hover:text-background"
					title={t("Close")}
				>
					<XIcon className="h-4 w-4" />
				</button>
			</div>
			<div className="thin min-h-0 flex-1 overflow-y-auto p-2">
				{payload.hotkeys.length > 0 ? (
					<div className="overflow-hidden rounded-lg border">
						{payload.hotkeys.map((hotkey, index) => (
							<div
								key={`${hotkey.name}-${hotkey.key}-${index}`}
								className={
									"flex min-h-11 items-center gap-3 border-b px-3 last:border-b-0 " +
									(index % 2 ? "bg-sidebar/45" : "bg-background/45")
								}
							>
								<div className="min-w-0 flex-1 truncate text-sm font-semibold text-accent">{hotkey.name}</div>
								<div className="flex flex-wrap items-center justify-end gap-1">
									{hotkey.key.split(" ﹢ ").map((key, keyIndex, keys) => (
										<span key={`${key}-${keyIndex}`} className="flex items-center gap-1">
											<kbd className="min-w-8 rounded-md border bg-sidebar px-2 py-1 text-center text-sm font-semibold text-accent shadow-sm">
												{key}
											</kbd>
											{keyIndex < keys.length - 1 && <span className="text-xs text-muted-foreground">+</span>}
										</span>
									))}
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="grid h-full place-items-center rounded-lg border bg-sidebar/35 p-6 text-center text-sm text-muted-foreground">
						{t("No hotkeys found for the selected mod.")}
					</div>
				)}
			</div>
			<div className="border-t bg-sidebar/80 px-3 py-1 text-[10px] text-muted-foreground">
				{t("Alt + K toggles this window. Drag the top bar to move it.")}
			</div>
		</div>
	);
}

export default HotkeysOverlayWindow;
