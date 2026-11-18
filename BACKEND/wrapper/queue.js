const IORedis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

// Background jobs on BullMQ (a job queue stored in Redis). A request that would have to wait for something slow
// or unreliable (an email, an SMS) just drops a small job in the queue and answers at once; a worker picks the job
// up, and BullMQ retries it with a growing delay if it fails. Jobs survive a server restart.
//
// Off by default (QUEUE_ENABLED=true turns it on, and it needs REDIS_URL). When it is off, or Redis cannot take
// the job, callers run the work inline, exactly as before the queue existed.
//
// Free-tier note: an idle BullMQ worker still talks to Redis. drainDelay (seconds the worker waits when the queue
// is empty) is set to 30 so an idle worker costs a few commands a minute, not a few per second.

const QUEUE_NAME = 'hopz-jobs';
const prefix = () => `${config.redisKeyPrefix}queue`;
const enabled = () => Boolean(config.queueEnabled && config.redisUrl);

let queue = null;
let worker = null;
let producerConn = null;
let workerConn = null;
let lastWarn = 0;

function warn(err, what) {
  if (Date.now() - lastWarn < 30000) return;
  lastWarn = Date.now();
  logger.warn({ err: err.message }, `Job queue: ${what}`);
}

function getQueue() {
  if (queue) return queue;
  const { Queue } = require('bullmq'); // only loaded when the queue is on
  // Fail fast: if Redis is down, add() must error quickly so the caller can run the work inline instead.
  producerConn = new IORedis(config.redisUrl, { maxRetriesPerRequest: 1, commandTimeout: 1500, connectTimeout: 3000, enableOfflineQueue: false });
  producerConn.on('error', (err) => warn(err, 'producer connection error'));
  queue = new Queue(QUEUE_NAME, {
    connection: producerConn,
    prefix: prefix(),
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 2000 }, // retries after ~2 s, 4 s, 8 s
      removeOnComplete: true, // a finished job (it can hold a reset code) is deleted at once
      removeOnFail: { age: 3600 }, // a job that gave up is kept for an hour so it can be looked at, then deleted
    },
  });
  queue.on('error', (err) => warn(err, 'queue error'));
  return queue;
}

// true = the job is queued; false = not queued (queue off or Redis problem): run the work inline.
async function enqueue(name, data, opts = {}) {
  if (!enabled()) return false;
  try {
    await getQueue().add(name, data, opts);
    return true;
  } catch (err) {
    warn(err, 'could not queue a job; running it inline');
    return false;
  }
}

// `handlers` maps a job name to async (data, job) => ... . A thrown error makes BullMQ retry the job.
function startWorker(handlers) {
  if (!enabled() || worker) return null;
  const { Worker } = require('bullmq');
  // A worker waits on Redis with blocking commands, so it must never give up on a slow reply.
  workerConn = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  workerConn.on('error', (err) => warn(err, 'worker connection error'));
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) throw new Error(`No handler for job "${job.name}"`);
      return handler(job.data, job);
    },
    {
      connection: workerConn,
      prefix: prefix(),
      concurrency: 5,
      drainDelay: config.queueDrainDelaySeconds,
      stalledInterval: 60000,
    }
  );
  worker.on('failed', (job, err) => {
    const final = job && job.attemptsMade >= (job.opts.attempts || 1);
    logger[final ? 'error' : 'warn'](
      { job: job && job.name, id: job && job.id, attempt: job && job.attemptsMade, err: err.message },
      final ? 'Job failed for good' : 'Job failed, will retry'
    );
  });
  worker.on('error', (err) => warn(err, 'worker error'));
  logger.info('Job worker started');
  return worker;
}

// Numbers for /metrics: { waiting, active, delayed, failed }.
async function counts() {
  if (!enabled()) return null;
  try {
    return await getQueue().getJobCounts('waiting', 'active', 'delayed', 'failed');
  } catch {
    return null;
  }
}

async function close() {
  const parts = [worker && worker.close(), queue && queue.close()];
  await Promise.allSettled(parts);
  for (const c of [workerConn, producerConn]) if (c) c.disconnect();
  worker = null;
  queue = null;
  workerConn = null;
  producerConn = null;
}

module.exports = { enabled, enqueue, startWorker, counts, close, QUEUE_NAME };
