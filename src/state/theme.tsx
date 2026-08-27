"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeId = "rosa" | "noche";

interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Muestras visuales para el selector */
  swatches: { name: keyof typeof SWATCH_KEYS; color: string }[];
}

/** Claves CSS a mostrar en las tarjetas de previsualización */
const SWATCH_KEYS = {
  pine: "--color-pine",
  gold: "--color-gold",
  paper: "--color-paper",
  ink: "--color-ink",
} as const;

export const THEMES: ThemeMeta[] = [
  {
    id: "rosa",
    label: "Rosa",
    description: "Rosa viejo y crema · romántico y suave",
    swatches: [
      { name: "pine", color: "#8c4a64" },
      { name: "gold", color: "#c47b8a" },
      { name: "paper", color: "#faf3f1" },
      { name: "ink", color: "#4a2c30" },
    ],
  },
  {
    id: "noche",
    label: "Noche",
    description: "Negro y rosa · elegante y premium",
    swatches: [
      { name: "pine", color: "#191317" },
      { name: "gold", color: "#d98aa6" },
      { name: "paper", color: "#0d0a0c" },
      { name: "ink", color: "#f2dce3" },
    ],
  },
];

const STORAGE_KEY = "salon-aura-theme";

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.classList.remove("theme-aura", "theme-rosa", "theme-noche");
  root.classList.add(`theme-${theme}`);
  // Actualiza meta theme-color para móvil
  const meta = document.querySelector('meta[name="theme-color"]');
  const colors: Record<ThemeId, string> = {
    rosa: "#8c4a64",
    noche: "#0d0a0c",
  };
  if (meta) meta.setAttribute("content", colors[theme]);
}

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "rosa";
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  // Los temas antiguos no disponibles pasan a Rosa.
  if (stored === "noche") return "noche";
  return "rosa";
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "rosa",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("rosa");

  // Aplicar tema al montar (desde localStorage)
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  // Script inline para aplicar el tema antes del primer render (evita flash)
  // Se ejecuta como <script> en <head> desde layout.tsx
  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
    window.dispatchEvent(new Event("theme-changed"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Script que debe inyectarse en <head> para aplicar el tema antes del render.
 * Evita el flash de tema incorrecto al recargar la página. */
export const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    // Los temas antiguos no disponibles pasan a Rosa.
    if (t !== 'rosa' && t !== 'noche') t = 'rosa';
    var root = document.documentElement;
    root.classList.remove('theme-aura', 'theme-rosa', 'theme-noche');
    root.classList.add('theme-' + t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var colors = { rosa: '#8c4a64', noche: '#0d0a0c' };
      meta.setAttribute('content', colors[t]);
    }
  } catch (e) {}
})();
`;
