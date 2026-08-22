/** Print every Fetch/XHR response made by the Commons vouch application. */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async response => {
  const request = response.request();
  if (!['fetch', 'xhr'].includes(request.resourceType())) return;
  const contentType = response.headers()['content-type'] ?? '';
  let body = '';
  try { body = (await response.text()).slice(0, 5 * 1024); }
  catch (error) { body = `[body unavailable: ${error instanceof Error ? error.message : String(error)}]`; }
  process.stdout.write([
    `METHOD ${request.method()}`,
    `URL ${response.url()}`,
    `STATUS ${response.status()}`,
    `CONTENT TYPE ${contentType}`,
    'FIRST 5KB OF RESPONSE',
    body,
    '\n' + '-'.repeat(100) + '\n',
  ].join('\n'));
});

await page.goto('https://commonsmade.com/vouch', { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(15_000);
for (const username of ['CyphrGM', 'Slayed_eth']) {
  const search = page.locator('input:visible').first();
  if (await search.count()) {
    await search.fill(username);
    await search.press('Enter');
    await page.waitForTimeout(5_000);
  }
}
await page.waitForTimeout(10_000);
await browser.close();
