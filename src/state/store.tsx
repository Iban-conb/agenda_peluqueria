"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Appointment,
  AppointmentStatus,
  Client,
  Consent,
  DB,
  SalonInfo,
  Service,
  Settings,
} from "../lib/types";
import { freshDB, loadDB, saveDB, uid } from "../lib/indexeddb";

interface StoreApi {
  db: DB;
  loading: boolean;
  addClient: (data: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addConsent: (data: Omit<Consent, "id">) => Consent;
  deleteConsent: (id: string) => void;
  consentsOf: (clientId: string) => Consent[];
  addAppointment: (data: Omit<Appointment, "id" | "createdAt">) => Appointment;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  setAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  addService: (data: Omit<Service, "id">) => Service;
  updateService: (id: string, patch: Partial<Service>) => void;
  deleteService: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setSalon: (patch: Partial<SalonInfo>) => void;
  replaceAll: (db: DB) => void;
  wipeAll: () => void;
  clientById: (id: string) => Client | undefined;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(freshDB);
  const [loading, setLoading] = useState(true);

  // Cargar DB al montar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadDB();
      if (!cancelled) {
        setDb(loaded);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guardar DB al cambiar
  useEffect(() => {
    if (loading) return;
    saveDB(db);
  }, [db, loading]);

  const api = useMemo<StoreApi>(
    () => ({
      db,
      loading,
      addClient(data) {
        const client: Client = {
          ...data,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        setDb((d) => ({ ...d, clients: [...d.clients, client] }));
        return client;
      },
      updateClient(id, patch) {
        setDb((d) => ({
          ...d,
          clients: d.clients.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        }));
      },
      deleteClient(id) {
        setDb((d) => ({
          ...d,
          clients: d.clients.filter((c) => c.id !== id),
          appointments: d.appointments.filter((a) => a.clientId !== id),
          consents: d.consents.filter((c) => c.clientId !== id),
        }));
      },
      addConsent(data) {
        const consent: Consent = { ...data, id: uid() };
        setDb((d) => ({ ...d, consents: [...d.consents, consent] }));
        return consent;
      },
      deleteConsent(id) {
        setDb((d) => ({
          ...d,
          consents: d.consents.filter((c) => c.id !== id),
        }));
      },
      consentsOf(clientId) {
        return db.consents
          .filter((c) => c.clientId === clientId)
          .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
      },
      addAppointment(data) {
        const appt: Appointment = {
          ...data,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        setDb((d) => ({ ...d, appointments: [...d.appointments, appt] }));
        return appt;
      },
      updateAppointment(id, patch) {
        setDb((d) => ({
          ...d,
          appointments: d.appointments.map((a) =>
            a.id === id ? { ...a, ...patch } : a
          ),
        }));
      },
      deleteAppointment(id) {
        setDb((d) => ({
          ...d,
          appointments: d.appointments.filter((a) => a.id !== id),
        }));
      },
      setAppointmentStatus(id, status) {
        setDb((d) => ({
          ...d,
          appointments: d.appointments.map((a) =>
            a.id === id ? { ...a, status } : a
          ),
        }));
      },
      addService(data) {
        const service: Service = { ...data, id: uid() };
        setDb((d) => ({ ...d, services: [...d.services, service] }));
        return service;
      },
      updateService(id, patch) {
        setDb((d) => ({
          ...d,
          services: d.services.map((s) =>
            s.id === id ? { ...s, ...patch } : s
          ),
        }));
      },
      deleteService(id) {
        setDb((d) => ({
          ...d,
          services: d.services.filter((s) => s.id !== id),
        }));
      },
      setSettings(patch) {
        setDb((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
      },
      setSalon(patch) {
        setDb((d) => ({ ...d, salon: { ...d.salon, ...patch } }));
      },
      replaceAll(next) {
        setDb({ ...next, version: 1 });
      },
      wipeAll() {
        setDb(freshDB());
      },
      clientById(id) {
        return db.clients.find((c) => c.id === id);
      },
    }),
    [db, loading]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore fuera de StoreProvider");
  return ctx;
}
