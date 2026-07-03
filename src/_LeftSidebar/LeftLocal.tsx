import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SidebarContent, SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UNCATEGORIZED } from "@/utils/consts";
import { CATEGORIES, FILTER, LEFT_SIDEBAR_OPEN, MOD_LIST, PREVIEW_CATEGORY, RECENT_CATEGORIES, TEXT_DATA } from "@/utils/vars";
import { Separator } from "@radix-ui/react-separator";
import { useAtom, useAtomValue } from "jotai";
import { CheckIcon, CircleIcon, Clock3Icon, XIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useCustomI18n } from "@/utils/customI18n";

function LeftLocal() {
	const t = useCustomI18n();
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const textData = useAtomValue(TEXT_DATA);
	const [filter, setFilter] = useAtom(FILTER);
	const modList = useAtomValue(MOD_LIST);
	const categories = useAtomValue(CATEGORIES);
	const [recentCategories, setRecentCategories] = useAtom(RECENT_CATEGORIES);
	const [previewCategory, setPreviewCategory] = useAtom(PREVIEW_CATEGORY);
	const filterParams = [
		{
			key: "src",
			sub: "",
			label: textData._RightSideBar._RightLocal.Source,
		},
		{
			key: "upd",
			sub: "",
			label: textData.Update,
		},
		{
			key: "tag",
			sub: "fav",
			label: textData._Tags.Favorite,
		},
		{
			key: "tag",
			sub: "nsfw",
			label: textData._Tags.NSFW,
		},
	];
	const filterFunction = useCallback(
		(key: string, val: string, subkey = "", reset = false) => {
			setFilter((prev: any) => {
				if (reset) {
					filterParams.forEach((item) => {
						if (item.sub) {
							prev[item.key][item.sub] = "any";
						} else {
							prev[item.key] = "any";
						}
					});
				}
				if (subkey && (reset || prev[key][subkey] !== val)) {
					prev[key][subkey] = val;
				} else if (!subkey && (reset || prev[key] !== val)) {
					prev[key] = val;
				} else {
					return prev;
				}
				return { ...prev };
			});
		},
		[filter, setFilter, filterParams]
	);
	const activeFilters = useMemo(() => {
		return Object.keys(filter).some((key) => {
			if (key === "st") return false;
			if (typeof filter[key as keyof typeof filter] === "string") {
				if (filter[key as keyof typeof filter] !== "any") return true;
			} else {
				if (Object.values(filter[key as keyof typeof filter] as Record<string, string>).some((v) => v !== "any"))
					return true;
			}
			return false;
		});
	}, [filter]);

	const recentItems = useMemo(
		() =>
			recentCategories
				.slice(0, 10)
				.map((name) => {
					const category = categories.find((cat) => cat._sName === name);
					const modsCount = modList.filter((mod) => mod.parent === name).length;
					if (!modsCount && name !== UNCATEGORIZED) return null;
					return {
						name,
						icon: category?._sIconUrl || (name === UNCATEGORIZED ? "/icons/uncategorized.png" : "/who.jpg"),
						modsCount,
					};
				})
				.filter(Boolean) as { name: string; icon: string; modsCount: number }[],
		[categories, modList, recentCategories]
	);

	return (
		<>
			<SidebarGroup className=" p-0">
				<SidebarGroupLabel className="justify-between">
					{textData._LeftSideBar._LeftLocal.Filter}
					<Dialog>
						<DialogTrigger>
							<div
								className="min-w-fit px-1 rounded hover:text-accent cursor-pointerx active:scale-95 text-accent/50 text-xs duration-200 select-none"
								style={{
									background: activeFilters ? "var(--accent)" : "",
									color: activeFilters ? "var(--background)" : "",
								}}
							>
								{textData._LeftSideBar._LeftLocal._Filter.Advanced}
							</div>
						</DialogTrigger>
						<DialogContent className="max-h-120 min-h-120">
							<div className="min-h-fit text-accent my-6 text-3xl">
								{textData._LeftSideBar._LeftLocal._Filter.AdvFilOpt}
								<Tooltip>
									<TooltipTrigger></TooltipTrigger>
									<TooltipContent className="opacity-0"></TooltipContent>
								</Tooltip>
							</div>

							<div className="flex flex-row mb-8 gap-4 items-center">
								{[
									{
										icon: <CircleIcon className="aspect-square h-4 text-accent" />,
										text: textData._LeftSideBar._LeftLocal._Filter.All,
									},
									{
										icon: <CheckIcon className="aspect-square h-4 text-success" />,
										text: textData._LeftSideBar._LeftLocal._Filter.Yes,
									},
									{
										icon: <XIcon className="aspect-square h-4 text-destructive" />,
										text: textData._LeftSideBar._LeftLocal._Filter.No,
									},
								].map((fil) => (
									<div key={fil.text} className="flex flex-row gap-1 items-center">
										{fil.icon}
										<label>{fil.text}</label>
									</div>
								))}
							</div>
							<div className="flex flex-row gap-4 items-center">
								<label className="min-w-24 text-center">{textData._LeftSideBar._LeftLocal._Filter.Enabled}</label>
								<div className="flex flex-row gap-1 w-full">
									{[
										{
											val: "all",
											icon: <CircleIcon className="aspect-square h-4" />,
										},
										{
											val: "enabled",
											icon: <CheckIcon className="aspect-square h-4" />,
										},
										{
											val: "disabled",
											icon: <XIcon className="aspect-square h-4" />,
										},
									].map((fil) => (
										<Button
											key={"filter " + fil.val}
											onClick={() => {
												filterFunction("st", fil.val);
											}}
											className={
												"w-25 data-zzz:text-xs " + (filter.st == fil.val ? "bg-accent bgaccent text-background " : "")
											}
											style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
										>
											{fil.icon}
										</Button>
									))}
								</div>
							</div>
							{filterParams.map((item) => {
								return (
									<div className="flex flex-row gap-4 items-center">
										<label className="min-w-24 text-center">{item.label}</label>
										<div className="flex flex-row gap-1 w-full">
											{[
												{
													val: "any",
													icon: <CircleIcon className="aspect-square h-4" />,
												},
												{
													val: "has",
													icon: <CheckIcon className="aspect-square h-4" />,
												},
												{
													val: "lacks",
													icon: <XIcon className="aspect-square h-4" />,
												},
											].map((fil) => (
												<Button
													key={"filter " + fil.val}
													onClick={() => {
														filterFunction(item.key, fil.val, item.sub);
													}}
													className={
														"w-25 data-zzz:text-xs " +
														((item.sub
															? (filter[item.key as keyof typeof filter] as Record<string, string>)[item.sub]
															: filter[item.key as keyof typeof filter]) === fil.val
															? "bg-accent bgaccent text-background "
															: "")
													}
													style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
												>
													{fil.icon}
												</Button>
											))}
										</div>
									</div>
								);
							})}
						</DialogContent>
					</Dialog>
				</SidebarGroupLabel>
				<SidebarContent
					className="grid w-full grid-cols-3 gap-2 px-2 overflow-hidden"
					style={{
						gridTemplateColumns: leftSidebarOpen ? "repeat(3, minmax(0, 1fr))" : "repeat(1, minmax(0, 1fr))",
					}}
				>
					{[
						{
							name: "all",
							icon: <CircleIcon className="aspect-square h-4" />,
							text: textData.All,
						},
						{
							name: "enabled",
							icon: <CheckIcon className="aspect-square h-4" />,
							text: textData._LeftSideBar._LeftLocal._Filter.Enabled,
						},
						{
							name: "disabled",
							icon: <XIcon className="aspect-square h-4" />,
							text: textData._LeftSideBar._LeftLocal._Filter.Disabled,
						},
					].map((fil) => (
						<Button
							key={"filter " + fil.name}
							onClick={() => {
								filterFunction("st", fil.name, "", true);
							}}
							className={
								"w-full min-w-0 data-zzz:text-xs " +
								(filter.st == fil.name && !activeFilters ? "bg-accent bgaccent text-background " : "")
							}
							style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
						>
							{fil.icon}
							{leftSidebarOpen && fil.text}
						</Button>
					))}
				</SidebarContent>
			</SidebarGroup>
			<Separator
				className="w-full ease-linear duration-200 min-h-px my-2.5 bg-border"
				style={{
					opacity: leftSidebarOpen ? "0" : "",
					height: leftSidebarOpen ? "0px" : "",
					marginBlock: leftSidebarOpen ? "4px" : "",
				}}
			/>
			<SidebarGroup className="">
				<SidebarGroupLabel className="flex items-center justify-between">
					<div className="flex items-center gap-1">
						<Clock3Icon className="w-3.5 h-3.5" />
						{leftSidebarOpen && t("Recently opened")}
					</div>
				</SidebarGroupLabel>
				<SidebarContent className="flex w-full flex-col gap-1 overflow-hidden px-2">
					{recentItems.length ? (
						recentItems.map((item) => (
							<Button
								key={`recent-character-${item.name}`}
								onClick={() => {
									setPreviewCategory(item.name);
									setRecentCategories((previous) => [item.name, ...previous.filter((name) => name !== item.name)].slice(0, 10));
								}}
								title={item.name}
								className={
									"justify-start min-h-10 h-10 overflow-hidden px-2 " +
									(previewCategory === item.name ? "bg-accent bgaccent text-background" : "")
								}
								style={{ width: leftSidebarOpen ? "" : "2.5rem", justifyContent: leftSidebarOpen ? "" : "center" }}
							>
								<img
									src={item.icon}
									onError={(event) => {
										event.currentTarget.src = "/who.jpg";
									}}
									className="min-w-6 w-6 h-6 rounded-full object-cover"
								/>
								{leftSidebarOpen && (
									<span className="flex min-w-0 flex-col text-left leading-tight">
										<span className="truncate">{item.name}</span>
										<span className="truncate text-[9px] opacity-65">{item.modsCount} {t("mods")}</span>
									</span>
								)}
							</Button>
						))
					) : (
						leftSidebarOpen && <div className="px-2 pb-1 text-[11px] text-muted-foreground">{t("Open a character to show it here.")}</div>
					)}
				</SidebarContent>
			</SidebarGroup>
		</>
	);
}

export default LeftLocal;
