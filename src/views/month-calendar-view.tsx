"use client";

import { useMemo, useState } from "react";
import type { Appointment, AppointmentStatus } from "../lib/types";
import { STATUS_META } from "../lib/types";
import {
  addDaysKey,
  capitalize,
  fmtDayNum,
  fmtMonth,
  fmtLong,
  fromKey,
  getMonthMatrix,
  isDayOpen,
  minutesToLabel,
  rangeLabel,
  todayKey,
} from "../lib/date-utils";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import StatusPill from "../components/status-pill";
import {
  IcBan,
  IcCalendar,
  IcChevronL,
  IcChevronR,
  IcPhone,
  IcPlus,
  IcSparkle,
} from "../components/icons";

const WEEK_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DOT_COLOR: Record<AppointmentStatus, string> = {
  pendiente: "#D97706",
  confirmada: "#059669",
  completada: "#374151",
  cancelada: "#DB2777",
};

/* ---------- KPI pill ---------- */
function Kpi({
  value,
  label,
  highlight,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-card px-3 py-2 shadow-sm">
      <p
        className={`font-display font-extrabold text-xl leading-none num ${
          highlight ? "text-moss" : "text-pine"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-faint font-semibold mt-1">
        {label}
      </p>
    </div>
  );
}

/* ---------- tarjeta de cita del día seleccionado ---------- */
function DayApptCard({
  appt,
  clientName,
  clientPhone,
  onEdit,
}: {
  appt: Appointment;
  clientName: string;
  clientPhone: string;
  onEdit: (a: Appointment) => void;
}) {
  const cancelled = appt.status === "cancelada";
  return (
    <button
      onClick={() => onEdit(appt)}
      className="w-full anim-rise flex items-stretch gap-3 rounded-lg border border-line bg-card px-3 py-2 hover:shadow-md hover:-translate-y-px transition-all text-left"
    >
      <span
        className="w-1 rounded-full shrink-0"
        style={{ background: appt.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-bold text-sm num text-ink shrink-0">
            {rangeLabel(appt.start, appt.duration)}
          </span>
          <StatusPill status={appt.status} />
        </div>
        <p
          className={`text-sm font-semibold truncate ${
            cancelled ? "line-through text-soft" : "text-ink"
          }`}
        >
          {clientName}
        </p>
        {clientPhone && (
          <p className="text-[11px] text-pine font-semibold num truncate flex items-center gap-1">
            <IcPhone size={11} /> {clientPhone}
          </p>
        )}
        <p className="text-xs text-soft truncate">
          {appt.serviceName} · {appt.price} €
        </p>
        {appt.notes && (
          <p className="text-[11px] text-faint italic truncate mt-0.5">
            “{appt.notes}”
          </p>
        )}
      </div>
    </button>
  );
}

/* ---------- vista ---------- */
export default function MonthCalendarView({
  onOpenAgenda,
}: {
  onOpenAgenda: (day: string) => void;
}) {
  const { db, clientById } = useStore();
  const { openAppointment } = useUI();

  const today = todayKey();
  const initial = fromKey(today);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [selectedDay, setSelectedDay] = useState<string>(today);

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  // Mapa fecha -> citas
  const byDate = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of db.appointments) {
      const list = m.get(a.date) || [];
      list.push(a);
      m.set(a.date, list);
    }
    m.forEach((list) =>
      list.sort((x, y) => x.start - y.start || y.duration - x.duration)
    );
    return m;
  }, [db.appointments]);

  // KPIs del mes visible
  const monthStats = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const inMonth = db.appointments.filter((a) => a.date.startsWith(monthPrefix));
    const active = inMonth.filter((a) => a.status !== "cancelada");
    const completed = inMonth.filter((a) => a.status === "completada");
    const income = active.reduce((s, a) => s + a.price, 0);
    return {
      total: inMonth.length,
      active: active.length,
      completed: completed.length,
      income,
    };
  }, [db.appointments, year, month]);

  // Citas del día seleccionado
  const selectedAppts = byDate.get(selectedDay) || [];

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }
  function goToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedDay(todayKey());
  }

  function handleDayClick(key: string) {
    setSelectedDay(key);
  }

  function openDayAgenda() {
    onOpenAgenda(selectedDay);
  }

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight text-ink capitalize">
            {capitalize(fmtMonth(toKeyOfMonth(year, month)))}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-faint mt-0.5">
            Calendario completo
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-linedark bg-card p-0.5 shadow-sm">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md text-soft hover:bg-mint hover:text-ink transition-colors"
            aria-label="Mes anterior"
          >
            <IcChevronL size={16} />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-soft hover:text-ink transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md text-soft hover:bg-mint hover:text-ink transition-colors"
            aria-label="Mes siguiente"
          >
            <IcChevronR size={16} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex gap-2">
        <Kpi
          value={monthStats.active}
          label="Citas activas"
        />
        <Kpi
          value={monthStats.completed}
          label="Completadas"
        />
        <Kpi
          value={`${monthStats.income} €`}
          label="Ingresos del mes"
          highlight
        />
      </div>

      {/* Cuadrícula mensual */}
      <div className="rounded-xl border border-line bg-card shadow-sm overflow-hidden anim-rise">
        {/* Cabecera días */}
        <div className="grid grid-cols-7 border-b border-line bg-paper/60">
          {WEEK_HEADERS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wide text-faint"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Cuadrícula */}
        <div className="grid grid-cols-7 grid-rows-6">
          {weeks.flat().map(({ key, date, inMonth }) => {
            const isToday = key === today;
            const isSelected = key === selectedDay;
            const isOpen = isDayOpen(
              key,
              db.settings.openDays,
              db.settings.closedDates
            );
            const dayAppts = byDate.get(key) || [];
            const isFestive = db.settings.closedDates.includes(key);

            // Estados para renderizado
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDayClick(key)}
                className={`relative min-h-[78px] sm:min-h-[100px] p-1.5 text-left align-top border-b border-r border-line transition-all ${
                  isSelected
                    ? "bg-mint/60 ring-2 ring-inset ring-moss z-10"
                    : isOpen
                    ? "hover:bg-mint/40 cursor-pointer"
                    : "bg-paper/40 cursor-not-allowed"
                } ${!inMonth ? "opacity-50" : ""}`}
              >
                {/* Número del día */}
                <div className="flex items-start justify-between mb-1">
                  <span
                    className={`calendar-daynum text-xs sm:text-sm font-bold inline-flex items-center justify-center w-6 h-6 rounded-full num ${
                      isToday
                        ? "bg-moss text-paper"
                        : !isOpen
                        ? "text-faint line-through"
                        : "text-ink"
                    }`}
                  >
                    {fmtDayNum(key)}
                  </span>
                  {/* Badge contador */}
                  {dayAppts.length > 0 && (
                    <span
                      className={`min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center num ${
                        isSelected
                          ? "bg-pine text-paper"
                          : "bg-moss/15 text-moss"
                      }`}
                    >
                      {dayAppts.length}
                    </span>
                  )}
                </div>

                {/* Etiqueta festivo/cerrado */}
                {!isOpen && inMonth && (
                  <>
                    {/* Móvil: icono compacto (la etiqueta no cabe) */}
                    <span
                      className="sm:hidden inline-flex w-[18px] h-[18px] rounded items-center justify-center text-danger/80 bg-dangersoft/70"
                      title={isFestive ? "Festivo" : "Cerrado"}
                    >
                      {isFestive ? <IcSparkle size={10} /> : <IcBan size={10} />}
                    </span>
                    {/* Escritorio: etiqueta de texto */}
                    <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wide text-danger/70 bg-dangersoft/60 px-1 py-0.5 rounded">
                      {isFestive ? "Festivo" : "Cerrado"}
                    </span>
                  </>
                )}

                {/* Dots de estado (hasta 4) */}
                {isOpen && dayAppts.length > 0 && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 flex-wrap">
                    {dayAppts.slice(0, 6).map((a) => (
                      <span
                        key={a.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: DOT_COLOR[a.status] }}
                        title={`${minutesToLabel(a.start)} · ${a.serviceName} · ${STATUS_META[a.status].label}`}
                      />
                    ))}
                    {dayAppts.length > 6 && (
                      <span className="text-[8px] text-faint num">
                        +{dayAppts.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="border-t border-line bg-paper/60 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
          {(Object.keys(STATUS_META) as AppointmentStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: DOT_COLOR[s] }}
              />
              <span className="text-soft font-medium">
                {STATUS_META[s].label}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Panel del día seleccionado */}
      <div className="rounded-xl border border-line bg-card shadow-sm overflow-hidden anim-rise">
        <header className="px-4 py-3 border-b border-line bg-paper/60 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-faint">
              Día seleccionado
            </p>
            <p className="font-display font-bold text-base sm:text-lg text-ink capitalize truncate mt-0.5">
              {capitalize(fmtLong(selectedDay))}
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-mint text-moss rounded-full px-2 py-1 num">
            {selectedAppts.length}{" "}
            {selectedAppts.length === 1 ? "cita" : "citas"}
          </span>
        </header>

        <div className="p-3 sm:p-4 space-y-2">
          {selectedAppts.length === 0 ? (
            <div className="py-8 text-center">
              <span className="inline-flex w-12 h-12 rounded-full bg-mint text-moss items-center justify-center mb-3">
                <IcSparkle size={22} />
              </span>
              <p className="font-display font-bold text-base text-ink">
                Sin citas este día
              </p>
              <p className="text-sm text-soft mt-0.5">
                Añade una cita para el {capitalize(fmtLong(selectedDay))}.
              </p>
            </div>
          ) : (
            selectedAppts.map((a) => (
              <DayApptCard
                key={a.id}
                appt={a}
                clientName={
                  clientById(a.clientId)?.name ?? "Cliente eliminado"
                }
                clientPhone={clientById(a.clientId)?.phone ?? ""}
                onEdit={(appt) => openAppointment({ appt })}
              />
            ))
          )}

          {/* Botones de acción */}
          <div className="pt-2 space-y-2">
            <button
              onClick={openDayAgenda}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-bold hover:bg-pine2 active:scale-[0.98] transition-all shadow-sm"
            >
              <IcCalendar size={16} /> Abrir agenda del día
            </button>
            <button
              onClick={() =>
                openAppointment({
                  date: selectedDay,
                  start: db.settings.openHour * 60,
                })
              }
              disabled={
                !isDayOpen(
                  selectedDay,
                  db.settings.openDays,
                  db.settings.closedDates
                )
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-linedark text-moss px-4 py-2.5 text-sm font-bold hover:bg-mint hover:border-moss/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IcPlus size={16} /> Nueva cita este día
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toKeyOfMonth(year: number, month: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-01`;
}
