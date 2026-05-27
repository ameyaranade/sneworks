import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { TypeSchema } from '../types';
import { DEFAULT_TYPE_SCHEMAS } from '../constants';

// ─── Collection helper ─────────────────────────────────────────────────────────

function typesCol(uid: string) {
  return collection(db, 'users', uid, 'logger_types');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addTypeSchema(
  uid: string,
  schema: Omit<TypeSchema, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(typesCol(uid), {
    ...schema,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTypeSchema(
  uid: string,
  typeId: string,
  partial: Partial<Omit<TypeSchema, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'logger_types', typeId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTypeSchema(uid: string, typeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'logger_types', typeId));
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

export async function seedDefaultTypes(uid: string): Promise<void> {
  const col = typesCol(uid);
  const existing = await getDocs(col);
  if (!existing.empty) return; // already seeded

  const batch = writeBatch(db);
  for (const schema of DEFAULT_TYPE_SCHEMAS) {
    const ref = doc(col); // auto-id
    batch.set(ref, {
      ...schema,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export function subscribeToTypes(
  uid: string,
  cb: (types: TypeSchema[]) => void,
): Unsubscribe {
  const q = query(typesCol(uid), orderBy('sortOrder', 'asc'));
  return onSnapshot(q, async (snap) => {
    if (snap.empty) {
      // First run: seed defaults, subscription will fire again after write
      seedDefaultTypes(uid).catch(console.error);
      return;
    }
    const types = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TypeSchema));
    cb(types);
  });
}
