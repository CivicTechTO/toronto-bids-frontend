import { describe, it, expect } from 'vitest';
import { displayTitle } from '../../src/prepare/titles.ts';

describe('displayTitle', () => {
  it('uses the published title verbatim when present', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: 'Road Resurfacing — Various Locations',
        rfx_type: 'RFT',
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Road Resurfacing — Various Locations', untitled: false });
  });

  it('builds "Doc <n> — <rfx_type>, <division>" for a null title (data rule 5)', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: null,
        rfx_type: 'RFQ',
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Doc 3524228095 — RFQ, Transportation Services', untitled: true });
  });

  it('omits the division when null', () => {
    expect(
      displayTitle({ document_number: '3524228095', title: null, rfx_type: 'RFQ', division: null }),
    ).toEqual({ text: 'Doc 3524228095 — RFQ', untitled: true });
  });

  it('omits the rfx_type when null', () => {
    expect(
      displayTitle({
        document_number: '3524228095',
        title: null,
        rfx_type: null,
        division: 'Transportation Services',
      }),
    ).toEqual({ text: 'Doc 3524228095 — Transportation Services', untitled: true });
  });

  it('falls back to the bare document number when rfx_type and division are both null', () => {
    expect(
      displayTitle({ document_number: '3524228095', title: null, rfx_type: null, division: null }),
    ).toEqual({ text: 'Doc 3524228095', untitled: true });
  });
});
