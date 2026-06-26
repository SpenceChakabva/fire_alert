"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedCounter({ value, className = "", style }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current;
    const end = value;
    prev.current = value;
    if (start === end) { el.textContent = String(end); return; }
    const dur = 600;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(start + (end - start) * ease));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span ref={ref} className={className} style={style}>{value}</span>;
}
