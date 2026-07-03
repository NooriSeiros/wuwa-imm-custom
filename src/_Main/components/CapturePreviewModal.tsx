import { addToast } from "@/_Toaster/ToastProvider";
import { Button } from "@/components/ui/button";
import { managedSRC } from "@/utils/consts";
import { saveConfigs } from "@/utils/filesys";
import {
	DATA,
	LAST_UPDATED,
	MOD_LIST,
	PRESETS,
	PREVIEW_CAPTURE_OVERLAY,
	PREVIEW_CAPTURE_TARGET,
	SETTINGS,
	SOURCE,
} from "@/utils/vars";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { CheckIcon, Loader2Icon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useCustomI18n } from "@/utils/customI18n";

type Selection = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type CaptureBounds = {
	left: number;
	top: number;
	width: number;
	height: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function makeSelection(
	startX: number,
	startY: number,
	currentX: number,
	currentY: number,
	widthLimit: number,
	heightLimit: number
) {
	const sx = clamp(startX, 0, widthLimit);
	const sy = clamp(startY, 0, heightLimit);
	const cx = clamp(currentX, 0, widthLimit);
	const cy = clamp(currentY, 0, heightLimit);

	return {
		x: Math.min(sx, cx),
		y: Math.min(sy, cy),
		width: Math.abs(cx - sx),
		height: Math.abs(cy - sy),
	};
}

function getPointerInBounds(event: ReactMouseEvent<HTMLElement>, bounds: CaptureBounds) {
	const rect = event.currentTarget.getBoundingClientRect();
	const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * bounds.width : 0;
	const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * bounds.height : 0;
	return {
		x: clamp(x, 0, bounds.width),
		y: clamp(y, 0, bounds.height),
	};
}

function isAbsoluteWindowsPath(path: string) {
	return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function joinWindowsPath(...parts: string[]) {
	return parts
		.filter(Boolean)
		.map((part, index) => (index === 0 ? part.replace(/[\\/]+$/g, "") : part.replace(/^[\\/]+|[\\/]+$/g, "")))
		.join("\\");
}

function CapturePreviewModal() {
	const t = useCustomI18n();
	const [target, setTarget] = useAtom(PREVIEW_CAPTURE_TARGET);
	const [, setOverlayActive] = useAtom(PREVIEW_CAPTURE_OVERLAY);
	const game = useAtomValue(SETTINGS).global.game;
	const source = useAtomValue(SOURCE);
	const [, setLastUpdated] = useAtom(LAST_UPDATED);
	const setData = useSetAtom(DATA);
	const setModList = useSetAtom(MOD_LIST);
	const setPresets = useSetAtom(PRESETS);
	const startRef = useRef<{ x: number; y: number } | null>(null);
	const [phase, setPhase] = useState<"idle" | "selecting" | "capturing" | "confirming">("idle");
	const [bounds, setBounds] = useState<CaptureBounds | null>(null);
	const [selection, setSelection] = useState<Selection | null>(null);
	const [dragging, setDragging] = useState(false);
	const [stagePath, setStagePath] = useState("");
	const [saving, setSaving] = useState(false);
	const [paused, setPaused] = useState(false);
	const stageUrl = useMemo(() => (stagePath ? convertFileSrc(stagePath) : ""), [stagePath]);

	const closeFlow = async () => {
		await invoke("cancel_preview_capture_overlay").catch(() => {});
		setOverlayActive(false);
		setPhase("idle");
		setBounds(null);
		setSelection(null);
		setStagePath("");
		setPaused(false);
		setTarget(null);
	};

	const beginSelection = async () => {
		if (!target) return;
		setPhase("selecting");
		setOverlayActive(true);
		setSelection(null);
		setStagePath("");
		try {
			const nextBounds = await invoke<CaptureBounds>("enter_preview_capture_overlay", {
				gameId: game === "WW" ? 0 : 0,
			});
			setBounds(nextBounds);
		} catch (error) {
			addToast({ type: "error", message: String(error) });
			await closeFlow();
		}
	};

	useEffect(() => {
		if (target && phase === "idle") beginSelection();
	}, [target, phase]);

	useEffect(() => {
		if (!target) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeFlow();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [target]);

	const captureSelection = async (nextSelection: Selection) => {
		if (!target || !bounds || nextSelection.width < 8 || nextSelection.height < 8) return;
		setDragging(false);
		setPhase("capturing");
		try {
			const path = await invoke<string>("capture_preview_screen_region", {
				crop: {
					x: Math.round(bounds.left + nextSelection.x),
					y: Math.round(bounds.top + nextSelection.y),
					width: Math.round(nextSelection.width),
					height: Math.round(nextSelection.height),
				},
			});
			setStagePath(path);
			setOverlayActive(false);
			setPhase("confirming");
		} catch (error) {
			addToast({ type: "error", message: String(error) });
			await closeFlow();
		}
	};

	const pauseForGameCamera = async () => {
		if (!target || phase !== "selecting") return;
		setPaused(true);
		setDragging(false);
		startRef.current = null;
		try {
			await invoke("pause_preview_capture_overlay", { gameId: game === "WW" ? 0 : 0 });
		} catch (error) {
			addToast({ type: "error", message: String(error) });
		} finally {
			setPaused(false);
		}
	};

	const confirmPreview = async () => {
		if (!target || !stagePath) return;
		setSaving(true);
		try {
			if (target.kind === "preset") {
				const coverPath = await invoke<string>("save_preset_cover_stage", {
					stagePath,
					coverKey: target.coverKey,
				});
				setPresets((previous) =>
					previous.map((preset, index) => (index === target.presetIndex ? { ...preset, cover: coverPath } : preset))
				);
			} else if (target.kind === "look") {
				const coverPath = await invoke<string>("save_look_cover_stage", {
					stagePath,
					coverKey: target.coverKey,
				});
				setData((previous) => ({
					...previous,
					[target.modPath]: {
						...(previous[target.modPath] || {}),
						looks: (previous[target.modPath]?.looks || []).map((look) =>
							look.id === target.lookId ? { ...look, cover: coverPath, updatedAt: new Date().toISOString() } : look
						),
					},
				}));
			} else {
				const modPath = isAbsoluteWindowsPath(target.path)
					? target.path
					: joinWindowsPath(source, managedSRC, target.path);
				await invoke("save_mod_preview_stage", { stagePath, modPath });
				setData((prev) => {
					if (prev[target.path]?.crop) delete prev[target.path].crop;
					return { ...prev };
				});
				setModList((prev) =>
					prev.map((mod) => {
						if (mod.path !== target.path) return mod;
						const next = { ...mod };
						delete next.crop;
						return next;
					})
				);
			}
			saveConfigs();
			setLastUpdated(Date.now());
			addToast({
				type: "success",
				message:
					target.kind === "preset"
						? t("Preset cover saved.")
						: target.kind === "look"
							? t("Look preview saved.")
							: t("Preview image saved."),
			});
			await closeFlow();
		} catch (error) {
			addToast({ type: "error", message: String(error) });
		} finally {
			setSaving(false);
		}
	};

	if (!target) return null;

	if (phase === "selecting" || phase === "capturing") {
		return (
			<div
				className={
					"fixed inset-0 z-[5000] select-none cursor-crosshair " +
					(paused ? "pointer-events-none bg-transparent" : "bg-black/12")
				}
				onMouseDown={(event) => {
					if (!bounds || phase !== "selecting") return;
					if (event.button === 2) {
						event.preventDefault();
						event.stopPropagation();
						pauseForGameCamera();
						return;
					}
					if (event.button !== 0) return;
					const pointer = getPointerInBounds(event, bounds);
					startRef.current = pointer;
					setDragging(true);
					setSelection(null);
				}}
				onContextMenu={(event) => event.preventDefault()}
				onMouseMove={(event) => {
					if (!dragging || !startRef.current || !bounds || phase !== "selecting") return;
					const pointer = getPointerInBounds(event, bounds);
					const nextSelection = makeSelection(
						startRef.current.x,
						startRef.current.y,
						pointer.x,
						pointer.y,
						bounds.width,
						bounds.height
					);
					setSelection(nextSelection.width >= 4 || nextSelection.height >= 4 ? nextSelection : null);
				}}
				onMouseUp={(event) => {
					if (event.button !== 0) return;
					if (!dragging || !startRef.current || !bounds || phase !== "selecting") return;
					const pointer = getPointerInBounds(event, bounds);
					const nextSelection = makeSelection(
						startRef.current.x,
						startRef.current.y,
						pointer.x,
						pointer.y,
						bounds.width,
						bounds.height
					);
					setDragging(false);
					startRef.current = null;
					if (nextSelection.width < 8 || nextSelection.height < 8) {
						setSelection(null);
						return;
					}
					setSelection(nextSelection);
					captureSelection(nextSelection);
				}}
			>
				<div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border bg-background/70 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur">
					{paused
						? t("Overlay paused · Move the camera · Release right click to resume")
						: t("Left drag to capture preview · Hold right click to move camera · Esc cancels")}
				</div>
				<div className="hidden">{t("Drag to capture preview · Esc cancels")}</div>
				{selection && (
					<div
						className="pointer-events-none absolute border-2 border-accent bg-accent/[0.06] shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]"
						style={{
							left: selection.x,
							top: selection.y,
							width: selection.width,
							height: selection.height,
						}}
					/>
				)}
				{!selection && !paused && (
					<div className="pointer-events-none absolute inset-4 rounded-lg border border-accent/60 shadow-[inset_0_0_35px_rgba(255,255,255,0.08),0_0_28px_rgba(255,255,255,0.08)]" />
				)}
				{phase === "capturing" && (
					<div className="absolute inset-0 grid place-items-center bg-black/30">
						<div className="flex items-center gap-2 rounded-lg border bg-background/80 px-4 py-3 text-foreground backdrop-blur">
							<Loader2Icon className="h-5 w-5 animate-spin text-accent" />
							{t("Capturing...")}
						</div>
					</div>
				)}
			</div>
		);
	}

	if (phase === "confirming") {
		return (
			<div className="fixed inset-0 z-[5000] flex items-center justify-center bg-background/75 p-6 backdrop-blur-md">
				<div className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-xl border bg-sidebar p-4 shadow-2xl">
					<div className="mb-3 flex items-center justify-between gap-3">
						<div>
							<p className="text-accent text-[10px] font-bold tracking-[0.2em] uppercase">{t("Confirm preview")}</p>
							<h2 className="text-2xl font-serif text-accent">{target.name}</h2>
							<p className="text-xs text-muted-foreground">{t("Does this crop look good?")}</p>
						</div>
						<Button onClick={closeFlow} className="h-9 w-9 p-0">
							<XIcon className="h-4 w-4" />
						</Button>
					</div>
					<div className="grid min-h-[26rem] place-items-center overflow-hidden rounded-lg border bg-background/40">
						{stageUrl ? (
							<img src={stageUrl} className="max-h-[68vh] max-w-full rounded-md object-contain" />
						) : (
							<Loader2Icon className="h-8 w-8 animate-spin text-accent" />
						)}
					</div>
					<div className="mt-3 flex items-center justify-end gap-3">
						<Button disabled={saving} onClick={beginSelection}>
							<RotateCcwIcon className="h-4 w-4" />
							{t("No, recapture")}
						</Button>
						<Button variant="success" disabled={saving || !stagePath} onClick={confirmPreview}>
							{saving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
							{t("Yes, use it")}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return null;
}

export default CapturePreviewModal;
