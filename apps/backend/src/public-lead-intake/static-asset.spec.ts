import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('public lead intake static asset', () => {
  const repoRoot = join(__dirname, '..', '..', '..', '..');

  it('mantiene lo script pubblico nel path servito da Nest', () => {
    const scriptPath = join(repoRoot, 'apps', 'backend', 'public', 'forms', 'doflow-lead-intake.v1.js');
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('raccoglie i click-id advertising nel payload pubblico', () => {
    const script = readFileSync(join(repoRoot, 'apps', 'backend', 'public', 'forms', 'doflow-lead-intake.v1.js'), 'utf8');
    expect(script).toContain('gclid');
    expect(script).toContain('fbclid');
    expect(script).toContain('ttclid');
  });

  it('copia apps/backend/public nell immagine backend Docker', () => {
    const dockerfile = readFileSync(join(repoRoot, 'apps', 'backend', 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('COPY --from=builder /app/apps/backend/public ./apps/backend/public');
  });
});
