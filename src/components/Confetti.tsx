import { useEffect, useState, type CSSProperties } from "react";

const COLORS = ["var(--primary)", "var(--highlight)", "var(--lavender)", "var(--accent)"];

export function Confetti() {
  const [pieces, setPieces] = useState<CSSProperties[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPieces(
      Array.from({ length: 70 }, () => ({
        left: `${Math.random() * 100}%`,
        background: COLORS[Math.floor(Math.random() * COLORS.length)],
        "--dx": `${(Math.random() - 0.5) * 200}px`,
        "--rot": `${Math.random() * 720}deg`,
        "--dur": `${1.6 + Math.random() * 1.4}s`,
        animationDelay: `${Math.random() * 0.3}s`,
        width: `${6 + Math.random() * 6}px`,
        height: `${10 + Math.random() * 8}px`,
      }) as CSSProperties),
    );
    const t = setTimeout(() => setPieces([]), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!pieces.length) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 -top-6 z-50 h-0">
      {pieces.map((s, i) => (
        <span key={i} className="confetti-piece absolute top-0 rounded-sm" style={s} />
      ))}
    </div>
  );
}
