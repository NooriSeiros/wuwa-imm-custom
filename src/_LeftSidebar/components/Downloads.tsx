import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Check, Clock, DownloadIcon, FileQuestionIcon, FolderArchiveIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CATEGORIES, DATA, DOWNLOAD_LIST, GAME, LEFT_SIDEBAR_OPEN, MOD_LIST, TEXT_DATA } from "@/utils/vars";
import { formatBytes, sanitizeFileName } from "@/utils/utils";
import {
	cleanCancelledDownload,
	createModDownloadDir,
	refreshModList,
	saveConfigs,
	validateModDownload,
} from "@/utils/filesys";
import { DownloadItem } from "@/utils/types";
import { UNCATEGORIZED } from "@/utils/consts";
import { info } from "@/lib/logger";

let path = "";
let downloadElement: any = null;
let extracts = {} as any;
export function addToExtracts(key: string, element: any) {
	extracts[key] = element;
}
let prev = 0;
let prevText = " • ";
const Icons = {
	pending: <Clock className="min-h-4 min-w-4 max-w-4" />,
	downloading: <Loader2 className="min-h-4 min-w-4 max-w-4 animate-spin" />,
	completed: <Check className="min-h-4 min-w-4 max-w-4" />,
	failed: <X className="min-h-4 min-w-4 max-w-4 text-destructive" />,
	extracting: <FolderArchiveIcon className="min-h-4 min-w-4 max-w-4 animate-pulse" />,
};
function Downloads() {
	const textData = useAtomValue(TEXT_DATA);
	const [downloads, setDownloads] = useAtom(DOWNLOAD_LIST);
	const categories = useAtomValue(CATEGORIES);
	const [data, setData] = useAtom(DATA);
	const [dialogOpen, setDialogOpen] = useState(false);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const modList = useSetAtom(MOD_LIST);
	const game = useAtomValue(GAME);
	const downloadRef = useRef<HTMLDivElement>(null);
	const downloadRef2 = useRef<HTMLDivElement>(null);
	const downloadRef3 = useRef<HTMLDivElement>(null);
	const speedRef = useRef<HTMLDivElement>(null);
	const lastSpeedUpdate = useRef<number>(0);
	const downloadFile = async (item: DownloadItem) => {
		if (item.category == "Other/Misc") item.category = "Other";
		else if (!categories.find((cat) => cat._sName == item.category)) item.category = UNCATEGORIZED;
		item.name = sanitizeFileName(item.name);
		path = (await createModDownloadDir(item.category, item.name)) as string;
		downloadElement = {
			name: item.name,
			path: item.category + "\\" + item.name,
			source: item.source,
			fname: item.fname,
			category: item.category,
			updatedAt: item.updated * 1000,
			dlPath: path,
			key: `${item.name}_${item.file}_${item.fname}_${item.updated}`,
		};
		setData((prevData) => {
			if (downloadElement.path)
				prevData[downloadElement.path] = {
					source: downloadElement.source,
					updatedAt: prevData[downloadElement.path]?.updatedAt || -1,
					...prevData[downloadElement.path],
				};
			return { ...prevData };
		});
		saveConfigs();
		invoke("download_and_unzip", {
			fileName: item.name,
			downloadUrl: item.file,
			savePath: path,
			key: downloadElement.key,
			emit: true,
		});
		invoke("download_and_unzip", {
			fileName: "preview",
			downloadUrl: item.preview,
			savePath: path,
			key: "link_preview_" + item.name,
			emit: false,
		});
	};
	useEffect(() => {
		listen("download-progress", (event) => {
			const payload = event.payload as any;
			const total = payload.total as number;
			const downloaded = payload.downloaded as number;
			prev = ((downloaded / total) * 100).toFixed(2) as unknown as number;
			if (!downloadElement || payload.key !== downloadElement.key) return;
			prevText = ` • ${prev}% (${formatBytes(downloaded)}/${formatBytes(total)}) • ${payload.speed} • ${
				payload.eta
			} • `;
			// Debounce speed/ETA updates to 500ms
			const now = Date.now();
			if (now - lastSpeedUpdate.current >= 1000) {
				if (speedRef.current) speedRef.current.textContent = prevText;
				lastSpeedUpdate.current = now;
			}

			if (downloadRef.current) downloadRef.current.style.width = prev + "%";
			if (downloadRef2.current) downloadRef2.current.style.width = prev + "%";
			if (downloadRef3.current) {
				downloadRef3.current.style.background =
					"conic-gradient( var(--accent) 0% " + prev + "%, var(--button) 0% 100%)";
			}
		});
		listen("ext", (event) => {
			const payload = event.payload as any;
			if (!downloadElement || payload.key !== downloadElement.key) return;
			path = "";
			prev = 0;
			prevText = " • ";
			if (speedRef.current) speedRef.current.textContent = " • ";
			if (downloadRef.current) downloadRef.current.style.width = "0%";
			if (downloadRef2.current) downloadRef2.current.style.width = "0%";
			if (downloadRef3.current) {
				downloadRef3.current.style.background = "conic-gradient( var(--accent) 0% 0%, var(--button) 0% 100%)";
			}
			setDownloads((prev) => {
				return {
					...prev,
					downloading: null,
					extracting: [...(prev.extracting || []), downloadElement],
				};
			});
			extracts[payload.key] = {
				...downloadElement,
			};
			downloadElement = null;
		});
		listen("fin", async (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			info("[IMM] Extraction finished for key:", key);
			const type = payload.type || ("auto" as string);
			if (extracts[key] && type == "auto") {
				const finishedElement = extracts[key];
				delete extracts[key];
				await validateModDownload(finishedElement.dlPath);
				setData((prev) => {
					if (finishedElement.path)
						prev[finishedElement.path] = {
							...prev[finishedElement.path],
							source: finishedElement.source,
							updatedAt: finishedElement.updatedAt || Date.now(),
							viewedAt: Date.now(),
						};
					return { ...prev };
				});
				setDownloads((prev) => {
					return {
						...prev,
						completed: [...(prev.completed || []), finishedElement],
						extracting: prev.extracting?.filter((item: any) => item.key !== key) || [],
					};
				});
				modList(await refreshModList());
				saveConfigs();
				return;
			} else if (extracts[key] && type == "manual") {
				const finishedElement = extracts[key];
				await validateModDownload(finishedElement.dlPath, true);
				setDownloads((prev) => {
					return {
						...prev,
						completed: [...(prev.completed || []), finishedElement],
						extracting: prev.extracting?.filter((item: any) => item.key !== key) || [],
					};
				});
			}
			return;
		});
	}, []);
	useEffect(() => {
		path = "";
		downloadElement = null;
		prev = 0;
		prevText = " • ";
	}, [game]);
	useEffect(() => {
		if (downloads && downloads.queue.length < 1) return;
		if (path !== "") return;
		if (!downloads.downloading || Object.keys(downloads.downloading).length < 1) {
			let item = downloads.queue[0];
			let name = item.name;
			let count = 0;
			let category = item.category;
			for (let key in data) {
				//info(data[key].source, item.source);
				if (data[key].source == item.source) {
					count++;
					name = key.split("\\")[1];
					category = key.split("\\")[0];
				}
			}
			if (count == 1 && !item.addon) {
				item.name = name;
				item.category = category;
			}
			setDownloads((prev) => {
				return {
					...prev,
					queue: downloads.queue.slice(1),
					downloading: item,
				};
			});
			downloadFile(item as DownloadItem);
		}
	}, [downloads, path]);
	const clearCompleted = () => {
		setDownloads((prev) => ({ ...prev, completed: [] }));
	};
	const cancelExtract = (key: string) => {
		invoke("cancel_extract", { key }).then(() => {
			setDownloads((prev) => {
				return {
					...prev,
					extracting: prev.extracting?.filter((item) => item.key !== key) || [],
				};
			});
		});
	};
	const cancelDownload = (index: number) => {
		if (index == 0 && downloads?.downloading && Object.keys(downloads.downloading).length > 0) {
			invoke("get_username").then((_) => {
				cleanCancelledDownload(path);
				path = "";
				downloadElement = null;
				prev = 0;
				prevText = " • ";
				setDownloads((prev) => {
					return {
						...prev,
						downloading: null,
					};
				});
			});
			return;
		}
		index =
			index -
			(downloads?.downloading && Object.keys(downloads.downloading).length > 0 ? 1 : 0) -
			downloads.extracting.length;
		const type = index < downloads?.queue.length ? "queue" : "completed";
		index = type == "queue" ? index : index - downloads.queue.length;
		setDownloads((prev) => ({
			...prev,
			[type]: prev[type].filter((_: any, i: number) => i !== index),
		}));
	};
	const done = downloads?.completed?.length || 0;
	let downloadList = [];
	if (downloads?.downloading && Object.keys(downloads.downloading).length > 0)
		downloadList.push({ ...downloads.downloading, status: "downloading" });
	if (downloads?.extracting)
		downloadList = [...downloadList, ...downloads.extracting.map((item) => ({ ...item, status: "extracting" }))];
	if (downloads?.queue)
		downloadList = [...downloadList, ...downloads.queue.map((item) => ({ ...item, status: "pending" }))];
	if (downloads?.completed)
		downloadList = [...downloadList, ...downloads.completed.map((item) => ({ ...item, status: "completed" }))];
	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				{
					<Button
						className="text-ellipsis min-h-12 max-h-12 min-w -80 flex flex-col items-center w-full px-0 overflow-hidden"
						style={{ width: leftSidebarOpen ? "" : "3rem" }}
					>
						{leftSidebarOpen ? (
							downloadList.length > 0 ? (
								<>
									<div className="fade-in min-h-12 flex flex-col items-center justify-center w-full overflow-hidden rounded-md pointer-events-none">
										<div
											ref={downloadRef}
											key={"down" + JSON.stringify(downloadList[0])}
											className="min-h-12 height-in zzz-rounded bg-accent bgaccent text-background hover:brightness-125 z-10 flex flex-col self-start justify-center -mb-12 overflow-hidden rounded-lg"
											style={{ width: prev + "%" }}
										>
											<div className="min-w-79 fade-in flex items-center justify-center gap-1 pointer-events-none">
												{Icons[downloadList[0].status as keyof typeof Icons] || (
													<FileQuestionIcon className="min-h-4 min-w-4" />
												)}
												<Label className="min-w-2 max-w-71.5 w-fit py-2 pr-2" style={{ backgroundColor: "#fff0" }}>
													{downloadList[0].status == "downloading"
														? `${textData._LeftSideBar._components._Downloads.Downloading} ${done + 1}/${
																downloadList.length
															}`
														: `${textData._LeftSideBar._components._Downloads.Downloaded} ${done}/${downloadList.length}`}
												</Label>
											</div>
										</div>
										<div
											key={"down2" + JSON.stringify(downloadList[0])}
											className="fade-in min-h-12 flex items-center justify-center w-full gap-1 pointer-events-none"
										>
											{Icons[downloadList[0].status as keyof typeof Icons] || (
												<FileQuestionIcon className="min-h-4 min-w-4" />
											)}
											<Label className=" w-fit max-w-72 pr-2 pointer-events-none">
												{downloadList[0].status == "downloading"
													? `${textData._LeftSideBar._components._Downloads.Downloading} ${done + 1}/${
															downloadList.length
														}`
													: `${textData._LeftSideBar._components._Downloads.Downloaded} ${done}/${downloadList.length}`}
											</Label>
										</div>
									</div>
								</>
							) : (
								<div className="fade-in min-h-12 flex items-center justify-center w-full gap-1 pl-2 pointer-events-none">
									<DownloadIcon className="min-h-4 min-w-4" />
									<Label className=" w-fit max-w-72 pr-2 pointer-events-none">{textData.Downloads}</Label>
								</div>
							)
						) : downloadList.length > 0 ? (
							<>
								<div
									ref={downloadRef3}
									className="min-h-12 min-w-12 max-w-12 max-h-12 flex items-center justify-center p-1 rounded-lg"
									style={{
										background: "conic-gradient( var(--accent) 0% " + prev + "%, var(--button) 0% 100%)",
										transition: "minHeight 0.3s, margin-bottom 0.3s, height 0.3s",
									}}
								>
									<Label className=" bg-button zzz-rounded zzz-fg-text text-accent flex items-center justify-center w-full h-full rounded-md pointer-events-none">{`${
										done + (downloadList[0].status == "downloading" ? 1 : 0)
									}/${downloadList.length}`}</Label>
								</div>
							</>
						) : (
							<div className="min-h-12 min-w-12 flex items-center justify-center rounded-md">
								<DownloadIcon className="min-h-4 min-w-4" />
							</div>
						)}
					</Button>
				}
			</DialogTrigger>
			<DialogContent className="min-w-180 min-h-150">
				<div className="min-h-fit text-accent my-6 text-3xl">{textData.Downloads}</div>
				<div className="h-116 flex flex-col items-center w-full gap-4 p-0">
					<div className="flex justify-between w-full">
						<div className="text-accent text-lg">{`${textData._LeftSideBar._components._Downloads.Queue} (${downloadList.length})`}</div>
						<Button
							variant="outline"
							size="sm"
							onClick={clearCompleted}
							style={{ backgroundColor: "#0000" }}
							disabled={!downloadList.some((item) => item.status === "completed" || item.status === "failed")}
						>
							{textData._LeftSideBar._components._Downloads.Clear}
						</Button>
					</div>
					<div className="data-wuwa:gap-0 data-wuwa:border flex flex-col w-full h-full gap-2 overflow-y-auto text-gray-300 border-0 rounded-sm">
						{downloadList.length > 0 ? (
							<>
								{
									<div
										className="button-like zzz-fg-text data-gi:rounded-sm duration-0 min-h-16 data-wuwa:-mb-16 -mb-18 data-wuwa:border-b flex items-center w-full h-16 min-w-0 overflow-hidden"
										style={{
											opacity: downloadList[0].status === "downloading" ? 1 : 0,
										}}
									>
										<div
											key={"cur" + JSON.stringify(downloadList[0])}
											ref={downloadRef2}
											className="bg-accent bgaccent data-zzz:zzz-rounded zzz-fg-text data-gi:rounded-sm duration-0 min-h-16 flex items-center w-0 h-16 min-w-0 opacity-50"
											style={{ width: prev + "%" }}
										></div>
									</div>
								}
								{downloadList.map((item, index) => (
									<div
										key={item.name.replaceAll("DISABLED_", "") + index}
										className="hover:bg-background/20 zzz-fg-text data-gi:border-1 data-gi:rounded-sm min-h-16 data-wuwa:border-b button-like flex items-center justify-between w-full px-4"
										style={{ backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150" }}
									>
										<div className=" flex items-center flex-1 w-full gap-3">
											{Icons[item.status as keyof typeof Icons] || <FileQuestionIcon className="min-h-4 min-w-4" />}
											<div className="flex flex-col flex-1 w-full">
												<Label
													className="focus:border-0 border-border/0 max-w-142 text-ellipsis w-full h-8 overflow-hidden text-white rounded-none cursor-default pointer-events-none"
													style={{ backgroundColor: "#fff0" }}
												>
													{item.name.replaceAll("DISABLED_", "")}
												</Label>
												<div className="flex gap-1 text-xs text-gray-400 capitalize">
													{`${item.status + (item.status === "extracting" ? ` ${item.fname}` : "")}`}
													<div ref={index == 0 ? speedRef : null}>{index == 0 ? prevText : " • "}</div>
													{item.category}
												</div>
											</div>
										</div>
										<div className="flex items-center gap-2 z-20">
											{item.status === "pending" ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => cancelDownload(index)}
													className="hover:text-destructive"
												>
													<X className="w-4 h-4" />
												</Button>
											) : item.status === "completed" || item.status === "failed" ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => cancelDownload(index)}
													className="hover:text-gray-300 data-zzz:border-0 text-gray-400"
												>
													<X className="w-4 h-4" />
												</Button>
											) : item.status === "downloading" ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => cancelDownload(index)}
													className="hover:text-destructive"
												>
													<X className="w-4 h-4" />
												</Button>
											) : item.status === "extracting" ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => cancelExtract(item.key || "")}
													className="hover:text-destructive"
												>
													<X className="w-4 h-4" />
												</Button>
											) : (
												<></>
											)}
										</div>
									</div>
								))}
							</>
						) : (
							<div className="flex items-center justify-center h-full text-gray-400">
								{textData._LeftSideBar._components._Downloads.NoQ}
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
export default Downloads;
