import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UNCATEGORIZED } from "@/utils/consts";
import { eventMatchesCustomHotkey } from "@/utils/customHotkeys";
import { CATEGORIES, MOD_LIST, ONLINE, PREVIEW_CATEGORY, RECENT_CATEGORIES } from "@/utils/vars";
import { useAtom, useAtomValue } from "jotai";
import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCustomI18n } from "@/utils/customI18n";

function CharacterSearchModal() {
	const t = useCustomI18n();
	const online = useAtomValue(ONLINE);
	const categories = useAtomValue(CATEGORIES);
	const modList = useAtomValue(MOD_LIST);
	const [, setPreviewCategory] = useAtom(PREVIEW_CATEGORY);
	const [, setRecentCategories] = useAtom(RECENT_CATEGORIES);
	const [open, setOpen] = useState(false);
	const [term, setTerm] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);

	const characters = useMemo(() => {
		const knownCategories = categories
			.filter((cat) => modList.some((mod) => mod.parent === cat._sName))
			.map((cat) => ({
				name: cat._sName,
				icon: cat._sIconUrl,
				count: modList.filter((mod) => mod.parent === cat._sName).length,
			}));
		const uncategorized = modList.filter((mod) => mod.parent === UNCATEGORIZED);
		return [
			...(uncategorized.length
				? [{ name: UNCATEGORIZED, icon: "/icons/uncategorized.png", count: uncategorized.length }]
				: []),
			...knownCategories,
		].sort((a, b) => a.name.localeCompare(b.name));
	}, [categories, modList]);

	const results = useMemo(() => {
		const normalized = term.trim().toLowerCase();
		const filtered = normalized
			? characters.filter((character) => character.name.toLowerCase().includes(normalized))
			: characters;
		return filtered.slice(0, 18);
	}, [characters, term]);

	const openCharacter = (name: string) => {
		setPreviewCategory(name);
		setRecentCategories((prev) => [name, ...prev.filter((item) => item !== name)].slice(0, 10));
		setOpen(false);
		setTerm("");
	};

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (online) return;
			if (eventMatchesCustomHotkey(event, "characterSearch")) {
				event.preventDefault();
				setOpen(true);
				return;
			}
			if (!open) return;
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
				setTerm("");
			}
			if (event.key === "Enter" && results[0]) {
				event.preventDefault();
				openCharacter(results[0].name);
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [online, open, results]);

	useEffect(() => {
		if (!open) return;
		const handler = setTimeout(() => inputRef.current?.focus(), 0);
		return () => clearTimeout(handler);
	}, [open]);

	if (!open || online) return null;

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/65 p-6 backdrop-blur-md">
			<div className="w-full max-w-3xl rounded-xl border bg-sidebar p-4 shadow-2xl">
				<div className="mb-3 flex items-center justify-between gap-3">
					<div>
						<p className="text-accent text-[10px] font-bold tracking-[0.2em] uppercase">{t("Character search")}</p>
						<h2 className="text-2xl font-serif text-accent">{t("Go to character")}</h2>
					</div>
					<Button
						onClick={() => {
							setOpen(false);
							setTerm("");
						}}
						className="h-9 w-9 p-0"
					>
						<XIcon className="h-4 w-4" />
					</Button>
				</div>
				<div className="button-like flex h-12 items-center overflow-hidden rounded-lg border bg-background/40 px-3">
					<SearchIcon className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
					<Input
						ref={inputRef}
						value={term}
						placeholder={t("Type a character name...")}
						className="h-10 flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
						onChange={(event) => setTerm(event.target.value)}
					/>
				</div>
				<div className="mt-4 grid max-h-[54vh] grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3 overflow-y-auto pr-1">
					{results.map((character) => (
						<button
							key={`character-search-${character.name}`}
							onClick={() => openCharacter(character.name)}
							className="group flex min-h-16 items-center gap-3 rounded-lg border bg-background/30 p-2 text-left duration-200 hover:border-accent hover:bg-background/60"
						>
							<img
								src={character.icon || "/who.jpg"}
								onError={(event) => {
									event.currentTarget.src = "/who.jpg";
								}}
								className="h-12 w-12 rounded-md border bg-sidebar object-cover"
							/>
							<div className="min-w-0">
								<p className="truncate text-sm font-bold text-foreground group-hover:text-accent">{character.name}</p>
								<p className="text-[11px] text-muted-foreground">
									{character.count} {t("mods")}
								</p>
							</div>
						</button>
					))}
				</div>
				<div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
					<span>{t("Enter opens the first result")}</span>
					<span>{t("Esc closes")}</span>
				</div>
			</div>
		</div>
	);
}

export default CharacterSearchModal;
