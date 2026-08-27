/**
 * Sincronización con Google Drive mediante OAuth 2.0 + Drive REST API.
 *
 * Patrón "local-first":
 *  - IndexedDB es la fuente de verdad local (ya gestionada por store.tsx).
 *  - Google Drive guarda una réplica del archivo .sqlite exportado.
 *  - La resolución de conflictos se hace por modifiedTime: gana el más nuevo.
 *  - Subida segura: sube a un archivo temporal y luego renombra,
 *    evitando corrupción si la subida falla a medias.
 */

const DRIVE_FILE_NAME = "peluqueria-marisa-db.sqlite";
const DRIVE_FILE_NAME_TMP = "peluqueria-marisa-db.sqlite.tmp";
const DRIVE_FIELDS = "id,name,modifiedTime,size";

const STORAGE_KEY_CLIENT_ID = "peluqueria-marisa-drive-client-id";
const STORAGE_KEY_FILE_ID = "peluqueria-marisa-drive-file-id";
const STORAGE_KEY_LAST_SYNC = "peluqueria-marisa-drive-last-sync";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; expires_in: number; error?: string }) => void;
            error_callback?: () => void;
          }) => {
            requestAccessToken: (opts?: { prompt?: "" | "consent" | "none" }) => void;
          };
        };
      };
    };
  }
}

let gisLoaded = false;
let gisPromise: Promise<void> | null = null;

/** Carga diferida del Google Identity Services script. */
export function loadGis(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("google-gis-script");
    if (existing) {
      existing.addEventListener("load", () => {
        gisLoaded = true;
        resolve();
      });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisPromise;
}

/* ============ Configuración persistida ============ */

export function getStoredClientId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_CLIENT_ID) || "";
  } catch {
    return "";
  }
}

export function setStoredClientId(id: string) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_CLIENT_ID, id.trim());
    else localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
    // Al cambiar de cliente, olvidamos el file id guardado
    localStorage.removeItem(STORAGE_KEY_FILE_ID);
  } catch {
    /* ignore */
  }
}

export function getStoredFileId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_FILE_ID) || "";
  } catch {
    return "";
  }
}

function setStoredFileId(id: string) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_FILE_ID, id);
    else localStorage.removeItem(STORAGE_KEY_FILE_ID);
  } catch {
    /* ignore */
  }
}

export function getLastSyncAt(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function setLastSyncAt(t: number) {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, String(t));
  } catch {
    /* ignore */
  }
}

/* ============ OAuth ============ */

let currentToken: string | null = null;
let tokenExpiry = 0;

export function hasValidToken(): boolean {
  return !!currentToken && Date.now() < tokenExpiry - 60_000;
}

export function getStoredTokenInfo(): { token: string | null; expiry: number } {
  return { token: currentToken, expiry: tokenExpiry };
}

/** Solicita un access token con el alcance drive.file.
 *  drive.file solo permite acceder a archivos que la propia app ha creado. */
export async function requestAccessToken(
  clientId: string,
  prompt: "" | "consent" | "none" = ""
): Promise<string> {
  if (!clientId) throw new Error("Falta el Client ID de Google OAuth.");
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services no disponible.");
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error("No se pudo obtener el access token."));
          return;
        }
        currentToken = response.access_token;
        tokenExpiry = Date.now() + response.expires_in * 1000;
        resolve(response.access_token);
      },
      error_callback: () => {
        reject(new Error("El usuario canceló o falló la autenticación."));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export function signOut() {
  currentToken = null;
  tokenExpiry = 0;
  // Revocar el token en el servidor de Google (best effort)
  if (currentToken) {
    fetch(
      `https://oauth2.googleapis.com/revoke?token=${currentToken}`,
      { method: "POST" }
    ).catch(() => {});
  }
}

async function ensureToken(): Promise<string> {
  if (hasValidToken()) return currentToken!;
  const clientId = getStoredClientId();
  if (!clientId) throw new Error("Configura primero el Client ID en Ajustes.");
  return requestAccessToken(clientId, "none");
}

/* ============ Drive REST API ============ */

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

async function driveFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await ensureToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    // Token expirado o inválido: reintentar una vez
    currentToken = null;
    const fresh = await ensureToken();
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${fresh}`,
        ...(init.headers || {}),
      },
    });
  }
  return res;
}

/** Busca el archivo .sqlite en Drive (por nombre exacto).
 *  Devuelve el primero que encuentre o null si no existe. */
export async function findDbFile(): Promise<DriveFile | null> {
  // Comprueba primero el ID cacheado
  const cachedId = getStoredFileId();
  if (cachedId) {
    try {
      const res = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${cachedId}?fields=${DRIVE_FIELDS}`
      );
      if (res.ok) {
        const f = (await res.json()) as DriveFile;
        if (f && f.id) return f;
      }
    } catch {
      /* file eliminado, seguimos buscando */
    }
  }

  const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(${DRIVE_FIELDS})&orderBy=modifiedTime desc`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive list error: ${err}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  const file = data.files?.[0] || null;
  if (file) setStoredFileId(file.id);
  return file;
}

/** Sube el archivo .sqlite a Drive de forma segura:
 *  1. Sube como archivo .tmp
 *  2. Si ya existe el archivo principal, lo actualiza (PATCH content)
 *  3. Si no existe, crea el definitivo y elimina el .tmp
 *  Devuelve el metadata del archivo final. */
export async function uploadDb(
  bytes: Uint8Array
): Promise<DriveFile> {
  // Pasada 1: subir como tmp (siempre, así nunca corrompemos el principal)
  const tmpFile = await uploadMultipart(DRIVE_FILE_NAME_TMP, bytes);

  // Pasada 2: buscar el archivo principal existente
  const existing = await findDbFileByName(DRIVE_FILE_NAME);

  let finalFile: DriveFile;
  if (existing) {
    // PATCH: actualizar contenido del archivo existente
    finalFile = await patchFileContent(existing.id, DRIVE_FILE_NAME, bytes);
    // Borrar el tmp
    await safeDelete(tmpFile.id);
  } else {
    // Crear archivo definitivo copiando el tmp y renombrándolo
    finalFile = await copyAndRename(tmpFile.id, DRIVE_FILE_NAME);
    // Borrar el tmp
    await safeDelete(tmpFile.id);
  }

  setStoredFileId(finalFile.id);
  const now = Date.now();
  setLastSyncAt(now);
  return finalFile;
}

async function findDbFileByName(name: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name = '${name}' and trashed = false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(${DRIVE_FIELDS})&orderBy=modifiedTime desc`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive list error: ${err}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files?.[0] || null;
}

async function uploadMultipart(
  name: string,
  bytes: Uint8Array
): Promise<DriveFile> {
  const metadata = { name, mimeType: "application/x-sqlite3" };
  const boundary = "peluqueria_marisa_" + Math.random().toString(36).slice(2);
  const body = new Uint8Array([
    ...new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: application/x-sqlite3\r\n\r\n`
    ),
    ...bytes,
    ...new TextEncoder().encode(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=" +
      DRIVE_FIELDS,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload error: ${err}`);
  }
  return (await res.json()) as DriveFile;
}

async function patchFileContent(
  fileId: string,
  name: string,
  bytes: Uint8Array
): Promise<DriveFile> {
  const metadata = { name };
  const boundary = "peluqueria_marisa_" + Math.random().toString(36).slice(2);
  const body = new Uint8Array([
    ...new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: application/x-sqlite3\r\n\r\n`
    ),
    ...bytes,
    ...new TextEncoder().encode(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=${DRIVE_FIELDS}`,
    {
      method: "PATCH",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive update error: ${err}`);
  }
  return (await res.json()) as DriveFile;
}

async function copyAndRename(
  sourceId: string,
  newName: string
): Promise<DriveFile> {
  // Copiar el archivo tmp con el nombre final
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${sourceId}/copy?fields=${DRIVE_FIELDS}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive copy error: ${err}`);
  }
  return (await res.json()) as DriveFile;
}

async function safeDelete(fileId: string): Promise<void> {
  try {
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
    });
  } catch {
    /* best effort */
  }
}

/** Descarga el contenido binario del archivo .sqlite de Drive. */
export async function downloadDb(): Promise<Uint8Array<ArrayBuffer>> {
  const file = await findDbFile();
  if (!file) throw new Error("No hay archivo .sqlite en Drive todavía.");
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive download error: ${err}`);
  }
  const buf = await res.arrayBuffer();
  setLastSyncAt(Date.now());
  return new Uint8Array(buf);
}

/** Devuelve el modifiedTime del archivo en Drive (ISO string). */
export async function getDriveModifiedTime(): Promise<string | null> {
  const file = await findDbFile();
  return file?.modifiedTime || null;
}

export interface SyncStatus {
  driveHasFile: boolean;
  driveModifiedTime: string | null;
  lastSyncAt: number | null;
  fileId: string | null;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const file = await findDbFile();
    return {
      driveHasFile: !!file,
      driveModifiedTime: file?.modifiedTime || null,
      lastSyncAt: getLastSyncAt(),
      fileId: file?.id || null,
    };
  } catch {
    return {
      driveHasFile: false,
      driveModifiedTime: null,
      lastSyncAt: getLastSyncAt(),
      fileId: null,
    };
  }
}

export const DRIVE_CONSTANTS = {
  DRIVE_FILE_NAME,
  DRIVE_FILE_NAME_TMP,
};
