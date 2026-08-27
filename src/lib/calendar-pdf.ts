/**
 * Calendario laboral: importación de festivos desde PDF y exportación
 * del calendario del salón a PDF.
 *
 * - Importar: usa pdf.js (CDN) para leer el calendario, localiza los
 *   bloques de cada mes y detecta los días cuya casilla está marcada en
 *   color (festivos), igual que en los calendarios laborales oficiales.
 * - Exportar: genera con pdf-lib un calendario A4 vertical de 12 meses
 *   (3 columnas × 4 filas) con los festivos marcados con la casilla
 *   completa en color.
 */

import type { SalonInfo } from "./types";

/* ------------------------------------------------------------------ */
/* pdf.js desde CDN (carga diferida)                                   */
/* ------------------------------------------------------------------ */

const PDFJS_VER = "3.11.174";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`;

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfjsPage {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
  }) => { promise: Promise<void> };
}

interface PdfjsDoc {
  getPage: (n: number) => Promise<PdfjsPage>;
}

interface PdfjsLib {
  getDocument: (opts: { data: Uint8Array }) => { promise: Promise<PdfjsDoc> };
  GlobalWorkerOptions: { workerSrc: string };
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsLib;
  }
}

let pdfjsPromise: Promise<PdfjsLib> | null = null;

async function loadPdfjs(): Promise<PdfjsLib> {
  if (typeof window === "undefined") {
    throw new Error("La importación de calendarios solo funciona en el navegador.");
  }
  if (window.pdfjsLib) return window.pdfjsLib;
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise<PdfjsLib>((resolve, reject) => {
    const existing = document.getElementById("pdfjs-script");
    const script = (existing ?? document.createElement("script")) as HTMLScriptElement;
    if (!existing) {
      script.id = "pdfjs-script";
      script.src = PDFJS_URL;
      document.head.appendChild(script);
    }
    const onReady = () => {
      if (!window.pdfjsLib) {
        reject(new Error("No se pudo cargar el lector de PDF."));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    if (window.pdfjsLib) onReady();
    else {
      script.addEventListener("load", onReady, { once: true });
      script.addEventListener("error", () => reject(new Error("No se pudo cargar el lector de PDF.")), { once: true });
    }
  });
  return pdfjsPromise;
}

/* ------------------------------------------------------------------ */
/* Importación de festivos                                             */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

export interface ImportedCalendar {
  year: number;
  /** Festivos detectados en formato YYYY-MM-DD, ordenados */
  holidays: string[];
  /** Número de bloques de mes reconocidos (para validar el formato) */
  monthsFound: number;
}

/** Agrupa una lista ordenada de números en clusters separados por un hueco mínimo. */
function clusterByGap(sorted: number[], gap: number): number[][] {
  const out: number[][] = [];
  let cur: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > gap) {
      out.push(cur);
      cur = [];
    }
    cur.push(sorted[i]);
  }
  out.push(cur);
  return out;
}

/**
 * Lee un calendario laboral en PDF y devuelve los días festivos
 * (aquellos con la casilla marcada en color).
 */
export async function importHolidaysFromPdf(
  file: File
): Promise<ImportedCalendar> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await doc.getPage(1);

  // Render de la página para poder muestrear el color de las casillas
  const RENDER_SCALE = 2;
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo preparar el lienzo de lectura.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pageH = viewport.height / RENDER_SCALE;

  const sampleColor = (x: number, y: number): [number, number, number] | null => {
    const px = Math.round(x * RENDER_SCALE);
    const py = Math.round((pageH - y) * RENDER_SCALE);
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
    const i = (py * canvas.width + px) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };

  /** ¿Es un píxel de color (saturado y no oscuro)? → casilla de festivo. */
  const isColored = (c: [number, number, number] | null): boolean => {
    if (!c) return false;
    const [r, g, b] = c;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    return mx - mn >= 45 && mx >= 90;
  };

  // Textos con posiciones (coords PDF: origen abajo-izquierda)
  const tc = await page.getTextContent();
  const items = tc.items
    .map((it) => ({
      str: it.str.trim(),
      x: it.transform[4],
      y: it.transform[5],
      w: it.width || 0,
      h: it.height || 8,
    }))
    .filter((it) => it.str.length > 0);

  // Año del calendario
  let year = new Date().getFullYear();
  for (const it of items) {
    const m = it.str.match(/(19|20)\d{2}/);
    if (m) {
      year = parseInt(m[0], 10);
      break;
    }
  }

  // Bloques de mes: cabeceras ENERO…DICIEMBRE
  const monthItems = items.filter((it) =>
    MONTH_NAMES.includes(it.str.toUpperCase())
  );
  if (monthItems.length < 12) {
    throw new Error(
      "No se reconocieron los 12 meses del calendario. Asegúrate de subir un calendario anual (enero a diciembre)."
    );
  }

  // Columnas por posición x y filas por posición y (agrupación por huecos)
  const colCenters = clusterByGap(
    monthItems.map((m) => m.x).sort((a, b) => a - b),
    90
  ).map((c) => c.reduce((s, v) => s + v, 0) / c.length);
  const rowTops = clusterByGap(
    monthItems.map((m) => m.y).sort((a, b) => a - b),
    60
  ).map((c) => Math.max(...c));

  const colOf = (x: number): number => {
    let best = 0;
    let bd = Infinity;
    colCenters.forEach((cx, i) => {
      const d = Math.abs(cx - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  /** Fila cuya cabecera queda justo por encima del número (mayor y ≤ dayY). */
  const rowOf = (y: number): number => {
    let best = -1;
    rowTops.forEach((ry, i) => {
      if (ry >= y - 6 && (best === -1 || ry < rowTops[best])) best = i;
    });
    return best;
  };

  // Números de día con la casilla coloreada → festivos
  const holidays = new Set<string>();
  const numbers = items.filter(
    (it) =>
      /^\d{1,2}$/.test(it.str) &&
      +it.str >= 1 &&
      +it.str <= 31 &&
      it.w > 0 &&
      it.w < 40
  );

  for (const n of numbers) {
    const day = +n.str;
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    // Anillo de puntos alrededor del número (unidades PDF)
    const offs: [number, number][] = [
      [-8, -5], [8, -5], [-8, 4], [8, 4],
      [0, -7], [0, 6], [-5, 0], [5, 0], [9, 0], [-9, 0],
    ];
    let colored = 0;
    for (const [dx, dy] of offs) {
      if (isColored(sampleColor(cx + dx, cy + dy))) colored++;
    }
    if (colored < 2) continue;

    const col = colOf(n.x);
    const row = rowOf(n.y);
    if (row < 0) continue;
    const mi = monthItems.find(
      (m) => colOf(m.x) === col && rowOf(m.y) === row
    );
    if (!mi) continue;

    const month = MONTH_NAMES.indexOf(mi.str.toUpperCase()) + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    // Validar fecha real (evita 31 de febrero, etc.)
    const check = new Date(year, month - 1, day);
    if (check.getMonth() === month - 1) holidays.add(date);
  }

  const list = Array.from(holidays).sort();
  if (list.length === 0) {
    throw new Error(
      "No se detectó ningún día marcado en color. El calendario debe marcar los festivos con la casilla coloreada."
    );
  }

  return { year, holidays: list, monthsFound: monthItems.length };
}

/* ------------------------------------------------------------------ */
/* Exportación a PDF (formato calendario laboral A4 vertical)          */
/* ------------------------------------------------------------------ */

const MONTH_LABELS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];
const WEEKDAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function sanitizePdf(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\u0000-\u00FF\u2013\u2014\u20AC\u2022]/g, "");
}

export interface ExportCalendarOpts {
  year: number;
  /** Fechas festivas/cerradas en formato YYYY-MM-DD */
  holidays: string[];
  salon: SalonInfo;
}

/**
 * Genera el calendario laboral del salón en PDF (A4 vertical, 12 meses
 * en 3×4 con los festivos marcados con la casilla completa en color).
 */
export async function exportCalendarPdf(
  opts: ExportCalendarOpts
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { year, salon } = opts;

  const festive = new Set(
    opts.holidays.filter((d) => d.startsWith(String(year)))
  );

  const doc = await PDFDocument.create();
  doc.setTitle(`Calendario laboral ${year} - ${sanitizePdf(salon.name)}`);
  doc.setAuthor(sanitizePdf(salon.fiscalName || salon.name));
  doc.setCreator(`${sanitizePdf(salon.name)} · Gestión de citas`);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Paleta (coherente con el tema rosa del salón)
  const cPine = rgb(0x8c / 255, 0x4a / 255, 0x64 / 255);
  const cHoliday = rgb(0xb3 / 255, 0x36 / 255, 0x4d / 255);
  const cInk = rgb(0x2f / 255, 0x24 / 255, 0x28 / 255);
  const cSoft = rgb(0x7a / 255, 0x55 / 255, 0x60 / 255);
  const cFaint = rgb(0xa9 / 255, 0x8a / 255, 0x93 / 255);
  const cLine = rgb(0xe0 / 255, 0xc2 / 255, 0xc8 / 255);
  const cWeekend = rgb(0xf5 / 255, 0xee / 255, 0xf0 / 255);
  const cWhite = rgb(1, 1, 1);

  const page = doc.addPage([595.28, 841.89]);
  const W = page.getWidth();

  const draw = (
    text: string,
    x: number,
    y: number,
    size: number,
    f: typeof font,
    color = cInk
  ) => page.drawText(sanitizePdf(text), { x, y, size, font: f, color });

  /* --- Cabecera --- */
  let y = 812;
  const title = `Calendario ${year}`;
  draw(title, 47, y, 21, fontBold, cPine);
  draw(salon.name, W - 47 - font.widthOfTextAtSize(sanitizePdf(salon.name), 9), y + 2, 9, fontBold, cSoft);
  const salonBits = [
    salon.fiscalName && salon.fiscalName !== salon.name ? salon.fiscalName : "",
    salon.nif ? `NIF/CIF ${salon.nif}` : "",
    [salon.street, [salon.zip, salon.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    salon.phone,
    salon.email,
  ].filter(Boolean).join("  ·  ");
  if (salonBits) {
    draw(salonBits, 47, y - 14, 7, font, cFaint);
  }
  y -= 30;
  draw(
    `Calendario laboral del salón · los días marcados en color son festivos o días de cierre.`,
    47,
    y,
    7.5,
    font,
    cSoft
  );

  /* --- Rejilla de meses: 3 columnas × 4 filas --- */
  const GRID_TOP = 758;
  const GRID_BOTTOM = 118;
  const MARGIN = 47;
  const GAP_X = 14;
  const GAP_Y = 14;
  const colW = (W - MARGIN * 2 - GAP_X * 2) / 3;
  const rowH = (GRID_TOP - GRID_BOTTOM - GAP_Y * 3) / 4;

  const headerH = 15;
  const weekdayH = 12;
  const cellW = colW / 7;

  for (let m = 0; m < 12; m++) {
    const col = m % 3;
    const rowIdx = Math.floor(m / 3);
    const bx = MARGIN + col * (colW + GAP_X);
    const byTop = GRID_TOP - rowIdx * (rowH + GAP_Y);

    // Cabecera del mes
    page.drawRectangle({
      x: bx,
      y: byTop - headerH,
      width: colW,
      height: headerH,
      color: cPine,
    });
    const label = MONTH_LABELS[m];
    draw(
      label,
      bx + (colW - fontBold.widthOfTextAtSize(label, 8.5)) / 2,
      byTop - headerH + 4.2,
      8.5,
      fontBold,
      cWhite
    );

    // Días de la semana
    const wy = byTop - headerH - weekdayH + 3;
    WEEKDAY_LETTERS.forEach((d, i) => {
      const isWeekend = i >= 5;
      draw(
        d,
        bx + i * cellW + (cellW - font.widthOfTextAtSize(d, 7.5)) / 2,
        wy,
        7.5,
        fontBold,
        isWeekend ? cHoliday : cSoft
      );
    });

    // Casillas de días (lunes primero)
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const startCol = (new Date(year, m, 1).getDay() + 6) % 7; // 0 = lunes

    const gridTopY = byTop - headerH - weekdayH;
    const rowsNeeded = Math.ceil((startCol + daysInMonth) / 7);
    const cellH = Math.min((gridTopY - (byTop - rowH)) / rowsNeeded, 16.5);

    for (let d = 1; d <= daysInMonth; d++) {
      const gi = startCol + d - 1;
      const gc = gi % 7;
      const gr = Math.floor(gi / 7);
      const isWeekend = gc >= 5;
      const key = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFestive = festive.has(key);

      const cx = bx + gc * cellW;
      const cyTop = gridTopY - gr * cellH;

      if (isFestive) {
        // Festivo: casilla completa en color con número blanco
        page.drawRectangle({
          x: cx + 0.5,
          y: cyTop - cellH + 0.5,
          width: cellW - 1,
          height: cellH - 1,
          color: cHoliday,
        });
        const t = String(d);
        draw(
          t,
          cx + (cellW - fontBold.widthOfTextAtSize(t, 8.5)) / 2,
          cyTop - cellH + (cellH - 6) / 2,
          8.5,
          fontBold,
          cWhite
        );
      } else {
        if (isWeekend) {
          page.drawRectangle({
            x: cx + 0.5,
            y: cyTop - cellH + 0.5,
            width: cellW - 1,
            height: cellH - 1,
            color: cWeekend,
          });
        }
        const t = String(d);
        draw(
          t,
          cx + (cellW - font.widthOfTextAtSize(t, 8)) / 2,
          cyTop - cellH + (cellH - 6) / 2,
          8,
          font,
          isWeekend ? cFaint : cInk
        );
      }
    }
  }

  /* --- Leyenda inferior --- */
  const legendY = 96;
  page.drawLine({
    start: { x: MARGIN, y: legendY + 26 },
    end: { x: W - MARGIN, y: legendY + 26 },
    thickness: 0.8,
    color: cLine,
  });

  // Muestra de casilla festiva
  page.drawRectangle({
    x: MARGIN,
    y: legendY + 8,
    width: 16,
    height: 11,
    color: cHoliday,
  });
  draw("Festivo / día de cierre", MARGIN + 22, legendY + 10.5, 7.5, fontBold, cSoft);
  page.drawRectangle({
    x: MARGIN + 140,
    y: legendY + 8,
    width: 16,
    height: 11,
    color: cWeekend,
    borderColor: cLine,
    borderWidth: 0.5,
  });
  draw("Fin de semana", MARGIN + 162, legendY + 10.5, 7.5, font, cSoft);

  // Listado de fechas
  const dates = Array.from(festive).sort();
  const dateLabels = dates.map((d) => {
    const [, mm, dd] = d.split("-");
    return `${+dd} ${MONTH_SHORT[+mm - 1]}`;
  });
  if (dateLabels.length > 0) {
    let lx = MARGIN;
    let ly = legendY - 6;
    draw("Días marcados:", lx, ly, 7.5, fontBold, cSoft);
    lx += fontBold.widthOfTextAtSize("Días marcados:", 7.5) + 8;
    for (const lab of dateLabels) {
      const wLab = font.widthOfTextAtSize(lab, 7.5) + 10;
      if (lx + wLab > W - MARGIN) {
        lx = MARGIN + 4;
        ly -= 11;
      }
      draw(lab, lx, ly, 7.5, font, cInk);
      lx += wLab;
    }
  }

  // Pie
  draw(
    `Documento generado electrónicamente por ${salon.fiscalName || salon.name} · ${new Date().toLocaleDateString("es-ES")}`,
    MARGIN,
    40,
    6.5,
    font,
    cFaint
  );

  return doc.save();
}
