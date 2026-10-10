/**
 * Thin Kong Admin API client, used to create and tear down the entities the UI
 * specs act on. Talking to Kong directly (rather than clicking through Konga)
 * keeps fixture setup out of the thing under test — if a spec fails we know it
 * was the UI, not the scaffolding.
 */

const ADMIN_URL = (process.env.KONG_ADMIN_URL || 'http://localhost:8001').replace(/\/$/, '');

// Everything this suite creates carries this prefix, so a crashed run leaves
// obviously-disposable litter and `cleanupFixtures()` can find it again.
const PREFIX = 'e2e-phase1-';

async function request(method, path, body) {
  const res = await fetch(ADMIN_URL + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok && res.status !== 404) {
    throw new Error(`Kong ${method} ${path} -> ${res.status}: ${text}`);
  }
  return { status: res.status, body: payload };
}

const kong = {
  adminUrl: ADMIN_URL,
  prefix: PREFIX,

  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  del: (p) => request('DELETE', p),

  /** Kong's version, so specs can skip anything version-gated. */
  async version() {
    const { body } = await request('GET', '/');
    return body.version;
  },

  /** Plugins attached to an entity, e.g. plugins('services', id). */
  async plugins(collection, id) {
    const { body } = await request('GET', `/${collection}/${id}/plugins`);
    return body.data;
  },
};

/**
 * Create the service / route / upstream / consumer the UI specs need.
 * Idempotent: removes anything left behind by an earlier run first.
 */
async function createFixtures() {
  await cleanupFixtures();

  const service = (await kong.post('/services', {
    name: PREFIX + 'service',
    url: 'http://httpbin.org',
  })).body;

  const route = (await kong.post(`/services/${service.id}/routes`, {
    name: PREFIX + 'route',
    paths: ['/' + PREFIX + 'route'],
  })).body;

  const upstream = (await kong.post('/upstreams', {
    name: PREFIX + 'upstream.test',
  })).body;

  const consumer = (await kong.post('/consumers', {
    username: PREFIX + 'consumer',
    tags: ['e2e'],
  })).body;

  return { service, route, upstream, consumer };
}

/**
 * Delete every entity whose name/username starts with PREFIX.
 *
 * Order matters: Kong refuses to delete a service while a route still
 * references it, so routes go first. Plugins are not swept — they are never
 * PREFIX-named, and Kong cascade-deletes them along with the service, route or
 * consumer they hang off.
 */
async function cleanupFixtures() {
  for (const collection of ['routes', 'services', 'upstreams', 'consumers']) {
    const { body } = await kong.get(`/${collection}`);
    if (!body || !body.data) continue;

    for (const entity of body.data) {
      const label = entity.name || entity.username || '';
      if (label.startsWith(PREFIX)) {
        await kong.del(`/${collection}/${entity.id}`);
      }
    }
  }
}

module.exports = { kong, createFixtures, cleanupFixtures, PREFIX };
