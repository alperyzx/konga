/**
 * Page-level helpers for driving Konga's AngularJS 1.x SPA.
 *
 * Two things make this app awkward to test and are handled here once:
 *  - routing is hash-based, so `page.goto` does not imply a state change; and
 *  - an Angular digest can leave the DOM mid-render, so assertions need to wait
 *    on ui-router rather than on a selector.
 */

/**
 * Collect anything the app complains about. Installed via addInitScript so it
 * is in place before Angular bootstraps and survives reloads — a DI failure
 * happens during bootstrap and would be missed by a post-load hook.
 */
async function collectErrors(page) {
  await page.addInitScript(() => {
    window.__kongaErrors = [];

    const original = console.error.bind(console);
    console.error = function () {
      window.__kongaErrors.push(Array.prototype.map.call(arguments, String).join(' '));
      original.apply(null, arguments);
    };

    window.addEventListener('error', (e) => {
      window.__kongaErrors.push('uncaught: ' + e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
      window.__kongaErrors.push('unhandledrejection: ' + reason);
    });
  });
}

// Noise that is not the app's fault and would otherwise fail every spec.
const IGNORED_ERRORS = [
  /favicon/i,
  /net::ERR_/,
  /Failed to load resource/i,
];

/** Everything collected so far, minus the known noise. */
async function errors(page) {
  const raw = await page.evaluate(() => window.__kongaErrors || []);
  return raw.filter((e) => !IGNORED_ERRORS.some((re) => re.test(e)));
}

/** Discard what has been collected, so a spec can scope its assertion. */
async function clearErrors(page) {
  await page.evaluate(() => {
    window.__kongaErrors = [];
  });
}

/**
 * Ask Angular's injector whether a service is registered, without dragging the
 * service itself across the bridge (most of them do not serialize).
 */
function isRegistered(page, name) {
  return page.evaluate((service) => {
    try {
      angular.element(document.body).injector().get(service);
      return true;
    } catch (e) {
      return false;
    }
  }, name);
}

/** Whether an Angular module of this name was ever defined. */
function moduleExists(page, name) {
  return page.evaluate((mod) => {
    try {
      angular.module(mod);
      return true;
    } catch (e) {
      return false;
    }
  }, name);
}

/** Wait until Angular has bootstrapped and ui-router has settled on a state. */
async function waitForAngular(page) {
  await page.waitForFunction(() => {
    if (!window.angular) return false;
    const injector = angular.element(document.body).injector();
    if (!injector) return false;
    return !!injector.get('$state').current.name;
  }, null, { timeout: 30000 });
}

/**
 * Navigate to a hash route and wait for ui-router to land.
 * Returns the state actually reached, which is not always the one asked for —
 * a retired route falls through to the `otherwise` handler, and asserting on
 * the difference is the point of several specs.
 */
async function goToState(page, hash) {
  const target = hash.startsWith('#!') ? hash : '#!' + hash;

  if (page.url().startsWith('http')) {
    // Already on the app: a hash change alone will not reload, which is what
    // we want — it exercises in-app routing rather than a cold boot.
    await page.evaluate((h) => {
      window.location.hash = h;
    }, target);
  } else {
    await page.goto('/' + target);
  }

  await waitForAngular(page);
  // ui-router resolves are async; give the transition a digest to finish.
  await page.waitForTimeout(800);

  return currentState(page);
}

/** The name of the state ui-router is currently showing. */
function currentState(page) {
  return page.evaluate(
    () => angular.element(document.body).injector().get('$state').current.name
  );
}

/** Log in through the real form. Used once, by the setup project. */
async function login(page, { username, password, baseURL }) {
  await page.goto((baseURL || '') + '/#!/login');
  await waitForAngular(page);

  await page.getByRole('textbox', { name: /username or email/i }).fill(username);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/#!\/dashboard/, { timeout: 30000 });
  await waitForAngular(page);
}

module.exports = {
  collectErrors,
  errors,
  clearErrors,
  isRegistered,
  moduleExists,
  waitForAngular,
  goToState,
  currentState,
  login,
};
