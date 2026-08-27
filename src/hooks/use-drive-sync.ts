"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DB } from "@/lib/types";
import {
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS,
  normalizeSalon,
} from "@/lib/types";
import { exportToSQLiteBlob, importFromSQLiteBlob } from "@/lib/sqlite-export";
import {
  downloadDb,
  getDriveModifiedTime,
  getLastSyncAt,
  getStoredClientId,
  getStoredTokenInfo,
  requestAccessToken,
  uploadDb,
} from "@/lib/drive-sync";

export type SyncPhase =
  | "idle"
  | "uploading"
  | "downloading"
  | "checking"
  | "error";

export interface SyncState {
  phase: SyncPhase;
  message: string;
  lastSyncAt: number | null;
  isConfigured: boolean;
  isAuthenticated: boolean;
}

const DEBOUNCE_MS = 3_000;

interface UseDriveSyncOptions {
  getDb: () => DB;
  replaceDb: (db: DB) => void;
  /** Versión que cambia cuando la DB local cambia. Dispara el push con debounce. */
  dbVersion: string;
  /** Auto-sync al montar. */
  autoReconcile?: boolean;
}

export function useDriveSync({
  getDb,
  replaceDb,
  dbVersion,
  autoReconcile = true,
}: UseDriveSyncOptions) {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [message, setMessage] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(getLastSyncAt());
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const [isConfigured, setIsConfigured] = useState(() => !!getStoredClientId());

  // Comprobar sesión al montar
  useEffect(() => {
    mountedRef.current = true;
    if (!isConfigured) {
      setIsAuthenticated(false);
      return;
    }
    const { token, expiry } = getStoredTokenInfo();
    setIsAuthenticated(!!token && Date.now() < expiry - 60_000);
    return () => {
      mountedRef.current = false;
    };
  }, [isConfigured]);

  const refreshAuthState = useCallback(() => {
    if (!mountedRef.current) return;
    const { token, expiry } = getStoredTokenInfo();
    setIsAuthenticated(!!token && Date.now() < expiry - 60_000);
  }, []);

  const signIn = useCallback(async (): Promise<boolean> => {
    const clientId = getStoredClientId();
    if (!clientId) {
      setPhase("error");
      setMessage("Falta el Client ID de Google.");
      return false;
    }
    try {
      await requestAccessToken(clientId, "");
      setIsConfigured(true);
      setIsAuthenticated(true);
      setPhase("idle");
      setMessage("Sesión iniciada en Drive.");
      return true;
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Error al iniciar sesión.");
      return false;
    }
  }, []);

  const requestConsent = useCallback(async (): Promise<boolean> => {
    const clientId = getStoredClientId();
    if (!clientId) return false;
    try {
      await requestAccessToken(clientId, "consent");
      setIsConfigured(true);
      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const push = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("uploading");
    setMessage("Subiendo copia a Drive…");
    try {
      const db = getDb();
      const blob = await exportToSQLiteBlob(db);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await uploadDb(bytes);
      const t = Date.now();
      setLastSyncAt(t);
      setPhase("idle");
      setMessage("Copia subida a Drive.");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Error al subir.");
      refreshAuthState();
    } finally {
      busyRef.current = false;
    }
  }, [getDb, refreshAuthState]);

  const pull = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("downloading");
    setMessage("Descargando de Drive…");
    try {
      const bytes = await downloadDb();
      const file = new File([bytes], "peluqueria-marisa-db.sqlite", {
        type: "application/x-sqlite3",
      });
      const { clients, appointments, services, consents, salon } =
        await importFromSQLiteBlob(file);
      const newDb: DB = {
        version: 1,
        clients,
        appointments,
        services:
          services.length > 0 ? services : DEFAULT_SERVICES.map((s) => ({ ...s })),
        consents,
        // El salon viaja en el SQLite; si el archivo es antiguo se conserva el local
        salon: salon ?? normalizeSalon(getDb().salon),
        settings: { ...DEFAULT_SETTINGS },
      };
      replaceDb(newDb);
      const t = Date.now();
      setLastSyncAt(t);
      setPhase("idle");
      setMessage("Copia descargada de Drive.");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Error al descargar.");
      refreshAuthState();
    } finally {
      busyRef.current = false;
    }
  }, [replaceDb, refreshAuthState]);

  const reconcile = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("checking");
    setMessage("Comprobando Drive…");
    try {
      const driveTime = await getDriveModifiedTime();
      setIsAuthenticated(true);
      const localTime = getLastSyncAt();
      const driveMs = driveTime ? Date.parse(driveTime) : 0;
      const localMs = localTime || 0;

      if (driveTime === null) {
        busyRef.current = false;
        await push();
        return;
      }
      if (driveMs > localMs) {
        busyRef.current = false;
        await pull();
        return;
      }
      setPhase("idle");
      setMessage("Todo sincronizado.");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Error al reconciliar.");
      refreshAuthState();
    } finally {
      busyRef.current = false;
    }
  }, [push, pull, refreshAuthState]);

  // Auto-reconcile al montar. Si el token no está en memoria, Drive intenta
  // recuperarlo silenciosamente con la autorización ya concedida.
  useEffect(() => {
    if (!autoReconcile || !isConfigured) return;
    void reconcile();
  }, [autoReconcile, isConfigured, reconcile]);

  // Auto-push con debounce cuando dbVersion cambia
  useEffect(() => {
    if (!isConfigured || !isAuthenticated) return;
    if (!dbVersion) return; // skip carga inicial
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void push();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dbVersion, isConfigured, isAuthenticated, push]);

  // Último intento de respaldo al abandonar la página. El guardado principal
  // ocurre antes, con debounce, porque los navegadores no garantizan que una
  // petición asíncrona termine durante beforeunload.
  useEffect(() => {
    const flush = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (isConfigured && isAuthenticated) void push();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [isConfigured, isAuthenticated, push]);

  const state: SyncState = {
    phase,
    message,
    lastSyncAt,
    isConfigured,
    isAuthenticated,
  };

  return {
    state,
    signIn,
    requestConsent,
    push,
    pull,
    reconcile,
  };
}
