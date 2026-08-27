"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Appointment } from "../lib/types";
import { STATUS_META } from "../lib/types";
import {
  addDaysKey,
  capitalize,
  fmtDayNum,
  fmtLong,
  fmtShortDate,
  fmtWeekday,
  inLabel,
  isDayOpen,
  minutesToLabel,
  nowMinutes,
  rangeLabel,
  startOfWeekKey,
  todayKey,
} from "../lib/date-utils";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import {
  IcBan,
  IcCalendar,
  IcCheck,
  IcChevronL,
  IcChevronR,
  IcGrid,
  IcList,
  IcPencil,
  IcPhone,
  IcPlus,
  IcRotate,
  IcSparkle,
  IcTrash,
} from "../components/icons";

const PXH = 64;

/* ---------- disposición de citas solapadas en columnas ---------- */
function layoutItems(items: Appointment[]) {
  const sorted = [...items].sort((x, y) => x.start - y.start || y.duration - x.duration);
  const clusters: Appointment[][] = [];
  let cur: Appointment[] = [];
  let curEnd = -1;
  for (const a of sorted) {
    if (cur.length && a.start >= curEnd) {
      clusters.push(cur);
      cur = [];
      curEnd = -1;
    }
    cur.push(a);
    curEnd = Math.max(curEnd, a.start + a.duration);
  }
  if (cur.length) clusters.push(cur);

  const out: { a: Appointment; col: number; cols: number }[] = [];
  for (const cl of clusters) {
    const colEnds: number[] = [];
    const placed = cl.map((a) => {
      let col = colEnds.findIndex((end) => end <= a.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(a.start + a.duration);
      } else {
        colEnds[col] = a.start + a.duration;
      }
      return { a, col, cols: 0 };
    });
    placed.forEach((p) => (p.cols = colEnds.length));
    out.push(...placed);
  }
  return out;
}

function StatusChip({ status, tiny }: { status: Appointment["status"]; tiny?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ${tiny ? "text-[9px] px-1.5 py-px" : "text-[10px] px-2 py-0.5"}`}
      style={{ background: m.bg, color: m.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.fg }} />
      {m.label}
    </span>
  );
}

/* ---------- franja semanal ---------- */
function WeekStrip({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  const { db } = useStore();
  const weekStart = startOfWeekKey(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of db.appointments) m.set(a.date, (m.get(a.date) ?? 0) + 1);
    return m;
  }, [db.appointments]);
  const tKey = todayKey();

  return (
    <div className="flex items-stretch gap-1.5 rounded-xl border border-line bg-card p-1.5 shadow-sm">
      <button
        onClick={() => onSelect(addDaysKey(weekStart, -7))}
        className="px-2 rounded-lg text-soft hover:bg-mint hover:text-ink transition-colors"
        aria-label="Semana anterior"
      >
        <IcChevronL size={18} />
      </button>
      <div className="grid grid-cols-7 flex-1 gap-1">
        {days.map((k) => {
          const sel = k === selected;
          const today = k === tKey;
          const closed = !isDayOpen(k, db.settings.openDays, db.settings.closedDates);
          const n = counts.get(k) ?? 0;
          return (
            <button
              key={k}
              onClick={() => onSelect(k)}
              className={`relative rounded-lg py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-[0.97] ${
                sel
                  ? closed ? "bg-danger text-paper shadow-md" : "bg-pine text-paper shadow-md"
                  : closed
                    ? "bg-dangersoft/70 text-danger hover:bg-dangersoft"
                    : "hover:bg-mint/70"
              }`}
              aria-label={`${fmtWeekday(k)} ${fmtDayNum(k)}${closed ? ", salón cerrado" : ""}`}
            >
              {closed && (
                <span className={`absolute right-1 top-1 flex items-center gap-0.5 rounded-full px-1 py-px text-[7px] font-extrabold uppercase tracking-wide ${sel ? "bg-paper/20 text-paper" : "bg-danger/15 text-danger"}`}>
                  <IcBan size={8} /> cerrado
                </span>
              )}
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${sel ? "text-paper/70" : closed ? "text-danger/70" : "text-faint"}`}>
                {fmtWeekday(k)}
              </span>
              <span className={`font-display font-bold text-base sm:text-lg leading-none num ${today && !sel && !closed ? "text-moss" : ""}`}>
                {fmtDayNum(k)}
              </span>
              <span className="h-1 flex items-center">
                {n > 0 && (
                  <span className={`min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center num ${sel ? "bg-moss text-paper" : closed ? "bg-danger text-paper" : "bg-moss/15 text-moss"}`}>
                    {n}
                  </span>
                )}
                {today && n === 0 && <span className={`w-1.5 h-1.5 rounded-full ${closed ? "bg-danger" : "bg-moss"}`} />}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onSelect(addDaysKey(weekStart, 7))}
        className="px-2 rounded-lg text-soft hover:bg-mint hover:text-ink transition-colors"
        aria-label="Semana siguiente"
      >
        <IcChevronR size={18} />
      </button>
    </div>
  );
}

/* ---------- línea de tiempo ---------- */
function Timeline({
  dayKey,
  items,
  onSlot,
  onEdit,
  onNew,
}: {
  dayKey: string;
  items: Appointment[];
  onSlot: (start: number) => void;
  onEdit: (a: Appointment) => void;
  onNew: () => void;
}) {
  const { db, clientById } = useStore();
  const { openHour, closeHour, step } = db.settings;
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const H = (closeHour - openHour) * PXH;
  const nowMin = nowMinutes();
  const isToday = dayKey === todayKey();
  const placed = layoutItems(items);
  const areaRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent) {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    const y = e.clientY - r.top;
    const mins = openMin + Math.floor((y / PXH) * 60 / step) * step;
    if (mins >= openMin && mins <= closeMin - step) onSlot(mins);
  }

  return (
    <div className="flex rounded-xl border border-line bg-card overflow-hidden shadow-sm anim-rise">
      {/* gutter de horas */}
      <div className="relative w-12 sm:w-14 shrink-0 border-r border-line bg-paper/70 select-none" style={{ height: H }}>
        {Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i).map((h, i) => (
          <span
            key={h}
            className="absolute right-2 text-[10px] sm:text-[11px] font-semibold text-faint num"
            style={{ top: i * PXH + (i === 0 ? 4 : -7) }}
          >
            {h}:00
          </span>
        ))}
        {isToday && nowMin >= openMin && nowMin <= closeMin && (
          <span
            className="absolute right-1.5 text-[9px] font-bold uppercase text-moss bg-mint rounded px-1 py-px"
            style={{ top: ((nowMin - openMin) / 60) * PXH - 8 }}
          >
            ahora
          </span>
        )}
      </div>

      {/* zona de citas */}
      <div ref={areaRef} className="relative flex-1 cursor-copy" style={{ height: H }} onClick={handleClick} title="Haz clic en un hueco para crear una cita">
        {Array.from({ length: closeHour - openHour + 1 }, (_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 border-t border-line" style={{ top: i * PXH }} />
        ))}
        {Array.from({ length: closeHour - openHour }, (_, i) => (
          <div key={`m${i}`} className="absolute left-0 right-0 border-t border-dashed border-line/70" style={{ top: i * PXH + PXH / 2 }} />
        ))}

        {placed.map(({ a, col, cols }) => {
          const top = ((a.start - openMin) / 60) * PXH;
          const h = (a.duration / 60) * PXH;
          const cancelled = a.status === "cancelada";
          const done = a.status === "completada";
          const client = clientById(a.clientId);
          // Hasta una hora: una sola línea equilibrada. En tarjetas estrechas
          // el bloque central se recorta, pero nunca desplaza la hora o el estado.
          const compact = a.duration <= 60;
          const compactTextSize = a.duration === 60
            ? "text-xs sm:text-sm"
            : "text-[11px] sm:text-xs";
          const phone = client?.phone?.trim();
          const clientName = client?.name ?? "Cliente eliminado";
          const compactLabel = `${clientName}${phone ? ` · ${phone}` : ""} · ${a.serviceName}${a.notes ? ` · ${a.notes}` : ""}`;
          return (
            <div
              key={a.id}
              className="absolute group"
              style={{
                top: top + 2,
                height: Math.max(h - 4, 22),
                left: `calc(${(col / cols) * 100}% + 5px)`,
                width: `calc(${100 / cols}% - 10px)`,
                zIndex: 10 + col,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(a);
              }}
            >
              <div
                className={`h-full rounded-lg border border-line overflow-hidden cursor-pointer transition-all duration-150 hover:shadow-lg hover:-translate-y-px ${cancelled ? "opacity-55" : ""} ${compact ? "px-2 py-0.5" : "px-2.5 py-2"}`}
                style={{ borderLeft: `3px solid ${a.color}`, background: `${a.color}16` }}
              >
                {compact ? (
                  // Línea única: hora / cliente + servicio / estado.
                  <div className={`flex items-center gap-1.5 ${compactTextSize} leading-tight h-full min-w-0`}>
                    <span
                      className={`font-extrabold num shrink-0 ${cancelled ? "line-through" : ""}`}
                      style={{ color: a.color }}
                    >
                      {minutesToLabel(a.start)}
                    </span>
                    <span className="h-3 border-l border-line/80 shrink-0" />
                    <span
                      title={compactLabel}
                      className={`min-w-0 truncate font-bold tracking-tight ${cancelled ? "line-through text-soft" : "text-ink"}`}
                    >
                      {clientName}
                    </span>
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/\s/g, "")}`}
                        title={`Llamar a ${clientName}: ${phone}`}
                        aria-label={`Llamar a ${clientName}: ${phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 shrink-0 text-[10px] sm:text-[11px] font-bold text-pine hover:text-moss hover:underline num"
                      >
                        <IcPhone size={11} /> {phone}
                      </a>
                    )}
                    <span className="min-w-0 flex-1 truncate text-soft" title={a.serviceName}>
                      · {a.serviceName}
                    </span>
                    <span className="shrink-0">
                      <StatusChip status={a.status} tiny />
                    </span>
                  </div>
                ) : (
                  // Tarjetas altas: contenido centrado y con separación estable.
                  <div className="h-full flex flex-col justify-center gap-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`text-[10px] font-bold num ${cancelled ? "line-through" : ""}`}
                        style={{ color: a.color }}
                      >
                        {minutesToLabel(a.start)}
                      </span>
                      {h >= 52 && (
                        <span className="text-[10px] text-faint num">
                          –{minutesToLabel(a.start + a.duration)}
                        </span>
                      )}
                      <span className="ml-auto">
                        <StatusChip status={a.status} tiny />
                      </span>
                    </div>
                    <p
                      className={`text-base sm:text-lg font-bold leading-tight truncate ${
                        cancelled ? "line-through text-soft" : "text-ink"
                      }`}
                    >
                      <span>{clientName}</span>
                      {phone && (
                        <a
                          href={`tel:${phone.replace(/\s/g, "")}`}
                          title={`Llamar a ${clientName}: ${phone}`}
                          aria-label={`Llamar a ${clientName}: ${phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 ml-2 align-middle text-[11px] font-bold text-pine hover:text-moss hover:underline num"
                        >
                          <IcPhone size={12} /> {phone}
                        </a>
                      )}
                    </p>
                    <p className="text-xs sm:text-sm text-soft truncate flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: a.color }}
                      />
                      {a.serviceName}
                      {done && <IcCheck size={11} className="text-moss shrink-0" />}
                    </p>
                    {a.notes && h >= 78 && (
                      <p className="text-[10px] text-faint truncate italic">{a.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* línea de ahora */}
        {isToday && nowMin >= openMin && nowMin <= closeMin && (
          <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: ((nowMin - openMin) / 60) * PXH }}>
            <div className="h-[2px] bg-moss shadow-[0_0_8px_rgba(184,108,138,0.7)]" />
            <span className="absolute -left-1 -top-[3.5px] w-2 h-2 rounded-full bg-moss pulse-gold" />
          </div>
        )}

        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center anim-fade">
              <span className="inline-flex w-12 h-12 rounded-full bg-mint text-moss items-center justify-center mb-2">
                <IcCalendar size={22} />
              </span>
              <p className="font-display font-bold text-lg text-ink">Día libre</p>
              <p className="text-sm text-soft mb-3">Haz clic en cualquier hueco para añadir una cita</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNew();
                }}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-4 py-2 text-sm font-semibold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
              >
                <IcPlus size={15} /> Añadir la primera cita
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- modo lista ---------- */
function DayList({ items, onEdit }: { items: Appointment[]; onEdit: (a: Appointment) => void }) {
  const { clientById, setAppointmentStatus, deleteAppointment } = useStore();
  const { toast, confirm } = useUI();

  async function remove(a: Appointment) {
    const ok = await confirm({
      title: "Eliminar cita",
      message: `¿Eliminar la cita de ${clientById(a.clientId)?.name ?? "cliente"} a las ${minutesToLabel(a.start)}?`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) {
      deleteAppointment(a.id);
      toast("Cita eliminada", "info");
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-linedark bg-card/60 py-14 text-center anim-rise">
        <p className="font-display font-bold text-lg text-ink">Sin citas este día</p>
        <p className="text-sm text-soft">Cambia de día en la franja superior o crea una cita nueva.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((a, i) => {
        const c = clientById(a.clientId);
        return (
          <div
            key={a.id}
            className="anim-rise flex items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="self-stretch w-1 rounded-full shrink-0" style={{ background: a.color }} />
            <div className="w-14 shrink-0">
              <p className="font-display font-bold text-sm num leading-none">{minutesToLabel(a.start)}</p>
              <p className="text-[10px] text-faint num mt-0.5">{a.duration} min</p>
            </div>
            <button className="flex-1 min-w-0 text-left" onClick={() => onEdit(a)}>
              <p className={`text-sm font-semibold truncate ${a.status === "cancelada" ? "line-through text-soft" : "text-ink"}`}>
                {c?.name ?? "Cliente eliminado"}
              </p>
              <p className="text-xs truncate flex items-center gap-1">
                {c?.phone && (
                  <span className="text-pine font-semibold num shrink-0 inline-flex items-center gap-0.5">
                    <IcPhone size={11} /> {c.phone}
                  </span>
                )}
                <span className="text-soft truncate">
                  {c?.phone ? " · " : ""}{a.serviceName} · {a.price} €{a.notes ? ` · ${a.notes}` : ""}
                </span>
              </p>
            </button>
            <StatusChip status={a.status} />
            <div className="flex items-center gap-0.5 shrink-0">
              {(a.status === "pendiente" || a.status === "confirmada") && (
                <>
                  <button
                    title="Marcar completada"
                    onClick={() => {
                      setAppointmentStatus(a.id, "completada");
                      toast("Cita completada");
                    }}
                    className="p-1.5 rounded-lg text-soft hover:text-moss hover:bg-oksoft transition-colors"
                  >
                    <IcCheck size={16} />
                  </button>
                  <button
                    title="Cancelar cita"
                    onClick={() => {
                      setAppointmentStatus(a.id, "cancelada");
                      toast("Cita cancelada", "info");
                    }}
                    className="p-1.5 rounded-lg text-soft hover:text-danger hover:bg-dangersoft transition-colors"
                  >
                    <IcBan size={16} />
                  </button>
                </>
              )}
              {(a.status === "completada" || a.status === "cancelada") && (
                <button
                  title="Reabrir como pendiente"
                  onClick={() => {
                    setAppointmentStatus(a.id, "pendiente");
                    toast("Cita reabierta", "info");
                  }}
                  className="p-1.5 rounded-lg text-soft hover:text-warnfg hover:bg-warnsoft transition-colors"
                >
                  <IcRotate size={16} />
                </button>
              )}
              <button title="Editar" onClick={() => onEdit(a)} className="p-1.5 rounded-lg text-soft hover:text-ink hover:bg-mint transition-colors">
                <IcPencil size={15} />
              </button>
              <button title="Eliminar" onClick={() => remove(a)} className="p-1.5 rounded-lg text-soft hover:text-danger hover:bg-dangersoft transition-colors">
                <IcTrash size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- panel lateral ---------- */
function SidePanel({ dayKey, items, onEdit, defaultStart }: { dayKey: string; items: Appointment[]; onEdit: (a: Appointment) => void; defaultStart: number }) {
  const { db, clientById } = useStore();
  const { openAppointment } = useUI();
  const nowMin = nowMinutes();
  const isToday = dayKey === todayKey();

  const active = items.filter((a) => a.status !== "cancelada");
  const income = active.reduce((s, a) => s + a.price, 0);
  const busyMin = active.reduce((s, a) => s + a.duration, 0);
  const totalMin = (db.settings.closeHour - db.settings.openHour) * 60;
  const occupancy = Math.min(100, Math.round((busyMin / totalMin) * 100));

  const upcoming = (isToday ? items.filter((a) => a.start + a.duration >= nowMin) : items)
    .filter((a) => a.status !== "cancelada")
    .sort((x, y) => x.start - y.start)
    .slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-card p-4 shadow-sm anim-rise">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint mb-3">El día en cifras</h3>
        <div className="flex items-end gap-4">
          <div>
            <p className="font-display font-extrabold text-4xl leading-none num text-pine">{active.length}</p>
            <p className="text-[11px] text-soft font-medium mt-1">citas activas</p>
          </div>
          <div className="h-10 w-px bg-line" />
          <div>
            <p className="font-display font-extrabold text-2xl leading-none num text-moss">{income} €</p>
            <p className="text-[11px] text-soft font-medium mt-1">estimados</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-medium text-soft mb-1">
            <span>Ocupación</span>
            <span className="num font-bold">{occupancy}%</span>
          </div>
          <div className="h-2 rounded-full bg-mint overflow-hidden">
            <div className="h-full rounded-full bg-moss transition-all duration-700" style={{ width: `${occupancy}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-4 shadow-sm anim-rise" style={{ animationDelay: "60ms" }}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint mb-2.5">
          {isToday ? "Lo que viene" : "Citas del día"}
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-faint py-2">Nada pendiente por aquí.</p>
        ) : (
          <div className="space-y-1">
            {upcoming.map((a) => {
              const c = clientById(a.clientId);
              return (
                <button
                  key={a.id}
                  onClick={() => onEdit(a)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-mint/70 transition-colors text-left group"
                >
                  <span className="font-display font-bold text-sm num w-11 shrink-0" style={{ color: a.color }}>
                    {minutesToLabel(a.start)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate group-hover:text-pine transition-colors">
                      {c?.name ?? "Cliente"}
                    </span>
                    <span className="block text-[11px] text-faint truncate">{a.serviceName}</span>
                  </span>
                  {isToday && a.status !== "completada" && (
                    <span className="text-[10px] font-bold text-moss bg-mint rounded-full px-2 py-0.5 num shrink-0">
                      {inLabel(a.start - nowMin)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => openAppointment({ date: dayKey, start: defaultStart })}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-moss text-paper font-display font-bold text-sm px-4 py-3 hover:bg-pine2 active:scale-[0.98] transition-all shadow-md anim-rise"
        style={{ animationDelay: "120ms" }}
      >
        <IcPlus size={17} /> Nueva cita
      </button>
    </div>
  );
}

/* ---------- vista principal ---------- */
export default function AgendaView({ initialDay }: { initialDay?: string }) {
  const { db } = useStore();
  const { openAppointment } = useUI();
  const [selected, setSelected] = useState(initialDay ?? todayKey());
  const [mode, setMode] = useState<"agenda" | "lista">("agenda");
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const dayItems = useMemo(
    () => db.appointments.filter((a) => a.date === selected).sort((x, y) => x.start - y.start || y.duration - x.duration),
    [db.appointments, selected]
  );

  const isToday = selected === todayKey();
  const isClosed = !isDayOpen(selected, db.settings.openDays, db.settings.closedDates);
  const nextSlot = (() => {
    const base = isToday ? nowMinutes() + 5 : db.settings.openHour * 60;
    const step = db.settings.step;
    return Math.min(Math.max(Math.ceil(base / step) * step, db.settings.openHour * 60), db.settings.closeHour * 60 - step);
  })();

  const newDefault = () => openAppointment({ date: selected, start: nextSlot });
  const onSlot = (start: number) => openAppointment({ date: selected, start });
  const onEdit = (a: Appointment) => openAppointment({ appt: a });

  return (
    <div className="space-y-4">
      <WeekStrip selected={selected} onSelect={setSelected} />

      {isClosed && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-dangersoft px-3.5 py-2.5 text-danger anim-fade">
          <IcBan size={16} />
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide">Salón cerrado</p>
            <p className="text-[11px] text-danger/80">Este día está marcado como no laborable.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight text-ink capitalize">
              {fmtLong(selected)}
            </h1>
            {!isToday && (
              <button
                onClick={() => setSelected(todayKey())}
                className="text-[11px] font-bold uppercase tracking-wide text-moss bg-mint hover:bg-moss/20 rounded-full px-2.5 py-1 transition-colors"
              >
                volver a hoy
              </button>
            )}
          </div>
          <p className="text-sm text-soft mt-0.5">
            {dayItems.length === 0
              ? "Ninguna cita registrada"
              : `${dayItems.length} ${dayItems.length === 1 ? "cita" : "citas"} · ${capitalize(fmtShortDate(selected))}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-card p-0.5 shadow-sm">
            <button
              onClick={() => setMode("agenda")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                mode === "agenda" ? "bg-pine text-paper shadow" : "text-soft hover:text-ink"
              }`}
            >
              <IcGrid size={14} /> Agenda
            </button>
            <button
              onClick={() => setMode("lista")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                mode === "lista" ? "bg-pine text-paper shadow" : "text-soft hover:text-ink"
              }`}
            >
              <IcList size={14} /> Lista
            </button>
          </div>
          <button
            onClick={newDefault}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-pine text-paper px-3.5 py-2 text-xs font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
          >
            <IcPlus size={15} /> Nueva cita
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="min-w-0">
          {mode === "agenda" ? (
            <Timeline dayKey={selected} items={dayItems} onSlot={onSlot} onEdit={onEdit} onNew={newDefault} />
          ) : (
            <DayList items={dayItems} onEdit={onEdit} />
          )}
          <p className="text-[11px] text-faint mt-2 hidden lg:flex items-center gap-1.5">
            <IcSparkle size={12} className="text-moss" />
            Consejo: haz clic en un hueco libre de la agenda para crear una cita a esa hora.
          </p>
        </div>
        <SidePanel dayKey={selected} items={dayItems} onEdit={onEdit} defaultStart={nextSlot} />
      </div>
    </div>
  );
}
