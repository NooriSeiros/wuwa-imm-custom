import { Sidebar, SidebarContent, SidebarFooter, SidebarGroupLabel } from "@/components/ui/sidebar";
import { Globe, HardDriveDownload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	CURRENT_PRESET,
	GAME,
	LEFT_SIDEBAR_OPEN,
	LEFT_SIDEBAR_WIDTH,
	MOD_LIST,
	ONLINE,
	SETTINGS,
	TEXT_DATA,
} from "@/utils/vars";
import { AnimatePresence, motion } from "motion/react";
import LeftOnline from "./LeftOnline";
import LeftLocal from "./LeftLocal";
import { GAME_NAMES, ONLINE_TRANSITION } from "@/utils/consts";
import { useInstalledItemsManager } from "@/utils/utils";
import Downloads from "./components/Downloads";
import OnlineInstalled from "./components/OnlineInstalled";
import BatchOperations from "./components/Batch";
import Restore from "./components/Restore";
import { Label } from "@/components/ui/label";
import { applyPreset, refreshModList, saveConfigs } from "@/utils/filesys";
import Remove from "./components/Remove";
import StartGameButton from "./components/StartGameButton";
import type { CSSProperties } from "react";

function LeftSidebar() {
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const leftSidebarWidth = useAtomValue(LEFT_SIDEBAR_WIDTH);
	const textData = useAtomValue(TEXT_DATA);
	const [online, setOnline] = useAtom(ONLINE);
	const game = useAtomValue(SETTINGS).global.game;
	const [settings, setSettings] = useAtom(SETTINGS);
	const setCurrentPreset = useSetAtom(CURRENT_PRESET);
	const setModList = useSetAtom(MOD_LIST);
	const setGame = useSetAtom(GAME);

	useInstalledItemsManager();

	return (
		<Sidebar
			collapsible="icon"
			className="pointer-events-auto pt-8"
			style={{ "--sidebar-width": `${leftSidebarWidth}px` } as CSSProperties}
		>
			<SidebarContent className="bg-sidebar bgpattern h-full gap-0 overflow-hidden border border-t-0">
				<div className="flex flex-col w-full max-h-full min-h-full">
					<div className="min-h-16 min-w-16 flex items-center justify-center h-16 gap-3 px-2 border-b">
						<StartGameButton showLabel={leftSidebarOpen} className={leftSidebarOpen ? "min-w-28 flex-1" : "min-w-10 w-10 p-0"} />
						<div
							id="IMMLogo"
							className="aspect-square logo h-10 duration-200"
							onClick={() => setGame("")}
							style={{
								opacity: leftSidebarOpen ? "" : "0",
								width: leftSidebarOpen ? "" : "0rem",
								marginLeft: leftSidebarOpen ? "" : "-0.75rem",
							}}
						/>
						<div
							className="max-w-28 font-en min-w-29 flex flex-col text-center duration-200 ease-linear"
							style={{
								marginRight: leftSidebarOpen ? "" : "-8.125rem",
								opacity: leftSidebarOpen ? "" : "0",
							}}
						>
							<label className="text-2xl text-[#eaeaea] min-w-fit">{GAME_NAMES[game] || "Integrated"}</label>
							<label className="min-w-fit text-accent textaccent text-sm opacity-75">Mod Manager</label>
						</div>
					</div>

					<div className="duration-200 px-0 w-full mt-2.5">
						<SidebarGroupLabel className="justify-between">
							{textData._LeftSideBar._Left.Mode}{" "}
							<div className="flex min-w-0 items-center gap-2">
								{!online && leftSidebarOpen && (
									<button
										onClickCapture={async () => {
											setCurrentPreset(-1);
											await applyPreset([]);
											setModList(await refreshModList());
										}}
										className="min-w-fit hover:text-accent cursor-pointerx active:scale-95 text-accent/60 text-[10px] duration-200 select-none"
									>
										{textData._LeftSideBar._LeftLocal._Presets.DisableAll}
									</button>
								)}
								<Label className="text-[10px] min-w-fit opacity-50 text-accent flex items-center">
									{textData._LeftSideBar._LeftOnline.Chk} :
									<Button
										onClick={() => {
											setSettings({
												...settings,
												global: {
													...settings.global,
													chkModUpdates: !settings.global.chkModUpdates,
												},
											});
											saveConfigs();
										}}
										style={{
											color: settings.global.chkModUpdates ? "var(--background)" : "",
											backgroundColor: settings.global.chkModUpdates ? "var(--accent)" : "",
										}}
										className="aspect-square pb-2.25 h-4 w-8 text-[10px]"
									>
										{settings.global.chkModUpdates ? "On" : "Off"}
									</Button>
								</Label>
							</div>
						</SidebarGroupLabel>
						<div
							className="min-h-fit grid justify-between w-full grid-cols-2 gap-2 px-2 overflow-hidden"
							style={{
								gridTemplateColumns: leftSidebarOpen ? "" : "repeat(1, minmax(0, 1fr))",
							}}
						>
							<Button
								onClick={() => {
									setOnline(false);
								}}
								className={
									"w-full overflow-hidden text-ellipsis " +
									(!online && "hover:brightness-125 bg-accent bgaccent text-background")
								}
							>
								<HardDriveDownload className="w-6 h-6" />
								{leftSidebarOpen && textData.Installed}
							</Button>
							<Button
								onClick={() => {
									setOnline(true);
								}}
								className={
									"w-full overflow-hidden text-ellipsis " +
									(online && "hover:brightness-125 bg-accent bgaccent  text-background")
								}
							>
								<Globe className="w-6 h-6" />
								{leftSidebarOpen && textData._LeftSideBar._Left.Online}
							</Button>
						</div>
					</div>

					<Separator
						className="w-full ease-linear duration-200 min-h-[1px] my-2.5 bg-border"
						style={{
							opacity: leftSidebarOpen ? "0" : "",
							height: leftSidebarOpen ? "0px" : "",
							marginBlock: leftSidebarOpen ? "4px" : "",
						}}
					/>
					<div className="flex flex-row w-full flex-1 min-h-0 max-h-full p-0 overflow-hidden">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.div
								{...ONLINE_TRANSITION(online)}
								key={online ? "online" : "local"}
								className=" flex flex-col max-w-full max-h-full min-w-full min-h-0"
							>
								{online ? <LeftOnline /> : <LeftLocal />}
							</motion.div>
						</AnimatePresence>
					</div>

					<Separator className="w-full ease-linear duration-200 min-h-[1px]  bg-border" />
					<SidebarFooter className="shrink-0 min-h-fit flex flex-col items-center justify-between w-full gap-2 overflow-visible pb-2 duration-200">
						{online && (
							<div className={`grid w-full gap-2 ${leftSidebarOpen ? "grid-cols-2" : "grid-cols-1"}`}>
								<div className="min-w-0"><Downloads /></div>
								<div className="min-w-0"><OnlineInstalled /></div>
							</div>
						)}
						<div className={`grid w-full gap-2 overflow-hidden duration-200 ${leftSidebarOpen ? "grid-cols-2" : "grid-cols-1"}`}>
							<BatchOperations leftSidebarOpen={leftSidebarOpen} />
							<Restore leftSidebarOpen={leftSidebarOpen} />
						</div>
						<Remove />
					</SidebarFooter>
				</div>
			</SidebarContent>
		</Sidebar>
	);
}

export default LeftSidebar;
