/**
 * Generación del PDF de consentimiento informado (RGPD / LOPDGDD).
 *
 * El documento se construye íntegramente en el navegador con pdf-lib y se
 * guarda en la base de datos de la aplicación (IndexedDB) codificado en
 * base64, de modo que queda disponible para consulta y descarga offline.
 *
 * El documento está diseñado para ocupar UNA sola página A4 e incluye los
 * datos fiscales reales del salón configurados en Ajustes.
 */

import type { Client, SalonInfo } from "./types";
import {
  CONSENT_TEXT_VERSION,
  salonAddress,
} from "./types";

/* ------------------------------------------------------------------ */
/* Texto legal del consentimiento                                      */
/* ------------------------------------------------------------------ */

export interface ConsentClause {
  title: string;
  body: string[];
}

/** Cláusulas del consentimiento (mostradas en el modal y volcadas al PDF),
 *  personalizadas con los datos fiscales del salón. */
export function getConsentClauses(salon: SalonInfo): ConsentClause[] {
  const nombre = salon.fiscalName || salon.name;
  const domicilio = salonAddress(salon);
  const contacto = [
    salon.email,
    salon.phone ? `teléfono ${salon.phone}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const identificacion = [
    nombre,
    salon.nif ? `NIF/CIF ${salon.nif}` : "",
    domicilio ? `con domicilio en ${domicilio}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    {
      title: "1. Responsable del tratamiento",
      body: [
        `${identificacion}, en su condición de responsable del tratamiento, trata los datos personales facilitados por sus clientes con la finalidad de prestar el servicio solicitado y gestionar la relación comercial.`,
      ],
    },
    {
      title: "2. Finalidad del tratamiento",
      body: [
        "a) Gestionar la agenda de citas, el historial de servicios y la relación comercial con el cliente.",
        "b) Remitir recordatorios de cita por los medios de contacto facilitados (teléfono, correo electrónico).",
        "c) Enviar comunicaciones comerciales y novedades del salón, únicamente si el cliente marca la casilla de aceptación correspondiente.",
      ],
    },
    {
      title: "3. Legitimación",
      body: [
        "La base jurídica del tratamiento es la ejecución de la relación contractual o la aplicación de medidas precontractuales (art. 6.1.b RGPD) para las finalidades de gestión, y el consentimiento expreso del cliente (art. 6.1.a RGPD) para las comunicaciones comerciales.",
      ],
    },
    {
      title: "4. Destinatarios",
      body: [
        "No se cederán datos personales a terceros, salvo obligación legal. Los datos pueden alojarse en proveedores de servicios en la nube debidamente contratados conforme al art. 28 RGPD.",
      ],
    },
    {
      title: "5. Plazos de conservación",
      body: [
        "Los datos se conservarán mientras exista relación comercial entre el cliente y el salón y, posteriormente, durante los plazos de prescripción de las responsabilidades legales aplicables.",
      ],
    },
    {
      title: "6. Derechos",
      body: [
        `El cliente podrá ejercer en cualquier momento sus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad dirigiéndose por escrito a ${nombre}${contacto ? ` (${contacto})` : ""}. Asimismo, podrá presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es) si considera que el tratamiento no se ajusta a la normativa vigente.`,
      ],
    },
    {
      title: "7. Procedencia de los datos",
      body: [
        "Los datos personales tratados proceden del propio interesado, facilitados al formalizar la cita o durante la prestación del servicio.",
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Utilidades base64                                                   */
/* ------------------------------------------------------------------ */

/** Convierte bytes a base64 sin depender de Buffer (compatibilidad navegador). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000; // 32.768 bytes por iteración
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Convierte base64 a bytes (con buffer ArrayBuffer para uso en Blob/File). */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Crea una URL de objeto (blob) a partir del PDF guardado en base64. */
export function consentToObjectUrl(pdfBase64: string): string {
  const bytes = base64ToBytes(pdfBase64);
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/* ------------------------------------------------------------------ */
/* Construcción del PDF (una sola página A4)                           */
/* ------------------------------------------------------------------ */

const PAGE_W = 595.28; // A4 en puntos pdf-lib
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

type PDFFontLike = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

/** Divide un texto en líneas que caben en el ancho disponible. */
function wrapText(
  text: string,
  font: PDFFontLike,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Sustituye caracteres no soportados por la codificación WinAnsi. */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\u0000-\u00FF\u2013\u2014\u20AC\u2022]/g, "");
}

export interface BuildConsentPdfOpts {
  client: Client;
  salon: SalonInfo;
  /** Data URL (image/png) con la firma manuscrita. */
  signatureDataUrl: string;
  /** ¿Aceptó comunicaciones comerciales? */
  marketing: boolean;
}

/**
 * Genera el PDF del consentimiento informado firmado, ocupando una sola
 * página A4. Devuelve los bytes del documento.
 */
export async function buildConsentPdf(
  opts: BuildConsentPdfOpts
): Promise<Uint8Array> {
  // Importación dinámica: pdf-lib solo se carga al firmar
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const { client, salon } = opts;

  const doc = await PDFDocument.create();
  doc.setTitle(`Consentimiento informado - ${sanitize(salon.name)}`);
  doc.setAuthor(sanitize(salon.fiscalName || salon.name));
  doc.setSubject("Consentimiento RGPD");
  doc.setCreator(`${sanitize(salon.name)} - Gestión de citas`);
  doc.setProducer(`${sanitize(salon.name)} - Gestión de citas`);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const cPine = rgb(0x2e / 255, 0x6e / 255, 0x4f / 255);
  const cGold = rgb(0xb8 / 255, 0x6c / 255, 0x8a / 255);
  const cInk = rgb(0x1b / 255, 0x26 / 255, 0x21 / 255);
  const cSoft = rgb(0x5c / 255, 0x6b / 255, 0x64 / 255);
  const cLine = rgb(0xc9 / 255, 0xd6 / 255, 0xce / 255);
  const cRed = rgb(0xb3 / 255, 0x36 / 255, 0x4d / 255);
  const cBlue = rgb(0x34 / 255, 0x55 / 255, 0x8b / 255);
  const cWhite = rgb(1, 1, 1);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  /** Dibuja una casilla de verificación cuadrada (marcada o vacía). */
  const checkbox = (x: number, yy: number, checked: boolean) => {
    const s = 8;
    page.drawRectangle({
      x,
      y: yy,
      width: s,
      height: s,
      borderColor: cInk,
      borderWidth: 0.9,
    });
    if (checked) {
      page.drawLine({
        start: { x: x + 1.8, y: yy + 2.2 },
        end: { x: x + s / 2, y: yy + s - 2.6 },
        thickness: 1.1,
        color: cInk,
      });
      page.drawLine({
        start: { x: x + s / 2, y: yy + s - 2.6 },
        end: { x: x + s - 1.6, y: yy + 1.4 },
        thickness: 1.1,
        color: cInk,
      });
    }
  };

  const draw = (
    text: string,
    x: number,
    yy: number,
    size: number,
    f: PDFFontLike,
    color = cInk
  ) => {
    page.drawText(sanitize(text), { x, y: yy, size, font: f as never, color });
  };

  const now = new Date();
  const dateLong = now.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLong = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  /* --- Cabecera con poste de peluquero --- */
  const poleW = 11;
  const poleH = 27;
  const poleX = MARGIN;
  const poleTop = y - 2;
  // bola superior
  page.drawCircle({
    x: poleX + poleW / 2,
    y: poleTop + 3.4,
    size: 3.4,
    color: cGold,
    borderColor: cInk,
    borderWidth: 0.7,
  });
  // cuerpo blanco
  page.drawRectangle({
    x: poleX,
    y: poleTop - poleH,
    width: poleW,
    height: poleH,
    color: cWhite,
    borderColor: cInk,
    borderWidth: 0.9,
  });
  // franjas diagonales (roja, azul, roja)
  const stripes: { off: number; color: typeof cRed }[] = [
    { off: 4.6, color: cRed },
    { off: 10.6, color: cBlue },
    { off: 16.6, color: cRed },
  ];
  for (const s of stripes) {
    page.drawLine({
      start: { x: poleX + 1.4, y: poleTop - poleH + s.off },
      end: { x: poleX + poleW - 1.4, y: poleTop - poleH + s.off + 3.4 },
      thickness: 2.6,
      color: s.color,
    });
  }

  draw(salon.name, MARGIN + poleW + 9, poleTop - 15, 14.5, fontBold, cPine);
  draw("Gestión de citas", MARGIN + poleW + 9, poleTop - 25, 7, font, cGold);

  const dateStr = `En ${dateLong}`;
  draw(
    dateStr,
    PAGE_W - MARGIN - font.widthOfTextAtSize(sanitize(dateStr), 8),
    poleTop - 12,
    8,
    font,
    cSoft
  );
  const timeStr = `a las ${timeLong}`;
  draw(
    timeStr,
    PAGE_W - MARGIN - font.widthOfTextAtSize(sanitize(timeStr), 8),
    poleTop - 23,
    8,
    font,
    cSoft
  );

  y = poleTop - poleH - 8;

  /* --- Título --- */
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.2,
    color: cGold,
  });
  y -= 15;
  draw("CONSENTIMIENTO INFORMADO", MARGIN, y, 12.5, fontBold, cInk);
  y -= 12;
  draw(
    "Tratamiento de datos personales · RGPD (UE) 2016/679 y LOPDGDD 3/2018",
    MARGIN,
    y,
    7.6,
    font,
    cSoft
  );
  y -= 15;

  /* --- Datos del responsable y del cliente --- */
  const colW = (CONTENT_W - 14) / 2;
  const col2X = MARGIN + colW + 14;
  const infoBox = (title: string, height: number) => {
    page.drawRectangle({
      x: MARGIN,
      y: y - height,
      width: CONTENT_W,
      height,
      color: rgb(0.96, 0.98, 0.96),
      borderColor: cLine,
      borderWidth: 0.6,
    });
    draw(title, MARGIN + 9, y - 13, 7.6, fontBold, cPine);
    y -= 24;
  };
  const info = (label: string, value: string, x: number, width: number) => {
    draw(label, x, y, 6.5, fontBold, cSoft);
    const lines = wrapText(value || "No facilitado", font, 7.8, width).slice(0, 2);
    lines.forEach((line, i) => draw(line, x, y - 9 - i * 8.5, 7.8, font, cInk));
  };

  infoBox("RESPONSABLE DEL TRATAMIENTO", 64);
  info("Nombre comercial", salon.name, MARGIN + 9, colW - 9);
  info(
    "Razón social / NIF-CIF",
    [salon.fiscalName && salon.fiscalName !== salon.name ? salon.fiscalName : "", salon.nif].filter(Boolean).join(" · "),
    col2X,
    colW - 9
  );
  y -= 24;
  info("Domicilio", salonAddress(salon), MARGIN + 9, colW - 9);
  info(
    "Contacto",
    [salon.phone, salon.email].filter(Boolean).join(" · "),
    col2X,
    colW - 9
  );
  y -= 27;

  infoBox("DATOS DEL CLIENTE", 64);
  info("Nombre completo", client.name, MARGIN + 9, colW - 9);
  info("Teléfono", client.phone, col2X, colW - 9);
  y -= 24;
  info("Correo electrónico", client.email, MARGIN + 9, colW - 9);
  info(
    "Dirección",
    [client.street, [client.zip, client.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    col2X,
    colW - 9
  );
  y -= 27;

  /* --- Cláusulas (compactas, una columna) --- */
  for (const clause of getConsentClauses(salon)) {
    const bodyLines = clause.body.flatMap((p) =>
      wrapText(p, font, 7.7, CONTENT_W - 8)
    );
    draw(clause.title, MARGIN, y, 8.2, fontBold, cPine);
    y -= 10.2;
    for (const ln of bodyLines) {
      draw(ln, MARGIN + 8, y, 7.7, font, cInk);
      y -= 9.6;
    }
    y -= 3.4;
  }

  /* --- Bloque de aceptaciones --- */
  y -= 2;
  const acceptanceMain = `El/la cliente manifiesta haber leído y comprendido la información anterior y CONSENTE el tratamiento de sus datos personales por ${salon.name} para la gestión de la relación comercial y la prestación del servicio.`;
  const accLines = wrapText(acceptanceMain, font, 7.7, CONTENT_W - 30);
  const marketingText = opts.marketing
    ? "Acepto recibir comunicaciones comerciales y novedades del salón."
    : "NO acepto recibir comunicaciones comerciales del salón.";

  const boxPad = 7;
  const boxH =
    boxPad + accLines.length * 9.6 + 9.6 + 4 + boxPad;
  // Fondo suave del color de acento de la aplicación.
  page.drawRectangle({
    x: MARGIN,
    y: y - boxH,
    width: CONTENT_W,
    height: boxH,
    color: rgb(0xf4 / 255, 0xe3 / 255, 0xe8 / 255),
    borderColor: cGold,
    borderWidth: 0.6,
  });
  y -= boxPad;
  // casilla principal (marcada)
  checkbox(MARGIN + 8, y - 7.4, true);
  accLines.forEach((ln, i) => {
    draw(ln, MARGIN + 24, y - i * 9.6, 7.7, font, cInk);
  });
  y -= accLines.length * 9.6 + 4;
  // casilla marketing
  checkbox(MARGIN + 8, y - 7.4, opts.marketing);
  draw(marketingText, MARGIN + 24, y, 7.7, font, cInk);
  y -= 9.6 + boxPad + 8;

  /* --- Firma (misma página) --- */
  // Si por datos muy largos el contenido bajara demasiado, fijamos el bloque
  // de firma por encima del pie para no saltar de página.
  const sigH = 62;
  const captionSpace = 13;
  const footerY = 64;
  if (y - sigH - captionSpace - 12 < footerY + 6) {
    y = footerY + 6 + sigH + captionSpace + 12;
  }

  const sigMaxW = 205;
  let sigW = sigMaxW;
  let sigH2 = 52;
  try {
    const sigPng = await doc.embedPng(opts.signatureDataUrl);
    const ratio = sigPng.width / sigPng.height;
    sigW = Math.min(sigMaxW - 14, ratio * (sigH - 10));
    sigH2 = sigW / ratio;
    if (sigH2 > sigH - 10) {
      sigH2 = sigH - 10;
      sigW = sigH2 * ratio;
    }
    page.drawRectangle({
      x: MARGIN,
      y: y - sigH,
      width: sigMaxW,
      height: sigH,
      color: rgb(0.985, 0.985, 0.975),
      borderColor: cLine,
      borderWidth: 0.8,
    });
    page.drawImage(sigPng, {
      x: MARGIN + (sigMaxW - sigW) / 2,
      y: y - sigH + (sigH - sigH2) / 2,
      width: sigW,
      height: sigH2,
    });
  } catch {
    page.drawRectangle({
      x: MARGIN,
      y: y - sigH,
      width: sigMaxW,
      height: sigH,
      color: rgb(0.985, 0.985, 0.975),
      borderColor: cLine,
      borderWidth: 0.8,
    });
  }
  draw("Firma del cliente/a", MARGIN + 2, y - sigH - 10, 7, fontBold, cSoft);

  // Bloque de datos a la derecha de la firma
  const fx = MARGIN + sigMaxW + 26;
  const fw = PAGE_W - MARGIN - fx;
  draw("Lugar y fecha de firma", fx, y - 6, 7, fontBold, cSoft);
  y -= 16;
  for (const ln of wrapText(`${salonAddress(salon) || salon.name}, ${dateLong}`, font, 8.4, fw).slice(0, 2)) {
    draw(ln, fx, y, 8.4, font, cInk);
    y -= 10.5;
  }
  draw(`Hora: ${timeLong}`, fx, y, 8.4, font, cInk);
  y -= 10.5;
  draw(
    opts.marketing
      ? "Comunicaciones comerciales: Aceptadas"
      : "Comunicaciones comerciales: Rechazadas",
    fx,
    y,
    7.2,
    font,
    cSoft
  );
  y -= 9.5;
  if (salon.nif) {
    draw(`NIF/CIF: ${salon.nif}`, fx, y, 7.2, font, cSoft);
    y -= 9.5;
  }

  /* --- Pie --- */
  page.drawLine({
    start: { x: MARGIN, y: footerY + 10 },
    end: { x: PAGE_W - MARGIN, y: footerY + 10 },
    thickness: 0.7,
    color: cLine,
  });
  draw(
    `Documento generado electrónicamente por ${salon.fiscalName || salon.name} · Versión del texto: v${CONSENT_TEXT_VERSION}`,
    MARGIN,
    footerY,
    6.6,
    font,
    cSoft
  );

  return doc.save();
}
