"use client";

import { useRef, useState } from "react";
import type { Client } from "../lib/types";
import { CONSENT_TEXT_VERSION } from "../lib/types";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import Modal from "./aura-modal";
import SignaturePad, {
  type SignaturePadApi,
} from "./signature-pad";
import {
  getConsentClauses,
  buildConsentPdf,
  bytesToBase64,
} from "../lib/consent-pdf";
import { IcCheck, IcFileText, IcPenNib, IcShieldCheck } from "./icons";

interface Props {
  client: Client;
  onClose: () => void;
}

export default function ConsentModal({ client, onClose }: Props) {
  const { addConsent, db } = useStore();
  const { toast } = useUI();
  const salon = db.salon;
  const clauses = getConsentClauses(salon);
  const sigApi = useRef<SignaturePadApi | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!accepted) {
      setError("El cliente debe marcar la casilla de consentimiento.");
      return;
    }
    const signature = sigApi.current?.toPng();
    if (!signature) {
      setError("Falta la firma manuscrita del cliente.");
      return;
    }
    setSaving(true);
    try {
      const bytes = await buildConsentPdf({
        client,
        salon,
        signatureDataUrl: signature,
        marketing,
      });
      addConsent({
        clientId: client.id,
        signedAt: new Date().toISOString(),
        textVersion: CONSENT_TEXT_VERSION,
        marketing,
        clientName: client.name,
        pdfBase64: bytesToBase64(bytes),
      });
      toast("Consentimiento firmado y guardado en PDF");
      onClose();
    } catch (e) {
      console.error(e);
      setError(
        "No se pudo generar el PDF del consentimiento. Inténtalo de nuevo."
      );
      setSaving(false);
    }
  }

  const cbx =
    "mt-0.5 w-4.5 h-4.5 shrink-0 rounded border-2 border-linedark bg-white text-pine focus:ring-moss/40 cursor-pointer";

  return (
    <Modal
      title="Consentimiento de protección de datos"
      subtitle={`${client.name} · se generará un PDF firmado y quedará guardado en la base de datos`}
      onClose={onClose}
      z={1000}
      maxW="max-w-xl"
    >
      <div className="space-y-4">
        {/* Aviso de modalidad */}
        <div className="flex items-start gap-2.5 rounded-lg bg-mint/70 border border-moss/25 px-3 py-2.5">
          <IcShieldCheck size={16} className="text-moss mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed text-moss">
            Entrega el teléfono al cliente: debe leer la información, marcar su
            conformidad y <strong>firmar con el dedo en la pantalla táctil</strong>.
            El documento se archiva automáticamente en su ficha.
          </p>
        </div>

        {/* Texto legal */}
        <div className="rounded-xl border border-line bg-paper/70 overflow-hidden">
          <div className="px-4 py-2.5 bg-pine/95 flex items-center gap-2">
            <IcFileText size={14} className="text-moss shrink-0" />
            <p className="text-xs font-bold text-paper">
              Información previa · RGPD (UE) 2016/679 y LOPDGDD 3/2018
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto px-4 py-3 space-y-3">
            {clauses.map((c) => (
              <div key={c.title}>
                <p className="text-[11px] font-bold text-pine">{c.title}</p>
                {c.body.map((p, i) => (
                  <p key={i} className="text-[11.5px] leading-relaxed text-soft mt-0.5">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Aceptaciones */}
        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className={cbx}
              style={{ width: 18, height: 18 }}
            />
            <span className="text-xs leading-relaxed text-ink">
              <strong>He leído y acepto</strong> el tratamiento de mis datos
              personales por {salon.name} para gestionar citas, historial de
              servicios y la relación comercial. *
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className={cbx}
              style={{ width: 18, height: 18 }}
            />
            <span className="text-xs leading-relaxed text-soft">
              Acepto recibir <strong>comunicaciones comerciales</strong> y
              novedades del salón (opcional).
            </span>
          </label>
        </div>

        {/* Firma */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-soft mb-1.5">
            Firma del cliente/a *
          </p>
          <SignaturePad apiRef={sigApi} onChange={setHasSignature} />
        </div>

        {error && (
          <p className="text-xs font-medium text-danger bg-dangersoft border border-danger/20 rounded-lg px-3 py-2 anim-fade">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint/60 hover:text-ink transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !accepted || !hasSignature}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-paper/40 border-t-paper rounded-full animate-spin" />
                Generando PDF…
              </>
            ) : (
              <>
                <IcPenNib size={15} /> Firmar y guardar
              </>
            )}
          </button>
        </div>

        <p className="text-[10px] text-faint text-center">
          {accepted && hasSignature && !saving ? (
            <span className="inline-flex items-center gap-1 text-moss">
              <IcCheck size={11} /> Listo para firmar
            </span>
          ) : (
            "Campos obligatorios: casilla de aceptación y firma manuscrita"
          )}
        </p>
      </div>
    </Modal>
  );
}
