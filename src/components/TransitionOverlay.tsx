import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export interface TransitionOverlayHandle {
  fadeTo(target: number, durationSec: number): void;
  getOpacity(): number;
}

interface FadeAnimation {
  from: number;
  to: number;
  start: number;
  duration: number;
}

// Full-bleed dark overlay driven imperatively from the scene layer. It owns
// its own rAF loop and mutates opacity directly on the DOM so we don't re-render
// React every frame during a transition.
export const TransitionOverlay = forwardRef<TransitionOverlayHandle>(
  function TransitionOverlay(_props, ref) {
    const divRef = useRef<HTMLDivElement>(null);
    const opacityRef = useRef(0);
    const animRef = useRef<FadeAnimation | null>(null);
    const rafRef = useRef<number | null>(null);

    function tick() {
      const anim = animRef.current;
      const el = divRef.current;
      if (!anim || !el) {
        rafRef.current = null;
        return;
      }
      const now = performance.now();
      const t = Math.min(1, (now - anim.start) / anim.duration);
      const eased = t * t * (3 - 2 * t);
      opacityRef.current = anim.from + (anim.to - anim.from) * eased;
      el.style.opacity = String(opacityRef.current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        rafRef.current = null;
      }
    }

    useImperativeHandle(ref, () => ({
      fadeTo(target, durationSec) {
        const clamped = Math.max(0, Math.min(1, target));
        if (durationSec <= 0) {
          opacityRef.current = clamped;
          if (divRef.current) divRef.current.style.opacity = String(clamped);
          return;
        }
        animRef.current = {
          from: opacityRef.current,
          to: clamped,
          start: performance.now(),
          duration: durationSec * 1000,
        };
        if (rafRef.current == null) {
          rafRef.current = requestAnimationFrame(tick);
        }
      },
      getOpacity() {
        return opacityRef.current;
      },
    }));

    useEffect(
      () => () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      },
      []
    );

    return (
      <div
        ref={divRef}
        className="transition-overlay"
        aria-hidden="true"
      />
    );
  }
);
