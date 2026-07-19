import { describe, expect, it } from 'vitest';
import { loadFixture, loadPage } from './helpers';

const fixture = loadFixture();

// Group fixture composite award lines by call_number, mirroring p.compositeCalls.
const byCall = new Map<string, typeof fixture.composite_awards>();
for (const line of fixture.composite_awards) {
  const list = byCall.get(line.call_number) ?? [];
  list.push(line);
  byCall.set(line.call_number, list);
}
const multiWinner = [...byCall.entries()].find(([, lines]) => lines.length >= 2)!;

describe('/calls/ index', () => {
  it('lists every fixture call with a link to its page', () => {
    const $ = loadPage('calls');
    for (const call of byCall.keys()) {
      expect($(`a[href="/calls/${call}/"]`).length, `missing link for call ${call}`).toBe(1);
      expect($('body').text()).toContain(call);
    }
  });
});

describe('/calls/{call}/ record page', () => {
  const [call, lines] = multiWinner;
  it('the fixture has a call with at least two winners', () => {
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
  it('shows every winner line', () => {
    const $ = loadPage(`calls/${call}`);
    expect($('.composite-lines tbody tr').length).toBe(lines.length);
    for (const line of lines) {
      if (line.supplier_name_raw !== null) {
        expect($('.composite-lines').text()).toContain(line.supplier_name_raw);
      }
    }
  });
  it('shows the initial-term-only caveat', () => {
    const $ = loadPage(`calls/${call}`);
    expect($('.initial-term-caveat').text()).toContain('initial contract term only');
  });
});
