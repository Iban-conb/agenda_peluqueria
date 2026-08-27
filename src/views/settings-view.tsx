"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Consent, SalonInfo, Service } from "../lib/types";
import {
  DEFAULT_SALON,
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS,
  SERVICE_COLORS,
  WEEKDAY_LABELS,
  normalizeSalon,
} from "../lib/types";
import { dbSizeKB } from "../lib/indexeddb";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import { exportToSQLiteBlob, importFromSQLiteBlob } from "../lib/sqlite-export";
import {
  exportCalendarPdf,
  importHolidaysFromPdf,
  type ImportedCalendar,
} from "../lib/calendar-pdf";
import {
  getStoredClientId,
  setStoredClientId,
} from "../lib/drive-sync";
import { useDriveSyncContext } from "../components/drive-sync-provider";
import { useTheme, THEMES, type ThemeId } from "../state/theme";
import Modal, { Field, inputCls } from "../components/aura-modal";
import InstallModal from "../components/install-modal";
import {
  IcAlert,
  IcBan,
  IcBarberPole,
  IcCalendar,
  IcCheck,
  IcDownload,
  IcMobile,
  IcMonitor,
  IcPencil,
  IcPlus,
  IcScissors,
  IcTrash,
  IcUpload,
  IcWifi,
} from "../components/icons";

function Section({
  title,
  icon,
  children,
  desc,
  defaultOpen = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  desc?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-line bg-card shadow-sm overflow-hidden anim-rise">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-2.5 px-4 py-3 bg-paper/60 cursor-pointer select-none text-left hover:bg-mint/30 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-mint text-moss flex items-center justify-center">
          {icon}
        </span>
        <div>
          <h2 className="font-display font-bold text-sm leading-none text-ink">
            {title}
          </h2>
          {desc && <p className="text-[11px] text-faint mt-0.5">{desc}</p>}
        </div>
        </span>
        <span className={`text-moss text-lg leading-none transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
}

/** Valida y normaliza una lista de consentimientos leída de un backup JSON. */
function parseConsents(raw: unknown): Consent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Consent =>
      !!c &&
      typeof c === "object" &&
      typeof (c as Consent).id === "string" &&
      typeof (c as Consent).clientId === "string" &&
      typeof (c as Consent).signedAt === "string" &&
      typeof (c as Consent).pdfBase64 === "string"
  );
}

/* ---------- sección de datos del salón ---------- */
function SalonSection() {
  const { db, setSalon } = useStore();
  const { toast } = useUI();
  const [form, setForm] = useState<SalonInfo>(() => ({
    ...DEFAULT_SALON,
    ...db.salon,
  }));
  const [error, setError] = useState("");

  const set =
    (k: keyof SalonInfo) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function save() {
    if (!form.name.trim()) {
      setError("El nombre comercial del salón es obligatorio.");
      return;
    }
    const mail = form.email.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setError("El correo electrónico del salón no parece válido.");
      return;
    }
    setError("");
    setSalon({
      ...form,
      name: form.name.trim(),
      email: mail,
    });
    toast("Datos del salón actualizados");
  }

  return (
    <Section
      title="Datos del salón"
      desc="Nombre y datos fiscales: se muestran en la aplicación y se usan en los documentos legales"
      icon={<IcBarberPole size={15} />}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre comercial *" hint="Aparece en la cabecera de la app">
            <input
              className={inputCls}
              value={form.name}
              onChange={set("name")}
              placeholder="Peluquería Marisa"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
          <Field label="Nombre fiscal / razón social" hint="Solo si difiere del comercial">
            <input
              className={inputCls}
              value={form.fiscalName}
              onChange={set("fiscalName")}
              placeholder="p. ej. Marisa López García"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="NIF/CIF">
            <input
              className={inputCls + " uppercase"}
              value={form.nif}
              onChange={set("nif")}
              placeholder="12345678A"
              autoCapitalize="characters"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
          <Field label="Teléfono">
            <input
              className={inputCls}
              value={form.phone}
              onChange={set("phone")}
              placeholder="612 345 678"
              inputMode="tel"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Correo electrónico">
              <input
                className={inputCls}
                value={form.email}
                onChange={set("email")}
                placeholder="peluqueriamarisa@correo.com"
                inputMode="email"
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </Field>
          </div>
        </div>
        <Field label="Calle y número">
          <input
            className={inputCls}
            value={form.street}
            onChange={set("street")}
            placeholder="Calle, número, piso…"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="C. Postal">
            <input
              className={inputCls}
              value={form.zip}
              onChange={set("zip")}
              placeholder="28012"
              inputMode="numeric"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
          <Field label="Ciudad">
            <input
              className={inputCls}
              value={form.city}
              onChange={set("city")}
              placeholder="Madrid"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
        </div>

        {error && (
          <p className="text-xs font-medium text-danger bg-dangersoft border border-danger/20 rounded-lg px-3 py-2 anim-fade">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-faint leading-relaxed">
            Estos datos alimentan el consentimiento RGPD y los PDF firmados.
          </p>
          <button
            onClick={save}
            className="shrink-0 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
          >
            Guardar datos
          </button>
        </div>
      </div>
    </Section>
  );
}

/* ---------- sección de calendario laboral ---------- */
const MONTH_SHORT_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function CalendarSection() {
  const { db, setSettings } = useStore();
  const { toast } = useUI();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportedCalendar | null>(null);
  const [exporting, setExporting] = useState(false);

  // Años disponibles: año actual + años presentes en los días cerrados
  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    for (const d of db.settings.closedDates) {
      const y = +d.slice(0, 4);
      if (y > 1990 && y < 2200) ys.add(y);
    }
    return Array.from(ys).sort((a, b) => a - b);
  }, [db.settings.closedDates]);

  // Por defecto: el año con más festivos configurados (o el actual)
  const [exportYear, setExportYear] = useState<number>(() => {
    const counts = new Map<number, number>();
    for (const d of db.settings.closedDates) {
      const y = +d.slice(0, 4);
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    let best = new Date().getFullYear();
    let bestN = 0;
    counts.forEach((n, y) => {
      if (n > bestN) {
        best = y;
        bestN = n;
      }
    });
    return best;
  });

  async function onImportPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    try {
      const res = await importHolidaysFromPdf(f);
      setPreview(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo leer el calendario.", "err");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  function applyImport(mode: "add" | "replace") {
    if (!preview) return;
    const year = preview.year;
    let next: string[];
    if (mode === "add") {
      next = Array.from(new Set([...db.settings.closedDates, ...preview.holidays])).sort();
    } else {
      next = Array.from(
        new Set([
          ...db.settings.closedDates.filter((d) => +d.slice(0, 4) !== year),
          ...preview.holidays,
        ])
      ).sort();
    }
    const added = next.filter((d) => !db.settings.closedDates.includes(d)).length;
    setSettings({ closedDates: next });
    setPreview(null);
    toast(
      mode === "add"
        ? `${added} ${added === 1 ? "festivo añadido" : "festivos añadidos"} al ${year}`
        : `Festivos del ${year} actualizados (${preview.holidays.length} días)`
    );
  }

  async function doExport() {
    setExporting(true);
    try {
      const bytes = await exportCalendarPdf({
        year: exportYear,
        holidays: db.settings.closedDates,
        salon: db.salon,
      });
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendario-laboral-${exportYear}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Calendario ${exportYear} exportado a PDF`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al exportar el calendario.", "err");
    } finally {
      setExporting(false);
    }
  }

  const holidayCount = db.settings.closedDates.filter((d) => +d.slice(0, 4) === exportYear).length;

  return (
    <>
      <Section
        title="Calendario laboral"
        desc="Importa los festivos de un calendario oficial en PDF y exporta el tuyo"
        icon={<IcCalendar size={15} />}
      >
        <div className="space-y-4">
          {/* Importar */}
          <div className="rounded-lg border border-line bg-paper/60 p-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Importar festivos desde PDF</p>
                <p className="text-xs text-soft mt-0.5 leading-relaxed">
                  Sube un calendario laboral (tipo calendarios.ideal.es) y se volcarán
                  automáticamente los días marcados en color a tus días cerrados.
                </p>
              </div>
              <button
                onClick={() => pdfInputRef.current?.click()}
                disabled={importing}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-3.5 py-2 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm disabled:opacity-60"
              >
                {importing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-paper/40 border-t-paper rounded-full animate-spin" />
                    Leyendo…
                  </>
                ) : (
                  <>
                    <IcUpload size={14} /> Importar PDF
                  </>
                )}
              </button>
            </div>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onImportPdf}
            />
          </div>

          {/* Exportar */}
          <div className="rounded-lg border border-line bg-paper/60 p-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Exportar calendario a PDF</p>
                <p className="text-xs text-soft mt-0.5 leading-relaxed">
                  Genera el calendario anual del salón (A4, 12 meses) con los
                  festivos marcados en color.
                  {holidayCount > 0 ? (
                    <> El {exportYear} tiene {holidayCount} {holidayCount === 1 ? "día marcado" : "días marcados"}.</>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <select
                  className="rounded-lg border border-linedark bg-white/70 px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/25 num"
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  aria-label="Año a exportar"
                >
                  {years.map((yy) => (
                    <option key={yy} value={yy}>
                      {yy}
                    </option>
                  ))}
                </select>
                <button
                  onClick={doExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-linedark text-moss px-3.5 py-2 text-xs font-bold hover:bg-mint hover:border-moss/50 transition-all disabled:opacity-60"
                >
                  {exporting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-moss/40 border-t-moss rounded-full animate-spin" />
                      Generando…
                    </>
                  ) : (
                    <>
                      <IcDownload size={14} /> Exportar PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Modal de vista previa de la importación */}
      {preview && (
        <Modal
          title={`Festivos detectados · ${preview.year}`}
          subtitle={`${preview.holidays.length} días marcados en color en el calendario`}
          onClose={() => setPreview(null)}
          z={60}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
              {preview.holidays.map((d) => {
                const [, mm, dd] = d.split("-");
                return (
                  <span
                    key={d}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold num ${
                      db.settings.closedDates.includes(d)
                        ? "bg-mint text-moss"
                        : "bg-dangersoft text-danger"
                    }`}
                  >
                    {+dd} {MONTH_SHORT_NAMES[+mm - 1]}
                    {db.settings.closedDates.includes(d) && (
                      <IcCheck size={11} className="opacity-70" />
                    )}
                  </span>
                );
              })}
            </div>
            <p className="text-[11px] text-faint">
              En verde: días que ya tenías configurados. En rojo: festivos nuevos que se añadirán.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint/60 hover:text-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => applyImport("replace")}
                className="flex-1 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint/60 hover:text-ink transition-colors"
              >
                Reemplazar {preview.year}
              </button>
              <button
                onClick={() => applyImport("add")}
                className="flex-1 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
              >
                Añadir festivos
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- modal de servicio ---------- */
function ServiceModal({
  preset,
  onClose,
}: {
  preset: Service | null;
  onClose: () => void;
}) {
  const { addService, updateService } = useStore();
  const { toast } = useUI();
  const [name, setName] = useState(preset?.name ?? "");
  const [duration, setDuration] = useState(preset?.duration ?? 45);
  const [price, setPrice] = useState(String(preset?.price ?? 20));
  const [color, setColor] = useState(
    preset?.color ?? SERVICE_COLORS[0]
  );
  const [error, setError] = useState("");

  function save() {
    if (!name.trim()) {
      setError("Ponle un nombre al servicio.");
      return;
    }
    const p = Math.max(0, Number(price) || 0);
    const data = {
      name: name.trim(),
      duration,
      price: p,
      color,
    };
    if (preset) {
      updateService(preset.id, data);
      toast("Servicio actualizado");
    } else {
      addService(data);
      toast("Servicio añadido");
    }
    onClose();
  }

  return (
    <Modal
      title={preset ? "Editar servicio" : "Nuevo servicio"}
      subtitle="Los precios y duraciones se usan al crear citas"
      onClose={onClose}
      z={60}
      maxW="max-w-md"
    >
      <div className="space-y-4">
        <Field label="Nombre *">
          <input
            className={inputCls}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Corte y peinado"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duración">
            <div className="flex items-center rounded-lg border border-linedark bg-white/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(15, d - 15))}
                className="px-3 py-2 text-soft hover:bg-mint hover:text-ink transition-colors font-bold"
                aria-label="Restar 15 minutos"
              >
                −
              </button>
              <span className="flex-1 text-center text-sm font-semibold num">
                {duration} min
              </span>
              <button
                type="button"
                onClick={() => setDuration((d) => Math.min(360, d + 15))}
                className="px-3 py-2 text-soft hover:bg-mint hover:text-ink transition-colors font-bold"
                aria-label="Sumar 15 minutos"
              >
                +
              </button>
            </div>
          </Field>
          <Field label="Precio (€)">
            <input
              className={inputCls}
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Color en la agenda">
          <div className="flex gap-2">
            {SERVICE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-ink scale-110"
                    : "hover:scale-110"
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              >
                {color === c && <IcCheck size={14} className="text-paper" />}
              </button>
            ))}
          </div>
        </Field>
        {error && (
          <p className="text-xs font-medium text-danger bg-dangersoft border border-danger/20 rounded-lg px-3 py-2 anim-fade">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint/60 hover:text-ink transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
          >
            {preset ? "Guardar cambios" : "Añadir servicio"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- tarjetas de tema ---------- */
function ThemeCard({
  id,
  label,
  description,
  swatches,
  active,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  description: string;
  swatches: { name: string; color: string }[];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-xl border p-3 text-left transition-all hover:-translate-y-px hover:shadow-md ${
        active
          ? "border-moss bg-mint/50 ring-1 ring-moss/40"
          : "border-line bg-paper/60 hover:border-linedark"
      }`}
    >
      {/* Previsualización de la paleta */}
      <div className="flex gap-1 mb-2.5 h-14 rounded-lg overflow-hidden border border-line">
        {swatches.map((s, i) => (
          <div
            key={i}
            className="flex-1 flex items-end justify-center pb-1"
            style={{ background: s.color }}
          >
            <span
              className="text-[8px] font-bold uppercase tracking-wide"
              style={{
                color:
                  s.name === "paper" || s.name === "gold"
                    ? "rgba(0,0,0,0.45)"
                    : "rgba(255,255,255,0.85)",
              }}
            >
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <p className="font-display font-bold text-sm text-ink flex items-center gap-1.5">
        {label}
        {active && <IcCheck size={14} className="text-moss" />}
      </p>
      <p className="text-[11px] text-soft mt-0.5">{description}</p>
    </button>
  );
}

/* ---------- vista de ajustes ---------- */
export default function SettingsView() {
  const { db, setSettings, deleteService, replaceAll, wipeAll } = useStore();
  const { toast, confirm, install, installAvailable, standalone } = useUI();
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    preset: Service | null;
  }>({ open: false, preset: null });
  const fileRef = useRef<HTMLInputElement>(null);
  const sqliteRef = useRef<HTMLInputElement>(null);
  const s = db.settings;

  // Tema
  const { theme, setTheme } = useTheme();

  // Drive sync
  const [clientIdInput, setClientIdInput] = useState(() => getStoredClientId());
  const [clientIdSaved, setClientIdSaved] = useState(true);

  // El sincronizador es global: también detecta cambios hechos desde Agenda
  // y Clientes, no solo los realizados desde esta pantalla.
  const sync = useDriveSyncContext();

  function changeOpen(v: number) {
    if (v >= s.closeHour) {
      toast("La apertura debe ser anterior al cierre", "err");
      return;
    }
    setSettings({ openHour: v });
  }
  function changeClose(v: number) {
    if (v <= s.openHour) {
      toast("El cierre debe ser posterior a la apertura", "err");
      return;
    }
    setSettings({ closeHour: v });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peluqueria-marisa-datos-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Copia de seguridad JSON descargada");
  }

  async function exportSQLite() {
    try {
      const blob = await exportToSQLiteBlob(db);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `peluqueria-marisa-${new Date()
        .toISOString()
        .slice(0, 10)}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Base de datos SQLite descargada");
    } catch (e) {
      toast("Error al exportar SQLite: " + (e as Error).message, "err");
    }
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result));
        if (
          !parsed ||
          !Array.isArray(parsed.clients) ||
          !Array.isArray(parsed.appointments)
        )
          throw new Error("formato");
        replaceAll({
          version: 1,
          clients: parsed.clients,
          appointments: parsed.appointments,
          services:
            Array.isArray(parsed.services) && parsed.services.length
              ? parsed.services
              : DEFAULT_SERVICES.map((x) => ({ ...x })),
          consents: parseConsents(parsed.consents),
          salon: normalizeSalon(parsed.salon),
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        });
        toast(
          `Datos importados: ${parsed.clients.length} clientes y ${parsed.appointments.length} citas`
        );
      } catch {
        toast("El archivo no tiene el formato esperado", "err");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }

  async function onImportSQLite(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = await importFromSQLiteBlob(f);
      replaceAll({
        version: 1,
        clients: data.clients,
        appointments: data.appointments,
        services:
          data.services.length > 0
            ? data.services
            : DEFAULT_SERVICES.map((x) => ({ ...x })),
        consents: data.consents,
        // El salon viaja en el SQLite; si es un archivo antiguo se conserva el local
        salon: data.salon ?? normalizeSalon(db.salon),
        settings: { ...DEFAULT_SETTINGS },
      });
      toast(
        `SQLite importado: ${data.clients.length} clientes, ${data.appointments.length} citas${data.consents.length ? ` y ${data.consents.length} consentimientos` : ""}`
      );
    } catch (err) {
      toast("Error al importar SQLite: " + (err as Error).message, "err");
    } finally {
      e.target.value = "";
    }
  }

  async function eraseAll() {
    const ok = await confirm({
      title: "Borrar todos los datos",
      message: `Se eliminarán ${db.clients.length} clientes, ${db.appointments.length} citas y ${db.consents.length} consentimientos firmados de este dispositivo. Te recomendamos exportar una copia antes. ¿Continuar?`,
      confirmLabel: "Borrar todo",
      danger: true,
    });
    if (!ok) return;
    wipeAll();
    toast("Datos borrados. Base de datos vacía.", "info");
  }

  async function removeService(srv: Service) {
    const ok = await confirm({
      title: "Eliminar servicio",
      message: `¿Eliminar «${srv.name}»? Las citas ya creadas conservarán su nombre y precio.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    deleteService(srv.id);
    toast("Servicio eliminado", "info");
  }

  function saveClientId() {
    setStoredClientId(clientIdInput.trim());
    setClientIdSaved(true);
    toast("Client ID guardado. Ya puedes iniciar sesión en Drive.");
  }

  async function handleSignIn() {
    if (!getStoredClientId()) {
      toast("Guarda primero el Client ID", "err");
      return;
    }
    const ok = await sync.signIn();
    if (!ok) toast("No se pudo iniciar sesión en Drive", "err");
    else toast("Sesión iniciada en Drive");
  }

  async function handlePush() {
    if (!sync.state.isAuthenticated) {
      const ok = await sync.signIn();
      if (!ok) return;
    }
    await sync.push();
    toast(
      sync.state.phase === "error"
        ? "Error al subir: " + sync.state.message
        : "Copia subida a Drive"
    );
  }

  async function handlePull() {
    if (!sync.state.isAuthenticated) {
      const ok = await sync.signIn();
      if (!ok) return;
    }
    await sync.pull();
    toast(
      sync.state.phase === "error"
        ? "Error al descargar: " + sync.state.message
        : "Copia descargada de Drive"
    );
  }

  async function handleReconcile() {
    if (!sync.state.isAuthenticated) {
      const ok = await sync.signIn();
      if (!ok) return;
    }
    await sync.reconcile();
    if (sync.state.phase === "error") {
      toast("Sync: " + sync.state.message, "err");
    } else {
      toast(sync.state.message || "Sincronización completada");
    }
  }

  // Días de apertura
  function toggleOpenDay(day: number) {
    const current = new Set(s.openDays);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    const sorted = Array.from(current).sort((a, b) => a - b);
    if (sorted.length === 0) {
      toast("Debe haber al menos un día abierto", "err");
      return;
    }
    setSettings({ openDays: sorted });
  }

  // Festivos
  const [newHoliday, setNewHoliday] = useState("");

  function addHoliday() {
    const d = newHoliday.trim();
    if (!d) return;
    if (s.closedDates.includes(d)) {
      toast("Ese día ya está marcado como cerrado", "err");
      return;
    }
    setSettings({ closedDates: [...s.closedDates, d].sort() });
    setNewHoliday("");
    toast("Día cerrado añadido");
  }

  function removeHoliday(d: string) {
    setSettings({ closedDates: s.closedDates.filter((x) => x !== d) });
  }

  function clearAllHolidays() {
    if (s.closedDates.length === 0) return;
    setSettings({ closedDates: [] });
    toast("Lista de festivos vaciada", "info");
  }

  const hours = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight text-ink">
          Ajustes
        </h1>
        <p className="text-sm text-soft mt-0.5">
          Apariencia, datos del salón, horario, servicios y sincronización
        </p>
      </div>

      {/* === APARIENCIA === */}
      <Section
        title="Apariencia"
          desc="Elige la paleta de colores del salón. Se guarda en este dispositivo."
        icon={<IcMonitor size={15} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              id={t.id}
              label={t.label}
              description={t.description}
              swatches={t.swatches.map((s) => ({
                name: s.name,
                color: s.color,
              }))}
              active={theme === t.id}
              onSelect={() => {
                setTheme(t.id);
                toast(`Tema cambiado a «${t.label}»`);
              }}
            />
          ))}
        </div>
      </Section>

      {/* === DATOS DEL SALÓN === */}
      <SalonSection />

      {/* === HORARIO === */}
      <Section
        title="Horario del salón"
        desc={`La agenda muestra de ${s.openHour}:00 a ${s.closeHour}:00 en huecos de ${s.step} min`}
        icon={<IcMonitor size={15} />}
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Apertura">
            <select
              className={inputCls}
              value={s.openHour}
              onChange={(e) => changeOpen(Number(e.target.value))}
            >
              {hours(7, 13).map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cierre">
            <select
              className={inputCls}
              value={s.closeHour}
              onChange={(e) => changeClose(Number(e.target.value))}
            >
              {hours(15, 22).map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hueco de cita">
            <select
              className={inputCls}
              value={s.step}
              onChange={(e) => setSettings({ step: Number(e.target.value) })}
            >
              {[15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Días de apertura */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-soft mb-2">
            Días de apertura
          </p>
          <p className="text-xs text-faint mb-2.5">
            Marca los días de la semana en los que el salón está abierto.
            Los días no marcados no aceptan citas.
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const active = s.openDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleOpenDay(day)}
                  className={`rounded-lg px-2 py-2.5 text-xs font-bold border transition-all active:scale-[0.97] ${
                    active
                      ? "bg-pine text-paper border-pine shadow-sm"
                      : "bg-paper/60 text-faint border-linedark hover:border-linedark hover:text-soft"
                  }`}
                >
                  {WEEKDAY_LABELS[day]}
                </button>
              );
            })}
          </div>
          {s.openDays.length === 0 && (
            <p className="mt-2 text-xs text-danger flex items-center gap-1.5">
              <IcAlert size={12} />
              Debe haber al menos un día abierto.
            </p>
          )}
        </div>

        {/* Festivos / vacaciones */}
        <div className="mt-5 pt-4 border-t border-line">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-soft">
                Días cerrados
              </p>
              <p className="text-xs text-faint mt-0.5">
                Festivos, vacaciones o cualquier día suelto en que el salón
                permanezca cerrado.
              </p>
            </div>
            {s.closedDates.length > 0 && (
              <button
                onClick={clearAllHolidays}
                className="text-[11px] font-bold text-danger hover:bg-dangersoft rounded-full px-2 py-1 transition-colors shrink-0"
              >
                Vaciar lista
              </button>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="date"
              className={inputCls}
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHoliday()}
            />
            <button
              onClick={addHoliday}
              disabled={!newHoliday}
              className="shrink-0 rounded-lg bg-pine text-paper px-3 text-xs font-bold disabled:opacity-50 hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
            >
              <IcPlus size={14} />
            </button>
          </div>

          {s.closedDates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-linedark py-6 text-center">
              <p className="text-xs text-faint">
                No hay días cerrados configurados
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {s.closedDates.map((d) => {
                const date = new Date(d);
                const label = date.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                return (
                  <div
                    key={d}
                    className="flex items-center gap-3 rounded-lg border border-line bg-paper/60 px-3 py-2 hover:border-linedark transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-dangersoft text-danger flex items-center justify-center shrink-0">
                      <IcBan size={14} />
                    </span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-ink capitalize truncate">
                      {label}
                    </span>
                    <button
                      onClick={() => removeHoliday(d)}
                      className="p-1.5 rounded-lg text-soft hover:text-danger hover:bg-dangersoft transition-colors shrink-0"
                      title="Eliminar"
                    >
                      <IcTrash size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* === SERVICIOS === */}
      <Section
        title="Servicios y precios"
        desc="Cada servicio aporta duración, precio y color a la cita"
        icon={<IcScissors size={15} />}
      >
        <div className="space-y-1.5">
          {db.services.map((srv) => (
            <div
              key={srv.id}
              className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 hover:border-linedark transition-colors group"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: srv.color }}
              />
              <span className="text-sm font-semibold flex-1 truncate">
                {srv.name}
              </span>
              <span className="text-xs text-soft num hidden sm:inline">
                {srv.duration} min
              </span>
              <span className="text-sm font-display font-bold text-pine num w-14 text-right">
                {srv.price} €
              </span>
              <button
                onClick={() =>
                  setServiceModal({ open: true, preset: srv })
                }
                className="p-1.5 rounded-lg text-soft hover:text-ink hover:bg-mint transition-colors"
                title="Editar servicio"
              >
                <IcPencil size={14} />
              </button>
              <button
                onClick={() => removeService(srv)}
                className="p-1.5 rounded-lg text-soft hover:text-danger hover:bg-dangersoft transition-colors"
                title="Eliminar servicio"
              >
                <IcTrash size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setServiceModal({ open: true, preset: null })}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-linedark px-3.5 py-2 text-xs font-bold text-moss hover:bg-mint hover:border-moss/50 transition-colors"
        >
          <IcPlus size={14} /> Añadir servicio
        </button>
      </Section>

      {/* === CALENDARIO LABORAL === */}
      <CalendarSection />

      {/* === SINCRONIZACIÓN DRIVE === */}
      <Section
        title="Sincronización con Google Drive"
        desc="Sube y baja tu base de datos entre dispositivos con el alcance drive.file"
        icon={<IcWifi size={15} />}
      >
        <div className="space-y-3">
          <p className="text-sm text-soft leading-relaxed">
            Tu archivo <code className="bg-mint rounded px-1 py-px text-[11px]">peluqueria-marisa-db.sqlite</code>{" "}
            se guarda en tu Google Drive (ámbito{" "}
            <strong className="text-ink">drive.file</strong>: solo la app ve los
            archivos que ella misma crea). La resolución de conflictos usa la
            fecha de modificación: gana el más nuevo.
          </p>

          {/* Client ID */}
          <Field
            label="Client ID de OAuth"
            hint="Créalo gratis en Google Cloud Console: API & Services → Credentials → OAuth client (Web). Origen autorizado: este dominio."
          >
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={clientIdInput}
                onChange={(e) => {
                  setClientIdInput(e.target.value);
                  setClientIdSaved(false);
                }}
                placeholder="xxxxx.apps.googleusercontent.com"
              />
              <button
                onClick={saveClientId}
                disabled={!clientIdInput.trim() || clientIdSaved}
                className="shrink-0 rounded-lg bg-pine text-paper px-3 text-xs font-bold disabled:opacity-50 hover:bg-pine2 active:scale-[0.98] transition-all"
              >
                Guardar
              </button>
            </div>
          </Field>

          {/* Estado de sesión */}
          <div className="rounded-lg border border-line bg-paper/70 p-3 flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                sync.state.isAuthenticated
                  ? "bg-moss pulse-gold"
                  : "bg-faint"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">
                {sync.state.isAuthenticated
                  ? "Sesión iniciada en Drive"
                  : sync.state.isConfigured
                  ? "Sin sesión — pulsa «Iniciar sesión»"
                  : "Configura el Client ID antes de iniciar sesión"}
              </p>
              <p className="text-[11px] text-soft">
                Última sincronización:{" "}
                {sync.state.lastSyncAt
                  ? new Date(sync.state.lastSyncAt).toLocaleString("es-ES")
                  : "nunca"}
                {sync.state.phase !== "idle" && (
                  <span className="ml-2 text-moss">
                    · {sync.state.message}
                  </span>
                )}
              </p>
            </div>
            {sync.state.phase === "uploading" ||
              sync.state.phase === "downloading" ||
              (sync.state.phase === "checking" && (
                <span className="animate-spin text-moss">
                  <IcAlert size={16} />
                </span>
              ))}
          </div>

          {/* Botones */}
          <div className="flex flex-wrap gap-2">
            {!sync.state.isAuthenticated ? (
              <button
                onClick={handleSignIn}
                disabled={!sync.state.isConfigured}
                className="inline-flex items-center gap-1.5 rounded-lg bg-moss text-paper px-3.5 py-2 text-xs font-bold disabled:opacity-50 hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
              >
                <IcUpload size={14} /> Iniciar sesión en Drive
              </button>
            ) : (
              <button
                onClick={handleReconcile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-3.5 py-2 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
              >
                <IcWifi size={14} /> Sincronizar ahora
              </button>
            )}
            <button
              onClick={handlePush}
              disabled={!sync.state.isAuthenticated}
              className="inline-flex items-center gap-1.5 rounded-lg border border-linedark px-3.5 py-2 text-xs font-bold text-soft hover:bg-mint hover:text-ink disabled:opacity-50 transition-colors"
            >
              <IcUpload size={14} /> Subir a Drive
            </button>
            <button
              onClick={handlePull}
              disabled={!sync.state.isAuthenticated}
              className="inline-flex items-center gap-1.5 rounded-lg border border-linedark px-3.5 py-2 text-xs font-bold text-soft hover:bg-mint hover:text-ink disabled:opacity-50 transition-colors"
            >
              <IcDownload size={14} /> Bajar de Drive
            </button>
          </div>

          {/* Auto-sync info */}
          {sync.state.isAuthenticated && (
            <p className="text-[11px] text-faint flex items-center gap-1.5">
              <IcCheck size={12} className="text-moss" />
              Auto-sync activo: cada cambio se sube automáticamente 10 s después
              de la última modificación (patrón "local-first").
            </p>
          )}

          {sync.state.phase === "error" && (
            <p className="text-xs font-medium text-danger bg-dangersoft border border-danger/20 rounded-lg px-3 py-2 anim-fade">
              {sync.state.message}
            </p>
          )}
        </div>
      </Section>

      {/* === BASE DE DATOS === */}
      <Section
        title="Base de datos local"
        desc={`${db.clients.length} clientes · ${db.appointments.length} citas · ${db.services.length} servicios · ${dbSizeKB(db)} KB en este dispositivo`}
        icon={<IcDownload size={15} />}
      >
        <p className="text-sm text-soft leading-relaxed mb-3">
          Todo se guarda en el almacenamiento local de cada dispositivo
          (IndexedDB + localStorage) y funciona sin conexión. Dispones de dos
          formatos de exportación manual:{" "}
          <strong className="text-ink">JSON</strong> (copia legible) y{" "}
          <strong className="text-ink">SQLite</strong> (base de datos
          relacional con claves foráneas e índices).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportData}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-3.5 py-2 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
          >
            <IcDownload size={14} /> Exportar JSON
          </button>
          <button
            onClick={exportSQLite}
            className="inline-flex items-center gap-1.5 rounded-lg bg-moss text-paper px-3.5 py-2 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
          >
            <IcDownload size={14} /> Exportar SQLite
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-linedark px-3.5 py-2 text-xs font-bold text-soft hover:bg-mint hover:text-ink transition-colors"
          >
            <IcUpload size={14} /> Importar JSON
          </button>
          <button
            onClick={() => sqliteRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-linedark px-3.5 py-2 text-xs font-bold text-soft hover:bg-mint hover:text-ink transition-colors"
          >
            <IcUpload size={14} /> Importar SQLite
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImport}
          />
          <input
            ref={sqliteRef}
            type="file"
            accept=".sqlite,.db,application/x-sqlite3"
            className="hidden"
            onChange={onImportSQLite}
          />
          <button
            onClick={eraseAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 text-danger px-3.5 py-2 text-xs font-bold hover:bg-dangersoft transition-colors"
          >
            <IcTrash size={14} /> Borrar todo
          </button>
        </div>
      </Section>

      {/* === PWA === */}
      <Section
        title="Instalación y acceso desde otros dispositivos"
        desc="Úsala en el PC del salón, en la intranet y en el móvil"
        icon={<IcMobile size={15} />}
      >
        {standalone ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-oksoft text-okfg text-sm font-semibold px-3 py-2 mb-3">
            <IcCheck size={16} /> Ya estás usando la aplicación instalada.
          </p>
        ) : (
          <button
            onClick={() => setInstallModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-moss text-paper font-display font-bold text-sm px-4 py-2.5 hover:bg-pine2 active:scale-[0.98] transition-all shadow-md mb-3"
          >
            <IcDownload size={16} /> Instalar aplicación en este dispositivo
          </button>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-paper/70 p-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-moss mb-1.5">
              <IcMobile size={14} /> En el móvil
            </p>
            <ul className="text-xs text-soft space-y-1.5 leading-relaxed list-disc pl-4">
              <li>
                <strong className="text-ink">Android (Chrome):</strong> menú
                de tres puntos y «Añadir a pantalla de inicio».
              </li>
              <li>
                <strong className="text-ink">iPhone (Safari):</strong> botón
                Compartir y «Añadir a pantalla de inicio».
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-paper/70 p-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-moss mb-1.5">
              <IcWifi size={14} /> En la intranet del salón
            </p>
            <p className="text-xs text-soft leading-relaxed">
              Sirve esta app en tu red local (por ejemplo con{" "}
              <code className="bg-mint rounded px-1 py-px text-[11px]">
                npx serve dist
              </code>
              ) y ábrela desde cualquier equipo conectado al router. Ahora
              mismo la estás usando en{" "}
              <code className="bg-mint rounded px-1 py-px text-[11px] break-all">
                {typeof location !== "undefined"
                  ? location.host
                  : "este equipo"}
              </code>
              . Con la sesión iniciada, los cambios se suben automáticamente a
              Drive unos segundos después, desde Agenda, Calendario, Clientes
              o Ajustes. Al abrir la app se comprueba y descarga la copia más
              reciente.
            </p>
          </div>
        </div>
      </Section>

      {serviceModal.open && (
        <ServiceModal
          preset={serviceModal.preset}
          onClose={() =>
            setServiceModal({ open: false, preset: null })
          }
        />
      )}

      {installModalOpen && (
        <InstallModal
          onClose={() => setInstallModalOpen(false)}
          onInstall={() => {
            setInstallModalOpen(false);
            install();
          }}
          installAvailable={installAvailable}
        />
      )}
    </div>
  );
}
