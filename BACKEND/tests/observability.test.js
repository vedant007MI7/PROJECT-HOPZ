// Set before helpers load, because config reads the environment once.
process.env.METRICS_TOKEN = 'test-metrics-token';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, closeDb, makeUser, auth, cleanTables } = require('./helpers');
const config = require('../config');
const metrics = require('../wrapper/metrics');

after(async () => {
  await cleanTables();
  await closeDb();
});

const scrape = (token = 'test-metrics-token') => {
  const req = api().get('/metrics');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('request ids', () => {
  test('every response carries an X-Request-Id', async () => {
    const res = await api().get('/api/health');
    assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  });

  test('a sensible id sent by the client is kept', async () => {
    const res = await api().get('/api/health').set('X-Request-Id', 'client-req-12345');
    assert.equal(res.headers['x-request-id'], 'client-req-12345');
  });

  test('an odd id is replaced, so it cannot reach the logs', async () => {
    const res = await api().get('/api/health').set('X-Request-Id', 'bad id with spaces');
    assert.notEqual(res.headers['x-request-id'], 'bad id with spaces');
    assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  });

  test('errors and unknown routes get one too', async () => {
    const res = await api().get('/api/nope');
    assert.equal(res.status, 404);
    assert.ok(res.headers['x-request-id']);
  });
});

describe('GET /metrics', () => {
  test('needs the token when one is set', async () => {
    assert.equal((await scrape(null)).status, 401);
    assert.equal((await scrape('wrong-token')).status, 401);
    assert.equal((await scrape()).status, 200);
  });

  test('is hidden in production when no token is set, open in development', async () => {
    const saved = { token: config.metricsToken, env: config.nodeEnv };
    try {
      config.metricsToken = '';
      config.nodeEnv = 'production';
      assert.equal((await scrape(null)).status, 404);
      config.nodeEnv = 'development';
      assert.equal((await scrape(null)).status, 200);
    } finally {
      config.metricsToken = saved.token;
      config.nodeEnv = saved.env;
    }
  });

  test('counts requests by route pattern, not by real URL', async () => {
    metrics.reset();
    const rider = await makeUser('rider');
    const id = '11111111-1111-4111-8111-111111111111';
    await api().get(`/api/rides/${id}`).set(auth(rider.token)); // 404: no such ride
    await api().get(`/api/rides/${id}`).set(auth(rider.token));
    const text = (await scrape()).text;
    assert.match(text, /hopz_http_requests_total\{method="GET",route="\/api\/rides\/:id",status="404"\} 2/);
    assert.ok(!text.includes(id), 'the real id must not become a label');
    assert.match(text, /hopz_http_request_duration_seconds_count\{method="GET",route="\/api\/rides\/:id"\} 2/);
    assert.match(text, /hopz_http_request_duration_seconds_bucket\{method="GET",route="\/api\/rides\/:id",le="\+Inf"\} 2/);
  });

  test('unknown paths share one label instead of creating a series each', async () => {
    metrics.reset();
    await api().get('/api/random-1');
    await api().get('/api/random-2');
    const text = (await scrape()).text;
    assert.match(text, /route="unmatched",status="404"\} 2/);
  });

  test('includes server and business gauges', async () => {
    const text = (await scrape()).text;
    for (const name of [
      'hopz_process_uptime_seconds', 'hopz_process_memory_bytes', 'hopz_event_loop_delay_p99_seconds',
      'hopz_db_pool_connections', 'hopz_circuit_breaker_state', 'hopz_active_rides', 'hopz_online_drivers',
    ]) {
      assert.ok(text.includes(`# TYPE ${name} gauge`), `missing ${name}`);
    }
    assert.match(text, /hopz_active_rides\{status="requested"\} \d+/);
    assert.match(text, /hopz_circuit_breaker_state\{service="razorpay"\} 0/);
  });
});

describe('metrics format', () => {
  test('label values are escaped', () => {
    metrics.reset();
    metrics.observeRequest({ method: 'GET', route: 'a"b\\c', status: 200, seconds: 0.02 });
    const text = metrics.render();
    assert.ok(text.includes('route="a\\"b\\\\c"'));
  });

  test('a slow request lands only in the buckets that can hold it', () => {
    metrics.reset();
    metrics.observeRequest({ method: 'GET', route: '/x', status: 200, seconds: 0.3 });
    const text = metrics.render();
    assert.match(text, /le="0.25"\} 0/);
    assert.match(text, /le="0.5"\} 1/);
    assert.match(text, /le="10"\} 1/);
  });
});
