import { useEffect, useState } from "react";
import { Carousel as CarouselCN, CarouselContent, CarouselItem } from "@/components/ui/carousel";
// import { OnlineModImage } from "@/utils/types";
import type { EmblaCarouselType } from "embla-carousel";

function Carousel({ data, big }: { data: any[]; big?: boolean }) {
	big = big || false;
	const w = big ? "45rem" : "12.5rem";
	const [current, setCurrent] = useState(0);
	const [api, setApi] = useState<EmblaCarouselType | undefined>();
	useEffect(() => {
		if (!api) return;
		const onSelect = () => {
			setCurrent(api.selectedScrollSnap());
		};
		api.on("select", onSelect);
		return () => {
			api.off("select", onSelect);
		};
	}, [api]);
	return (
		<>
			<CarouselCN
				setApi={setApi}
				opts={{ loop: true }}
				className="aspect-video min-w-full max-w-full min-h-[calc(100%-4rem)] overflow-hidden  pointer-events-none rounded-lg"
			>
				<CarouselContent className="aspect-video min-w-full min-h-full">
					{data?.map((item, index) => (
						<CarouselItem key={index} className="flex flex-col overflow-hidden">
							<div className=" flex flex-col overflow-hidden border rounded-lg">
								<div
									onClick={(e) => {
										if (e.target != e.currentTarget) return;
									}}
									className=" aspect-video ml-4 -mb-[55%] flex blur-md flex-col pointer-events-auto items-center justify-between overflow-hidden rounded-lg"
									style={{
										backgroundImage: `url(${item._sBaseUrl + "/" + item._sFile})`,
										backgroundSize: "cover",
										backgroundPosition: "center",
										backgroundRepeat: "no-repeat",
									}}
								/>
								<div
									onClick={(e) => {
										if (e.target != e.currentTarget) return;
									}}
									className=" aspect-video z-20 flex flex-col items-center justify-between overflow-hidden rounded-lg pointer-events-auto"
									style={{
										backgroundImage: `url(${item._sBaseUrl + "/" + item._sFile})`,
										backgroundSize: "contain",
										backgroundPosition: "center",
										backgroundRepeat: "no-repeat",
									}}
								/>
							</div>
						</CarouselItem>
					))}
				</CarouselContent>
			</CarouselCN>
			<div
				className="flex flex-wrap items-center min-w-full justify-center min-h-fit gap-0.5 rounded-lg pointer-events-none"
				style={{
					width: w,
				}}
			>
				{data?.map((_, index) => (
					<div
						className={
							"h-1/3 min-h-2.5 aspect-square pointer-events-auto rounded-full border duration-200 " +
							(index == current ? "bg-accent bgaccent   border-accent" : " hover:bg-border")
						}
						onClick={(e) => {
							e.stopPropagation();
							if (api) {
								api.scrollTo(index);
							}
						}}
					></div>
				))}
			</div>
		</>
	);
}
export default Carousel;
