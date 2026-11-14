// Two small tools for calling services we do not control (Razorpay, the email provider).
//
// withRetry:       try again a couple of times, waiting a little longer each time (with a random jitter so many
//                  callers do not all retry at the same instant).
// CircuitBreaker:  after several failures in a row, stop calling for a while and fail instantly. This keeps a
//                  slow or dead provider from tying up every request for its full timeout, and gives it room to recover.

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function withRetry(fn, { attempts = 2, baseMs = 300, shouldRetry = () => true, wait = sleep } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      if (i === attempts || !shouldRetry(err)) break;
      // 300 ms, 600 ms, 1200 ms ... plus up to 50% random extra.
      await wait(baseMs * 2 ** (i - 1) * (1 + Math.random() * 0.5));
    }
  }
  throw lastError;
}

class CircuitOpenError extends Error {
  constructor(name) {
    super(`${name} is temporarily unavailable`);
    this.name = 'CircuitOpenError';
  }
}

// closed    = normal, calls go through.
// open      = too many failures; calls fail at once until `openMs` has passed.
// half-open = after the wait, ONE trial call is let through: success closes the circuit, failure opens it again.
class CircuitBreaker {
  constructor({ name, failureThreshold = 5, openMs = 30000, now = Date.now } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
    this.now = now;
    this.reset();
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.openedAt = 0;
    this.trialInFlight = false;
  }

  // `countsAsFailure(err)` decides which errors mean "the provider is unhealthy" (network errors, 5xx).
  // A 4xx caused by our own bad request must not trip the breaker.
  async run(fn, countsAsFailure = () => true) {
    if (this.state === 'open') {
      if (this.now() - this.openedAt < this.openMs) throw new CircuitOpenError(this.name);
      this.state = 'half-open';
    }
    if (this.state === 'half-open') {
      if (this.trialInFlight) throw new CircuitOpenError(this.name); // someone else is already testing it
      this.trialInFlight = true;
    }
    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (err) {
      if (countsAsFailure(err)) {
        this.failures += 1;
        if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
          this.state = 'open';
          this.openedAt = this.now();
        }
      } else if (this.state === 'half-open') {
        this.reset(); // the provider answered (it just refused our request), so it is alive
      }
      this.trialInFlight = false;
      throw err;
    }
  }
}

// An error that means "the other service is having trouble", as opposed to "your request was wrong".
class TransientError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransientError';
    this.transient = true;
  }
}
const isTransient = (err) => !!(err && err.transient);

module.exports = { withRetry, CircuitBreaker, CircuitOpenError, TransientError, isTransient };
