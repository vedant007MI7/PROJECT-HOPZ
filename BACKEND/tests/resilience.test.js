// Set before helpers load, because config reads the environment once.
process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
process.env.RAZORPAY_KEY_SECRET = 'unit-test-secret';

const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, closeDb } = require('./helpers');
const app = require('../app');
const razorpay = require('../wrapper/razorpay');
const AppError = require('../function/app-error');
const {
  withRetry, CircuitBreaker, CircuitOpenError, TransientError, isTransient,
} = require('../wrapper/resilience');

after(closeDb);

describe('withRetry', () => {
  const noWait = async () => {};

  test('retries a transient failure and returns the first success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 2) throw new TransientError('blip');
      return 'ok';
    }, { attempts: 3, wait: noWait, shouldRetry: isTransient });
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  test('does not retry an error that retrying cannot fix', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => { calls += 1; throw new Error('bad request'); }, { attempts: 3, wait: noWait, shouldRetry: isTransient }),
      /bad request/
    );
    assert.equal(calls, 1);
  });

  test('gives up after the last attempt and throws the last error', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => { calls += 1; throw new TransientError(`fail ${calls}`); }, { attempts: 3, wait: noWait, shouldRetry: isTransient }),
      /fail 3/
    );
    assert.equal(calls, 3);
  });

  test('waits longer before each retry', async () => {
    const waits = [];
    await assert.rejects(
      withRetry(async () => { throw new TransientError('x'); }, { attempts: 3, baseMs: 100, wait: async (ms) => waits.push(ms) })
    );
    assert.equal(waits.length, 2);
    assert.ok(waits[0] >= 100 && waits[0] <= 150);
    assert.ok(waits[1] >= 200 && waits[1] <= 300);
  });
});

describe('CircuitBreaker', () => {
  const fail = async () => { throw new TransientError('down'); };

  function make() {
    const clock = { t: 1000 };
    const breaker = new CircuitBreaker({ name: 'Test', failureThreshold: 3, openMs: 10000, now: () => clock.t });
    return { breaker, clock };
  }

  test('opens after the threshold and then fails without calling the service', async () => {
    const { breaker } = make();
    for (let i = 0; i < 3; i += 1) await assert.rejects(breaker.run(fail, isTransient), /down/);
    let called = false;
    await assert.rejects(breaker.run(async () => { called = true; }), CircuitOpenError);
    assert.equal(called, false);
  });

  test('lets one trial through after the wait, and closes on success', async () => {
    const { breaker, clock } = make();
    for (let i = 0; i < 3; i += 1) await assert.rejects(breaker.run(fail, isTransient));
    clock.t += 10001;
    assert.equal(await breaker.run(async () => 'back', isTransient), 'back');
    assert.equal(breaker.state, 'closed');
    assert.equal(await breaker.run(async () => 'again', isTransient), 'again');
  });

  test('a failed trial opens it again for another full wait', async () => {
    const { breaker, clock } = make();
    for (let i = 0; i < 3; i += 1) await assert.rejects(breaker.run(fail, isTransient));
    clock.t += 10001;
    await assert.rejects(breaker.run(fail, isTransient), /down/);
    assert.equal(breaker.state, 'open');
    await assert.rejects(breaker.run(async () => 'x'), CircuitOpenError);
  });

  test('only one trial runs at a time while half-open', async () => {
    const { breaker, clock } = make();
    for (let i = 0; i < 3; i += 1) await assert.rejects(breaker.run(fail, isTransient));
    clock.t += 10001;
    let release;
    const slow = breaker.run(() => new Promise((resolve) => { release = resolve; }), isTransient);
    await assert.rejects(breaker.run(async () => 'second'), CircuitOpenError);
    release('done');
    assert.equal(await slow, 'done');
  });

  test('errors that are our own fault do not count against the service', async () => {
    const { breaker } = make();
    for (let i = 0; i < 10; i += 1) {
      await assert.rejects(breaker.run(async () => { throw new Error('400 bad request'); }, isTransient));
    }
    assert.equal(breaker.state, 'closed');
  });
});

describe('Razorpay calls', () => {
  const realFetch = global.fetch;
  let calls;
  const answer = (status, body = {}) => async () => {
    calls += 1;
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  const order = () => razorpay.createOrder({ amountPaise: 10000, receipt: 'r1', notes: {} });

  beforeEach(() => { calls = 0; razorpay.breaker.reset(); });
  after(() => { global.fetch = realFetch; razorpay.breaker.reset(); });

  test('a good answer returns the order', async () => {
    global.fetch = answer(200, { id: 'order_1', amount: 10000, currency: 'INR' });
    assert.deepEqual(await order(), { id: 'order_1', amount: 10000, currency: 'INR' });
    assert.equal(calls, 1);
  });

  test('a 5xx is tried twice, then reported as a 502', async () => {
    global.fetch = answer(503);
    await assert.rejects(order(), (err) => err instanceof AppError && err.status === 502);
    assert.equal(calls, 2);
  });

  test('a network failure is tried twice, then reported as a 502', async () => {
    global.fetch = async () => { calls += 1; throw new Error('socket hang up'); };
    await assert.rejects(order(), (err) => err.status === 502);
    assert.equal(calls, 2);
  });

  test('a 4xx is not retried and does not count against the breaker', async () => {
    global.fetch = answer(400, { error: { description: 'Amount too small' } });
    await assert.rejects(order(), /Amount too small/);
    assert.equal(calls, 1);
    assert.equal(razorpay.breaker.failures, 0);
  });

  test('after repeated failures it answers 503 at once without calling Razorpay', async () => {
    global.fetch = answer(500);
    for (let i = 0; i < 5; i += 1) await assert.rejects(order());
    const before = calls;
    await assert.rejects(order(), (err) => err.status === 503 && /temporarily unavailable/.test(err.message));
    assert.equal(calls, before);
  });
});

describe('health during shutdown', () => {
  test('answers 503 while draining, 200 otherwise', async () => {
    assert.equal((await api().get('/api/health')).status, 200);
    app.locals.draining = true;
    try {
      assert.equal((await api().get('/api/health')).status, 503);
    } finally {
      app.locals.draining = false;
    }
  });
});
