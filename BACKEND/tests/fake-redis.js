const { haversineKm } = require('../function/geo');

// A tiny in-memory stand-in for the few Redis commands the driver-location code uses.
// `failing = true` makes every call throw, to test the fall back to the database.
class FakeRedis {
  constructor() {
    this.kv = new Map(); // key -> { value, until }
    this.geo = new Map(); // member -> { lat, lng }
    this.failing = false;
    this.commands = 0;
  }

  _check() {
    this.commands += 1;
    if (this.failing) throw new Error('fake redis is down');
  }

  _live(key) {
    const hit = this.kv.get(key);
    if (!hit) return undefined;
    if (hit.until && hit.until < Date.now()) {
      this.kv.delete(key);
      return undefined;
    }
    return hit;
  }

  _set(key, value, ...opts) {
    let ttl = 0;
    let nx = false;
    for (let i = 0; i < opts.length; i += 1) {
      if (opts[i] === 'EX') ttl = Number(opts[++i]);
      if (opts[i] === 'PX') ttl = Number(opts[++i]) / 1000;
      if (opts[i] === 'NX') nx = true;
    }
    if (nx && this._live(key)) return null;
    this.kv.set(key, { value: String(value), until: ttl ? Date.now() + ttl * 1000 : 0 });
    return 'OK';
  }

  _incr(key, by) {
    const hit = this._live(key);
    const next = Number(hit ? hit.value : 0) + by;
    this.kv.set(key, { value: String(next), until: hit ? hit.until : 0 });
    return next;
  }

  _pttl(key) {
    const hit = this._live(key);
    if (!hit) return -2;
    return hit.until ? Math.max(1, hit.until - Date.now()) : -1;
  }

  async decr(key) { this._check(); return this._incr(key, -1); }
  async del(key) { this._check(); return this.kv.delete(key) ? 1 : 0; }
  async set(key, value, ...opts) { this._check(); return this._set(key, value, ...opts); }
  async get(key) { this._check(); return this._live(key)?.value ?? null; }
  async mget(keys) { this._check(); return keys.map((k) => this._live(k)?.value ?? null); }
  async zrem(_key, ...members) { this._check(); members.forEach((m) => this.geo.delete(m)); return members.length; }

  async geosearch(_key, _from, lng, lat, _by, radius, _unit, _order, _c, count) {
    this._check();
    return [...this.geo.entries()]
      .map(([id, p]) => [id, haversineKm(lat, lng, p.lat, p.lng)])
      .filter(([, d]) => d <= radius)
      .sort((a, b) => a[1] - b[1])
      .slice(0, count)
      .map(([id, d]) => [id, d.toFixed(4)]);
  }

  pipeline() {
    const steps = [];
    const p = {
      geoadd: (_k, lng, lat, id) => { steps.push(() => { this.geo.set(id, { lat, lng }); return 1; }); return p; },
      set: (k, v, ...o) => { steps.push(() => this._set(k, v, ...o)); return p; },
      zrem: (_k, id) => { steps.push(() => { this.geo.delete(id); return 1; }); return p; },
      incr: (k) => { steps.push(() => this._incr(k, 1)); return p; },
      pttl: (k) => { steps.push(() => this._pttl(k)); return p; },
      del: (k) => { steps.push(() => (this.kv.delete(k) ? 1 : 0)); return p; },
      exec: async () => { this._check(); return steps.map((s) => [null, s()]); },
    };
    return p;
  }

  // Test helpers
  expireLiveKeys() { for (const k of [...this.kv.keys()]) if (!k.endsWith(':saved')) this.kv.delete(k); }
  forgetSavedMarkers() { for (const k of [...this.kv.keys()]) if (k.endsWith(':saved')) this.kv.delete(k); }
  async quit() {}
}

module.exports = { FakeRedis };
