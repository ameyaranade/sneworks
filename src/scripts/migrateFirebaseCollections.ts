/**
 * migrateFirebaseCollections.ts
 *
 * One-time migration: copies Firestore docs from the old `sandbox_*` subcollections
 * to the new renamed subcollections, then deletes the originals.
 *
 * Collections migrated per user:
 *   users/{uid}/sandbox_todos  → users/{uid}/todos
 *   users/{uid}/sandbox_logs   → users/{uid}/logs
 *   users/{uid}/sandbox_groups → users/{uid}/groups
 *
 * Usage: triggered from MigrationRunner.tsx in the app UI.
 */

import {
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
  doc,
  type Firestore,
} from 'firebase/firestore';

export interface MigrationProgress {
  collection: string;
  read: number;
  written: number;
  deleted: number;
}

export interface MigrationResult {
  success: boolean;
  collections: MigrationProgress[];
  error?: string;
}

const COLLECTION_PAIRS: Array<{ from: string; to: string }> = [
  { from: 'sandbox_todos', to: 'todos' },
  { from: 'sandbox_logs', to: 'logs' },
  { from: 'sandbox_groups', to: 'groups' },
];

const BATCH_SIZE = 499; // Firestore max is 500; leave 1 slot for safety

/**
 * Copies all documents from `srcPath` to `dstPath` using batched writes.
 * Returns the number of documents copied.
 */
async function copyCollection(
  db: Firestore,
  uid: string,
  fromCol: string,
  toCol: string,
  onProgress?: (msg: string) => void,
): Promise<{ read: number; written: number }> {
  const srcRef = collection(db, 'users', uid, fromCol);
  const dstRef = collection(db, 'users', uid, toCol);

  onProgress?.(`Reading ${fromCol}...`);
  const snap = await getDocs(srcRef);
  const read = snap.docs.length;
  onProgress?.(`Found ${read} docs in ${fromCol}`);

  if (read === 0) return { read: 0, written: 0 };

  let written = 0;
  // Process in batches
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    for (const srcDoc of chunk) {
      const dstDocRef = doc(dstRef, srcDoc.id);
      batch.set(dstDocRef, srcDoc.data());
    }
    await batch.commit();
    written += chunk.length;
    onProgress?.(`  Written ${written}/${read} to ${toCol}`);
  }

  return { read, written };
}

/**
 * Deletes all documents in a subcollection using batched deletes.
 * Returns the number of documents deleted.
 */
async function deleteCollection(
  db: Firestore,
  uid: string,
  colName: string,
  onProgress?: (msg: string) => void,
): Promise<number> {
  const colRef = collection(db, 'users', uid, colName);
  const snap = await getDocs(colRef);
  onProgress?.(`Deleting ${snap.docs.length} docs from ${colName}...`);

  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.delete(doc(colRef, d.id));
    }
    await batch.commit();
    deleted += chunk.length;
  }

  onProgress?.(`  Deleted ${deleted} docs from ${colName}`);
  return deleted;
}

/**
 * Runs the full migration for a given uid.
 *
 * @param db - Firestore instance
 * @param uid - The authenticated user's uid
 * @param onProgress - Optional callback for progress messages
 * @param deleteOld - If true, deletes old collections after copying (default: true)
 */
export async function migrateCollections(
  db: Firestore,
  uid: string,
  onProgress?: (msg: string) => void,
  deleteOld = true,
): Promise<MigrationResult> {
  const results: MigrationProgress[] = [];

  try {
    // Phase 1: Copy all collections
    for (const { from, to } of COLLECTION_PAIRS) {
      onProgress?.(`--- Migrating ${from} → ${to} ---`);
      const { read, written } = await copyCollection(db, uid, from, to, onProgress);
      results.push({ collection: from, read, written, deleted: 0 });
    }

    // Phase 2: Delete old collections (only after all copies succeed)
    if (deleteOld) {
      onProgress?.('--- Deleting old collections ---');
      for (const { from } of COLLECTION_PAIRS) {
        const entry = results.find((r) => r.collection === from)!;
        entry.deleted = await deleteCollection(db, uid, from, onProgress);
      }
    }

    onProgress?.('Migration complete!');
    return { success: true, collections: results };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    onProgress?.(`ERROR: ${error}`);
    return { success: false, collections: results, error };
  }
}

/**
 * Checks whether the old sandbox_ collections have any data for a user.
 * Useful to determine if migration is needed.
 */
export async function checkMigrationNeeded(
  db: Firestore,
  uid: string,
): Promise<{ needed: boolean; counts: Record<string, number> }> {
  const counts: Record<string, number> = {};
  let needed = false;

  for (const { from } of COLLECTION_PAIRS) {
    const snap = await getDocs(collection(db, 'users', uid, from));
    counts[from] = snap.docs.length;
    if (snap.docs.length > 0) needed = true;
  }

  // Also check if destination collections are empty (fresh migration scenario)
  for (const { to } of COLLECTION_PAIRS) {
    const snap = await getDocs(collection(db, 'users', uid, to));
    counts[to] = snap.docs.length;
  }

  return { needed, counts };
}
