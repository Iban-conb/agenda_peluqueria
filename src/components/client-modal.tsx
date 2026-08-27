"use client";

import { useState } from "react";
import type { Client } from "../lib/types";
import { useStore } from "../state/store";
import { useUI } from "../state/ui";
import Modal, { Field, inputCls } from "./aura-modal";

interface Props {
  preset: Client | null;
  onSaved?: (id: string) => void;
  onClose: () => void;
}

export default function ClientModal({ preset, onSaved, onClose }: Props) {
  const { addClient, updateClient } = useStore();
  const { toast } = useUI();

  const [name, setName] = useState(preset?.name ?? "");
  const [phone, setPhone] = useState(preset?.phone ?? "");
  const [email, setEmail] = useState(preset?.email ?? "");
  const [street, setStreet] = useState(preset?.street ?? "");
  const [zip, setZip] = useState(preset?.zip ?? "");
  const [city, setCity] = useState(preset?.city ?? "");
  const [error, setError] = useState("");

  function save() {
    if (!name.trim() || !phone.trim()) {
      setError("El nombre y el teléfono son obligatorios.");
      return;
    }
    const mail = email.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setError("El correo electrónico no parece válido. Revísalo.");
      return;
    }
    const data = { name: name.trim(), phone: phone.trim(), email: mail, street: street.trim(), zip: zip.trim(), city: city.trim() };
    if (preset) {
      updateClient(preset.id, data);
      toast("Cliente actualizado");
      onSaved?.(preset.id);
    } else {
      const c = addClient(data);
      toast(`Cliente añadido: ${c.name.split(" ")[0]}`);
      onSaved?.(c.id);
    }
    onClose();
  }

  return (
    <Modal
      title={preset ? "Editar cliente" : "Nuevo cliente"}
      subtitle={preset ? "Actualiza los datos de contacto" : "Nombre, teléfono, correo y dirección"}
      onClose={onClose}
      z={60}
    >
      <div className="space-y-4">
        <Field label="Nombre completo *">
          <input
            className={inputCls}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. María Fernández López"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <Field label="Teléfono *">
          <input
            className={inputCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="p. ej. 612 345 678"
            inputMode="tel"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <Field label="Correo electrónico">
          <input
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="p. ej. maria.fernandez@correo.com"
            inputMode="email"
            autoComplete="email"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <Field label="Calle y número">
          <input className={inputCls} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Calle, número, piso…" />
        </Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="C. Postal">
            <input className={inputCls} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="28012" inputMode="numeric" />
          </Field>
          <Field label="Ciudad">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madrid" />
          </Field>
        </div>

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
            {preset ? "Guardar cambios" : "Añadir cliente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
