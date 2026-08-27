"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IcX } from "./icons";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  z?: number;
  maxW?: string;
}

export default function Modal({ title, subtitle, onClose, children, z = 50, maxW = "max-w-lg" }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const content = (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ zIndex: z }}
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-pine/45 backdrop-blur-[2px] anim-fade cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className={`relative w-full ${maxW} bg-card border border-line rounded-t-2xl sm:rounded-xl shadow-[0_24px_60px_-20px_rgba(22,60,44,0.45)] anim-pop max-h-[92dvh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg leading-tight text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-soft mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-soft hover:text-ink hover:bg-mint transition-colors"
            aria-label="Cerrar ventana"
          >
            <IcX size={17} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(content, document.body);
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-soft mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-faint mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-linedark bg-white/70 px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition-shadow focus:border-moss focus:ring-2 focus:ring-moss/25";
