import { describe, it, expect } from 'vitest';
import {
  userDataRegistry,
  USER_DATA_COLLECTIONS,
} from './userDataRegistry';

describe('userDataRegistry coverage', () => {
  it('registers every user-data collection (no store escapes export/erase)', () => {
    const registered = userDataRegistry.map((s) => s.collectionName).sort();
    expect(registered).toEqual([...USER_DATA_COLLECTIONS].sort());
  });

  it('has no duplicate collection entries', () => {
    const names = userDataRegistry.map((s) => s.collectionName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every store can be erased', () => {
    for (const store of userDataRegistry) {
      expect(typeof store.eraseAll).toBe('function');
    }
  });

  it('every exportable store provides exportAll', () => {
    for (const store of userDataRegistry.filter((s) => s.exportable)) {
      expect(typeof store.exportAll).toBe('function');
    }
  });

  it('only projects (the groups store) are exportable for now', () => {
    const exportable = userDataRegistry.filter((s) => s.exportable).map((s) => s.collectionName);
    expect(exportable).toEqual(['groups']);
  });
});
