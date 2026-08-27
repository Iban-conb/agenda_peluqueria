"use client";

import { useMemo, useState } from "react";
import type { Appointment, Client, Consent } from "../lib/types";
import { fmtShortDate, minutesToLabel, norm, todayKey } from "../lib/date-utils";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import StatusPill from "../components/status-pill";
import ConsentModal from "../components/consent-modal";
import ConsentViewer from "../components/consent-viewer";
import { consentToObjectUrl } from "../lib/consent-pdf";
import {
  IcArrowL,
  IcDownload,
  IcFileText,
  IcMail,
  IcPencil,
  IcPenNib,
  IcPhone,
  IcPin,
  IcPlus,
  IcSearch,
  IcShieldCheck,
  IcTrash,
  IcUserPlus,
  IcUsers,
} from "../components/icons";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return (
    <span
      className="rounded-full flex items-center justify-center font-display font-bold text-paper shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${h} 36% 38%), hsl(${h} 42% 28%))` }}
    >
      {initials(name)}
    </span>
  );
}

interface ClientStats {
  count: number;
  last?: Appointment;
  next?: Appointment;
}

export default function ClientsView() {
  const { db, deleteClient, clientById, deleteConsent } = useStore();
  const { toast, confirm, openAppointment, openClient } = useUI();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consentFor, setConsentFor] = useState<Client | null>(null);
  const [viewConsent, setViewConsent] = useState<Consent | null>(null);
  const today = todayKey();

  const stats = useMemo(() => {
    const m = new Map<string, ClientStats>();
    for (const c of db.clients) m.set(c.id, { count: 0 });
    for (const a of db.appointments) {
      const s = m.get(a.clientId);
      if (!s) continue;
      s.count++;
      const isPast = a.date < today || (a.date === today && a.start + a.duration < new Date().getHours() * 60 + new Date().getMinutes());
      if (!isPast && a.status !== "cancelada") {
        if (!s.next || a.date < s.next.date || (a.date === s.next.date && a.start < s.next.start)) s.next = a;
      }
      if (isPast || a.status === "completada") {
        if (!s.last || a.date > s.last.date || (a.date === s.last.date && a.start > s.last.start)) s.last = a;
      }
    }
    return m;
  }, [db.appointments, db.clients, today]);

  const clients = useMemo(() => {
    const term = norm(q.trim());
    return db.clients
      .filter((c) => !term || norm(`${c.name} ${c.phone} ${c.email} ${c.city} ${c.street} ${c.zip}`).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [db.clients, q]);

  const selected = selectedId ? clientById(selectedId) : undefined;
  const selectedAppts = useMemo(
    () =>
      selected
        ? db.appointments.filter((a) => a.clientId === selected.id).sort((x, y) => (y.date + String(y.start).padStart(4, "0")).localeCompare(x.date + String(x.start).padStart(4, "0")))
        : [],
    [db.appointments, selected]
  );

  const clientConsents = useMemo(
    () =>
      selected
        ? db.consents
            .filter((c) => c.clientId === selected.id)
            .sort((a, b) => b.signedAt.localeCompare(a.signedAt))
        : [],
    [db.consents, selected]
  );

  async function removeClient(c: Client) {
    const n = stats.get(c.id)?.count ?? 0;
    const nc = db.consents.filter((x) => x.clientId === c.id).length;
    const ok = await confirm({
      title: "Eliminar cliente",
      message:
        n > 0
          ? `Se eliminará a ${c.name}, sus ${n} ${n === 1 ? "cita registrada" : "citas registradas"}${nc > 0 ? ` y ${nc} ${nc === 1 ? "consentimiento firmado" : "consentimientos firmados"}` : ""}. ¿Continuar?`
          : `¿Seguro que quieres eliminar a ${c.name}?`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    deleteClient(c.id);
    setSelectedId(null);
    toast("Cliente eliminado", "info");
  }

  async function removeConsent(c: Consent) {
    const ok = await confirm({
      title: "Eliminar consentimiento",
      message:
        "Se borrará el consentimiento firmado y su PDF de la base de datos. Esta acción no se puede deshacer. ¿Continuar?",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    deleteConsent(c.id);
    if (viewConsent?.id === c.id) setViewConsent(null);
    toast("Consentimiento eliminado", "info");
  }

  function downloadConsent(c: Consent) {
    try {
      const url = consentToObjectUrl(c.pdfBase64);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consentimiento-${c.clientName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}-${c.signedAt.slice(0, 10)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      toast("No se pudo descargar el PDF", "err");
    }
  }

  function openConsentInBrowser(c: Consent) {
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setViewConsent(c);
      toast("El navegador ha bloqueado la nueva pestaña. Usa el visor integrado.", "info");
      return;
    }
    try {
      const url = consentToObjectUrl(c.pdfBase64);
      popup.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    } catch {
      popup.close();
      toast("No se pudo abrir el PDF", "err");
    }
  }

  const fmtConsentDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      {consentFor && (
        <ConsentModal client={consentFor} onClose={() => setConsentFor(null)} />
      )}
      {viewConsent && (
        <ConsentViewer
          consent={viewConsent}
          onClose={() => setViewConsent(null)}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight text-ink">Clientes</h1>
          <p className="text-sm text-soft mt-0.5">
            {db.clients.length} {db.clients.length === 1 ? "cliente" : "clientes"} en tu base de datos
          </p>
        </div>
        <div className="relative w-full sm:w-72 order-3 sm:order-none">
          <IcSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, teléfono, ciudad…"
            className="w-full rounded-lg border border-linedark bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/25 transition-shadow placeholder:text-faint shadow-sm"
          />
        </div>
        <button
          onClick={() => openClient()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-3.5 py-2 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
        >
          <IcUserPlus size={15} /> Nuevo cliente
        </button>
      </div>

      <div className="grid gap-4 items-start">
        {/* lista */}
        <div className="min-w-0 space-y-2">
          {clients.length === 0 && db.clients.length === 0 && (
            <div className="rounded-xl border border-dashed border-linedark bg-card/60 py-16 text-center anim-rise">
              <span className="inline-flex w-14 h-14 rounded-full bg-mint text-moss items-center justify-center mb-3">
                <IcUsers size={26} />
              </span>
              <p className="font-display font-bold text-lg text-ink">Aún no hay clientes</p>
              <p className="text-sm text-soft mb-4">Añade tu primer cliente con nombre, dirección y teléfono.</p>
              <button
                onClick={() => openClient()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold hover:bg-pine2 transition-colors shadow-sm"
              >
                <IcUserPlus size={16} /> Añadir cliente
              </button>
            </div>
          )}
          {clients.length === 0 && db.clients.length > 0 && (
            <div className="rounded-xl border border-dashed border-linedark bg-card/60 py-12 text-center anim-fade">
              <p className="font-display font-bold text-ink">Sin resultados para «{q}»</p>
              <p className="text-sm text-soft">Prueba con otro nombre o número de teléfono.</p>
            </div>
          )}
          {clients.map((c, i) => {
            const s = stats.get(c.id);
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`anim-rise w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-md hover:-translate-y-px ${
                  active ? "border-moss bg-mint/50 shadow-sm ring-1 ring-moss/40" : "border-line bg-card shadow-sm"
                }`}
                style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
              >
                <Avatar name={c.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink truncate">{c.name}</span>
                  <span className="block text-xs text-soft truncate">
                    {c.phone}
                    {c.city ? ` · ${c.city}` : ""}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[11px] font-bold text-moss bg-mint rounded-full px-2 py-0.5 num">
                    {s?.count ?? 0} {s?.count === 1 ? "cita" : "citas"}
                  </span>
                  {s?.next && (
                    <span className="block text-[10px] text-faint mt-1 num">
                      próxima: {fmtShortDate(s.next.date)} {minutesToLabel(s.next.start)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* detalle */}
        <div className={selected ? "fixed inset-0 z-[100] flex items-start justify-center px-3 pt-24 pb-5 sm:px-6" : "hidden"}>
          {selected && (
            <>
              <button
                type="button"
                aria-label="Cerrar ficha del cliente"
                className="absolute inset-0 bg-pine/45 backdrop-blur-[2px] anim-fade cursor-default"
                onClick={() => setSelectedId(null)}
                tabIndex={-1}
              />
              <div className="relative w-full max-w-6xl max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-line bg-card shadow-2xl anim-pop">
              <div className="bg-pine px-4 py-4 flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="p-1 -ml-1 rounded text-paper/70 hover:text-paper" aria-label="Cerrar ficha">
                  <IcArrowL size={18} />
                </button>
                <Avatar name={selected.name} size={46} />
                <div className="min-w-0">
                  <p className="font-display font-bold text-paper leading-tight truncate">{selected.name}</p>
                  <p className="text-[11px] text-paper/60">Cliente desde {fmtShortDate(selected.createdAt.slice(0, 10))}</p>
                </div>
              </div>

              <div className="p-4 grid lg:grid-cols-2 gap-5 items-start">
                <div className="space-y-3">
                <div className="flex gap-2">
                  <a
                    href={`tel:${selected.phone.replace(/\s/g, "")}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-mint text-moss border border-moss/40 px-3 py-2 text-xs font-bold hover:bg-moss/15 transition-colors"
                  >
                    <IcPhone size={14} /> Llamar
                  </a>
                  <button
                    onClick={() => openClient(selected)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-linedark px-3 py-2 text-xs font-bold text-soft hover:bg-mint hover:text-ink transition-colors"
                  >
                    <IcPencil size={14} /> Editar
                  </button>
                  <button
                    onClick={() => removeClient(selected)}
                    className="inline-flex items-center justify-center rounded-lg border border-danger/30 text-danger px-3 py-2 hover:bg-dangersoft transition-colors"
                    title="Eliminar cliente"
                  >
                    <IcTrash size={14} />
                  </button>
                </div>

                <div className="rounded-lg bg-paper/80 border border-line p-3 space-y-1.5 text-sm">
                  <p className="flex items-center gap-2">
                    <IcPhone size={14} className="text-faint shrink-0" />
                    <span className="num font-medium">{selected.phone || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <IcMail size={14} className="text-faint shrink-0" />
                    {selected.email ? (
                      <a
                        href={`mailto:${selected.email}`}
                        className="font-medium text-moss hover:underline break-all"
                      >
                        {selected.email}
                      </a>
                    ) : (
                      <span className="text-faint">Sin correo registrado</span>
                    )}
                  </p>
                  <p className="flex items-start gap-2">
                    <IcPin size={14} className="text-faint shrink-0 mt-0.5" />
                    <span className="text-soft">
                      {selected.street || "Dirección sin registrar"}
                      {(selected.zip || selected.city) && (
                        <>
                          <br />
                          {[selected.zip, selected.city].filter(Boolean).join(" · ")}
                        </>
                      )}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: String(stats.get(selected.id)?.count ?? 0), l: "citas" },
                    { v: stats.get(selected.id)?.next ? fmtShortDate(stats.get(selected.id)!.next!.date) : "—", l: "próxima" },
                    { v: stats.get(selected.id)?.last ? fmtShortDate(stats.get(selected.id)!.last!.date) : "—", l: "última" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg bg-mint/50 border border-line py-2">
                      <p className="font-display font-bold text-sm num leading-none text-pine">{x.v}</p>
                      <p className="text-[10px] text-soft mt-1">{x.l}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => openAppointment({ clientId: selected.id })}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-pine text-paper px-3 py-2.5 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
                >
                  <IcPlus size={14} /> Nueva cita para {selected.name.split(" ")[0]}
                </button>
                </div>

                {/* Consentimiento RGPD */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
                      Protección de datos (RGPD)
                    </h4>
                    {clientConsents.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint text-moss text-[10px] font-bold px-2 py-0.5">
                        <IcShieldCheck size={11} /> Firmado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint text-moss text-[10px] font-bold px-2 py-0.5">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setConsentFor(selected)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-pine text-paper px-3 py-2.5 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm mb-3"
                  >
                    <IcPenNib size={13} /> Nueva firma / renovar
                  </button>

                  {clientConsents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-moss/50 bg-mint/50 px-3 py-3 text-center">
                      <p className="text-xs font-bold text-moss">
                        Sin consentimiento firmado
                      </p>
                      <p className="text-[11px] text-soft mt-0.5 mb-2.5 leading-relaxed">
                        El cliente debe firmar el consentimiento de tratamiento
                        de datos en la pantalla táctil.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {clientConsents.map((c, i) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg border border-line bg-paper/60 px-2.5 py-2"
                        >
                          <span className="w-7 h-7 rounded-lg bg-mint text-moss flex items-center justify-center shrink-0">
                            <IcShieldCheck size={14} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-ink">
                              {fmtConsentDate(c.signedAt)}
                              {i === 0 && (
                                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-moss bg-mint rounded-full px-1.5 py-0.5">
                                  vigente
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] text-faint truncate">
                              {c.marketing
                                ? "Acepta comunicaciones comerciales"
                                : "Sin comunicaciones comerciales"}{" "}
                              · PDF guardado
                            </span>
                          </span>
                          <button
                            onClick={() => openConsentInBrowser(c)}
                            className="p-1.5 rounded-lg text-soft hover:text-ink hover:bg-mint transition-colors shrink-0"
                            title="Ver PDF del consentimiento"
                          >
                            <IcFileText size={14} />
                          </button>
                          <button
                            onClick={() => downloadConsent(c)}
                            className="p-1.5 rounded-lg text-soft hover:text-ink hover:bg-mint transition-colors shrink-0"
                            title="Descargar PDF"
                          >
                            <IcDownload size={14} />
                          </button>
                          <button
                            onClick={() => removeConsent(c)}
                            className="p-1.5 rounded-lg text-soft hover:text-danger hover:bg-dangersoft transition-colors shrink-0"
                            title="Eliminar consentimiento"
                          >
                            <IcTrash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedAppts.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint mb-1.5">Historial de citas</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                      {selectedAppts.slice(0, 12).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => openAppointment({ appt: a })}
                          className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-mint/70 transition-colors text-left"
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
                          <span className="text-xs font-semibold num w-20 shrink-0">
                            {fmtShortDate(a.date)} · {minutesToLabel(a.start)}
                          </span>
                          <span className="text-xs text-soft truncate flex-1">{a.serviceName}</span>
                          <StatusPill status={a.status} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
