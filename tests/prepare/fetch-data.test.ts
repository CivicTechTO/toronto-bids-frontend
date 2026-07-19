import { describe, expect, it } from 'vitest';
import { DEFAULT_URL, fetchDecision } from '../../scripts/fetch-data';

describe('fetchDecision', () => {
  it('skips when TB_DATA_FILE is set', () => {
    expect(fetchDecision({ TB_DATA_FILE: 'tests/fixtures/bids.fixture.json' }))
      .toEqual({ mode: 'skip', file: 'tests/fixtures/bids.fixture.json' });
  });

  it('TB_DATA_FILE wins even when TB_DATA_URL is also set', () => {
    expect(fetchDecision({ TB_DATA_FILE: 'x.json', TB_DATA_URL: 'https://example.com/bids.json' }))
      .toEqual({ mode: 'skip', file: 'x.json' });
  });

  it('downloads from TB_DATA_URL when TB_DATA_FILE is unset', () => {
    expect(fetchDecision({ TB_DATA_URL: 'https://example.com/bids.json' }))
      .toEqual({ mode: 'download', url: 'https://example.com/bids.json' });
  });

  it('falls back to the latest-release URL when neither is set', () => {
    expect(fetchDecision({})).toEqual({ mode: 'download', url: DEFAULT_URL });
    expect(DEFAULT_URL).toBe('https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json');
  });

  it('treats empty strings as unset', () => {
    expect(fetchDecision({ TB_DATA_FILE: '', TB_DATA_URL: '' }))
      .toEqual({ mode: 'download', url: DEFAULT_URL });
  });
});
