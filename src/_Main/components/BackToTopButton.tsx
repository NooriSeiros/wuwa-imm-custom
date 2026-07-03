import { Button } from "@/components/ui/button";
import { useCustomI18n } from "@/utils/customI18n";
import { ArrowUpIcon } from "lucide-react";
import { useEffect, useState } from "react";

function findActiveScroller(root: HTMLElement | null) {
	if (!root) return null;
	return Array.from(root.querySelectorAll<HTMLElement>("[data-main-scroll]")).find(
		(element) => element.offsetParent !== null && element.clientHeight > 0
	) || null;
}

export default function BackToTopButton({ root }: { root: HTMLElement | null }) {
	const t = useCustomI18n();
	const [scroller, setScroller] = useState<HTMLElement | null>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!root) return;
		let current: HTMLElement | null = null;
		const updateVisibility = () => setVisible((current?.scrollTop || 0) > 360);
		const connect = () => {
			const next = findActiveScroller(root);
			if (next === current) return;
			current?.removeEventListener("scroll", updateVisibility);
			current = next;
			setScroller(next);
			current?.addEventListener("scroll", updateVisibility, { passive: true });
			updateVisibility();
		};
		connect();
		const observer = new MutationObserver(connect);
		observer.observe(root, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			current?.removeEventListener("scroll", updateVisibility);
		};
	}, [root]);

	return (
		<Button
			className={`absolute bottom-5 right-5 z-50 h-10 w-10 rounded-full border p-0 shadow-xl transition-all ${
				visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
			}`}
			aria-label={t("Back to top")}
			title={t("Back to top")}
			onClick={() => scroller?.scrollTo({ top: 0, behavior: "smooth" })}
		>
			<ArrowUpIcon className="h-4 w-4" />
		</Button>
	);
}
