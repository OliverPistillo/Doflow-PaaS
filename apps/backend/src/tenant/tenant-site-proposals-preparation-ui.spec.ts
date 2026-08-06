import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('site proposal stalled preparation UI', () => {
  const frontend = resolve(__dirname, '../../../frontend/src/components/tenant-site-proposals');

  it('shows the blocked queue state and exposes retry only for real recovery candidates', () => {
    const progress = readFileSync(resolve(frontend, 'site-proposal-progress.tsx'), 'utf8');
    const detail = readFileSync(resolve(frontend, 'site-proposal-import-detail.tsx'), 'utf8');
    expect(progress).toContain('Accodamento bloccato');
    expect(progress).toContain('value.stalledReason');
    expect(detail).toContain('item.stalled || item.canRetryDispatch');
    expect(detail).toContain('Riprova accodamento');
  });

  it('uses real running/queued polling rates and background backoff without duplicate intervals', () => {
    const detail = readFileSync(resolve(frontend, 'site-proposal-import-detail.tsx'), 'utf8');
    expect(detail).toContain('hasRunning ? 2000 : 6000');
    expect(detail).toContain('document.visibilityState === "hidden" ? 10000');
    expect(detail).toContain('window.clearTimeout(timer)');
    expect(detail).not.toContain('setInterval');
  });
});
