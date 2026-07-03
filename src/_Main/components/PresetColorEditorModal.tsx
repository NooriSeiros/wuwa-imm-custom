import { Button } from "@/components/ui/button";
import {
	DEFAULT_EFFECT_COLORS,
	EFFECT_COLOR_PRESET_GROUPS,
	getEffectColorSwatch,
	type EffectColors,
} from "@/utils/effectColors";
import { ArrowLeftIcon, PaletteIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useCustomI18n } from "@/utils/customI18n";

type PresetColorEditorModalProps = {
	modName: string;
	initialColors: Partial<EffectColors> | undefined;
	onClose: () => void;
	onSave: (colors: EffectColors) => void | Promise<void>;
};

function PresetColorEditorModal({ modName, initialColors, onClose, onSave }: PresetColorEditorModalProps) {
	const t = useCustomI18n();
	const [colors, setColors] = useState<EffectColors>(() => ({
		...DEFAULT_EFFECT_COLORS,
		...(initialColors || {}),
		enabled: initialColors?.enabled ?? true,
	}));
	const [presetGroup, setPresetGroup] = useState<string | null>(null);
	const selectedGroup = useMemo(
		() => EFFECT_COLOR_PRESET_GROUPS.find((group) => group.name === presetGroup),
		[presetGroup]
	);
	const swatch = getEffectColorSwatch(colors);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose]);

	const update = (patch: Partial<EffectColors>) => setColors((current) => ({ ...current, ...patch }));

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-[230] flex items-center justify-center bg-background/70 p-5 backdrop-blur-md"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<motion.div
				initial={{ opacity: 0, scale: 0.97, y: 10 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.97, y: 10 }}
				className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-sidebar shadow-2xl"
			>
				<div className="flex items-start justify-between gap-4 border-b p-4">
					<div className="min-w-0">
						<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
							<PaletteIcon className="h-4 w-4" /> {t("Preset effect colors")}
						</div>
						<h2 className="mt-1 truncate font-serif text-2xl text-foreground">{modName}</h2>
						<p className="mt-1 text-xs text-muted-foreground">{t("Saved only inside this preset until the preset is applied.")}</p>
					</div>
					<Button className="h-9 w-9 shrink-0 p-0" variant="ghost" onClick={onClose}>
						<XIcon className="h-4 w-4" />
					</Button>
				</div>

				<div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3">
							<div>
								<div className="text-sm font-bold text-accent">{t("Effect colors")}</div>
								<div className="text-[10px] text-muted-foreground">{t("Stored for this mod in this preset")}</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									className="h-8 px-3 text-xs"
									variant="ghost"
									onClick={() => setColors({ ...DEFAULT_EFFECT_COLORS })}
								>
									{t("Default")}
								</Button>
								<Button
									className="h-8 min-w-16 justify-center"
									onClick={() => update({ enabled: !colors.enabled })}
									style={{ color: colors.enabled ? "var(--background)" : "", backgroundColor: colors.enabled ? "var(--accent)" : "" }}
								>
									{colors.enabled ? t("On") : t("Off")}
								</Button>
							</div>
						</div>

						{[
							{
								values: [
									[t("Red"), "red", "#ff6f6f"],
									[t("Green"), "green", "#7dff9f"],
									[t("Blue"), "blue", "#75baff"],
								] as const,
							},
							{
								values: [
									["R+", "redOffset", "#ff6f6f"],
									["G+", "greenOffset", "#7dff9f"],
									["B+", "blueOffset", "#75baff"],
								] as const,
							},
						].map((section, sectionIndex) => (
							<div key={sectionIndex} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2 rounded-lg border bg-background/35 p-3 text-xs">
								{section.values.map(([label, key, color]) => (
									<div key={key} className="contents">
										<span className="w-10 text-muted-foreground">{label}</span>
										<input
											type="range"
											min="0"
											max="1"
											step="0.01"
											value={colors[key]}
											onChange={(event) => update({ [key]: Number(event.currentTarget.value), enabled: true })}
											className="w-full accent-[var(--accent)]"
											style={{ accentColor: color }}
										/>
										<span className="w-9 text-right font-semibold text-accent">{colors[key].toFixed(2)}</span>
									</div>
								))}
							</div>
						))}

						<div className="flex items-center gap-3 rounded-lg border bg-background/35 p-3">
							<div className="h-12 w-20 shrink-0 rounded-md border" style={{ backgroundColor: swatch, boxShadow: `0 0 18px ${swatch}` }} />
							<div className="text-[11px] leading-relaxed text-muted-foreground">
								{t("RGB multiplies the original effect color. Offset adds extra tint and intensity.")}
							</div>
						</div>
					</div>

					<div className="flex min-h-0 flex-col rounded-lg border bg-background/25 p-3">
						{selectedGroup ? (
							<>
								<div className="mb-3 flex items-center justify-between gap-3">
									<Button className="h-8" variant="ghost" onClick={() => setPresetGroup(null)}>
										<ArrowLeftIcon className="h-4 w-4" /> {t("Themes")}
									</Button>
									<div className="text-sm font-bold text-accent">{selectedGroup.name}</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									{selectedGroup.presets.map((preset) => (
										<button
											key={preset.name}
											className="flex min-h-12 items-center gap-3 rounded-lg border bg-background/35 px-3 py-2 text-left duration-200 hover:border-accent hover:bg-background/60"
											onClick={() => update({ ...preset.values, enabled: true })}
										>
											<span className="h-5 w-5 shrink-0 rounded-full border" style={{ backgroundColor: preset.color, boxShadow: `0 0 10px ${preset.color}` }} />
											<span className="text-xs font-semibold text-foreground">{preset.name}</span>
										</button>
									))}
								</div>
							</>
						) : (
							<>
								<div className="mb-3">
									<div className="text-sm font-bold text-accent">{t("Color presets")}</div>
									<div className="text-[10px] text-muted-foreground">{t("Choose a theme, then choose a ready-made color.")}</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									{EFFECT_COLOR_PRESET_GROUPS.map((group) => (
										<button
											key={group.name}
											className="rounded-lg border bg-background/35 p-3 text-left duration-200 hover:border-accent hover:bg-background/60"
											onClick={() => setPresetGroup(group.name)}
										>
											<div className="text-sm font-bold text-foreground">{group.name}</div>
											<div className="mt-2 flex gap-1">
												{group.presets.slice(0, 6).map((preset) => (
													<span key={preset.name} className="h-3 w-3 rounded-full border" style={{ backgroundColor: preset.color }} />
												))}
											</div>
										</button>
									))}
								</div>
							</>
						)}
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 border-t p-4">
					<p className="text-xs text-muted-foreground">{t("Default removes this preset's color override for the mod.")}</p>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={onClose}>{t("Cancel")}</Button>
						<Button onClick={() => onSave(colors)}>{t("Save to preset")}</Button>
					</div>
				</div>
			</motion.div>
		</motion.div>
	);
}

export default PresetColorEditorModal;
