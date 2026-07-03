import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarContent, SidebarGroupLabel } from "@/components/ui/sidebar";
import {
	GAME,
	CATEGORIES,
	LEFT_SIDEBAR_OPEN,
	ONLINE_PATH,
	ONLINE_SORT,
	ONLINE_TYPE,
	TEXT_DATA,
	TYPES,
} from "@/utils/vars";
import { useAtom, useAtomValue } from "jotai";
import {
	AppWindowIcon,
	BotIcon,
	ShieldQuestion,
	ShirtIcon,
	ShoppingBagIcon,
	SearchIcon,
	SwordsIcon,
	UserIcon,
	VenetianMaskIcon,
	XIcon,
} from "lucide-react";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { eventMatchesCustomHotkey } from "@/utils/customHotkeys";
import { useCustomI18n } from "@/utils/customI18n";

const iconMap: { [key: string]: JSX.Element } = {
	Skin: <ShirtIcon className="w-6 h-6" />,
	Characters: <UserIcon className="w-6 h-6" />,
	Operators: <UserIcon className="w-6 h-6" />,
	Bangboo: <BotIcon className="w-6 h-6" />,
	UI: <AppWindowIcon className="w-6 h-6" />,
	Other: <ShieldQuestion className="w-6 h-6" />,
	Weapons: <SwordsIcon className="w-6 h-6" />,
	Objects: <ShoppingBagIcon className="w-6 h-6" />,
	Entity: <VenetianMaskIcon className="w-6 h-6" />,
};
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
function LeftOnline() {
	const t = useCustomI18n();
	const textData = useAtomValue(TEXT_DATA);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const types = useAtomValue(TYPES);
	const categories = useAtomValue(CATEGORIES);
	const onlineType = useAtomValue(ONLINE_TYPE);
	const [onlinePath, setOnlinePath] = useAtom(ONLINE_PATH);
	const onlineSort = useAtomValue(ONLINE_SORT);
	const game = useAtomValue(GAME);
	const [characterSearchOpen, setCharacterSearchOpen] = useState(false);
	const [characterSearchTerm, setCharacterSearchTerm] = useState("");
	const [selectedLetter, setSelectedLetter] = useState("");
	const characterSearchInputRef = useRef<HTMLInputElement | null>(null);
	const characterTags = useMemo(
		() =>
			categories
				.map((category) => ({
					name: category._sName,
					image: category._sIconUrl || "",
					path: `Skins/${category._sName}&_sort=${onlineSort}`,
				}))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[categories, onlineSort]
	);
	const getTagLetter = (name: string) => (/^[A-Z]/i.test(name) ? name[0].toUpperCase() : "");
	const availableLetters = useMemo(
		() => ALPHABET.filter((letter) => characterTags.some((tag) => getTagLetter(tag.name) === letter)),
		[characterTags]
	);
	const visibleCharacterTags = useMemo(
		() => (selectedLetter ? characterTags.filter((tag) => getTagLetter(tag.name) === selectedLetter) : characterTags),
		[characterTags, selectedLetter]
	);
	const characterSearchResults = useMemo(() => {
		const term = characterSearchTerm.trim().toLowerCase();
		const list = [...characterTags];
		return (term ? list.filter((tag) => tag.name.toLowerCase().includes(term)) : list).slice(0, 24);
	}, [characterTags, characterSearchTerm]);

	const openCharacter = (tag: (typeof characterTags)[number]) => {
		setOnlinePath(tag.path);
		setCharacterSearchOpen(false);
		setCharacterSearchTerm("");
	};

	useEffect(() => {
		if (selectedLetter && !availableLetters.includes(selectedLetter)) setSelectedLetter("");
	}, [availableLetters, selectedLetter]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (eventMatchesCustomHotkey(event, "characterSearch")) {
				event.preventDefault();
				setCharacterSearchOpen(true);
				return;
			}
			if (!characterSearchOpen) return;
			if (event.key === "Escape") {
				event.preventDefault();
				setCharacterSearchOpen(false);
				setCharacterSearchTerm("");
			}
			if (event.key === "Enter" && characterSearchResults[0]) {
				event.preventDefault();
				openCharacter(characterSearchResults[0]);
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [characterSearchOpen, characterSearchResults]);

	useEffect(() => {
		if (!characterSearchOpen) return;
		const timeout = window.setTimeout(() => characterSearchInputRef.current?.focus(), 0);
		return () => window.clearTimeout(timeout);
	}, [characterSearchOpen]);
	return (
		<>
			{characterSearchOpen && (
				<div className="fixed inset-0 z-[220] flex items-center justify-center bg-background/65 p-6 backdrop-blur-md">
					<div className="w-full max-w-3xl rounded-xl border bg-sidebar p-4 shadow-2xl">
						<div className="mb-3 flex items-center justify-between gap-3">
							<div>
								<p className="text-accent text-[10px] font-bold tracking-[0.2em] uppercase">{t("Characters A-Z")}</p>
								<h2 className="font-serif text-2xl text-accent">{t("Go to character")}</h2>
							</div>
							<Button
								onClick={() => {
									setCharacterSearchOpen(false);
									setCharacterSearchTerm("");
								}}
								className="h-9 w-9 p-0"
							>
								<XIcon className="h-4 w-4" />
							</Button>
						</div>
						<div className="button-like flex h-12 items-center overflow-hidden rounded-lg border bg-background/40 px-3">
							<SearchIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
							<Input
								ref={characterSearchInputRef}
								value={characterSearchTerm}
								placeholder={t("Type a character name...")}
								className="h-10 flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
								onChange={(event) => setCharacterSearchTerm(event.target.value)}
							/>
						</div>
						<div className="mt-4 grid max-h-[54vh] grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3 overflow-y-auto pr-1">
							{characterSearchResults.map((tag) => (
								<button
									key={`gamebanana-search-${tag.path}`}
									onClick={() => openCharacter(tag)}
									className="group flex min-h-16 items-center gap-3 rounded-lg border bg-background/30 p-2 text-left duration-200 hover:border-accent hover:bg-background/60"
								>
									<img
										src={tag.image || "/who.jpg"}
										draggable={false}
										onError={(event) => {
											event.currentTarget.src = "/who.jpg";
										}}
										className="h-12 w-12 rounded-md border bg-sidebar object-cover"
									/>
									<p className="min-w-0 truncate text-sm font-bold text-foreground group-hover:text-accent">
										{tag.name}
									</p>
								</button>
							))}
						</div>
						<div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
							<span>{t("Enter opens the first result")}</span>
							<span>{t("Esc closes")}</span>
						</div>
					</div>
				</div>
			)}
			<div
				className={`thin flex min-h-0 w-full flex-1 flex-col p-0 ${leftSidebarOpen ? "overflow-hidden" : "overflow-y-auto"}`}
				style={{
					maxHeight: leftSidebarOpen ? "" : "calc(100vh - 29.66rem)",
					minHeight: 0,
				}}
			>
				<SidebarGroupLabel className="h-6">{textData._LeftSideBar._LeftOnline.Type}</SidebarGroupLabel>
				<div
					className="grid w-full shrink-0 grid-cols-2 items-center justify-center gap-2 px-2 pb-2"
					style={{
						gridTemplateColumns: leftSidebarOpen
							? game == "WW"
								? "repeat(3, minmax(0, 1fr))"
								: ""
							: "repeat(1, minmax(0, 1fr))",
					}}
				>
					{types.map((category) => {
						return (
							<div key={"filter-wrap-" + category._sName} className="flex w-full items-center justify-center">
								<Button
									key={"filter" + category._sName}
									id={"type " + category._sName}
									onClick={() => {
										if (onlinePath.startsWith(category._sName)) {
											setOnlinePath("home&type=" + onlineType);
											return;
										}
										setOnlinePath(`${category._sName}&_sort=${onlineSort}`);
									}}
									className={
										"w-full min-w-fit justify-start	 " +
										(onlinePath.startsWith(category._sName) && " bg-accent bgaccent   text-background")
									}
									style={{
										width: leftSidebarOpen ? "" : "2.5rem",
										paddingInline: leftSidebarOpen ? "" : "4px",
										justifyContent: leftSidebarOpen ? "start" : "center",
									}}
								>
									{game == "GI" ? (
										<img
											src={category._sIconUrl}
											className="aspect-square w-8 h-8 duration-200"
											style={{
												filter: onlinePath.startsWith(category._sName) ? "invert(1) hue-rotate(180deg)" : "",
											}}
										/>
									) : (
										iconMap[category._sName] || <ShieldQuestion className="w-6 h-6" />
									)}

									{leftSidebarOpen && <label className="w-full text-center"> {t(category._sName)}</label>}
								</Button>
							</div>
						);
					})}
				</div>
				{leftSidebarOpen && (
					<>
						<SidebarGroupLabel className="h-6">
							<button
								type="button"
								className="text-left duration-200 hover:text-accent"
								onClick={() => setCharacterSearchOpen(true)}
								title={t("Open character search")}
							>
								{t("Characters")}
							</button>
						</SidebarGroupLabel>
						<div className="flex flex-nowrap items-center gap-0.5 overflow-hidden px-2 pb-2">
							{availableLetters.map((letter) => (
								<button
									type="button"
									key={`gamebanana-letter-${letter}`}
									onClick={() => setSelectedLetter((current) => (current === letter ? "" : letter))}
									className={
										"h-5 min-w-[0.72rem] rounded-sm border px-[1px] text-[8px] leading-none duration-200 hover:border-accent hover:bg-accent hover:text-background " +
										(selectedLetter === letter ? "border-accent bg-accent text-background" : "bg-sidebar text-accent")
									}
									title={`${t("Show characters starting with this letter")}: ${letter}`}
								>
									{letter}
								</button>
							))}
						</div>
						<SidebarContent className="grid min-h-0 flex-1 content-start grid-cols-2 gap-2 overflow-y-auto px-2 pb-2 pt-1">
							{visibleCharacterTags.map((tag) => (
								<Button
									key={tag.path}
									className={
										"relative h-20 overflow-hidden justify-start p-0 border " +
										(onlinePath.split("&_sort=")[0] === tag.path.split("&_sort=")[0]
											? "bg-accent bgaccent text-background"
											: "bg-input/40")
									}
									onClick={() => setOnlinePath(tag.path)}
									title={tag.name}
								>
									{tag.image && (
										<img
											src={tag.image}
											draggable={false}
											className="absolute inset-0 h-full w-full object-cover opacity-70"
											onError={(event) => {
												event.currentTarget.style.display = "none";
											}}
										/>
									)}
									<div className="absolute inset-x-0 bottom-0 bg-background/65 px-2 py-1 text-left text-xs font-semibold backdrop-blur">
										{tag.name}
									</div>
								</Button>
							))}
						</SidebarContent>
					</>
				)}
			</div>
		</>
	);
}

export default LeftOnline;
