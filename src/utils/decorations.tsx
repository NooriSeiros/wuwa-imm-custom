import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAtom, useAtomValue } from "jotai";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, MinusIcon, PaletteIcon, RectangleHorizontalIcon, XIcon } from "lucide-react";
import { INIT_DONE, LEFT_SIDEBAR_OPEN, ONLINE, RIGHT_SIDEBAR_OPEN, RIGHT_SIDEBAR_WIDTH, RIGHT_SLIDEOVER_OPEN } from "./vars";
import Help from "@/_Main/components/Help";
import Updater from "@/_Main/components/Updater";
import Settings from "@/_LeftSidebar/components/Settings";
import { getSavedWuWaElementTheme, switchWuWaElementTheme, WUWA_ELEMENT_THEMES, type WuWaElementTheme } from "./theme";
import { useEffect, useState } from "react";
// import { createPortal } from "react-dom";
const appWindow = getCurrentWindow();

function ThemePicker() {
	const [theme, setTheme] = useState<WuWaElementTheme>(() => getSavedWuWaElementTheme());

	useEffect(() => {
		switchWuWaElementTheme(theme);
	}, [theme]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button title="Themes" className="w-4 h-4 rounded-sm border">
					<PaletteIcon className="max-h-3" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="game-font z-5000 w-44 border bg-sidebar">
				<DropdownMenuLabel className="text-accent">Themes</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{WUWA_ELEMENT_THEMES.map((item) => (
					<DropdownMenuItem
						key={item.value}
						onClick={() => setTheme(item.value)}
						className="flex cursor-pointer items-center justify-between gap-2"
					>
						<span className="flex flex-col leading-tight">
							<span>{item.label}</span>
							<span className="text-[0.65rem] opacity-60">{item.hint}</span>
						</span>
						{theme === item.value && <CheckIcon className="size-3 text-accent" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function Decorations() {
	const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(LEFT_SIDEBAR_OPEN);
	const [rightSidebarOpen, setRightSidebarOpen] = useAtom(RIGHT_SIDEBAR_OPEN);
	const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(RIGHT_SLIDEOVER_OPEN);
	const rightSidebarWidth = useAtomValue(RIGHT_SIDEBAR_WIDTH);
	const online = useAtomValue(ONLINE);
	const initDone = useAtomValue(INIT_DONE)
	return (
		
			<div
			data-tauri-drag-region
			className="game-font pointer-events-auto z-2000 bg-sidebar fixed top-0 left-0 right-0 flex items-center w-screen h-8 border-b select-none"
		>
			<div className=" flex items-center w-full h-full pointer-events-none">
				<div
					className="flex items-center h-full gap-1 -mr-2 text-xs duration-200 pointer-events-none"
					style={{
						minWidth: "3.75rem",
						justifyContent: "center",
					}}
				>
					<Button
						onClick={(e) => {
							e.stopPropagation();
							setLeftSidebarOpen((prev: boolean) => !prev);
						}}
						className="flex items-center justify-center w-4 h-4 gap-0 pointer-events-auto"
					>
						<ArrowLeftIcon
							className=" pointer-events-none max-h-3.5 duration-200 stroke-1"
							style={{
								width: leftSidebarOpen ? "1.5rem" : "0rem",
							}}
						/>
						<ArrowRightIcon
							className=" pointer-events-none max-h-3.5 duration-200 stroke-1"
							style={{
								width: leftSidebarOpen ? "0rem" : "1.5rem",
							}}
						/>
					</Button>
				</div>
				<div className="flex items-center justify-between w-full h-full overflow-hidden">
					<div className="min-w-16 h-1"></div>
					<div style={{
						marginLeft: rightSidebarOpen?"":"6.5rem"
					}} className="flex items-center justify-center h-full gap-1">
						<Updater/>
					</div>

					{initDone ? <Help /> : <div></div>}
				</div>
				<div
					style={{
						minWidth: rightSidebarOpen ? `${Math.max(24, rightSidebarWidth - 75)}px` : "1.5rem",
					}}
					className="flex items-center justify-start mx-1 duration-200"
				>
					<Button
						onClick={(e) => {
							e.stopPropagation();
							online ? setRightSlideOverOpen((prev: boolean) => !prev) : setRightSidebarOpen((prev: boolean) => !prev);
						}}
						className="flex items-center justify-center w-4 h-4 gap-0 pointer-events-auto"
					>
						<ArrowRightIcon
							className=" pointer-events-none max-h-3.5 duration-200 stroke-1"
							style={{
								width: (online ? rightSlideOverOpen : rightSidebarOpen) ? "1.5rem" : "0rem",
							}}
						/>
						<ArrowLeftIcon
							className=" pointer-events-none max-h-3.5 duration-200 stroke-1"
							style={{
								width: (online ? rightSlideOverOpen : rightSidebarOpen) ? "0rem" : "1.5rem",
							}}
						/>
					</Button>
				</div>
			</div>
			<div className="flex gap-1 z-200 pointer-events-auto px-1">
				<ThemePicker />
				<Settings leftSidebarOpen={false} compact className="rounded-sm border" />
				<Button onClick={() => appWindow.minimize()} variant="warn" className="w-4 h-4">
					<MinusIcon className="max-h-3" />
				</Button>
				<Button onClick={() => appWindow.toggleMaximize()} variant="success" className="w-4 h-4">
					<RectangleHorizontalIcon className="max-h-3 scale-x-80" />
				</Button>
				<Button onClick={() => appWindow.close()} variant="destructive" className="w-4 h-4">
					<XIcon className="max-h-3" />
				</Button>
			</div>
			{/* <div className="titlebar-button" id="titlebar-minimize">
				<img src="https://api.iconify.design/mdi:window-minimize.svg" alt="minimize" />
			</div>
			<div className="titlebar-button" id="titlebar-maximize">
				<img src="https://api.iconify.design/mdi:window-maximize.svg" alt="maximize" />
			</div>
			<div className="titlebar-button" id="titlebar-close">
				<img src="https://api.iconify.design/mdi:close.svg" alt="close" />
			</div> */}
		</div>
	);
}

export default Decorations;
