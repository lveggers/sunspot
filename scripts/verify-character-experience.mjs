import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.SUNSPOT_URL || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 360, height: 640 }, timezoneId: 'Europe/Copenhagen', reducedMotion: 'reduce' });
await context.addCookies([{ name: 'sunspot-language', value: 'da', url: base }]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let mode = 'sun';
let releaseWeather;
const forecast = () => mode === 'missing' ? { available: false } : {
  available: true, stale: mode === 'stale',
  timeseries: Array.from({ length: 72 }, (_, hour) => ({
    time: new Date(Date.parse('2026-10-28T00:00:00Z') + hour * 3600000).toISOString(),
    data: {
      instant: { details: { cloud_area_fraction: mode === 'cloud' ? 100 : 5, air_temperature: 12, wind_speed: 2 } },
      next_1_hours: { summary: { symbol_code: ({ cloud: 'cloudy', rain: 'rain', unknown: 'unclassified' })[mode] || 'clearsky_day' }, details: { precipitation_amount: mode === 'rain' ? 2 : 0 } },
    },
  })),
};
await context.route('**/api/weather', async route => {
  if (mode === 'loading') await new Promise(resolve => { releaseWeather = resolve; });
  await route.fulfill({ json: forecast() });
});
await context.route('**/api/golden-hour/offers', route => route.fulfill({ json: { offers: [] } }));
const checks = [];
async function assertMoment(id, { ready = true } = {}) {
  await expect(page.locator(`.experience-hero[data-experience="${id}"]`)).toBeVisible();
  const submit = page.locator('.finder-submit');
  if (ready) await expect(submit).toBeEnabled();
  await expect(submit).toBeInViewport({ ratio: 1 });
  assert.ok(await submit.evaluate(element => {
    const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  }), `${id}: main search is unobstructed without scrolling`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: no horizontal overflow`);
  if ((id.startsWith('weather.') && id !== 'weather.sun') || id === 'planned.grey') {
    await expect(page.locator('.sun-focus-color-pane')).toHaveAttribute('data-active-count', '0');
  }
  checks.push(id);
}
async function open(nextMode, id, at = '2026-10-28T11:00:00Z') {
  mode = nextMode;
  await page.clock.setSystemTime(new Date(at));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  if (nextMode !== 'loading') await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await assertMoment(id, { ready: nextMode !== 'loading' });
}
try {
  await mkdir('artifacts', { recursive: true });
  for (const [mode, id, at] of [
    ['sun', 'weather.sun'], ['cloud', 'weather.cloud'], ['rain', 'weather.rain'],
    ['missing', 'weather.missing'], ['stale', 'weather.stale'], ['unknown', 'weather.unknown'],
    ['sun', 'weather.night', '2026-10-28T22:00:00Z'],
  ]) {
    await open(mode, id, at);
    await page.screenshot({ path: `artifacts/experience-${id}.png` });
  }
  await open('sun', 'weather.sun');
  await page.getByRole('button', { name: 'Åbn filtre', exact: true }).click();
  await page.getByRole('textbox', { name: 'Søg efter sted eller område', exact: true }).fill('no-such-sunspot');
  await page.getByRole('button', { name: 'Anvend filtre', exact: true }).click();
  await assertMoment('weather.no-spot');
  await open('sun', 'weather.sun');
  await page.getByRole('button', { name: 'Vælg sted og tid', exact: true }).click();
  await page.getByRole('combobox', { name: 'Dag', exact: true }).selectOption('2026-10-29');
  await page.getByRole('button', { name: 'Luk sted og tid', exact: true }).click();
  await assertMoment('planned.sun');
  mode = 'cloud';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await assertMoment('planned.grey');
  await open('loading', 'weather.loading');
  await expect(page.locator('.finder-submit')).toBeDisabled();
  await expect.poll(() => Boolean(releaseWeather)).toBe(true);
  mode = 'sun'; releaseWeather();
  await assertMoment('weather.sun');
  await page.getByRole('button', { name: 'Vælg sted og tid', exact: true }).click();
  for (const name of ['Park', 'Bar', 'Mad']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Luk sted og tid', exact: true }).click();
  await assertMoment('empty.no-types');
  await page.locator('.finder-submit').click();
  await expect(page.locator('.finder-empty[data-experience="empty.no-types"]')).toBeVisible();
  await expect(page.locator('.place-pin')).toHaveCount(0);
  await open('sun', 'weather.sun');
  await page.getByRole('button', { name: 'Nær mig', exact: true }).click();
  await assertMoment('empty.location');
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 13.4, latitude: 56.0 });
  await page.getByRole('button', { name: 'Nær mig', exact: true }).click();
  await assertMoment('empty.outside');
  await open('cloud', 'weather.cloud');
  for (const [language, label] of [['en', 'Language'], ['sv', 'Språk']]) {
    await page.locator('.finder-language select').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.getByRole('combobox', { name: label, exact: true }).first()).toHaveValue(language);
    await assertMoment('weather.cloud');
    await page.screenshot({ path: `artifacts/experience-cloud-${language}-mobile.png` });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, viewport: '360×640', checks, facts: ['main CTA visible and unobstructed', 'weather gates color focus', 'no types stays empty', 'denied/outside location stays honest', 'locale changes preserve moment'] }));
} finally {
  releaseWeather?.();
  await browser.close();
}
