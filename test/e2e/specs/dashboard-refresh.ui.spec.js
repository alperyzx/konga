const {test, expect} = require('@playwright/test');
const konga = require('../helpers/konga');

test('dashboard loads after refresh when cached user node state is stale', async ({page, context}) => {
  await konga.collectErrors(page);
  await page.goto('/#!/dashboard');
  await konga.waitForAngular(page);

  await page.evaluate(() => {
    const credentials = JSON.parse(localStorage.getItem('ngStorage-credentials'));
    credentials.user.node = null;
    localStorage.setItem('ngStorage-credentials', JSON.stringify(credentials));
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
  try {
    await page.reload({waitUntil: 'networkidle'});
    await konga.waitForAngular(page);
    await expect(page.getByText('CONNECTIONS', {exact: true})).toBeVisible({timeout: 20000});
    await expect(page.getByText('NODE INFO', {exact: true})).toBeVisible();
    expect(await konga.errors(page)).toEqual([]);
  } finally {
    await cdp.send('Network.setCacheDisabled', {cacheDisabled: false}).catch(() => {});
  }
});
