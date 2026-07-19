import { describe, it, expect } from 'vitest';
import { GLOSSARY, GLOSSARY_BY_ID } from '../../src/lib/glossary.ts';

describe('GLOSSARY', () => {
  it('has unique, url-safe ids', () => {
    const ids = GLOSSARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('gives every entry a heading and a one-sentence plain definition', () => {
    for (const e of GLOSSARY) {
      expect(e.term.length).toBeGreaterThan(0);
      expect(e.short.length).toBeGreaterThan(0);
      // `short` becomes a title attribute — keep it to a short sentence.
      expect(e.short.length).toBeLessThanOrEqual(160);
    }
  });

  it('indexes every entry by id', () => {
    for (const e of GLOSSARY) expect(GLOSSARY_BY_ID[e.id]).toBe(e);
    expect(Object.keys(GLOSSARY_BY_ID).length).toBe(GLOSSARY.length);
  });

  it('defines the terms the pages link to', () => {
    for (const id of [
      'solicitation',
      'award',
      'bid',
      'non-competitive',
      'buyer',
      'composite-award',
    ]) {
      expect(GLOSSARY_BY_ID[id], `missing glossary entry "${id}"`).toBeDefined();
    }
  });
});
