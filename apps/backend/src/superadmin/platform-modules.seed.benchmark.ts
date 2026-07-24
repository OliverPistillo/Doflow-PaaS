import { PlatformModulesSeedService } from './platform-modules.seed';

async function runBenchmark() {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Mock Repository to simulate DB latency
  const mockRepo = {
    existing: new Map(),
    queries: 0,
    async findOne({ where }: any) {
      this.queries++;
      await sleep(1); // 1ms latency
      return this.existing.get(where.key) || null;
    },
    async find() {
      this.queries++;
      await sleep(1); // 1ms latency
      return Array.from(this.existing.values());
    },
    async update(where: any, data: any) {
      this.queries++;
      await sleep(1); // 1ms latency
      if (this.existing.has(where.key)) {
        this.existing.set(where.key, { ...this.existing.get(where.key), ...data });
      }
    },
    create(data: any) {
      return data;
    },
    async save(data: any) {
      this.queries++;
      await sleep(1); // 1ms latency
      this.existing.set(data.key, data);
      return data;
    }
  };

  const mockDataSource = {
    query: async () => []
  };

  const service = new PlatformModulesSeedService(mockRepo as any, mockDataSource as any);

  console.log('--- STARTING BENCHMARK ---');

  // First run: Insert all
  let start = performance.now();
  await (service as any).seedModules();
  let end = performance.now();
  console.log(`\n🎯 Baseline Insert Time: ${(end - start).toFixed(2)} ms`);
  console.log(`📊 Queries executed: ${mockRepo.queries}\n`);

  mockRepo.queries = 0;

  // Second run: Update all
  start = performance.now();
  await (service as any).seedModules();
  end = performance.now();
  console.log(`🎯 Baseline Update Time: ${(end - start).toFixed(2)} ms`);
  console.log(`📊 Queries executed: ${mockRepo.queries}\n`);
}

runBenchmark().catch(console.error);
