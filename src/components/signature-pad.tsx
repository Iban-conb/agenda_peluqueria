"use client";

/**
 * Lienzo de firma manuscrita para pantalla táctil (dedo o stylus) y ratón.
 * Usa Pointer Events + `touch-action: none` para que trazar la firma no
 * haga scroll en el móvil. Expone su API a través de `apiRef`.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { IcRotate } from "./icons";

export interface SignaturePadApi {
  /** ¿Hay algún trazo dibujado? */
  hasInk: () => boolean;
  /** PNG (data URL) recortado al área firmada, o null si está vacío. */
  toPng: () => string | null;
  /** Borra la firma. */
  clear: () => void;
}

interface Props {
  apiRef: MutableRefObject<SignaturePadApi | null>;
  /** Aviso cuando cambia si hay firma o no. */
  onChange?: (hasInk: boolean) => void;
  height?: number;
}

const INK_COLOR = "#1f2a25";
const INK_WIDTH = 2.4;

export default function SignaturePad({ apiRef, onChange, height = 190 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const inkChanged = (v: boolean) => {
    setHasInk(v);
    onChange?.(v);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const setup = () => {
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const cssW = Math.max(1, wrap.clientWidth);
      const cssH = height;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = "100%";
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = INK_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK_COLOR;
      strokes.current = 0;
      inkChanged(false);
    };

    setup();

    const posOf = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
        return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing.current = true;
      const p = posOf(e);
      lastPoint.current = p;
      strokes.current++;
      inkChanged(true);
    };

    const onMove = (e: PointerEvent) => {
      if (!drawing.current || !lastPoint.current) return;
      e.preventDefault();
      const ctx = canvas.getContext("2d");
      const p = posOf(e);
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPoint.current = p;
    };

    const onUp = (e: PointerEvent) => {
      if (!drawing.current) return;
      drawing.current = false;
      lastPoint.current = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* el puntero ya se liberó */
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const ro = new ResizeObserver(setup);
    ro.observe(wrap);

    apiRef.current = {
      hasInk: () => strokes.current > 0,
      toPng: () => {
        if (strokes.current === 0) return null;
        try {
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          const { width: w, height: h } = canvas;
          const data = ctx.getImageData(0, 0, w, h).data;
          let minX = w;
          let minY = h;
          let maxX = -1;
          let maxY = -1;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (data[(y * w + x) * 4 + 3] > 12) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX < 0) return null;
          const pad = 12;
          minX = Math.max(0, minX - pad);
          minY = Math.max(0, minY - pad);
          maxX = Math.min(w - 1, maxX + pad);
          maxY = Math.min(h - 1, maxY + pad);
          const cw = maxX - minX + 1;
          const ch = maxY - minY + 1;
          const out = document.createElement("canvas");
          out.width = cw;
          out.height = ch;
          const octx = out.getContext("2d");
          if (!octx) return null;
          octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
          return out.toDataURL("image/png");
        } catch {
          return null;
        }
      },
      clear: () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        strokes.current = 0;
        inkChanged(false);
      },
    };

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      ro.disconnect();
      apiRef.current = null;
    };
  }, [height]);

  return (
    <div className="space-y-1.5">
      <div
        ref={wrapRef}
        className="relative rounded-xl border-2 border-dashed border-linedark bg-white/80 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ touchAction: "none" }}
          aria-label="Área de firma del cliente"
          role="img"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-faint/70 select-none">
            Firma aquí con el dedo
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-faint">
          Entrega el teléfono al cliente para que firme en la pantalla táctil.
        </p>
        <button
          type="button"
          onClick={() => apiRef.current?.clear()}
          className="inline-flex items-center gap-1 rounded-lg border border-linedark px-2.5 py-1.5 text-[11px] font-bold text-soft hover:bg-mint hover:text-ink transition-colors shrink-0"
        >
          <IcRotate size={12} /> Borrar firma
        </button>
      </div>
    </div>
  );
}
