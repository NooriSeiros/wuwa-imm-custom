import { addToast } from "@/_Toaster/ToastProvider";
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
import { applyModLookValues, captureModLookValues, countModLookValues, saveConfigs } from "@/utils/filesys";
import type { Mod, ModLook } from "@/utils/types";
import { DATA, PREVIEW_CAPTURE_TARGET } from "@/utils/vars";
import { getImageUrl, handleImageError } from "@/utils/utils";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAtom } from "jotai";
import { ArrowLeftIcon, CopyIcon, ImagePlusIcon, Layers3Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { eventMatchesClickShortcut, formatClickShortcut, getCustomClickShortcut } from "@/utils/customClickShortcuts";
import { useCustomI18n } from "@/utils/customI18n";

function newLookId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ModLooksView({ mod, onBack }: { mod: Mod; onBack: () => void }) {
	const t = useCustomI18n();
	const [data, setData] = useAtom(DATA);
	const [, setCaptureTarget] = useAtom(PREVIEW_CAPTURE_TARGET);
	const [busy, setBusy] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const looks = data[mod.path]?.looks || [];
	const captureShortcutLabel = formatClickShortcut(getCustomClickShortcut("previewCapture"));

	const replaceLooks = async (nextLooks: ModLook[]) => {
		setData((previous) => ({
			...previous,
			[mod.path]: { ...(previous[mod.path] || {}), looks: nextLooks },
		}));
		await saveConfigs();
	};

	const captureCurrentLook = async () => {
		if (busy) return;
		setBusy(true);
		try {
			const values = await captureModLookValues(mod.path);
			const variableCount = countModLookValues(values);
			if (!variableCount) {
				addToast({ type: "error", message: t("No persistent hotkey state was detected for this mod.") });
				return;
			}
			const now = new Date().toISOString();
			await replaceLooks([
				...looks,
				{ id: newLookId(), name: `${t("Look")} ${looks.length + 1}`, createdAt: now, updatedAt: now, values },
			]);
			addToast({ type: "success", message: `${t("Look saved with")} ${variableCount} ${t("settings")}.` });
		} catch (error) {
			addToast({ type: "error", message: `${t("Could not capture this Look:")} ${String(error)}` });
		} finally {
			setBusy(false);
		}
	};

	const applyLook = async (look: ModLook) => {
		if (busy) return;
		setBusy(true);
		try {
			await applyModLookValues(mod.path, look.values);
			addToast({
				type: "success",
				message: mod.enabled
					? `${look.name} ${t("prepared. Press F10 in-game manually to apply it.")}`
					: `${look.name} ${t("prepared for the next time this mod is enabled.")}`,
			});
		} catch (error) {
			addToast({ type: "error", message: `${t("Could not apply this Look:")} ${String(error)}` });
		} finally {
			setBusy(false);
		}
	};

	const renameLook = async (look: ModLook, value: string) => {
		const name = value.trim();
		if (!name || name === look.name) return;
		await replaceLooks(
			looks.map((item) => (item.id === look.id ? { ...item, name, updatedAt: new Date().toISOString() } : item))
		);
	};

	const duplicateLook = async (look: ModLook) => {
		const now = new Date().toISOString();
		await replaceLooks([
			...looks,
			{
				...look,
				id: newLookId(),
				name: `${look.name} ${t("Copy")}`,
				createdAt: now,
				updatedAt: now,
				values: JSON.parse(JSON.stringify(look.values)),
			},
		]);
	};

	const captureLookPreview = (look: ModLook, index: number) => {
		setCaptureTarget({
			kind: "look",
			modPath: mod.path,
			lookId: look.id,
			coverKey: `look-${mod.path}-${look.id}`,
			name: `${look.name || `${t("Look")} ${index + 1}`} ${t("preview")}`,
		});
	};

	const confirmDelete = async () => {
		if (!deleteId) return;
		await replaceLooks(looks.filter((look) => look.id !== deleteId));
		setDeleteId(null);
	};

	return (
		<div data-main-scroll className="thin flex h-full w-full flex-col overflow-y-auto px-5 pb-8">
			<div className="sticky top-0 z-20 -mx-5 border-b bg-background/95 px-5 py-3 backdrop-blur">
				<Button variant="secondary" className="h-9" onClick={onBack}>
					<ArrowLeftIcon className="h-4 w-4" /> {t("Back to")} {mod.parent || t("mods")}
				</Button>
				<div className="mt-4 flex flex-wrap items-center justify-between gap-5">
					<div className="flex min-w-0 items-center gap-4">
						<img
							src={getImageUrl(mod.path)}
							onError={(event) => handleImageError(event)}
							className="h-16 w-16 shrink-0 rounded-xl border object-cover"
						/>
						<div className="min-w-0">
							<p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">{t("Mod Looks")}</p>
							<h2 className="truncate font-serif text-3xl text-accent">{mod.name}</h2>
							<p className="mt-1 text-xs text-muted-foreground">{t("Saved hotkey states.")}</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{mod.enabled && <span className="text-xs text-muted-foreground">{t("F10 after apply")}</span>}
						<Button className="h-11 px-5" disabled={busy} onClick={captureCurrentLook}>
							<PlusIcon className="h-4 w-4" /> {busy ? t("Reading...") : t("Save Look")}
						</Button>
					</div>
				</div>
			</div>

			{looks.length ? (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,20rem))] gap-4">
					{looks.map((look, index) => (
						<div key={look.id} className="relative h-[36rem] overflow-hidden rounded-xl border bg-sidebar/75">
							<div
								className="absolute inset-0 grid cursor-pointer place-items-center overflow-hidden bg-background/45"
								title={`${captureShortcutLabel} ${t("to capture or replace this Look preview")}`}
								onClick={(event) => {
									if (!eventMatchesClickShortcut(event, "previewCapture")) return;
									event.preventDefault();
									event.stopPropagation();
									captureLookPreview(look, index);
								}}
								onAuxClick={(event) => {
									if (!eventMatchesClickShortcut(event, "previewCapture")) return;
									event.preventDefault();
									event.stopPropagation();
									captureLookPreview(look, index);
								}}
								onContextMenu={(event) => event.preventDefault()}
							>
								{look.cover ? (
									<img src={convertFileSrc(look.cover)} className="h-full w-full object-cover" />
								) : (
									<div className="flex flex-col items-center gap-2 text-muted-foreground">
										<ImagePlusIcon className="h-8 w-8 text-accent/70" />
										<span className="text-[10px] font-bold uppercase tracking-[0.16em]">
											{captureShortcutLabel} {t("preview")}
										</span>
									</div>
								)}
							</div>
							<div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-background/75 to-transparent p-3">
								<span className="rounded-md border bg-background/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
									{t("Look")} {index + 1}
								</span>
								<span className="rounded-md border bg-background/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
									{countModLookValues(look.values)} {t("settings")}
								</span>
							</div>
							<div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-background via-background/92 to-transparent p-4 pt-16">
								<Input
									defaultValue={look.name}
									className="h-9 border-0 bg-background/45 px-0 text-lg font-bold focus-visible:ring-0"
									onBlur={(event) => renameLook(look, event.currentTarget.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") event.currentTarget.blur();
										if (event.key === "Escape") {
											event.currentTarget.value = look.name;
											event.currentTarget.blur();
										}
									}}
								/>
								<div className="flex gap-2">
									<Button className="h-9 flex-1" disabled={busy} onClick={() => applyLook(look)}>
										{t("Apply Look")}
									</Button>
									<Button
										variant="secondary"
										className="h-9 w-9 p-0"
										title={t("Duplicate Look")}
										onClick={() => duplicateLook(look)}
									>
										<CopyIcon className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										className="h-9 w-9 p-0 text-destructive"
										title={t("Delete Look")}
										onClick={() => setDeleteId(look.id)}
									>
										<TrashIcon className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-sidebar/40 px-6 text-center">
					<Layers3Icon className="mb-3 h-9 w-9 text-accent/70" />
					<h3 className="text-lg font-bold">{t("No Looks saved yet")}</h3>
					<p className="mt-1 max-w-md text-xs text-muted-foreground">
						{t("Use Save Look after choosing an outfit state.")}
					</p>
				</div>
			)}

			<AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("Delete this Look?")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("This removes only the saved hotkey configuration. The mod itself is not changed.")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={confirmDelete}>
							{t("Delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
