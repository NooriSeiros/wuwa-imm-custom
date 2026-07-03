import React from "react";
import { Label } from "@/components/ui/label";
import { LOCAL_SPECIAL_CATEGORIES } from "@/utils/consts";
import { getImageUrl, handleImageError, handleInAppLink, join } from "@/utils/utils";
import {
	CheckIcon,
	ChevronDownIcon,
	EyeIcon,
	HeartIcon,
	MinusIcon,
	PinIcon,
	SwordsIcon,
	UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, DATA, MOD_LIST, openConflict, SELECTED, TEST_PIN_STATE, TEXT_DATA } from "@/utils/vars";
import { useAtomValue, useSetAtom } from "jotai";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { changeModName, saveConfigs, toggleTestPinnedMod } from "@/utils/filesys";
import { cn } from "@/lib/utils";

interface CardLocalProps {
	item: {
		path: string;
		name: string;
		enabled: boolean;
		isDir: boolean;
		parent?: string;
		depth?: number;
		tags?: string[];
		source?: string;
		crop?: {
			x?: number;
			y?: number;
			scale?: number;
			vertical?: boolean;
		};
	};
	selected: boolean;
	lastUpdated: number;
	hasUpdate: boolean;
	updateAvl: string;
	inConflict: number;
}

const CardLocal = React.memo(({ item, selected, lastUpdated, hasUpdate, updateAvl, inConflict }: CardLocalProps) => {
	const previewUrl = `${getImageUrl(item.path)}?${lastUpdated}`;
	const categories = useAtomValue(CATEGORIES);
	const moveCategories = [...categories, ...LOCAL_SPECIAL_CATEGORIES].filter(
		(category, index, list) => list.findIndex((item) => item._sName === category._sName) === index
	);
	const textData = useAtomValue(TEXT_DATA);
	const testPinState = useAtomValue(TEST_PIN_STATE);
	const setModList = useSetAtom(MOD_LIST);
	const setData = useSetAtom(DATA);
	const setSelected = useSetAtom(SELECTED);
	const tags = new Set(item.tags || []);
	const currentCategory = moveCategories.find((cat) => cat._sName === item.parent);

	const stopCardClick = (event: React.SyntheticEvent) => {
		event.stopPropagation();
	};

	const toggleFavorite = (event: React.MouseEvent) => {
		stopCardClick(event);
		const newTags = new Set(item.tags || []);
		if (newTags.has("fav")) newTags.delete("fav");
		else newTags.add("fav");

		setData((prev) => {
			prev[item.path] = {
				...prev[item.path],
				tags: Array.from(newTags),
			};
			return { ...prev };
		});
		setModList((prev) => prev.map((mod) => (mod.path === item.path ? { ...mod, tags: Array.from(newTags) } : mod)));
		saveConfigs();
	};

	const toggleNsfw = (event: React.MouseEvent) => {
		stopCardClick(event);
		const newTags = new Set(item.tags || []);
		if (newTags.has("nsfw")) newTags.delete("nsfw");
		else newTags.add("nsfw");

		setData((prev) => {
			prev[item.path] = {
				...prev[item.path],
				tags: Array.from(newTags),
			};
			return { ...prev };
		});
		setModList((prev) => prev.map((mod) => (mod.path === item.path ? { ...mod, tags: Array.from(newTags) } : mod)));
		saveConfigs();
	};

	const moveToCategory = (categoryName: string) => {
		if (!categoryName || categoryName === item.parent) return;
		const oldPath = item.path;
		changeModName(oldPath, join(categoryName, item.name))
			.then((newPath) => {
				if (!newPath) return;
				const name = newPath.split("\\").pop() || item.name;
				setModList((prev) =>
					prev.map((mod) => (mod.path === oldPath ? { ...mod, path: newPath, name, parent: categoryName } : mod))
				);
				setSelected((prev) => (prev === oldPath ? newPath : prev));
			})
			.catch(() => {});
	};

	return (
		<div
			className={`card-generic relative ${selected ? "selected-card" : ""}`}
			style={{
				borderColor: item.enabled ? "var(--accent)" : "",
			}}
		>
			<Button
				onMouseDown={stopCardClick}
				onMouseUp={stopCardClick}
				onClick={toggleFavorite}
				title={tags.has("fav") ? textData._Tags.RemFav : textData._Tags.AddFav}
				className="absolute right-2 top-2 z-20 h-9 w-9 rounded-full border bg-background/70 p-0 backdrop-blur hover:bg-background"
			>
				<HeartIcon
					className="h-4 w-4"
					style={{
						color: tags.has("fav") ? "var(--color-red-400)" : "",
						fill: tags.has("fav") ? "currentColor" : "none",
					}}
				/>
			</Button>
			{item.depth === 1 && (
				<Popover>
					<PopoverTrigger asChild>
						<Button
							onMouseDown={stopCardClick}
							onMouseUp={stopCardClick}
							onClick={stopCardClick}
							title="Move to character"
							className="absolute left-2 top-2 z-20 h-9 w-9 rounded-full border bg-background/70 p-0 backdrop-blur hover:bg-background"
						>
							<ChevronDownIcon className="h-4 w-4" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="z-[4000] w-80 p-0 my-2 border rounded-lg" onMouseUp={stopCardClick}>
						<Command>
							<CommandInput placeholder={textData.Search} className="h-12" />
							<CommandList>
								<CommandEmpty>{textData._RightSideBar._RightLocal.NoCat}</CommandEmpty>
								<CommandGroup>
									{moveCategories.map((cat) => (
										<CommandItem
											key={cat._sName}
											value={cat._sName}
											onSelect={(currentValue) => moveToCategory(currentValue)}
											className="button-like zzz-fg-text data-zzz:mt-1"
										>
											<img
												className="aspect-square outline bg-accent/10 flex items-center justify-center h-12 text-white rounded-full pointer-events-none"
												onError={(event) => {
													event.currentTarget.src = "/who.jpg";
												}}
												src={cat._sIconUrl || "err"}
											/>
											<div className="w-35 min-w-fit text-ellipsis overflow-hidden break-words">{cat._sName}</div>
											<CheckIcon
												className={cn("ml-auto", currentCategory?._sName === cat._sName ? "opacity-100" : "opacity-0")}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			)}
			<img
				style={{ filter: item.enabled ? "brightness(1) blur(8px) " : " blur(8px) brightness(0.5) saturate(0.5)" }}
				className="fadein object-cover w-full h-full pointer-events-none"
				src={previewUrl}
				onError={(e) => handleImageError(e, true)}
			/>

			<div className="relative w-full fadein h-[calc(100%-2.5rem)] flex items-center justify-center -mt-[calc(var(--card-height)-2px)] duration-200 rounded-t-lg data-gi:rounded-none pointer-events-none overflow-hidden">
				<img
					style={{
						filter: item.enabled ? "brightness(1)" : "brightness(0.5) saturate(0.5)",
						left: `${-(item.crop?.x || 0)}px`,
						top: `${-(item.crop?.y || 0)}px`,
						scale: item.crop?.scale || 1,
						minWidth: item.crop?.vertical ? "14rem" : "fit-content",
						minHeight: item.crop?.vertical ? "fit-content" : "18rem",
					}}
					className="w-full h-full relative object-cover object-center"
					src={previewUrl}
					onError={(e) => handleImageError(e)}
				/>
			</div>
			<div
				className="bg-background/50 rounded-b-xl data-zzz:rounded-bl-3xl fadein backdrop-blur
			 flex items-center w-full min-h-10 gap-2 px-3 header-img"
			>
				<Button
					onMouseDown={stopCardClick}
					onMouseUp={stopCardClick}
					onClick={toggleNsfw}
					title={tags.has("nsfw") ? textData._Tags.UnmarkNSFW : textData._Tags.MarkNSFW}
					className="max-h-8 max-w-8 -ml-2 -mr-1 flex-col"
					style={{
						color: tags.has("nsfw") ? "var(--color-yellow-200)" : "",
					}}
				>
					<EyeIcon className="h-3.5 w-3.5" />
					<MinusIcon
						className="scale-x-170 -mt-6 rotate-45 duration-300"
						style={{
							scale: tags.has("nsfw") ? "1.7 1" : "0 1",
						}}
					/>
				</Button>
				{inConflict >= 0 && (
					<Button
						onMouseDown={() => {
							openConflict(inConflict);
						}}
						variant="ghost"
						className="max-h-8 max-w-8 -ml-1 -mr-1"
					>
						<SwordsIcon className="text-destructive h-4" />
					</Button>
				)}
				<Label
					className="text-ellipsis min-w-0 flex-1 overflow-hidden border-0 text-xs pointer-events-none select-none"
					style={{ backgroundColor: "#fff0", filter: item.enabled ? "brightness(1)" : "brightness(0.5) saturate(0.5)" }}
				>
					{item.name}
				</Label>
				{item.depth === 1 && !tags.has("cycler") && (
					<Button
						onMouseDown={stopCardClick}
						onMouseUp={stopCardClick}
						onClick={async (event) => {
							stopCardClick(event);
							await toggleTestPinnedMod(item.path);
						}}
						title={testPinState.path === item.path ? "Clear temporary test pin" : "Temporarily pin this Normal mod"}
						className="max-h-8 max-w-8 -mr-1"
						style={{
							color: testPinState.path === item.path ? "var(--accent)" : "",
							backgroundColor: testPinState.path === item.path ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "",
						}}
					>
						<PinIcon
							className="h-4 w-4"
							style={{ fill: testPinState.path === item.path ? "currentColor" : "none" }}
						/>
					</Button>
				)}
			</div>
			{item?.source && hasUpdate && (
				<div
					className="fadein backdrop-blur -mt-[calc(var(--card-height)-2px)]
			 flex items-center w-full h-8 bg-background/50 pointer-events-none duration-200 justify-center border-y header-img"
				>
					{" "}
					<div className="absolute h-full w-full bgx-flash pointer-events-none" />
					<div
						onMouseDown={() => {
							handleInAppLink(item.source || "");
						}}
						className="pointer-events-auto h-8 absolute  textx-flash w-full rounded-none text-xs hover:text-background flex items-center justify-center gap-1 cursor-pointer"
					>
						<UploadIcon className="h-4" /> {updateAvl}
					</div>
				</div>
			)}
		</div>
	);
});

CardLocal.displayName = "CardLocal";

export default CardLocal;
