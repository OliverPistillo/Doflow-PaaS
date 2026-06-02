const { performance } = require('perf_hooks');

async function mockBroadcast() {
  return new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay per broadcast
}

async function runSequential(count) {
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    await mockBroadcast();
  }
  await mockBroadcast(); // global
  const end = performance.now();
  return end - start;
}

async function runConcurrent(count) {
  const start = performance.now();
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(mockBroadcast());
  }
  promises.push(mockBroadcast());
  await Promise.all(promises);
  const end = performance.now();
  return end - start;
}

async function main() {
  const count = 100;
  console.log(`Running with ${count} mock tenants (5ms delay each)...`);

  const seqTime = await runSequential(count);
  console.log(`Sequential: ${seqTime.toFixed(2)} ms`);

  const conTime = await runConcurrent(count);
  console.log(`Concurrent: ${conTime.toFixed(2)} ms`);
}

main();
