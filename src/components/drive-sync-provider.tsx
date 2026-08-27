"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useStore } from "@/state/store";
import { useDriveSync } from "@/hooks/use-drive-sync";

type DriveSyncApi = ReturnType<typeof useDriveSync>;

const DriveSyncContext = createContext<DriveSyncApi | null>(null);

/** Mantiene la sincronización activa aunque el usuario no esté en Ajustes. */
export default function DriveSyncProvider({ children }: { children: ReactNode }) {
  const { db, loading, replaceAll } = useStore();
  const dbRef = useRef(db);
  const replaceRef = useRef(replaceAll);
  useEffect(() => {
    dbRef.current = db;
    replaceRef.current = replaceAll;
  }, [db, replaceAll]);
  const sync = useDriveSync({
    getDb: () => dbRef.current,
    replaceDb: (next) => replaceRef.current(next),
    dbVersion: loading ? "" : JSON.stringify(db),
    autoReconcile: true,
  });

  return (
    <DriveSyncContext.Provider value={sync}>
      {children}
    </DriveSyncContext.Provider>
  );
}

export function useDriveSyncContext(): DriveSyncApi {
  const context = useContext(DriveSyncContext);
  if (!context) throw new Error("useDriveSyncContext fuera de DriveSyncProvider");
  return context;
}
