import { useRef, useState, type CSSProperties } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { Gift, Sparkles } from "lucide-react";
import type { Brand } from "@/lib/catalog";
import { formatINR } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Props = {
  brand: Brand;
  amount?: number;
  code?: string;
  interactive?: boolean; // tilt toward pointer + flip on press
  className?: string;
};

export function CardFace({ brand, amount, className }: { brand: Brand; amount?: number | undefined; className?: string | undefined }) {
  return (
    <div
      className={cn("card-art relative flex aspect-[1.6] w-full flex-col justify-between overflow-hidden rounded-2xl p-5", className)}
      style={{ "--h": brand.hue } as CSSProperties}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-xl font-bold leading-tight sm:text-2xl">{brand.name}</span>
        <Gift className="h-6 w-6 opacity-90" aria-hidden />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xs uppercase tracking-widest opacity-80">Giftloom</span>
        {amount !== undefined && <span className="font-display text-2xl font-extrabold">{formatINR(amount)}</span>}
      </div>
    </div>
  );
}

export function GiftCard({ brand, amount, code, interactive = false, className }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [flipped, setFlipped] = useState(false);
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 });

  const onMove = (e: React.PointerEvent) => {
    if (!interactive || reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ry.set(x * 22);
    rx.set(-y * 18);
  };
  const reset = () => { rx.set(0); ry.set(0); };

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={flipped ? "Show card front" : "Flip card to see the back"}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={() => setFlipped((f) => !f)}
      style={{ rotateX: rx, rotateY: ry, perspective: 1200 }}
      className={cn("block w-full cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring", className)}
    >
      <motion.div
        className="preserve-3d relative"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 16 }}
      >
        <div className="backface-hidden shadow-lift rounded-2xl">
          <CardFace brand={brand} amount={amount} />
        </div>
        <div
          className="card-back backface-hidden shadow-lift absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl p-5"
          style={{ transform: "rotateY(180deg)", "--h": brand.hue } as CSSProperties}
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          <span className="text-xs uppercase tracking-widest opacity-80">Gift card code</span>
          <span className="font-mono text-lg font-bold tracking-wider">{code ?? "••••-••••-••••"}</span>
          <span className="text-[10px] opacity-75">Keep this code private</span>
        </div>
      </motion.div>
    </motion.button>
  );
}
