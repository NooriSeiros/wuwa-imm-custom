import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	IMPORT_MISSING_ITEMS,
	INSTALLED_ITEMS,
	LEFT_SIDEBAR_OPEN,
	ONLINE,
	ONLINE_SELECTED,
	RIGHT_SLIDEOVER_OPEN,
	TEXT_DATA,
} from "@/utils/vars";
import { modRouteFromURL } from "@/utils/utils";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AlertTriangleIcon, EyeIcon, FolderCheckIcon, PackageCheckIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";

function OnlineInstalled() {
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<"updates" | "missing">("updates");
	const installedItems = useAtomValue(INSTALLED_ITEMS);
	const [missingItems, setMissingItems] = useAtom(IMPORT_MISSING_ITEMS);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const textData = useAtomValue(TEXT_DATA);
	const setOnline = useSetAtom(ONLINE);
	const setSelected = useSetAtom(ONLINE_SELECTED);
	const setRightSlideOverOpen = useSetAtom(RIGHT_SLIDEOVER_OPEN);

	const openItem = (item: (typeof installedItems)[number]) => {
		if (!item.source) return;
		setOnline(true);
		setSelected(modRouteFromURL(item.source));
		setRightSlideOverOpen(true);
		setOpen(false);
	};

	const openMissingItem = (item: (typeof missingItems)[number]) => {
		if (!item.source) return;
		const route = modRouteFromURL(item.source);
		if (!route) return;
		setOnline(true);
		setSelected(route);
		setRightSlideOverOpen(true);
		setOpen(false);
	};

	const statusIcon = (status: number) =>
		status === 2 ? (
			<UploadIcon className="h-4 w-4 shrink-0" />
		) : status === 1 ? (
			<EyeIcon className="h-4 w-4 shrink-0" />
		) : (
			<FolderCheckIcon className="h-4 w-4 shrink-0" />
		);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					className="min-h-12 max-h-12 flex w-full items-center justify-center gap-2 overflow-hidden px-2"
					style={{ width: leftSidebarOpen ? "" : "3rem" }}
					title={textData.Installed}
				>
					<PackageCheckIcon className="h-4 w-4 shrink-0" />
					{leftSidebarOpen && (
						<Label className="pointer-events-none truncate">
							{textData.Installed} ({installedItems.length}
							{missingItems.length ? ` + ${missingItems.length} missing` : ""})
						</Label>
					)}
				</Button>
			</DialogTrigger>
			<DialogContent className="min-w-180 min-h-150">
				<div className="my-6 flex min-h-fit items-center gap-3 text-3xl text-accent">
					<PackageCheckIcon className="h-7 w-7" />
					{textData.Installed}
				</div>
				<div className="mb-4 grid grid-cols-2 gap-2">
					<Button
						onClick={() => setTab("updates")}
						className={`h-10 ${tab === "updates" ? "bg-accent text-background hover:bg-accent" : "bg-input/50"}`}
					>
						Updates / Installed
					</Button>
					<Button
						onClick={() => setTab("missing")}
						className={`h-10 ${tab === "missing" ? "bg-accent text-background hover:bg-accent" : "bg-input/50"}`}
					>
						Missing from import ({missingItems.length})
					</Button>
				</div>
				<div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
					{tab === "updates" ? (
						<>
							<span className="flex items-center gap-1">
								<UploadIcon className="h-4 w-4" />
								{installedItems.filter((item) => item.modStatus === 2).length}
							</span>
							<span className="flex items-center gap-1">
								<EyeIcon className="h-4 w-4" />
								{installedItems.filter((item) => item.modStatus === 1).length}
							</span>
							<span className="flex items-center gap-1">
								<FolderCheckIcon className="h-4 w-4" />
								{installedItems.filter((item) => item.modStatus === 0).length}
							</span>
						</>
					) : (
						<>
							<span className="flex items-center gap-1">
								<AlertTriangleIcon className="h-4 w-4" />
								{missingItems.length} imported mod(s) not found in your Mods folder
							</span>
							{missingItems.length > 0 && (
								<Button className="ml-auto h-7 px-2 text-xs" onClick={() => setMissingItems([])}>
									Clear list
								</Button>
							)}
						</>
					)}
				</div>
				<div className="thin flex max-h-116 flex-col gap-2 overflow-y-auto pr-1">
					{tab === "updates" ? (
						installedItems.length ? (
						installedItems.map((item) => (
							<Button
								key={item.name}
								onClick={() => openItem(item)}
								disabled={!item.source}
								className="min-h-12 w-full justify-start gap-2 overflow-hidden bg-input/50 px-3 text-accent hover:bg-input/80"
								style={{
									background:
										item.modStatus === 2 ? "color-mix(in oklab, var(--accent) 20%, transparent)" : "",
								}}
							>
								{statusIcon(item.modStatus)}
								<span className="truncate">{item.name.split("\\").slice(-1)[0]}</span>
							</Button>
						))
						) : (
							<div className="flex h-40 items-center justify-center text-muted-foreground">No installed online mods.</div>
						)
					) : missingItems.length ? (
						missingItems.map((item) => (
							<div
								key={item.path}
								className="flex min-h-14 items-center gap-2 overflow-hidden rounded-lg border bg-input/30 px-3 text-accent"
							>
								<AlertTriangleIcon className="h-4 w-4 shrink-0 text-destructive" />
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-semibold">{item.name || item.path.split("\\").slice(-1)[0]}</div>
									<div className="truncate text-xs text-muted-foreground">{item.parent || item.path}</div>
								</div>
								<Button
									onClick={() => openMissingItem(item)}
									disabled={!modRouteFromURL(item.source || "")}
									className="h-8 shrink-0 px-3 text-xs"
								>
									Open online
								</Button>
								<Button
									onClick={() => setMissingItems((prev) => prev.filter((missing) => missing.path !== item.path))}
									className="h-8 w-8 shrink-0 p-0"
									title="Remove from missing list"
								>
									<Trash2Icon className="h-4 w-4" />
								</Button>
							</div>
						))
					) : (
						<div className="flex h-40 items-center justify-center text-muted-foreground">
							No missing mods from imported configs.
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default OnlineInstalled;
