"use client";

/**
 * Visor del PDF de consentimiento guardado en la base de datos.
 * Muestra el documento embebido y permite descargarlo o abrirlo aparte.
 */

import { useEffect, useState } from "react";
import type { Consent } from "../lib/types";
import { consentToObjectUrl } from "../lib/consent-pdf";
import Modal from "./aura-modal";
import { IcDownload, IcSparkle } from "./icons";

interface Props {
  consent: Consent;
  onClose: () => void;
}

export default function ConsentViewer({ consent, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    try {
      objectUrl = consentToObjectUrl(consent.pdfBase64);
      setUrl(objectUrl);
    } catch {
      setFailed(true);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [consent]);

  const fileName = `consentimiento-${consent.clientName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${consent.signedAt.slice(0, 10)}.pdf`;

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }

  const signed = new Date(consent.signedAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal
      title="Consentimiento firmado"
      subtitle={`${consent.clientName} · firmado el ${signed}${
        consent.marketing ? " · acepta comunicaciones comerciales" : ""
      }`}
      onClose={onClose}
      z={60}
      maxW="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-paper/70 overflow-hidden">
          {url ? (
            <iframe
              src={url}
              title={`Consentimiento de ${consent.clientName}`}
              className="w-full h-[calc(100dvh-10rem)] min-h-[65dvh] bg-white"
            />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center px-6">
              {failed ? (
                <>
                  <IcSparkle size={26} className="text-moss mb-2" />
                  <p className="text-sm font-semibold text-ink">
                    No se puede mostrar el documento
                  </p>
                  <p className="text-xs text-soft mt-1">
                    El PDF está dañado o no se puede abrir en este visor. Prueba
                    a descargarlo.
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className="w-8 h-8 border-[3px] border-moss/25 border-t-moss rounded-full animate-spin" />
                  <p className="text-xs text-faint">Abriendo documento…</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint/60 hover:text-ink transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => url && window.open(url, "_blank")}
            disabled={!url}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint hover:text-ink transition-colors disabled:opacity-50"
          >
            Abrir visor PDF
          </button>
          <button
            onClick={download}
            disabled={!url}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
          >
            <IcDownload size={15} /> Descargar PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
