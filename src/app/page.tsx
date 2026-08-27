"use client";

import { useEffect, useState } from "react";
import AgendaView from "@/views/agenda-view";
import ClientsView from "@/views/clients-view";
import SettingsView from "@/views/settings-view";
import MonthCalendarView from "@/views/month-calendar-view";
import {
  IcBarberPole,
  IcCalendar,
  IcCog,
  IcDownload,
  IcGrid,
  IcUsers,
} from "@/components/icons";
import { useUI } from "@/state/ui";
import { useStore } from "@/state/store";
import InstallModal from "@/components/install-modal";

type Tab = "calendario" | "agenda" | "clientes" | "ajustes";

const TABS: {
  id: Tab;
  label: string;
  icon: (s: number) => React.ReactNode;
}[] = [
  { id: "agenda", label: "Agenda", icon: (s) => <IcCalendar size={s} /> },
  { id: "calendario", label: "Calendario", icon: (s) => <IcGrid size={s} /> },
  { id: "clientes", label: "Clientes", icon: (s) => <IcUsers size={s} /> },
  { id: "ajustes", label: "Ajustes", icon: (s) => <IcCog size={s} /> },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
  return (
    <div className="text-right leading-none select-none">
      <p className="font-display font-bold text-base num text-paper">
        {pad(now.getHours())}:{pad(now.getMinutes())}
        <span className="text-paper/50 text-xs num">:{pad(now.getSeconds())}</span>
      </p>
      <p className="text-[10px] text-paper/55 font-medium mt-0.5 capitalize">
        {dateStr}
      </p>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("agenda");
  const [agendaDay, setAgendaDay] = useState<string | undefined>();
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const { install, installAvailable, standalone } = useUI();
  const { db } = useStore();
  const salonName = db.salon?.name || "Peluquería Marisa";

  // Título de la pestaña del navegador con el nombre del salón
  useEffect(() => {
    document.title = `${salonName} · Gestión de citas`;
  }, [salonName]);

  return (
    <div className="app-bg min-h-dvh">
      {/* cabecera */}
      <header className="sticky top-0 z-40 bg-pine text-paper shadow-[0_10px_30px_-12px_rgba(22,60,44,0.55)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-moss flex items-center justify-center shadow-inner shrink-0 text-paper">
              <IcBarberPole size={21} />
            </span>
            <div className="leading-none min-w-0">
              <p className="font-display font-extrabold text-lg tracking-tight truncate">
                {salonName}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-moss mt-0.5 hidden sm:block">
                Gestión de citas
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-0.5 mx-auto rounded-full bg-white/10 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  tab === t.id
                    ? "bg-paper text-pine shadow"
                    : "text-paper/70 hover:text-paper"
                }`}
              >
                {t.icon(14)}
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-auto">
            {!standalone && (
              <button
                onClick={() => setInstallModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-moss text-paper px-3 py-1.5 text-[11px] font-bold hover:bg-pine2 active:scale-[0.97] transition-all shadow"
              >
                <IcDownload size={13} />
                <span className="hidden sm:inline">Instalar app</span>
              </button>
            )}
            <div className="hidden sm:block">
              <Clock />
            </div>
          </div>
        </div>
      </header>

      {/* contenido */}
      <main className="max-w-6xl mx-auto px-4 py-5 pb-28 lg:pb-10">
        <div key={tab} className="anim-fade">
          {tab === "calendario" && (
            <MonthCalendarView
              onOpenAgenda={(day) => {
                setAgendaDay(day);
                setTab("agenda");
              }}
            />
          )}
          {tab === "agenda" && <AgendaView initialDay={agendaDay} />}
          {tab === "clientes" && <ClientsView />}
          {tab === "ajustes" && <SettingsView />}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-24 lg:pb-8">
        <p className="text-center text-[11px] text-faint">
          {salonName} · los datos se guardan en este dispositivo — exporta copias desde Ajustes
        </p>
      </footer>

      {/* navegación inferior en móvil */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-line shadow-[0_-8px_24px_-12px_rgba(27,38,33,0.25)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex flex-col items-center gap-0.5 py-2.5 transition-colors"
              >
                <span
                  className={`absolute top-0 h-0.5 w-10 rounded-full transition-all ${
                    active ? "bg-moss" : "bg-transparent"
                  }`}
                />
                <span
                  className={`transition-colors ${
                    active ? "text-pine" : "text-faint"
                  }`}
                >
                  {t.icon(20)}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    active ? "text-pine" : "text-faint"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {installModalOpen && (
        <InstallModal
          onClose={() => setInstallModalOpen(false)}
          onInstall={() => {
            setInstallModalOpen(false);
            install();
          }}
          installAvailable={installAvailable}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return <Shell />;
}
