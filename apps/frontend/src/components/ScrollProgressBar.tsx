import { useEffect, useState } from "react";

/**
 * Thin vertical progress bar (right edge) tied to document scroll depth.
 */
export function ScrollProgressBar() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const denom = h.scrollHeight - h.clientHeight;
      setPct(denom > 0 ? (h.scrollTop / denom) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="pet-pbar pointer-events-none fixed right-0 top-0 z-[1000] w-[3px] transition-[height] duration-75 ease-linear"
      style={{ height: `${pct}%` }}
      aria-hidden
    />
  );
}
