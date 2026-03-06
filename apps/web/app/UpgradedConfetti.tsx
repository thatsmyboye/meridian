"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * UpgradedConfetti
 *
 * Renders a brief full-screen confetti animation when the URL contains
 * `?upgraded=true` (Stripe's success_url redirect).  After showing the
 * celebration it removes the query param from the URL so a refresh doesn't
 * replay it.
 *
 * The confetti is drawn on a <canvas> using requestAnimationFrame.
 * No third-party library required.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#059669", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
];

function createParticle(canvasWidth: number): Particle {
  return {
    x: Math.random() * canvasWidth,
    y: -10,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
  };
}

const PARTICLE_COUNT = 160;
const DURATION_MS = 3500;

export default function UpgradedConfetti() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const upgraded = searchParams.get("upgraded") === "true";

  useEffect(() => {
    if (!upgraded) return;

    setVisible(true);
    setShowBanner(true);

    // Strip the query param from the URL without a page reload
    const url = new URL(window.location.href);
    url.searchParams.delete("upgraded");
    router.replace(url.pathname + (url.search || ""), { scroll: false });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas.width)
    );

    let animId: number;
    const startTime = performance.now();

    function draw(now: number) {
      if (!ctx || !canvas) return;
      const elapsed = now - startTime;
      if (elapsed > DURATION_MS) {
        setVisible(false);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION_MS);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.rotation += p.rotationSpeed;
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    const bannerTimer = setTimeout(() => setShowBanner(false), DURATION_MS);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(bannerTimer);
    };
  }, [upgraded, router]);

  if (!visible && !showBanner) return null;

  return (
    <>
      {/* Full-screen confetti canvas */}
      {visible && (
        <canvas
          ref={canvasRef}
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9999,
          }}
        />
      )}

      {/* Celebration banner */}
      {showBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111827",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 12,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 16,
            zIndex: 10000,
            boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span aria-hidden>🎉</span> Welcome to your new plan!
        </div>
      )}
    </>
  );
}
