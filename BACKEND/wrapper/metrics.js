// Numbers about how the server is behaving, kept in memory and printed in the Prometheus text format
// (the format most monitoring tools read). No library: counters and a histogram are small enough to write by hand.
//
//   hopz_http_requests_total{method,route,status}        how many requests, by outcome
//   hopz_http_request_duration_seconds{method,route}     how long they took (a histogram: buckets let a tool work out p95/p99)
//
// "route" is the route pattern (/api/rides/:id), never the real URL, so the number of series stays small.

const BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const requests = new Map(); // "method|route|status" -> count
const durations = new Map(); // "method|route" -> { buckets: number[], sum, count }

function observeRequest({ method, route, status, seconds }) {
  const rk = `${method}|${route}|${status}`;
  requests.set(rk, (requests.get(rk) || 0) + 1);

  const dk = `${method}|${route}`;
  let d = durations.get(dk);
  if (!d) {
    d = { buckets: new Array(BUCKETS.length).fill(0), sum: 0, count: 0 };
    durations.set(dk, d);
  }
  BUCKETS.forEach((upper, i) => { if (seconds <= upper) d.buckets[i] += 1; });
  d.sum += seconds;
  d.count += 1;
}

const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labels = (obj) => `{${Object.entries(obj).map(([k, v]) => `${k}="${esc(v)}"`).join(',')}}`;

// `gauges` = [{ name, help, samples: [{ labels?: {...}, value }] }] supplied by the caller at scrape time.
function render(gauges = []) {
  const out = [];

  out.push('# HELP hopz_http_requests_total HTTP requests handled.', '# TYPE hopz_http_requests_total counter');
  for (const [key, value] of requests) {
    const [method, route, status] = key.split('|');
    out.push(`hopz_http_requests_total${labels({ method, route, status })} ${value}`);
  }

  out.push(
    '# HELP hopz_http_request_duration_seconds HTTP request duration.',
    '# TYPE hopz_http_request_duration_seconds histogram'
  );
  for (const [key, d] of durations) {
    const [method, route] = key.split('|');
    BUCKETS.forEach((upper, i) => {
      out.push(`hopz_http_request_duration_seconds_bucket${labels({ method, route, le: upper })} ${d.buckets[i]}`);
    });
    out.push(`hopz_http_request_duration_seconds_bucket${labels({ method, route, le: '+Inf' })} ${d.count}`);
    out.push(`hopz_http_request_duration_seconds_sum${labels({ method, route })} ${d.sum}`);
    out.push(`hopz_http_request_duration_seconds_count${labels({ method, route })} ${d.count}`);
  }

  for (const g of gauges) {
    out.push(`# HELP ${g.name} ${g.help}`, `# TYPE ${g.name} ${g.type || 'gauge'}`);
    for (const s of g.samples) {
      out.push(`${g.name}${s.labels ? labels(s.labels) : ''} ${s.value}`);
    }
  }
  return `${out.join('\n')}\n`;
}

function reset() {
  requests.clear();
  durations.clear();
}

module.exports = { observeRequest, render, reset, BUCKETS };
