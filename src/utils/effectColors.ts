export type EffectColors = {
	enabled: boolean;
	red: number;
	green: number;
	blue: number;
	redOffset: number;
	greenOffset: number;
	blueOffset: number;
};

export const DEFAULT_EFFECT_COLORS: EffectColors = {
	enabled: false,
	red: 1,
	green: 1,
	blue: 1,
	redOffset: 0,
	greenOffset: 0,
	blueOffset: 0,
};

export const EFFECT_COLOR_PRESET_GROUPS = [
	{
		name: "Dark",
		presets: [
			{ name: "Abyss Violet", color: "#7a35ff", values: { red: 0.18, green: 0, blue: 0.52, redOffset: 0.04, greenOffset: 0, blueOffset: 0.24 } },
			{ name: "Blood Moon", color: "#ff2447", values: { red: 0.58, green: 0, blue: 0.08, redOffset: 0.22, greenOffset: 0, blueOffset: 0.04 } },
			{ name: "Shadow Rose", color: "#d52b91", values: { red: 0.5, green: 0, blue: 0.35, redOffset: 0.13, greenOffset: 0, blueOffset: 0.14 } },
			{ name: "Poison Night", color: "#54ff83", values: { red: 0.02, green: 0.55, blue: 0.1, redOffset: 0, greenOffset: 0.22, blueOffset: 0.04 } },
			{ name: "Void Blue", color: "#2f5dff", values: { red: 0.02, green: 0.08, blue: 0.62, redOffset: 0, greenOffset: 0.02, blueOffset: 0.24 } },
			{ name: "Cursed Flame", color: "#ff4d18", values: { red: 0.7, green: 0.08, blue: 0, redOffset: 0.16, greenOffset: 0.02, blueOffset: 0 } },
			{ name: "Night Cyan", color: "#22d9ff", values: { red: 0, green: 0.38, blue: 0.55, redOffset: 0, greenOffset: 0.1, blueOffset: 0.18 } },
			{ name: "Witch Gold", color: "#d6a52b", values: { red: 0.55, green: 0.34, blue: 0, redOffset: 0.12, greenOffset: 0.08, blueOffset: 0 } },
		],
	},
	{
		name: "Bright",
		presets: [
			{ name: "Radiant Gold", color: "#ffe36a", values: { red: 1, green: 0.82, blue: 0.08, redOffset: 0.26, greenOffset: 0.2, blueOffset: 0.02 } },
			{ name: "Solar Flare", color: "#ff9f35", values: { red: 1, green: 0.42, blue: 0.02, redOffset: 0.28, greenOffset: 0.12, blueOffset: 0 } },
			{ name: "Fairy Cyan", color: "#62f2ff", values: { red: 0.05, green: 0.9, blue: 1, redOffset: 0, greenOffset: 0.22, blueOffset: 0.28 } },
			{ name: "Bloom Pink", color: "#ff70d7", values: { red: 1, green: 0.14, blue: 0.62, redOffset: 0.24, greenOffset: 0.03, blueOffset: 0.18 } },
			{ name: "Pure White", color: "#ffffff", values: { red: 1, green: 0.96, blue: 0.9, redOffset: 0.24, greenOffset: 0.24, blueOffset: 0.22 } },
			{ name: "Lime Burst", color: "#c8ff35", values: { red: 0.65, green: 1, blue: 0.04, redOffset: 0.16, greenOffset: 0.24, blueOffset: 0 } },
			{ name: "Neon Blue", color: "#2aa2ff", values: { red: 0.02, green: 0.42, blue: 1, redOffset: 0, greenOffset: 0.12, blueOffset: 0.3 } },
			{ name: "Cherry Pop", color: "#ff3f6c", values: { red: 1, green: 0.08, blue: 0.22, redOffset: 0.24, greenOffset: 0.02, blueOffset: 0.08 } },
		],
	},
	{
		name: "Elements",
		presets: [
			{ name: "Inferno", color: "#ff5d1d", values: { red: 1, green: 0.18, blue: 0, redOffset: 0.22, greenOffset: 0.05, blueOffset: 0 } },
			{ name: "Cryo Spark", color: "#73d9ff", values: { red: 0.04, green: 0.62, blue: 1, redOffset: 0, greenOffset: 0.16, blueOffset: 0.3 } },
			{ name: "Voltaic Arc", color: "#9d62ff", values: { red: 0.32, green: 0, blue: 1, redOffset: 0.08, greenOffset: 0, blueOffset: 0.26 } },
			{ name: "Aero Mint", color: "#55ffc9", values: { red: 0, green: 1, blue: 0.55, redOffset: 0, greenOffset: 0.2, blueOffset: 0.1 } },
			{ name: "Spectro Gold", color: "#ffe27a", values: { red: 1, green: 0.78, blue: 0.16, redOffset: 0.2, greenOffset: 0.16, blueOffset: 0.04 } },
			{ name: "Havoc Violet", color: "#8e38ff", values: { red: 0.38, green: 0, blue: 0.9, redOffset: 0.1, greenOffset: 0, blueOffset: 0.22 } },
			{ name: "Glacio Blue", color: "#5fbfff", values: { red: 0.02, green: 0.48, blue: 1, redOffset: 0, greenOffset: 0.1, blueOffset: 0.28 } },
			{ name: "Pneuma Green", color: "#6affb6", values: { red: 0.02, green: 1, blue: 0.42, redOffset: 0, greenOffset: 0.18, blueOffset: 0.08 } },
		],
	},
	{
		name: "Mixed",
		presets: [
			{ name: "Violet Frost", color: "#9c7dff", values: { red: 0.3, green: 0.12, blue: 1, redOffset: 0.08, greenOffset: 0.12, blueOffset: 0.24 } },
			{ name: "Blood Gold", color: "#ff7b38", values: { red: 1, green: 0.16, blue: 0.02, redOffset: 0.22, greenOffset: 0.14, blueOffset: 0 } },
			{ name: "Toxic Cyan", color: "#4dffbf", values: { red: 0, green: 1, blue: 0.55, redOffset: 0, greenOffset: 0.14, blueOffset: 0.2 } },
			{ name: "Rose Lightning", color: "#df66ff", values: { red: 0.8, green: 0.04, blue: 1, redOffset: 0.14, greenOffset: 0, blueOffset: 0.2 } },
			{ name: "Solar Ocean", color: "#42c8ff", values: { red: 0.08, green: 0.55, blue: 1, redOffset: 0.16, greenOffset: 0.12, blueOffset: 0.2 } },
			{ name: "Ember Violet", color: "#ff5fd2", values: { red: 1, green: 0.08, blue: 0.52, redOffset: 0.16, greenOffset: 0.02, blueOffset: 0.16 } },
			{ name: "Holy Venom", color: "#d6ff5c", values: { red: 0.45, green: 1, blue: 0.08, redOffset: 0.18, greenOffset: 0.18, blueOffset: 0 } },
			{ name: "Abyss Flame", color: "#b43bff", values: { red: 0.42, green: 0, blue: 0.85, redOffset: 0.18, greenOffset: 0.04, blueOffset: 0.16 } },
		],
	},
	{
		name: "Other",
		presets: [
			{ name: "Default", color: "#bbbbbb", values: { red: 1, green: 1, blue: 1, redOffset: 0, greenOffset: 0, blueOffset: 0 } },
			{ name: "Deep Ocean", color: "#248dff", values: { red: 0.02, green: 0.28, blue: 1, redOffset: 0, greenOffset: 0.06, blueOffset: 0.24 } },
			{ name: "Cyber Mint", color: "#4dffe6", values: { red: 0, green: 1, blue: 0.82, redOffset: 0, greenOffset: 0.16, blueOffset: 0.14 } },
			{ name: "Royal Violet", color: "#b04cff", values: { red: 0.58, green: 0, blue: 1, redOffset: 0.12, greenOffset: 0, blueOffset: 0.18 } },
			{ name: "Amber", color: "#ffb12e", values: { red: 1, green: 0.52, blue: 0.02, redOffset: 0.2, greenOffset: 0.1, blueOffset: 0 } },
			{ name: "Sakura", color: "#ff8fbd", values: { red: 1, green: 0.25, blue: 0.48, redOffset: 0.2, greenOffset: 0.06, blueOffset: 0.12 } },
			{ name: "Aquamarine", color: "#2effd0", values: { red: 0, green: 0.9, blue: 0.65, redOffset: 0, greenOffset: 0.18, blueOffset: 0.16 } },
			{ name: "Prismatic", color: "#c777ff", values: { red: 0.72, green: 0.22, blue: 1, redOffset: 0.12, greenOffset: 0.06, blueOffset: 0.18 } },
		],
	},
];

export function getEffectColorSwatch(colors: EffectColors) {
	return `rgb(${Math.round(Math.min(1, colors.red * 0.45 + colors.redOffset) * 255)}, ${Math.round(
		Math.min(1, colors.green * 0.45 + colors.greenOffset) * 255
	)}, ${Math.round(Math.min(1, colors.blue * 0.45 + colors.blueOffset) * 255)})`;
}
