/**
 * planStore.ts
 * IndexedDB helper for persisting blueprint images (Blobs) per plan.
 * All data is stored entirely in the user's browser — nothing is sent to any server.
 */

const DB_NAME    = 'valtir-planner';
const DB_VERSION = 1;
const STORE_NAME = 'blueprints';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function saveBlueprintBlob(planId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, planId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror   = () => { db.close(); reject(tx.error); };
  });
}

export async function loadBlueprintBlob(planId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(planId);
    req.onsuccess = () => { db.close(); resolve((req.result as Blob) ?? null); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function deleteBlueprintBlob(planId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(planId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror   = () => { db.close(); reject(tx.error); };
  });
}
