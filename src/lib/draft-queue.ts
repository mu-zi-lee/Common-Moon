/**
 * Draft queue: persists pending `upsertRecord` payloads in IndexedDB and
 * retries them when online. Photos are already uploaded to storage before
 * a payload lands here (their paths live inside the payload), so a queued
 * draft is safe to retry indefinitely without duplicating uploads.
 */

export type DraftPayload = {
  id?: string;
  event_id?: string | null;
  photo_url?: string | null;
  photo_urls: string[];
  teacher_name?: string | null;
  character_name?: string | null;
  anime_name?: string | null;
  hall?: string | null;
  booth?: string | null;
  marker_x?: number | null;
  marker_y?: number | null;
  note?: string | null;
  favorite: boolean;
  rating: number;
  interactions?: string[];
  occurred_at?: string;
  contacts: { platform: string; handle: string }[];
  tags: string[];
};


export type DraftStatus = "pending" | "uploading" | "error";

export type Draft = {
  id: string;
  createdAt: number;
  payload: DraftPayload;
  status: DraftStatus;
  error?: string;
  /** post-quick flag: after successful flush, redirect target hint */
  quick?: boolean;
};

const DB_NAME = "coslog-drafts";
const STORE = "drafts";

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    let result: T;
    Promise.resolve(fn(s)).then((r) => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/* ---------------- Subscribers ---------------- */

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  for (const l of listeners) l();
}
export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/* ---------------- API ---------------- */

export async function list(): Promise<Draft[]> {
  try {
    return await tx("readonly", async (s) => {
      const rows = await req(s.getAll() as IDBRequest<Draft[]>);
      return rows.sort((a, b) => a.createdAt - b.createdAt);
    });
  } catch {
    return [];
  }
}

export async function enqueue(payload: DraftPayload, opts?: { quick?: boolean }): Promise<Draft> {
  const draft: Draft = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    payload,
    status: "pending",
    quick: opts?.quick,
  };
  await tx("readwrite", async (s) => { await req(s.put(draft)); });
  notify();
  return draft;
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", async (s) => { await req(s.delete(id)); });
  notify();
}

async function update(id: string, patch: Partial<Draft>): Promise<void> {
  await tx("readwrite", async (s) => {
    const cur = await req(s.get(id) as IDBRequest<Draft | undefined>);
    if (!cur) return;
    await req(s.put({ ...cur, ...patch }));
  });
  notify();
}

/* ---------------- Flush loop ---------------- */

type FlushResult = { flushed: number; failed: number };
let flushing = false;
let uploader: ((payload: DraftPayload) => Promise<unknown>) | null = null;

/** Wire once from a client-only bootstrapping site. */
export function setUploader(fn: (payload: DraftPayload) => Promise<unknown>) {
  uploader = fn;
}

export async function flush(): Promise<FlushResult> {
  if (flushing) return { flushed: 0, failed: 0 };
  if (!uploader) return { flushed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { flushed: 0, failed: 0 };
  }
  flushing = true;
  let flushed = 0;
  let failed = 0;
  try {
    const drafts = await list();
    for (const d of drafts) {
      await update(d.id, { status: "uploading", error: undefined });
      try {
        await uploader(d.payload);
        await remove(d.id);
        flushed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await update(d.id, { status: "error", error: msg });
        failed++;
      }
    }
  } finally {
    flushing = false;
    notify();
  }
  return { flushed, failed };
}

/* ---------------- Auto-triggers ---------------- */

let installed = false;
export function installAutoFlush() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => { void flush(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
}
