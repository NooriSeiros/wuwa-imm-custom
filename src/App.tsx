import { useAtom, useAtomValue, useSetAtom } from "jotai";
import "./App.css";
import {
	CHANGES,
	ERR,
	GAME,
	INIT_DONE,
	LANG,
	LEFT_SIDEBAR_OPEN,
	LEFT_SIDEBAR_WIDTH,
	MOD_LIST,
	ONLINE,
	PREVIEW_CAPTURE_OVERLAY,
	PROGRESS_OVERLAY,
	RIGHT_SIDEBAR_OPEN,
	RIGHT_SIDEBAR_WIDTH,
	RIGHT_SLIDEOVER_OPEN,
	SETTINGS,
} from "./utils/vars";
import { AnimatePresence, motion } from "motion/react";
import Checklist from "./_Checklist/Checklist";
import { initializeThemes } from "./utils/theme";
import Changes from "./_Changes/Changes";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { refreshModList, saveConfigs } from "./utils/filesys";
import { SidebarProvider } from "./components/ui/sidebar";
import LeftSidebar from "./_LeftSidebar/Left";
import Main from "./_Main/Main";
import RightLocal from "./_RightSidebar/RightLocal";
import RightOnline from "./_RightSidebar/RightOnline";
import { main } from "./utils/init";
import ToastProvider from "./_Toaster/ToastProvider";
import Progress from "./_Progress/Progress";
import CapturePreviewModal from "./_Main/components/CapturePreviewModal";
import HotkeysOverlayWindow from "./_Main/components/HotkeysOverlayWindow";
import { initGlobalDragScroll } from "./utils/dragScroll";
// import { Button } from "./components/ui/button";

const IS_HOTKEYS_OVERLAY_WINDOW = new URLSearchParams(window.location.search).has("hotkeysOverlay");

initializeThemes();
if (!IS_HOTKEYS_OVERLAY_WINDOW) {
	main("", true);
}
const SIDEBAR_MIN_WIDTH = 260;
const SIDEBAR_MAX_WIDTH = 560;
const LEFT_SIDEBAR_COLLAPSED_WIDTH = 63.2;
const RIGHT_SIDEBAR_COLLAPSED_WIDTH = 0;

function clampSidebarWidth(width: number) {
	return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

function App() {
	if (IS_HOTKEYS_OVERLAY_WINDOW) {
		return <HotkeysOverlayWindow />;
	}

	const initDone = useAtomValue(INIT_DONE);
	const lang = useAtomValue(LANG);
	const err = useAtomValue(ERR);
	const online = useAtomValue(ONLINE);
	const captureOverlayActive = useAtomValue(PREVIEW_CAPTURE_OVERLAY);
	const game = useAtomValue(GAME);
	const changes = useAtomValue(CHANGES);
	const settings = useAtomValue(SETTINGS);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const [leftSidebarWidth, setLeftSidebarWidth] = useAtom(LEFT_SIDEBAR_WIDTH);
	// const setOnlineSelected = useSetAtom(ONLINE_SELECTED);
	const [rightSidebarOpen, setRightSidebarOpen] = useAtom(RIGHT_SIDEBAR_OPEN);
	const [rightSidebarWidth, setRightSidebarWidth] = useAtom(RIGHT_SIDEBAR_WIDTH);
	const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(RIGHT_SLIDEOVER_OPEN);
	const setModList = useSetAtom(MOD_LIST);
	const progressOverlay = useAtomValue(PROGRESS_OVERLAY);
	const [_, setShowModeSwitch] = useState(false);
	const [previousOnline, setPreviousOnline] = useState(online);
	const afterInit = useCallback(async () => {
		saveConfigs();
		setModList(await refreshModList());
		return Promise.resolve();
	}, []);
	useEffect(() => {
		if (err) {
			throw new Error(err);
		}
	}, [err]);
	useEffect(() => {
		document.body.classList.toggle("preview-capture-transparent", captureOverlayActive);
		return () => document.body.classList.remove("preview-capture-transparent");
	}, [captureOverlayActive]);
	useEffect(() => {
		return initGlobalDragScroll();
	}, []);
	useEffect(() => {
		if (previousOnline !== online) {
			setShowModeSwitch(true);
			setPreviousOnline(online);
			const timer2 = setTimeout(() => {
				setRightSidebarOpen(!online);
			}, 300);

			const timer = setTimeout(() => {
				setShowModeSwitch(false);
			}, 1000);

			return () => {
				clearTimeout(timer);
				clearTimeout(timer2);
			};
		}
		return undefined;
	}, [online]);
	const startSidebarResize = useCallback(
		(side: "left" | "right", event: ReactMouseEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();

			const startX = event.clientX;
			const startWidth = side === "left" ? leftSidebarWidth : rightSidebarWidth;
			const setWidth = side === "left" ? setLeftSidebarWidth : setRightSidebarWidth;

			document.body.classList.add("resizing-sidebar");
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = side === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
				setWidth(clampSidebarWidth(startWidth + delta));
			};

			const stopResize = () => {
				document.body.classList.remove("resizing-sidebar");
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", stopResize);
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", stopResize);
		},
		[leftSidebarWidth, rightSidebarWidth, setLeftSidebarWidth, setRightSidebarWidth]
	);
	const leftSidebarStyle = useMemo(
		() => ({
			width: `${leftSidebarOpen ? leftSidebarWidth : LEFT_SIDEBAR_COLLAPSED_WIDTH}px`,
			minWidth: `${leftSidebarOpen ? leftSidebarWidth : LEFT_SIDEBAR_COLLAPSED_WIDTH}px`,
		}),
		[leftSidebarOpen, leftSidebarWidth]
	);
	const rightSidebarStyle = useMemo(
		() => ({
			width: `${rightSidebarOpen ? rightSidebarWidth : RIGHT_SIDEBAR_COLLAPSED_WIDTH}px`,
			minWidth: `${rightSidebarOpen ? rightSidebarWidth : RIGHT_SIDEBAR_COLLAPSED_WIDTH}px`,
		}),
		[rightSidebarOpen, rightSidebarWidth]
	);
	const leftSidebarProviderStyle = useMemo(
		() => ({ "--sidebar-width": `${leftSidebarWidth}px` }) as CSSProperties,
		[leftSidebarWidth]
	);
	const rightSidebarProviderStyle = useMemo(
		() => ({ "--sidebar-width": `${rightSidebarWidth}px` }) as CSSProperties,
		[rightSidebarWidth]
	);
	return (
		<>
		<div
			id="background"
			className="game-font fixed border-b flex flex-row items-start justify-start w-full h-full"
			style={{
				opacity: captureOverlayActive ? 0 : 1,
				pointerEvents: captureOverlayActive ? "none" : "auto",
			}}
		>
			<div
				className="bg-bgg fixed w-screen h-screen"
				style={{
					opacity: (settings.global.bgOpacity || 1) * 0.1,
					animation: settings.global.bgType == 2 ? "moveDiagonal 15s linear infinite" : "",
					backgroundImage: settings.global.bgType == 0 ? "none" : "",
					backgroundRepeat: settings.global.bgType == 0 ? "no-repeat" : "",
				}}
			></div>
			<SidebarProvider open={leftSidebarOpen} style={leftSidebarProviderStyle}>
				<LeftSidebar />
			</SidebarProvider>
			<SidebarProvider open={rightSidebarOpen} style={rightSidebarProviderStyle}>
				<RightLocal />
			</SidebarProvider>
			<RightOnline open={online && rightSlideOverOpen} />
			{leftSidebarOpen && (
				<div
					data-side="left"
					className="sidebar-resize-handle pointer-events-auto fixed bottom-0 top-8 z-50 w-3 cursor-col-resize"
					style={{ left: `${leftSidebarWidth - 6}px` }}
					onMouseDown={(event) => startSidebarResize("left", event)}
				/>
			)}
			{rightSidebarOpen && (
				<div
					data-side="right"
					className="sidebar-resize-handle pointer-events-auto fixed bottom-0 top-8 z-50 w-3 cursor-col-resize"
					style={{ right: `${rightSidebarWidth - 6}px` }}
					onMouseDown={(event) => startSidebarResize("right", event)}
				/>
			)}
			<div className="fixed flex flex-row w-full h-full">
				<div className="h-full duration-200 ease-linear" style={leftSidebarStyle} />
				<Main />
				<div className="h-full duration-300 ease-linear" style={rightSidebarStyle} />
			</div>
			<div className="fixed flex flex-row w-full h-full pointer-events-none">
				<div className="h-full duration-200 ease-linear" style={leftSidebarStyle} />
				<AnimatePresence>
					{online && rightSlideOverOpen && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							onClick={() => setRightSlideOverOpen(false)}
							className="w-full pointer-events-auto h-full bg-background/40 backdrop-blur-[2px]"
						/>
					)}
				</AnimatePresence>
			</div>
			
			
			<div id="mods-progress-container" className="fixed pointer-events-none -bottom-12 duration-300 text-[8px] opacity-50 rounded-tl-md flex pl-2 gap-1.5 flex-row items-center right-0 h-8 w-72 bg-sidebar border z-10">
				Mods Checked :
				<div className="w-42 border flex h-4 rounded-sm overflow-hidden">
					<div id="mods-progress" className="bg-accent duration-100 h-full rounded-r-sm"></div>
				</div>
				<div className="flex font-en min-w-fit text-center flex-col">
					<label id="mods-checked">88</label>
					<div className="w-full h-[1px] bg-border rounded-full"></div>
					<label id="mods-total">9999</label>
				</div>
			</div>
			<AnimatePresence>{(!initDone || !lang || !game) && <Checklist />}</AnimatePresence>
			<AnimatePresence>{changes.title && <Changes afterInit={afterInit} />}</AnimatePresence>
			<AnimatePresence>{progressOverlay.open && <Progress />}</AnimatePresence>
			<ToastProvider />
		</div>
		<CapturePreviewModal />
		</>
	);
}
export default App;
