const DRAG_THRESHOLD = 5;
const MOMENTUM_MIN_VELOCITY = 0.01;
const MOMENTUM_FRICTION = 0.975;
const MOMENTUM_BOOST = 2.1;
const MOMENTUM_MAX_VELOCITY = 3.5;
const VELOCITY_SAMPLE_WINDOW = 120;

const DRAG_SCROLL_IGNORE_SELECTOR = [
	"input",
	"textarea",
	"select",
	"option",
	"[contenteditable='true']",
	"[role='slider']",
	"[data-drag-scroll-ignore]",
	".sidebar-resize-handle",
].join(",");

function canScroll(element: HTMLElement) {
	const style = window.getComputedStyle(element);
	const overflowY = style.overflowY;
	const overflowX = style.overflowX;
	const canScrollY =
		element.scrollHeight > element.clientHeight + 1 && ["auto", "scroll", "overlay"].includes(overflowY);
	const canScrollX =
		element.scrollWidth > element.clientWidth + 1 && ["auto", "scroll", "overlay"].includes(overflowX);
	return canScrollY || canScrollX;
}

function findScrollableElement(start: EventTarget | null) {
	if (!(start instanceof HTMLElement)) return null;
	let current: HTMLElement | null = start;
	while (current && current !== document.body && current !== document.documentElement) {
		if (current.dataset.dragScroll === "off") return null;
		if (canScroll(current)) return current;
		current = current.parentElement;
	}
	return canScroll(document.documentElement) ? document.documentElement : null;
}

export function initGlobalDragScroll() {
	let momentumFrame: number | null = null;
	let drag:
		| {
				element: HTMLElement;
				pointerId: number;
				startX: number;
				startY: number;
				scrollLeft: number;
				scrollTop: number;
				lastScrollLeft: number;
				lastScrollTop: number;
				lastTime: number;
				velocityX: number;
				velocityY: number;
				samples: Array<{ time: number; scrollLeft: number; scrollTop: number }>;
				moved: boolean;
		  }
		| null = null;
	let suppressNextClick = false;
	let suppressNextMouseUp = false;

	const clearDrag = () => {
		drag = null;
		document.body.classList.remove("drag-scroll-active");
	};

	const cancelMomentum = () => {
		if (momentumFrame !== null) {
			cancelAnimationFrame(momentumFrame);
			momentumFrame = null;
		}
	};

	const startMomentum = (element: HTMLElement, velocityX: number, velocityY: number) => {
		cancelMomentum();
		velocityX = Math.max(-MOMENTUM_MAX_VELOCITY, Math.min(MOMENTUM_MAX_VELOCITY, velocityX));
		velocityY = Math.max(-MOMENTUM_MAX_VELOCITY, Math.min(MOMENTUM_MAX_VELOCITY, velocityY));
		if (Math.hypot(velocityX, velocityY) < MOMENTUM_MIN_VELOCITY) return;

		let lastTime = performance.now();
		const step = (now: number) => {
			const deltaTime = Math.min(32, Math.max(1, now - lastTime));
			lastTime = now;

			const previousLeft = element.scrollLeft;
			const previousTop = element.scrollTop;
			element.scrollLeft += velocityX * deltaTime;
			element.scrollTop += velocityY * deltaTime;

			if (element.scrollLeft === previousLeft) velocityX = 0;
			if (element.scrollTop === previousTop) velocityY = 0;

			const friction = Math.pow(MOMENTUM_FRICTION, deltaTime / 16);
			velocityX *= friction;
			velocityY *= friction;

			if (Math.hypot(velocityX, velocityY) < MOMENTUM_MIN_VELOCITY) {
				momentumFrame = null;
				return;
			}

			momentumFrame = requestAnimationFrame(step);
		};

		momentumFrame = requestAnimationFrame(step);
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		if (!(event.target instanceof HTMLElement)) return;
		if (event.target.closest(DRAG_SCROLL_IGNORE_SELECTOR)) return;

		const element = findScrollableElement(event.target);
		if (!element) return;
		cancelMomentum();

		drag = {
			element,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			scrollLeft: element.scrollLeft,
			scrollTop: element.scrollTop,
			lastScrollLeft: element.scrollLeft,
			lastScrollTop: element.scrollTop,
			lastTime: performance.now(),
			velocityX: 0,
			velocityY: 0,
			samples: [{ time: performance.now(), scrollLeft: element.scrollLeft, scrollTop: element.scrollTop }],
			moved: false,
		};
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const deltaX = event.clientX - drag.startX;
		const deltaY = event.clientY - drag.startY;

		if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

		drag.moved = true;
		document.body.classList.add("drag-scroll-active");
		event.preventDefault();

		const nextLeft = drag.scrollLeft - deltaX;
		const nextTop = drag.scrollTop - deltaY;
		const now = performance.now();
		const deltaTime = Math.max(1, now - drag.lastTime);

		drag.velocityX = (nextLeft - drag.lastScrollLeft) / deltaTime;
		drag.velocityY = (nextTop - drag.lastScrollTop) / deltaTime;
		drag.element.scrollLeft = nextLeft;
		drag.element.scrollTop = nextTop;
		drag.lastScrollLeft = drag.element.scrollLeft;
		drag.lastScrollTop = drag.element.scrollTop;
		drag.lastTime = now;
		drag.samples.push({ time: now, scrollLeft: drag.element.scrollLeft, scrollTop: drag.element.scrollTop });
		drag.samples = drag.samples.filter((sample) => now - sample.time <= VELOCITY_SAMPLE_WINDOW);
	};

	const onPointerUp = (event: PointerEvent) => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.moved) {
			suppressNextClick = true;
			suppressNextMouseUp = true;
			window.setTimeout(() => {
				suppressNextClick = false;
				suppressNextMouseUp = false;
			}, 0);
			const firstSample = drag.samples[0];
			const lastSample = drag.samples[drag.samples.length - 1];
			const sampleDelta = firstSample && lastSample ? Math.max(1, lastSample.time - firstSample.time) : 1;
			const velocityX =
				firstSample && lastSample ? ((lastSample.scrollLeft - firstSample.scrollLeft) / sampleDelta) * MOMENTUM_BOOST : drag.velocityX;
			const velocityY =
				firstSample && lastSample ? ((lastSample.scrollTop - firstSample.scrollTop) / sampleDelta) * MOMENTUM_BOOST : drag.velocityY;
			startMomentum(drag.element, velocityX, velocityY);
		}
		clearDrag();
	};

	const onMouseUp = (event: MouseEvent) => {
		if (!suppressNextMouseUp) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	const onClick = (event: MouseEvent) => {
		if (!suppressNextClick) return;
		suppressNextClick = false;
		suppressNextMouseUp = false;
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	document.addEventListener("pointerdown", onPointerDown, true);
	document.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
	document.addEventListener("pointerup", onPointerUp, true);
	document.addEventListener("pointercancel", onPointerUp, true);
	document.addEventListener("mouseup", onMouseUp, true);
	document.addEventListener("click", onClick, true);
	document.addEventListener("wheel", cancelMomentum, true);

	return () => {
		document.removeEventListener("pointerdown", onPointerDown, true);
		document.removeEventListener("pointermove", onPointerMove, true);
		document.removeEventListener("pointerup", onPointerUp, true);
		document.removeEventListener("pointercancel", onPointerUp, true);
		document.removeEventListener("mouseup", onMouseUp, true);
		document.removeEventListener("click", onClick, true);
		document.removeEventListener("wheel", cancelMomentum, true);
		cancelMomentum();
		clearDrag();
	};
}
