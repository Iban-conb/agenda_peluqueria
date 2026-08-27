"use client";

import { useEffect, useState } from "react";
import Modal from "./aura-modal";
import { IcDownload, IcMobile } from "./icons";

export default function InstallModal({
  onClose,
  onInstall,
  installAvailable,
}: {
  onClose: () => void;
  onInstall: () => void;
  installAvailable: boolean;
}) {
  const [appUrl, setAppUrl] = useState("");
  const [secureContext, setSecureContext] = useState(true);
  useEffect(() => {
    const fallback = window.location.href;
    const publishedUrl = process.env.NEXT_PUBLIC_PWA_URL?.trim();
    setAppUrl(publishedUrl || fallback);
    setSecureContext(window.isSecureContext);
    if (publishedUrl) return;
    fetch("/api")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { url?: string; httpsUrl?: string } | null) => {
        if (data?.httpsUrl || data?.url) setAppUrl(data.httpsUrl || data.url || fallback);
      })
      .catch(() => {
        // Se mantiene la URL actual como alternativa.
      });
  }, []);
  const qrUrl = appUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(appUrl)}`
    : "";

  return (
    <Modal
      title="Instalar la aplicación"
      subtitle="Escanea este código con la cámara del móvil"
      onClose={onClose}
      z={70}
      maxW="max-w-md"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Código QR para abrir la aplicación en el móvil"
              width={240}
              height={240}
              className="block w-56 h-56 sm:w-60 sm:h-60"
            />
          ) : (
            <div className="w-56 h-56 bg-mint rounded-xl" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink">
            Abre el enlace y añade la app a la pantalla de inicio.
          </p>
          <p className="text-xs text-soft leading-relaxed">
            En Android usa el menú de Chrome y elige «Instalar aplicación» o
            «Añadir a pantalla de inicio». En iPhone, pulsa Compartir y después
            «Añadir a pantalla de inicio».
          </p>
        </div>
        {installAvailable && (
          <button
            onClick={onInstall}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-moss text-paper font-display font-bold text-sm px-4 py-2.5 hover:bg-pine2 active:scale-[0.98] transition-all shadow-md"
          >
            <IcDownload size={16} /> Instalar en este dispositivo
          </button>
        )}
        {!secureContext && (
          <p className="w-full rounded-lg border border-warnfg/30 bg-warnsoft px-3 py-2 text-xs text-warnfg leading-relaxed">
            Se ha preparado un acceso HTTPS local temporal. La primera vez que
            abras el enlace en el móvil tendrás que aceptar el aviso del
            certificado local para poder instalarla como PWA.
          </p>
        )}
        <p className="inline-flex items-center gap-1.5 text-[11px] text-faint">
          <IcMobile size={13} /> La aplicación funciona también sin conexión.
        </p>
      </div>
    </Modal>
  );
}
