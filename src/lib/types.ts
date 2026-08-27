export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  createdAt: string;
}

/** Datos identificativos y fiscales del salón.
 *  Se muestran por la aplicación y se usan en los textos legales. */
export interface SalonInfo {
  /** Nombre comercial visible en la app */
  name: string;
  /** Razón social (si difiere del nombre comercial) */
  fiscalName: string;
  nif: string;
  phone: string;
  email: string;
  street: string;
  zip: string;
  city: string;
}

/** Registro de consentimiento informado (RGPD) firmado por el cliente.
 *  El PDF firmado se guarda en la propia base de datos como base64. */
export interface Consent {
  id: string;
  clientId: string;
  /** Fecha de firma ISO */
  signedAt: string;
  /** Versión del texto legal firmado */
  textVersion: number;
  /** ¿Aceptó recibir comunicaciones comerciales? */
  marketing: boolean;
  /** Nombre del cliente en el momento de la firma (snapshot) */
  clientName: string;
  /** Documento PDF firmado, codificado en base64 */
  pdfBase64: string;
}

export interface Service {
  id: string;
  name: string;
  duration: number; // minutos
  price: number; // euros
  color: string;
}

export type AppointmentStatus = "pendiente" | "confirmada" | "completada" | "cancelada";

export interface Appointment {
  id: string;
  clientId: string;
  date: string; // yyyy-mm-dd
  start: number; // minutos desde medianoche
  duration: number;
  status: AppointmentStatus;
  notes: string;
  serviceName: string;
  price: number;
  color: string;
  createdAt: string;
}

export interface Settings {
  openHour: number;
  closeHour: number;
  step: number; // minutos por hueco
  /** Días de la semana en los que el salón está abierto.
   *  0 = domingo, 1 = lunes, ..., 6 = sábado. */
  openDays: number[];
  /** Fechas concretas en las que el salón está cerrado
   *  (festivos, vacaciones, etc.). Formato YYYY-MM-DD. */
  closedDates: string[];
}

export interface DB {
  version: number;
  clients: Client[];
  appointments: Appointment[];
  services: Service[];
  consents: Consent[];
  salon: SalonInfo;
  settings: Settings;
}

/** Datos por defecto del salón. */
export const DEFAULT_SALON: SalonInfo = {
  name: "Peluquería Marisa",
  fiscalName: "",
  nif: "",
  phone: "",
  email: "",
  street: "",
  zip: "",
  city: "",
};

/** Versión actual del texto del consentimiento RGPD. */
export const CONSENT_TEXT_VERSION = 3;

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; fg: string; bg: string }
> = {
  pendiente: { label: "Pendiente", fg: "#a16207", bg: "#f7ecd2" },
  confirmada: { label: "Confirmada", fg: "#1d7a46", bg: "#dcefe2" },
  completada: { label: "Completada", fg: "#46564f", bg: "#e5eae4" },
  cancelada: { label: "Cancelada", fg: "#b3364d", bg: "#f8e1e6" },
};

export const STATUS_ORDER: AppointmentStatus[] = [
  "pendiente",
  "confirmada",
  "completada",
  "cancelada",
];

export const SERVICE_COLORS = [
  "#2e6e4f",
  "#b3364d",
  "#96701f",
  "#0e7490",
  "#a16207",
  "#5b5bd6",
];

export const DEFAULT_SERVICES: Service[] = [
  { id: "srv-corte", name: "Corte y peinado", duration: 45, price: 22, color: "#2e6e4f" },
  { id: "srv-tinte", name: "Tinte raíz", duration: 60, price: 35, color: "#b3364d" },
  { id: "srv-mechas", name: "Mechas balayage", duration: 120, price: 85, color: "#96701f" },
  { id: "srv-peinado", name: "Peinado de evento", duration: 50, price: 30, color: "#0e7490" },
  { id: "srv-manicura", name: "Manicura semipermanente", duration: 40, price: 18, color: "#a16207" },
  { id: "srv-keratina", name: "Tratamiento de keratina", duration: 90, price: 60, color: "#5b5bd6" },
];

export const DEFAULT_SETTINGS: Settings = {
  openHour: 9,
  closeHour: 20,
  step: 30,
  openDays: [1, 2, 3, 4, 5, 6], // Lun-Sáb
  closedDates: [],
};

/** Normaliza un objeto cualquiera a SalonInfo (migraciones). */
export function normalizeSalon(raw: unknown): SalonInfo {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<SalonInfo>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    name: str(s.name).trim() || DEFAULT_SALON.name,
    fiscalName: str(s.fiscalName),
    nif: str(s.nif),
    phone: str(s.phone),
    email: str(s.email),
    street: str(s.street),
    zip: str(s.zip),
    city: str(s.city),
  };
}

/** Dirección completa en una línea: «Calle X, 28012 Madrid». */
export function salonAddress(s: SalonInfo): string {
  return [s.street, [s.zip, s.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

/** Nombres cortos de los días de la semana, indexados por getDay() (0=Dom). */
export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
