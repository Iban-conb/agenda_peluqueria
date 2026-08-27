"use client";

import { useMemo, useState } from "react";
import type { Appointment, AppointmentStatus, Client } from "../lib/types";
import { STATUS_META, STATUS_ORDER } from "../lib/types";
import { isDayOpen, minutesToLabel, norm, rangeLabel, todayKey } from "../lib/date-utils";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import Modal, { Field, inputCls } from "./aura-modal";
import { IcChevronL, IcTrash, IcUserPlus } from "./icons";

export interface ApptPreset {
  appt?: Appointment;
  clientId?: string;
  date?: string;
  start?: number;
}

function ClientPicker({
  clients,
  value,
  onChange,
  onNew,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const sel = clients.find((c) => c.id === value);
  const filtered = clients.filter((c) => norm(`${c.name} ${c.phone} ${c.city}`).includes(norm(q)));

  return (
    <div className="relative">
      {sel && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-faint hover:text-ink transition-colors"
          title="Quitar selección"
        >
          <IcChevronL size={14} />
        </button>
      )}
      <input
        className={`${inputCls} ${sel ? "pl-8" : ""}`}
        placeholder={sel ? sel.name : "Buscar por nombre o teléfono…"}
        value={open ? q : sel?.name ?? ""}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
      />
      {open && (
        <div className="absolute z-10 mt-1.5 w-full max-h-56 overflow-y-auto rounded-lg border border-linedark bg-card shadow-xl anim-fade">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onNew();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-moss hover:bg-mint/70 border-b border-line transition-colors"
          >
            <IcUserPlus size={16} /> Nuevo cliente…
          </button>
          {filtered.length === 0 && <p className="px-3 py-3 text-sm text-faint">Sin resultados para «{q}»</p>}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-mint/70 transition-colors flex items-center justify-between gap-2 ${
                c.id === value ? "bg-mint" : ""
              }`}
            >
              <span className="font-medium truncate">{c.name}</span>
              <span className="text-xs text-faint num shrink-0">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppointmentModal({ preset, onClose }: { preset: ApptPreset; onClose: () => void }) {
  const { db, addAppointment, updateAppointment, deleteAppointment, clientById } = useStore();
  const { toast, confirm, openClient } = useUI();
  const editing = preset.appt;

  const openMin = db.settings.openHour * 60;
  const closeMin = db.settings.closeHour * 60;
  const step = db.settings.step;

  const [clientId, setClientId] = useState(editing?.clientId ?? preset.clientId ?? "");
  const [serviceId, setServiceId] = useState(() =>
    editing
      ? db.services.find((s) => s.name === editing.serviceName)?.id ?? db.services[0]?.id ?? ""
      : db.services[0]?.id ?? ""
  );
  const [date, setDate] = useState(editing?.date ?? preset.date ?? todayKey());
  const [start, setStart] = useState(editing?.start ?? preset.start ?? openMin);
  const [duration, setDuration] = useState(editing?.duration ?? db.services[0]?.duration ?? 45);
  const [status, setStatus] = useState<AppointmentStatus>(editing?.status ?? "confirmada");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");

  const service = db.services.find((s) => s.id === serviceId);

  const slots = useMemo(() => {
    const out: number[] = [];
    for (let m = openMin; m < closeMin; m += step) out.push(m);
    return out;
  }, [openMin, closeMin, step]);

  function changeService(id: string) {
    setServiceId(id);
    const s = db.services.find((x) => x.id === id);
    if (s) setDuration(s.duration);
  }

  function save() {
    if (!clientId) {
      setError("Selecciona un cliente para la cita.");
      return;
    }
    if (!service) {
      setError("Selecciona un servicio.");
      return;
    }
    if (
      !isDayOpen(date, db.settings.openDays, db.settings.closedDates)
    ) {
      setError(
        "El salón está cerrado ese día (festivo o día no laboral). Elige otra fecha."
      );
      return;
    }
    const clash = db.appointments.find(
      (a) =>
        a.id !== editing?.id &&
        a.date === date &&
        a.status !== "cancelada" &&
        start < a.start + a.duration &&
        a.start < start + duration
    );
    if (clash) {
      const other = clientById(clash.clientId)?.name ?? "otro cliente";
      setError(`Se solapa con la cita de ${other} (${rangeLabel(clash.start, clash.duration)}). Elige otra hora.`);
      return;
    }
    const data = {
      clientId,
      date,
      start,
      duration,
      status,
      notes: notes.trim(),
      serviceName: service.name,
      price: service.price,
      color: service.color,
    };
    if (editing) {
      updateAppointment(editing.id, data);
      toast("Cita actualizada");
    } else {
      addAppointment(data);
      const who = clientById(clientId)?.name.split(" ")[0] ?? "";
      toast(`Cita creada · ${who} a las ${minutesToLabel(start)}`);
    }
    onClose();
  }

  async function remove() {
    const who = clientById(editing!.clientId)?.name ?? "este cliente";
    const ok = await confirm({
      title: "Eliminar cita",
      message: `¿Seguro que quieres eliminar la cita de ${who} del día ${date}? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    deleteAppointment(editing!.id);
    toast("Cita eliminada", "info");
    onClose();
  }

  return (
    <Modal
      title={editing ? "Editar cita" : "Nueva cita"}
      subtitle={editing ? `Creada el ${editing.createdAt.slice(0, 10)}` : "Reserva un hueco en la agenda"}
      onClose={onClose}
      z={50}
    >
      <div className="space-y-4">
        <Field label="Cliente *">
          <ClientPicker
            clients={db.clients}
            value={clientId}
            onChange={(id) => {
              setClientId(id);
              setError("");
            }}
            onNew={() =>
              openClient(null, (id) => {
                setClientId(id);
                setError("");
              })
            }
          />
        </Field>

        <Field label="Servicio">
          <select className={inputCls} value={serviceId} onChange={(e) => changeService(e.target.value)}>
            {db.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration} min · {s.price} €
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field
            label="Fecha"
            hint={
              isDayOpen(date, db.settings.openDays, db.settings.closedDates)
                ? undefined
                : "⚠ El salón está cerrado ese día"
            }
          >
            <input
              type="date"
              className={`${inputCls} ${
                !isDayOpen(date, db.settings.openDays, db.settings.closedDates)
                  ? "border-danger ring-2 ring-danger/20"
                  : ""
              }`}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </Field>
          <Field label="Hora">
            <select className={inputCls} value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {slots.map((m) => (
                <option key={m} value={m}>
                  {minutesToLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duración" hint={`Termina a las ${minutesToLabel(start + duration)}`}>
            <div className="flex items-center rounded-lg border border-linedark bg-white/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(15, d - 15))}
                className="px-3 py-2 text-soft hover:bg-mint hover:text-ink transition-colors font-bold"
                aria-label="Restar 15 minutos"
              >
                −
              </button>
              <span className="flex-1 text-center text-sm font-semibold num">{duration} min</span>
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
        </div>

        <Field label="Estado">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className="rounded-lg px-2 py-2 text-xs font-semibold border transition-all active:scale-[0.97]"
                  style={
                    active
                      ? { background: meta.bg, color: meta.fg, borderColor: meta.fg, boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }
                      : { background: "transparent", color: "#5f6d65", borderColor: "#c6cfc0" }
                  }
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Notas">
          <input
            className={inputCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="p. ej. mechas tonos caramelo, alérgica a amoniaco…"
          />
        </Field>

        {service && (
          <div className="flex items-center gap-2.5 rounded-lg bg-mint/60 border border-line px-3 py-2.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: service.color }} />
            <span className="font-medium">{service.name}</span>
            <span className="ml-auto num font-display font-bold text-pine">{service.price} €</span>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-danger bg-dangersoft border border-danger/20 rounded-lg px-3 py-2 anim-fade">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {editing && (
            <button
              onClick={remove}
              className="rounded-lg border border-danger/30 text-danger px-3 py-2.5 text-sm font-semibold hover:bg-dangersoft transition-colors"
              title="Eliminar cita"
            >
              <IcTrash size={16} />
            </button>
          )}
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
            {editing ? "Guardar cambios" : "Crear cita"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
