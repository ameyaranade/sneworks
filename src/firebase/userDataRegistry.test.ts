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

  it('only projects (groups + sharedProjects) are exportable for now', () => {
    const exportable = userDataRegistry.filter((s) => s.exportable).map((s) => s.collectionName).sort();
    expect(exportable).toEqual(['groups', 'sharedProjects']);
  });

  it('registers chatSessions (assistant history) with erase + cache-clear, not exportable', () => {
    const chat = userDataRegistry.find((s) => s.collectionName === 'chatSessions');
    expect(chat).toBeDefined();
    expect(chat?.exportable).toBe(false);
    expect(typeof chat?.eraseAll).toBe('function');
    expect(typeof chat?.cacheKey).toBe('function');
  });

  it('registers sharedProjects (D8) with export + erase + cache-clear wired', () => {
    const shared = userDataRegistry.find((s) => s.collectionName === 'sharedProjects');
    expect(shared).toBeDefined();
    expect(shared?.exportable).toBe(true);
    expect(typeof shared?.exportAll).toBe('function');
    expect(typeof shared?.eraseAll).toBe('function');
    expect(typeof shared?.cacheKey).toBe('function');
  });
});
