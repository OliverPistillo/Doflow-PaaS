import { DataSource } from 'typeorm';
import { CreateAutomationPerformanceAuthority1840000000000 } from '../migrations/1840000000000-CreateAutomationPerformanceAuthority';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Acceptance migration cannot run in production');
  const host = String(process.env.DB_HOST || '');
  const database = String(process.env.DB_NAME || '');
  if (!['localhost', '127.0.0.1', 'doflow-acceptance-postgres'].includes(host) || !/acceptance/i.test(database)) {
    throw new Error('Automation/performance migration requires an isolated acceptance database');
  }
  const dataSource = new DataSource({
    type: 'postgres', host, port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER, password: process.env.DB_PASSWORD, database, synchronize: false,
  });
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  try {
    await runner.connect();
    await new CreateAutomationPerformanceAuthority1840000000000().up(runner);
  } finally {
    await runner.release();
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
