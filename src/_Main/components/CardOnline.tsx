import React from "react";
import { EyeOffIcon, LoaderIcon, MessageSquareIcon, PlusIcon, ThumbsUpIcon } from "lucide-react";
import { getTimeDifference, handleImageError } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { CSS_CLASSES, COMMON_STYLES } from "@/utils/consts";
// import type { CardLocalProps } from "@/utils/types";

interface CardOnlineProps {
	_sName: string;
	_sModelName: string;
	_sInitialVisibility: string;
	_nLikeCount: number;
	_nPostCount?: number;
	_tsDateAdded?: number;
	_tsDateModified?: number;
	_aPreviewMedia?: {
		_aImages?: {
			_sBaseUrl: string;
			_sFile: string;
		}[];
	};
	blur?: boolean;
	now: number;
	show: string;
}

const Online = React.memo((data: CardOnlineProps) => {
	const backgroundImage = data._aPreviewMedia?._aImages?.[0]
		? `${data._aPreviewMedia._aImages[0]._sBaseUrl}/${data._aPreviewMedia._aImages[0]._sFile}`
		: "/err";

	return (
		<div className="card-generic card-online ">
			<div className="min-h-full static">
				<img
					className="fadein flex flex-col relative min-h-full top-0 items-center justify-center object-cover w-full duration-200 bg-center bg-no-repeat rounded-t-lg pointer-events-none"
					src={backgroundImage}
					onError={(e) => handleImageError(e,true)}
					style={{
						filter:
							data._sInitialVisibility === "hide" && data.blur === true ? "brightness(0.5) blur(4px)" : "brightness(1)",
					}}
				/>
				<img
					className="w-full fadein min-h-[calc(100%-3.5rem)] relative -translate-y-[100%] -top-14 duration-200 rounded-t-lg data-gi:rounded-none pointer-events-none object-cover fadein flex flex-col items-center justify-center bg-center bg-no-repeat"
					src={backgroundImage}
					onError={(e) => handleImageError(e)}
					style={{
						filter:
							data._sInitialVisibility === "hide" && data.blur === true ? "brightness(0.5) blur(4px)" : "brightness(1)",
					}}
				/>
			</div>
			{data._sInitialVisibility === "hide" && data.blur === true && (
				<div className="max-h-0 fadein mb-41 -mt-41 w-fit z-20 self-center">
					<Button
						className=" bg-background/50 duration-200 pointer-events-auto"
						onClick={(e) => {
							e.currentTarget.style.opacity = "0";
							e.currentTarget.style.pointerEvents = "none";
							let parent = e.currentTarget.parentElement?.previousSibling?.lastChild as HTMLElement;
							if (parent) {
								parent.style.filter = "brightness(1)";
							}
						}}
					>
						<EyeOffIcon /> {data.show}
					</Button>
				</div>
			)}
			<div
				className={`w-fit fadein bg-background/50 text-accent  backdrop-blur -mt-68 flex flex-col items-center px-4 py-1 mb-44 rounded-br-lg pointer-events-none`}
			>
				{data._sModelName}
			</div>

			<div className={`bg-background/50 fadein backdrop-blur flex flex-col items-center w-full px-4 py-1`}>
				<Input
					readOnly
					type="text"
					className="bg-semi w-56 cursor-pointerx select-none focus-within:select-auto overflow-hidden h-8 focus-visible:ring-[0px] border-0 text-ellipsis"
					defaultValue={data._sName}
				/>
				<div className="flex justify-between w-full h-6 text-xs">
					<label className="flex items-center justify-center">
						<PlusIcon className="h-4" />
						{getTimeDifference(data.now, data._tsDateAdded || 0)}
					</label>
					<label className="flex items-center justify-center">
						<LoaderIcon className="h-4" />
						{getTimeDifference(data.now, data._tsDateModified || 0)}
					</label>
					<label className="flex items-center justify-center">
						<ThumbsUpIcon className="h-4" />
						{data._nLikeCount || "0"}
					</label>
					<label className="flex items-center justify-center">
						<MessageSquareIcon className="h-4" />
						{data._nPostCount || "0"}
					</label>
				</div>
			</div>
		</div>
	);
});

Online.displayName = "CardOnline";

export default Online;
