import { Platform } from 'react-native';
import { getApiBaseUrl, getToken } from '../api';

const DB_NAME = 'thekabook_doc_cache';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface StoredDoc {
  id: string;
  name: string;
  dataUrl: string;
  mimeType?: string;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save document content locally in IndexedDB (under both doc.id and file name).
 */
export async function saveDocToIndexedDB(
  id: string,
  name: string,
  dataUrl: string,
  mimeType?: string
): Promise<void> {
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredDoc = {
        id,
        name,
        dataUrl,
        mimeType: mimeType || 'application/pdf',
        updatedAt: Date.now(),
      };
      store.put(record);

      // Also save by filename key as fallback
      if (name && name !== id) {
        store.put({
          ...record,
          id: name,
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve document content from IndexedDB by id or name.
 */
export async function getDocFromIndexedDB(idOrName: string): Promise<StoredDoc | null> {
  const db = await openDB();
  if (!db || !idOrName) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(idOrName);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Upload document content to the API server so other sessions / devices can access it.
 */
export async function uploadDocToServer(
  id: string,
  name: string,
  dataUrl: string,
  mimeType?: string,
  token?: string
): Promise<boolean> {
  try {
    const auth = token || (await getToken());
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({
        id,
        name,
        mimeType: mimeType || 'application/pdf',
        dataUrl,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch document binary from API server as Blob URL.
 */
export async function fetchDocFromServer(
  id: string,
  token?: string
): Promise<{ blobUrl: string; filename?: string } | null> {
  try {
    const auth = token || (await getToken());
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/documents/${encodeURIComponent(id)}${auth ? `?token=${auth}` : ''}`;
    const res = await fetch(url, {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    if (!res.ok) return null;

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { blobUrl };
  } catch {
    return null;
  }
}

/**
 * Trigger immediate browser download of a file from DataURL or Blob URL.
 */
export function triggerBrowserDownload(url: string, filename: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Failed to trigger download:', err);
  }
}
