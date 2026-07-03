import { addToast } from "@/_Toaster/ToastProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { launchGame } from "@/utils/init";
import { isGameProcessRunning } from "@/utils/autolaunch";
import { SETTINGS, TEXT_DATA } from "@/utils/vars";
import { useAtomValue } from "jotai";
import { PlayIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function StartGameButton({ showLabel, className }: { showLabel?: boolean; className?: string }) {
	const textData = useAtomValue(TEXT_DATA);
	const game = useAtomValue(SETTINGS).global.game;
	const [running, setRunning] = useState(false);

	const refreshRunningState = useCallback(async () => {
		setRunning(await isGameProcessRunning(game));
	}, [game]);

	useEffect(() => {
		refreshRunningState();
		const interval = setInterval(refreshRunningState, 3000);
		return () => clearInterval(interval);
	}, [refreshRunningState]);

	const handleStart = async () => {
		const isRunningNow = await isGameProcessRunning(game);
		setRunning(isRunningNow);
		if (isRunningNow) {
			addToast({
				type: "info",
				message: "Game is already running",
			});
		} else {
			await launchGame();
		}
		setTimeout(refreshRunningState, 1500);
	};

	return (
		<Button
			onClick={handleStart}
			title={running ? "Game is running" : "Game is closed"}
			className={cn(
				"h-10 gap-2 overflow-hidden border font-bold duration-200",
				running
					? "border-emerald-300/70 bg-emerald-600/80 text-white hover:bg-emerald-500"
					: "border-red-300/70 bg-red-700/80 text-white hover:bg-red-600",
				className
			)}
		>
			<PlayIcon className="h-4 w-4" />
			{showLabel && <span className="truncate">{textData.Start}</span>}
		</Button>
	);
}

export default StartGameButton;
