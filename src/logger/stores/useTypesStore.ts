import { create } from 'zustand';
import type { TypeSchema } from '../types';
import { subscribeToTypes, addTypeSchema, updateTypeSchema, deleteTypeSchema } from '../firebase/typeQueries';
import { loggerCacheKey } from '../constants';
import { readCache, writeCache } from '../utils';
import { getCachedUid } from '../../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

interface TypesState {
  types: TypeSchema[];
  typesMap: Map<string, TypeSchema>;
  loaded: boolean;

  // Initialize with uid — returns unsubscribe
  init: (uid: string) => Unsubscribe;

  // CRUD
  addType: (uid: string, schema: Omit<TypeSchema, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateType: (uid: string, typeId: string, partial: Partial<TypeSchema>) => Promise<void>;
  deleteType: (uid: string, typeId: string) => Promise<void>;
}

export const useTypesStore = create<TypesState>((set) => {
  // Synchronous cache seed on module load (before any init call)
  const cachedUid = getCachedUid();
  let initialTypes: TypeSchema[] = [];
  if (cachedUid) {
    initialTypes = readCache<TypeSchema[]>(loggerCacheKey(cachedUid, 'types')) ?? [];
  }

  const buildMap = (types: TypeSchema[]): Map<string, TypeSchema> =>
    new Map(types.map((t) => [t.id!, t]));

  return {
    types: initialTypes,
    typesMap: buildMap(initialTypes),
    loaded: initialTypes.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToTypes(uid, (types) => {
        set({ types, typesMap: buildMap(types), loaded: true });
        writeCache(loggerCacheKey(uid, 'types'), types);
      });
      return unsub;
    },

    addType: async (uid, schema) => {
      return addTypeSchema(uid, schema);
    },

    updateType: async (uid, typeId, partial) => {
      await updateTypeSchema(uid, typeId, partial);
    },

    deleteType: async (uid, typeId) => {
      await deleteTypeSchema(uid, typeId);
    },
  };
});
