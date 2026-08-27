"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Client } from "../lib/types";
import { uid } from "../lib/indexeddb";
import AppointmentModal, {
  type ApptPreset,
} from "../components/appointment-modal";
import ClientModal from "../components/client-modal";
import { IcAlert, IcCheck, IcSparkle } from "../components/icons";

export type ToastTone = "ok" | "err" | "info";
interface Toast {
  id: string;
  msg: string;
  tone: ToastTone;
}

export interface ConfirmOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface UIApi {
  toast: (msg: string, tone?: ToastTone) => void;
  openAppointment: (preset?: ApptPreset) => void;
  openClient: (preset?: Client | null, onSaved?: (id: string) => void) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  install: () => void;
  installAvailable: boolean;
  standalone: boolean;
}

const Ctx = createContext<UIApi | null>(null);

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [apptPreset, setApptPreset] = useState<ApptPreset | null>(null);
  const [clientModal, setClientModal] = useState<{
    preset: Client | null;
    onSaved?: (id: string) => void;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOpts;
    resolve: (v: boolean) => void;
  } | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const deferred = useRef<BIPEvent | null>(null);

  const toast = useCallback((msg: string, tone: ToastTone = "ok") => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3400
    );
  }, []);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BIPEvent;
      setInstallAvailable(true);
    };
    const onInstalled = () => {
      setInstallAvailable(false);
      toast("Aplicación instalada. ¡Ya la tienes en tu pantalla!", "ok");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    try {
      if (window.matchMedia("(display-mode: standalone)").matches)
        setStandalone(true);
    } catch {
      /* opcional */
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [toast]);

  const install = useCallback(async () => {
    const e = deferred.current;
    if (!e) return;
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === "accepted") setInstallAvailable(false);
    deferred.current = null;
  }, []);

  const api: UIApi = {
    toast,
    openAppointment: (preset) => setApptPreset(preset ?? {}),
    openClient: (preset, onSaved) =>
      setClientModal({ preset: preset ?? null, onSaved }),
    confirm: (opts) =>
      new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })),
    install,
    installAvailable,
    standalone,
  };

  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      {apptPreset && (
        <AppointmentModal
          preset={apptPreset}
          onClose={() => setApptPreset(null)}
        />
      )}

      {clientModal && (
        <ClientModal
          preset={clientModal.preset}
          onSaved={clientModal.onSaved}
          onClose={() => setClientModal(null)}
        />
      )}

      {confirmState && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 65 }}
          role="alertdialog"
          aria-modal="true"
        >
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-pine/45 backdrop-blur-[2px] anim-fade cursor-default"
            onClick={() => closeConfirm(false)}
            tabIndex={-1}
          />
          <div className="relative w-full max-w-sm bg-card border border-line rounded-xl shadow-2xl anim-pop p-5">
            <h3 className="font-display font-bold text-lg text-ink">
              {confirmState.opts.title}
            </h3>
            <p className="text-sm text-soft mt-1.5 leading-relaxed">
              {confirmState.opts.message}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => closeConfirm(false)}
                className="flex-1 rounded-lg border border-linedark px-4 py-2.5 text-sm font-semibold text-soft hover:bg-mint/60 hover:text-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-paper active:scale-[0.98] transition-all shadow-sm ${
                  confirmState.opts.danger
                    ? "bg-danger hover:bg-[#9c2d42]"
                    : "bg-pine hover:bg-pine2"
                }`}
              >
                {confirmState.opts.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        style={{ zIndex: 80 }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-toast flex items-center gap-2.5 rounded-full bg-ink text-paper pl-2 pr-4 py-2 text-sm font-medium shadow-xl"
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                t.tone === "ok"
                  ? "bg-moss"
                  : t.tone === "err"
                  ? "bg-danger"
                  : "bg-moss text-paper"
              }`}
            >
              {t.tone === "ok" && <IcCheck size={13} />}
              {t.tone === "err" && <IcAlert size={13} />}
              {t.tone === "info" && <IcSparkle size={13} />}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useUI(): UIApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI fuera de UIProvider");
  return ctx;
}
