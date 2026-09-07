"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface SpotlightFocusSectionProps {
  onBookDemo: () => void;
}

export default function SpotlightFocusSection({
  onBookDemo,
}: SpotlightFocusSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  // Position coordinates (raw and smoothed)
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const targetCoords = useRef({ x: 0, y: 0 });
  const animFrameId = useRef<number | null>(null);

  // Initialize centered spotlight
  useEffect(() => {
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect();
      const initialX = rect.width / 2;
      const initialY = rect.height / 2;
      targetCoords.current = { x: initialX, y: initialY };
      setCoords({ x: initialX, y: initialY });
    }

    // Silky smooth LERP animation loop for mouse follow physics
    const updatePhysics = () => {
      setCoords((prev) => {
        const dx = targetCoords.current.x - prev.x;
        const dy = targetCoords.current.y - prev.y;
        // Smooth dampening factor
        const ease = 0.08;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
          return prev;
        }
        return {
          x: prev.x + dx * ease,
          y: prev.y + dy * ease,
        };
      });
      animFrameId.current = requestAnimationFrame(updatePhysics);
    };

    animFrameId.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    targetCoords.current = { x, y };
  }, []);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    // Return gently to center when mouse leaves
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect();
      targetCoords.current = { x: rect.width / 2, y: rect.height / 2 };
    }
  };

  return (
    <section
      id="radar"
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative py-36 md:py-48 border-t border-white/[0.08] text-center overflow-hidden bg-[#030303] select-none cursor-default transition-colors duration-500"
    >
      {/* 1. DYNAMIC SPOTLIGHT RADIAL BEAM LAYER (Follows cursor smoothly) */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background: `
            radial-gradient(550px circle at ${coords.x}px ${coords.y}px, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.07) 35%, rgba(0, 0, 0, 0) 75%),
            radial-gradient(220px circle at ${coords.x}px ${coords.y}px, rgba(255, 255, 255, 0.08), transparent 70%)
          `,
        }}
      />

      {/* 2. ARCHITECTURAL BLUEPRINT GRID REVEALED BY SPOTLIGHT */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-300"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(245, 158, 11, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(245, 158, 11, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          WebkitMaskImage: `radial-gradient(420px circle at ${coords.x}px ${coords.y}px, black 30%, transparent 100%)`,
          maskImage: `radial-gradient(420px circle at ${coords.x}px ${coords.y}px, black 30%, transparent 100%)`,
        }}
      />

      {/* 3. SUBTLE CONCENTRIC RADAR TARGETING RINGS CENTERED AT CURSOR */}
      <div
        className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
        style={{
          left: `${coords.x}px`,
          top: `${coords.y}px`,
          opacity: isHovered ? 0.35 : 0.2,
        }}
      >
        <div className="w-56 h-56 rounded-full border border-amber-500/30 animate-pulse" />
        <div className="absolute inset-[-40px] rounded-full border border-amber-500/15" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-amber-500/20" />
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-amber-500/20" />
      </div>

      {/* 4. CONTENT HERO CONTAINER */}
      <div className="max-w-4xl mx-auto px-6 space-y-8 relative z-10 pointer-events-auto">
        {/* Eyebrow */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-amber-400 text-xs font-mono uppercase tracking-[0.25em]">
          <img
            src="/resto-bird-flaticon.png"
            alt="Resto Bird"
            className="w-4 h-4 rounded-full object-contain"
          />
          <span>RESTO BIRD</span>
        </div>

        {/* Headline */}
        <h2 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.05]">
          See your restaurant <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-stone-200 to-stone-400">
            differently.
          </span>
        </h2>

        {/* Subtitle */}
        <p className="text-stone-400 text-base sm:text-lg max-w-lg mx-auto font-normal leading-relaxed">
          One view. Every order. Every ingredient. Every outlet.
        </p>

        {/* CTA Button */}
        <div className="pt-2">
          <button
            onClick={onBookDemo}
            className="group relative px-9 py-4 bg-white hover:bg-stone-100 text-stone-950 font-mono font-bold text-xs uppercase tracking-widest rounded-full transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(245,158,11,0.3)] active:scale-95"
          >
            <span>Book a Demo</span>
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">
              →
            </span>
          </button>
        </div>

        {/* Spotlight Telemetry Indicator */}
        <div className="pt-8 text-[11px] font-mono text-stone-400 tracking-wider uppercase flex items-center justify-center space-x-4 pointer-events-none">
          <span>RADAR FOCUS</span>
          <span className="text-stone-700">•</span>
          <span>SUB-SECOND DISPATCH</span>
          <span className="text-stone-700">•</span>
          <span>TOTAL VISIBILITY</span>
        </div>
      </div>
    </section>
  );
}
