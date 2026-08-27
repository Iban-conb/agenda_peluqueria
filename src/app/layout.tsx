import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/state/store";
import { UIProvider } from "@/state/ui";
import { ThemeProvider, themeInitScript } from "@/state/theme";
import PwaRegistration from "@/components/pwa-registration";
import DriveSyncProvider from "@/components/drive-sync-provider";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peluquería Marisa · Gestión de citas",
  description:
    "Agenda diaria y base de clientes para tu salón de peluquería. Funciona en PC, intranet y móvil (PWA). Los datos se guardan en el dispositivo (IndexedDB) y se pueden sincronizar con Google Drive.",
  keywords: [
    "peluquería",
    "salón",
    "citas",
    "agenda",
    "calendario",
    "clientes",
    "IndexedDB",
    "SQLite",
    "PWA",
    "Google Drive",
  ],
  authors: [{ name: "Peluquería Marisa" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Peluquería Marisa",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8c4a64",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        className={`${bricolage.variable} ${instrument.variable} antialiased`}
      >
        <PwaRegistration />
        <ThemeProvider>
          <StoreProvider>
            <DriveSyncProvider>
              <UIProvider>{children}</UIProvider>
            </DriveSyncProvider>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
