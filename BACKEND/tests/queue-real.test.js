// Runs against a REAL Redis and the real BullMQ. Skipped unless you opt in:
//   PowerShell:  $env:TEST_REDIS_URL=$env:REDIS_URL; $env:TEST_QUEUE_ENABLED='true'; node --test tests/queue-real.test.js
// (keys are under the "hopz:test:" prefix; the test cleans up after itself).
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');

const ON = Boolean(process.env.TEST_REDIS_URL) && process.env.TEST_QUEUE_ENABLED === 'true';
const { closeDb } = require('./helpers');

describe('BullMQ queue (real Redis)', { skip: ON ? false : 'set TEST_REDIS_URL and TEST_QUEUE_ENABLED=true to run' }, () => {
  const queue = require('../wrapper/queue');
  after(async () => {
    await queue.close();
    await closeDb();
  });

  const waitFor = async (fn, ms = 15000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return fn();
  };

  test('a queued job is run by the worker with its data', async () => {
    const seen = [];
    queue.startWorker({ 'unit-job': async (data) => { seen.push(data); } });
    assert.equal(await queue.enqueue('unit-job', { n: 1 }), true);
    assert.ok(await waitFor(() => seen.length === 1));
    assert.deepEqual(seen[0], { n: 1 });
  });

  test('a job that fails is retried until it works', async () => {
    let attempts = 0;
    await queue.close();
    queue.startWorker({ 'flaky-job': async () => { attempts += 1; if (attempts < 3) throw new Error('not yet'); } });
    assert.equal(await queue.enqueue('flaky-job', {}, { backoff: { type: 'fixed', delay: 100 } }), true);
    assert.ok(await waitFor(() => attempts === 3));
  });

  test('a delayed job waits, and a duplicate jobId is queued only once', async () => {
    const seen = [];
    await queue.close();
    queue.startWorker({ 'later-job': async (d) => { seen.push(d.id); } });
    const t0 = Date.now();
    await queue.enqueue('later-job', { id: 'x' }, { delay: 1500, jobId: 'same-id' });
    await queue.enqueue('later-job', { id: 'x' }, { delay: 1500, jobId: 'same-id' });
    assert.ok(await waitFor(() => seen.length >= 1));
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(seen.length, 1);
    assert.ok(Date.now() - t0 >= 1400);
  });
});
