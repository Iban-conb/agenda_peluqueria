import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Appointment,
  Client,
  Consent,
  DB,
  SalonInfo,
  Service,
  Settings,
} from "./types";
import {
  DEFAULT_SALON,
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS,
  normalizeSalon,
} from "./types";
import { addDaysKey, todayKey } from "./date-utils";

const DB_NAME = "salon-aura-db";
const DB_VERSION = 1;
const STORAGE_KEY = "salon-aura-db-v1";

interface AuraDB extends DBSchema {
  state: {
    key: string;
    value: DB;
  };
}

let dbPromise: Promise<IDBPDatabase<AuraDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB solo está disponible en el navegador");
  }
  if (!dbPromise) {
    dbPromise = openDB<AuraDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("state")) {
          db.createObjectStore("state");
        }
      },
    });
  }
  return dbPromise;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

/* ---------- seed inicial ---------- */

const SEED_CLIENTS: Client[] = [
  { id: "c-maria", name: "María Fernández López", phone: "612 345 678", email: "maria.fernandez@example.com", street: "Calle del Olivo 14, 3ºB", zip: "28012", city: "Madrid", createdAt: "2024-09-12" },
  { id: "c-carmen", name: "Carmen Ruiz Delgado", phone: "655 210 987", email: "carmen.ruiz@example.com", street: "Av. de la Constitución 48", zip: "41001", city: "Sevilla", createdAt: "2024-10-02" },
  { id: "c-lucia", name: "Lucía Gómez Navarro", phone: "699 481 230", email: "lucia.gomez@example.com", street: "Carrer de Sants 92", zip: "08014", city: "Barcelona", createdAt: "2024-11-20" },
  { id: "c-antonio", name: "Antonio Mora Vega", phone: "622 903 114", email: "antonio.mora@example.com", street: "Calle Larios 5, 1ºA", zip: "29005", city: "Málaga", createdAt: "2025-01-15" },
  { id: "c-isabel", name: "Isabel Castro Rey", phone: "688 154 762", email: "isabel.castro@example.com", street: "Rúa do Franco 21", zip: "15702", city: "Santiago de Compostela", createdAt: "2025-02-08" },
  { id: "c-paula", name: "Paula Navarro Sanz", phone: "611 876 540", email: "paula.navarro@example.com", street: "Calle Mayor 33, bajo", zip: "46001", city: "Valencia", createdAt: "2025-03-27" },
  { id: "c-elena", name: "Elena Vidal Prats", phone: "677 320 459", email: "elena.vidal@example.com", street: "Paseo de Zorrilla 101", zip: "47007", city: "Valladolid", createdAt: "2025-05-19" },
  { id: "c-rocio", name: "Rocío Blanco Torres", phone: "633 587 201", email: "rocio.blanco@example.com", street: "Calle San Vicente 8, 4ºC", zip: "03002", city: "Alicante", createdAt: "2025-06-30" },
];

function seedAppointments(): Appointment[] {
  const today = todayKey();
  const mk = (
    id: string,
    clientId: string,
    date: string,
    start: number,
    duration: number,
    status: Appointment["status"],
    serviceName: string,
    price: number,
    color: string,
    notes = ""
  ): Appointment => ({
    id,
    clientId,
    date,
    start,
    duration,
    status,
    notes,
    serviceName,
    price,
    color,
    createdAt: date,
  });

  return [
    mk("a-1", "c-maria", today, 600, 45, "confirmada", "Corte y peinado", 22, "#2e6e4f", "Como siempre, puntas"),
    mk("a-2", "c-lucia", today, 690, 120, "pendiente", "Mechas balayage", 85, "#96701f", "Tonos caramelo"),
    mk("a-3", "c-carmen", today, 1020, 60, "confirmada", "Tinte raíz", 35, "#b3364d"),
    mk("a-4", "c-paula", addDaysKey(today, 1), 630, 40, "pendiente", "Manicura semipermanente", 18, "#a16207"),
    mk("a-5", "c-antonio", addDaysKey(today, 1), 720, 45, "pendiente", "Corte y peinado", 22, "#2e6e4f"),
    mk("a-6", "c-elena", addDaysKey(today, 3), 750, 45, "confirmada", "Corte y peinado", 22, "#2e6e4f"),
    mk("a-7", "c-isabel", addDaysKey(today, -1), 660, 90, "completada", "Tratamiento de keratina", 60, "#5b5bd6"),
    mk("a-8", "c-rocio", addDaysKey(today, -1), 1080, 50, "cancelada", "Peinado de evento", 30, "#0e7490", "Avisó con antelación"),
    mk("a-9", "c-maria", addDaysKey(today, -6), 600, 45, "completada", "Corte y peinado", 22, "#2e6e4f"),
  ];
}

export function freshDB(): DB {
  return {
    version: 1,
    clients: [],
    appointments: [],
    services: DEFAULT_SERVICES.map((s) => ({ ...s })),
    consents: [],
    salon: { ...DEFAULT_SALON },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function seedDB(): DB {
  return {
    version: 1,
    clients: SEED_CLIENTS,
    appointments: seedAppointments(),
    services: DEFAULT_SERVICES.map((s) => ({ ...s })),
    consents: [],
    salon: { ...DEFAULT_SALON },
    settings: { ...DEFAULT_SETTINGS },
  };
}

/* ---------- carga / guardado ---------- */

export async function loadDB(): Promise<DB> {
  // 1. Intentar leer de IndexedDB
  try {
    const db = await getDB();
    const stored = await db.get("state", "main");
    if (stored) return normalize(stored);
  } catch {
    /* fallback abajo */
  }

  // 2. Migrar desde localStorage si existe
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const norm = normalize(parsed);
      await saveDB(norm);
      return norm;
    }
  } catch {
    /* ignore */
  }

  // 3. Sembrar base inicial
  const seeded = seedDB();
  await saveDB(seeded);
  return seeded;
}

export async function saveDB(db: DB): Promise<void> {
  try {
    const idb = await getDB();
    await idb.put("state", db, "main");
    // Mantener localStorage como mirror para accesos rápidos / migración
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* sin espacio */
    }
  } catch {
    // Sin IndexedDB: guardar solo en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* sin almacenamiento */
    }
  }
}

export async function wipeAllData(): Promise<void> {
  try {
    const idb = await getDB();
    await idb.delete("state", "main");
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function normalize(parsed: unknown): DB {
  if (!parsed || typeof parsed !== "object") return seedDB();
  const p = parsed as Partial<DB>;
  if (!Array.isArray(p.clients) || !Array.isArray(p.appointments)) {
    return seedDB();
  }
  const settings: Partial<Settings> = p.settings || {};
  return {
    version: 1,
    // Migración: clientes antiguos sin correo electrónico
    clients: p.clients.map((c) => ({ ...c, email: typeof c.email === "string" ? c.email : "" })),
    appointments: p.appointments,
    services:
      Array.isArray(p.services) && p.services.length
        ? p.services
        : DEFAULT_SERVICES.map((s) => ({ ...s })),
    consents: Array.isArray(p.consents) ? (p.consents as Consent[]) : [],
    // Migración: bases antiguas sin datos del salón
    salon: normalizeSalon(p.salon),
    settings: {
      openHour: typeof settings.openHour === "number" ? settings.openHour : DEFAULT_SETTINGS.openHour,
      closeHour: typeof settings.closeHour === "number" ? settings.closeHour : DEFAULT_SETTINGS.closeHour,
      step: typeof settings.step === "number" ? settings.step : DEFAULT_SETTINGS.step,
      openDays: Array.isArray(settings.openDays) ? settings.openDays : DEFAULT_SETTINGS.openDays,
      closedDates: Array.isArray(settings.closedDates) ? settings.closedDates : DEFAULT_SETTINGS.closedDates,
    },
  };
}

export function dbSizeKB(db: DB): string {
  try {
    return (JSON.stringify(db).length / 1024).toFixed(1);
  } catch {
    return "0";
  }
}

// Re-exportar tipos usados por la capa SQLite
export type { Appointment, Client, Consent, DB, SalonInfo, Service, Settings };
