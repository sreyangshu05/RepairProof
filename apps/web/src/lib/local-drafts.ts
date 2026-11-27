import { useEffect, useRef, useState } from 'react';

const DATABASE_NAME = 'repairproof-local-drafts';
const STORE_NAME = 'drafts';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const queues = new Map<string, Promise<unknown>>();
let expiredDraftCleanup: Promise<void> | null = null;

type DraftRecord<T> = { key: string; updatedAt: number; value: T };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDraft<T>(key: string): Promise<DraftRecord<T> | null> {
  await pruneExpiredDrafts();
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as DraftRecord<T> | undefined) ?? null);
    request.onerror = () => reject(request.error);
    request.addEventListener('loadend', () => database.close(), { once: true });
  });
}

function pruneExpiredDrafts() {
  if (expiredDraftCleanup) return expiredDraftCleanup;
  expiredDraftCleanup = openDatabase()
    .then(
      (database) =>
        new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, 'readwrite');
          const cursorRequest = transaction.objectStore(STORE_NAME).openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const record = cursor.value as DraftRecord<unknown>;
            if (Date.now() - record.updatedAt > MAX_AGE_MS) cursor.delete();
            cursor.continue();
          };
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.addEventListener('complete', () => database.close(), { once: true });
        }),
    )
    .catch(() => undefined)
    .finally(() => {
      expiredDraftCleanup = null;
    });
  return expiredDraftCleanup;
}

async function writeDraft<T>(key: string, value: T) {
  await enqueue(key, async () => {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ key, value, updatedAt: Date.now() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.addEventListener('complete', () => database.close(), { once: true });
    });
  });
}

async function deleteDraft(key: string) {
  try {
    await enqueue(key, async () => {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.addEventListener('complete', () => database.close(), { once: true });
      });
    });
  } catch {
    // A local cleanup failure must not affect a server-confirmed workflow.
  }
}

function enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.then(operation);
  queues.set(
    key,
    current.catch(() => undefined),
  );
  return current;
}

export function useLocalDraft<T>(
  key: string,
  currentValue: T,
  initialValue: T,
  setCurrentValue: (value: T) => void,
) {
  const initialJson = JSON.stringify(initialValue);
  const currentJson = JSON.stringify(currentValue);
  const baseline = useRef(initialJson);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState<T | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [ready, setReady] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setRecoveredDraft(null);
    setSavedLocally(false);
    baseline.current = initialJson;
    void readDraft<T>(key)
      .then(async (record) => {
        if (record && Date.now() - record.updatedAt > MAX_AGE_MS) {
          await deleteDraft(key);
          return null;
        }
        return record;
      })
      .then((record) => {
        if (cancelled) return;
        setRecoveredDraft(record?.value ?? null);
        setSavedLocally(Boolean(record));
        setStorageAvailable(true);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setStorageAvailable(false);
        setReady(true);
      });
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [key, initialJson]);

  useEffect(() => {
    if (!ready || !storageAvailable || recoveredDraft !== null) return;
    if (currentJson === baseline.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      let value: T;
      try {
        value = JSON.parse(currentJson) as T;
      } catch {
        return;
      }
      void writeDraft(key, value)
        .then(() => setSavedLocally(true))
        .catch(() => setStorageAvailable(false));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [currentJson, key, ready, recoveredDraft, storageAvailable]);

  const restore = () => {
    if (recoveredDraft === null) return;
    baseline.current = JSON.stringify(recoveredDraft);
    setCurrentValue(recoveredDraft);
    setRecoveredDraft(null);
    setSavedLocally(true);
  };

  const discard = () => {
    baseline.current = currentJson;
    setRecoveredDraft(null);
    setSavedLocally(false);
    void deleteDraft(key);
  };

  const clearAfterConfirmation = (confirmedValue: T = currentValue) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    baseline.current = JSON.stringify(confirmedValue);
    setRecoveredDraft(null);
    setSavedLocally(false);
    void deleteDraft(key);
  };

  return {
    recoveredDraft,
    storageAvailable,
    savedLocally,
    restore,
    discard,
    clearAfterConfirmation,
  };
}
