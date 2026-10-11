# Konga browser tests

Regression tests for the Konga admin UI, covering Phase 1 (the removal of the
APIs module) and Phase 2 (the schema-driven plugin form).

This is a **separate npm package** on purpose. The published container is a
`--production` install and has no test runner in it. Keeping the suite here
means it installs quickly and does not add browser tooling to Konga's runtime
dependency tree.

## Install

```bash
cd test/e2e
npm install
```

No browser is downloaded — the config runs against your installed Chrome
(`channel: 'chrome'`). Set `PW_CHANNEL=msedge` or `PW_CHANNEL=chromium` to use
something else.

## The three suites

| Project  | Needs a browser | Needs Konga | Needs Kong | What it covers |
| -------- | --------------- | ----------- | ---------- | -------------- |
| `static` | no              | no          | no         | Source-tree guards: the retired module stays retired, every DI annotation matches its function's arity, every `templateUrl` resolves, all four plugin pickers keep the same affordances, and `SchemaFormService` round-trips every plugin schema in `fixtures/`. |
| `schema` | no              | no          | yes        | The same round-trip, re-run against the gateway that is actually up. |
| `ui`     | yes             | yes         | yes        | The app logged in: routing, the injector, plugin creation end-to-end against a real Kong, the plugin picker's search and enabled badge, and the generated plugin form. |

`static` is the one to run on every change — it takes about half a second and
catches the whole class of silent AngularJS failures (a short `$inject` array
injects the wrong service into every later parameter without any error).

`plugin-picker.static.spec.js` exists because the catalogue is rendered by four
near-duplicate templates. The UI specs exercise two of them; those assertions
stop the other two from drifting.

```bash
npm run test:static
```

### The `schema` project, and why it is separate

Konga draws every plugin form from Kong's schema, so the forms are only as
correct as `SchemaFormService`'s coverage of Kong's type system. `static`
proves that against `fixtures/plugin-schemas.json`, captured from a 3.9.3 node
— which is as current as the day someone captured it. The `schema` project
asks the running gateway the same questions, so a Kong upgrade that introduces
a field type, or nests a record deeper than any plugin does today, fails a
build instead of reaching a user as an unconfigurable field.

It needs Kong but no Konga, no login and no browser, which is why it is its own
project rather than part of `ui` — and why `test:static` stays fully offline.

```bash
npm run test:schema
```

To re-capture the fixtures after a Kong upgrade (one line per plugin, so the
diff stays reviewable):

```bash
node -e '
  const base = process.env.KONG_ADMIN_URL || "http://localhost:8001";
  (async () => {
    const names = (await (await fetch(base + "/plugins/enabled")).json()).enabled_plugins.sort();
    const version = (await (await fetch(base + "/")).json()).version;
    const out = {_meta: {kong_version: version, captured: new Date().toISOString().slice(0,10),
      source: "GET /plugins/schema/<name> (legacy endpoint Konga uses)", count: names.length}};
    for (const n of names) out[n] = await (await fetch(base + "/plugins/schema/" + n)).json();
    process.stdout.write("{\n" + Object.entries(out)
      .map(([k, v]) => JSON.stringify(k) + ":" + JSON.stringify(v)).join(",\n") + "\n}\n");
  })();
' > fixtures/plugin-schemas.json
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

## The plugin form specs

`plugin-form.ui.spec.js` sticks to the shapes that were previously broken or
hand-written, because those are the ones a regression would reach first:

- a **map**, which used to render as `<input type="map">` — a text box that
  accepted anything and sent Kong something it would reject;
- a **record nested past three levels**, which is where the old hand-unrolled
  template ran out;
- an **array of records**, which used to need a bespoke `statsd` form that
  exposed four of its twenty-two fields;
- **`false` and `0`**, which the old serializer deleted on the way out along
  with the genuinely-empty values.

The last one is why the saving specs assert against Kong's Admin API rather
than against the form: the question is not what the UI shows, it is what the
gateway stored.

`helpers/plugin-form.js` finds controls by the label the renderer gave them,
never by position — the form is generated, so a spec that counts inputs breaks
the first time Kong reorders a schema. It also exports `closeModal`, which
specs that open several forms in a row need: the modal lives on `<body>`
outside the ui-router view, so navigating does not dismiss it, and its backdrop
makes every later click hang on actionability rather than fail.

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
