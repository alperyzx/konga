# Konga browser tests

Regression tests for the Konga admin UI, starting with Phase 1 (the removal of
the APIs module).

This is a **separate npm package** on purpose. Konga's root install pins
sails 0.12 and node-sass 4, which only build on Node 12; the published container
is a `--production` install and has no test runner in it at all. Keeping the
suite here means it installs in a couple of seconds on a modern Node and never
has to participate in that.

## Install

```bash
cd test/e2e
npm install
```

No browser is downloaded — the config runs against your installed Chrome
(`channel: 'chrome'`). Set `PW_CHANNEL=msedge` or `PW_CHANNEL=chromium` to use
something else.

## The two suites

| Project  | Needs a browser | Needs Konga + Kong | What it covers |
| -------- | --------------- | ------------------ | -------------- |
| `static` | no              | no                 | Source-tree guards: the retired module stays retired, every DI annotation matches its function's arity, every `templateUrl` resolves, and all four plugin pickers keep the same affordances. |
| `ui`     | yes             | yes                | The app logged in: routing, the injector, plugin creation end-to-end against a real Kong, and the plugin picker's search and enabled badge. |

`static` is the one to run on every change — it takes about 250 ms and catches
the whole class of silent AngularJS failures (a short `$inject` array injects
the wrong service into every later parameter without any error).

`plugin-picker.static.spec.js` exists because the catalogue is rendered by four
near-duplicate templates. The UI specs exercise two of them; those assertions
stop the other two from drifting.

```bash
npm run test:static
```

## Running the UI suite

Prerequisites:

- Konga running and reachable (default `http://localhost:1337`)
- Kong's Admin API reachable (default `http://localhost:8001`)
- A Konga admin account

```bash
KONGA_PASSWORD='…' npm run test:ui
```

| Variable         | Default                 | Meaning |
| ---------------- | ----------------------- | ------- |
| `KONGA_URL`      | `http://localhost:1337` | Konga's base URL |
| `KONG_ADMIN_URL` | `http://localhost:8001` | Kong's Admin API |
| `KONGA_USER`     | `admin`                 | Konga login |
| `KONGA_PASSWORD` | *(required)*            | Konga password — pass it on the command line or from your shell env, never commit it |

The `setup` project logs in once and saves the session to `test/e2e/.auth/`,
which the `ui` project reuses. That directory is gitignored; it holds a real
admin token.

Everything runs in a single worker. The specs share one Kong node and create
real entities, so parallel workers would race on fixtures.

## Fixtures

`helpers/kong.js` creates a service, route, upstream and consumer directly
through Kong's Admin API — not by clicking through Konga, so a failure points
at the UI rather than at the scaffolding. Everything it makes is prefixed
`e2e-phase1-`, and `cleanupFixtures()` runs both before and after the suite, so
a crashed run leaves obviously-disposable litter that the next run clears.

## Editing `assets/` invalidates a UI run

Sails 0.12 does not serve `assets/`. It serves `.tmp/public/`, a copy grunt
makes at lift time. Grunt's watch task does not see macOS fsevents through a
Docker bind mount, so an edit to `assets/` changes nothing the browser can
reach:

```bash
docker restart konga
```

Without it the suite passes happily against the previous snapshot — a green run
that proves nothing about the change you just made. If a UI assertion fails on
markup you are certain you wrote, check the server before you touch the test:

```bash
curl -s localhost:1337/js/app/services/views/add-service-plugin-modal.html | grep pluginSearch
```

Konga also serves every static asset with `Cache-Control: public, max-age=31536000`
and busts the cache on only two of its `templateUrl`s. The Playwright runner
launches a fresh profile each time so the suite is immune, but a browser you
have been clicking around in is not — hard-reload it.
