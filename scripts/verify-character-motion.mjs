import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export const openingTime = "2026-10-27T11:00:00Z";
export function openingForecast(mode = "sun") {
  if (mode === "missing") return { available: false };
  return { available: true, stale: mode === "stale", timeseries: Array.from({ length: 72 }, (_, hour) => ({
    time: new Date(Date.parse("2026-10-27T00:00:00Z") + hour * 3600000).toISOString(),
    data: {
      instant: { details: { cloud_area_fraction: mode === "cloud" ? 100 : 5, air_temperature: 12, wind_speed: 2 } },
      next_1_hours: { summary: { symbol_code: ({ cloud: "cloudy", rain: "rain", unknown: "unclassified" })[mode] || "clearsky_day" }, details: { precipitation_amount: mode === "rain" ? 2 : 0 } },
    },
  })) };
}
export const openingOffer = (kind = "beer") => ({
  id: `opening-${kind}`, placeId: "osm-335962972", placeName: "Café Stefanshus", kind,
  title: `Synthetic ${kind}`, description: "Synthetic opening test offer", priceDkk: 10,
  state: "active", claimable: true, demo: false, activeUntil: "2026-10-27T12:00:00Z",
});
export async function assertCharacterScope(page) {
  assert.deepEqual(await page.locator(".cast-character").evaluateAll((nodes) => nodes.filter((node) => !node.closest(".opening-theatre, .theatre-dialog")).map((node) => node.dataset.character)), [], "product figures occur only in the opening; the gallery is opt-in");
}
export async function assertOpeningBackdrop(page, active) {
  const state = await page.locator(".map-workspace").evaluate((main) => {
    const style = getComputedStyle(main, "::after");
    return { active: main.classList.contains("opening-active"), content: style.content, background: style.backgroundColor, opacity: style.opacity, z: Number(style.zIndex), panelZ: Number(getComputedStyle(main.querySelector(".spot-finder")).zIndex) };
  });
  assert.equal(state.active, active);
  if (active) {
    assert.ok(!["none", "normal"].includes(state.content));
    assert.match(state.background, /^rgba\(/);
    assert.ok(Number(state.background.match(/,\s*([\d.]+)\)$/)?.[1]) >= 0.7, "the opening backdrop is visibly dark");
    assert.ok(Number(state.opacity) > 0 && state.z < state.panelZ, "the backdrop is visible beneath the panel");
  } else assert.ok(["none", "normal"].includes(state.content), "search/settings remove the backdrop immediately");
}
export async function assertOpeningControls(page) {
  await assertOpeningBackdrop(page, true);
  const submit = page.locator(".finder-submit");
  await expect(submit).toBeInViewport({ ratio: 1 });
  assert.ok(await submit.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  }), "the search action remains unobstructed from the first frame");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "the opening does not overflow horizontally");
  const copy = page.locator(".opening-intro h1, .opening-intro p");
  assert.ok(await copy.count() >= 2, "opening title and explanatory text exist");
  for (const element of await copy.all()) {
    assert.ok(await element.evaluate((node) => {
      const style = getComputedStyle(node), box = node.getBoundingClientRect();
      return node.textContent.trim().length > 0 && style.visibility === "visible" && style.display !== "none" && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
    }), "opening text is computed-visible, not just present in the DOM");
  }
}
const activeCount = (page) => page.locator(".opening-theatre").evaluateAll((nodes) => nodes.flatMap((node) => node.getAnimations({ subtree: true })).filter((animation) => animation.playState === "running" || animation.pending).length);
const recordCount = (page) => page.evaluate(() => window.openingAnimations.length);
const records = (page) => page.evaluate(() => window.openingAnimations.map(({ animation, target, stage, start }) => ({
  target: target.className, scene: stage.dataset.scene, frames: animation.effect.getKeyframes(), timing: animation.effect.getTiming(), playState: animation.playState, start,
})));

export async function verifyOpeningMotion(browser, base) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, timezoneId: "Europe/Copenhagen", reducedMotion: "no-preference" });
  await context.addCookies([{ name: "sunspot-language", value: "da", url: base }]);
  await context.addInitScript(() => {
    window.openingAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      const stage = this.closest(".opening-theatre");
      if (stage) {
        const record = { animation, target: this, stage, start: null };
        window.openingAnimations.push(record);
        animation.ready.then(() => { record.start = { bottom: this.getBoundingClientRect().bottom, top: stage.getBoundingClientRect().top }; }).catch(() => {});
      }
      return animation;
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let mode = "sun", offers = [], requests = 0;
  await context.route("**/api/weather", (route) => { requests += 1; return route.fulfill({ json: openingForecast(mode) }); });
  await context.route("**/api/golden-hour/offers", (route) => route.fulfill({ json: { offers, serverNow: openingTime } }));
  async function open(expected) {
    await page.clock.setSystemTime(new Date(openingTime));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
    await expect(page.locator(".opening-theatre")).toHaveAttribute("data-scene", expected);
  }
  async function refresh(expected) {
    const before = requests;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => requests).toBeGreaterThan(before);
    await expect(page.locator(".opening-theatre")).toHaveAttribute("data-scene", expected);
  }
  const checks = [];
  try {
    await open("opening.sun");
    await expect.poll(() => recordCount(page)).toBe(2);
    await expect.poll(async () => (await records(page)).every((record) => record.start !== null)).toBe(true);
    const drops = await records(page);
    for (const record of drops) {
      const prop = record.target === "opening-weather-prop";
      assert.equal(record.timing.duration, prop ? 720 : 780);
      assert.equal(record.timing.delay, prop ? 90 : 0);
      assert.equal(record.timing.iterations, 1);
      assert.ok(record.timing.duration + record.timing.delay >= 650 && record.timing.duration + record.timing.delay <= 900);
      assert.ok(record.start.bottom <= record.start.top, "the whole rig starts above the clipped stage");
      assert.match(record.frames[0].transform, new RegExp(`translateY\\(${prop ? -160 : -210}px\\)`));
      assert.ok(record.frames.every((frame) => Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)).every((key) => key === "transform")), "only the outer rig transforms; text and atlas cropping are untouched");
    }
    await assertOpeningControls(page);
    await expect(page.locator(".opening-puppet .opening-strings line")).toHaveCount(4);
    await expect(page.locator(".opening-weather-prop .opening-strings line")).toHaveCount(2);
    assert.ok(await page.locator(".opening-strings line").evaluateAll((lines) => lines.every((line) => {
      const style = getComputedStyle(line);
      return Number(line.getAttribute("y1")) < 0 && Number(line.getAttribute("y2")) > 0 && line.getAttribute("x1") === line.getAttribute("x2") && style.stroke !== "none" && Number(style.opacity) > 0;
    })), "visible strings attach inside both moving rigs");
    await page.waitForTimeout(1000);
    assert.equal(await activeCount(page), 0, "the opening ends at rest without an idle loop");
    for (const target of await page.locator(".opening-puppet, .opening-weather-prop").all())
      assert.equal(await target.evaluate((node) => getComputedStyle(node).transform), "none");
    checks.push("two native 650–900ms stringed drops begin above the frame and finish at rest");

    const before = await recordCount(page), weatherBefore = requests;
    await page.evaluate(() => { window.stableOpening = document.querySelector(".opening-theatre"); });
    for (const language of ["en", "sv", "da"]) {
      await page.locator(".finder-language select").selectOption(language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await assertOpeningControls(page);
    }
    assert.equal(requests, weatherBefore, "language changes do not fetch weather");
    const copyBefore = await page.locator(".opening-intro").innerText();
    await refresh("opening.sun");
    assert.equal(await recordCount(page), before, "locale and unchanged polling do not replay the drop");
    assert.equal(await page.locator(".opening-intro").innerText(), copyBefore, "unchanged polling does not duplicate or replace the copy");
    assert.ok(await page.evaluate(() => window.stableOpening === document.querySelector(".opening-theatre")), "the stage node remains stable");
    await page.evaluate(() => {
      window.openingGateSeen = false;
      window.openingGateObserver = new MutationObserver(() => {
        if (document.querySelector(".opening-theatre") && !document.querySelector(".opening-theatre .cast-character")) window.openingGateSeen = true;
      });
      window.openingGateObserver.observe(document.querySelector(".opening-theatre"), { childList: true, subtree: true });
    });
    await page.clock.setSystemTime(new Date(Date.parse(openingTime) + 60000));
    await refresh("opening.sun");
    assert.ok(await page.evaluate(() => { window.openingGateObserver.disconnect(); return window.openingGateSeen; }), "new solar calculation temporarily hides the opening figure");
    assert.equal(await recordCount(page), before, "a temporary pending gate followed by the same descriptor does not replay");
    checks.push("locale, polling and temporary pending gates preserve a consumed opening");

    mode = "cloud";
    await refresh("opening.no-sun");
    await expect(page.locator(".opening-theatre .lucide-sun")).toHaveCount(0);
    await expect(page.locator(".opening-theatre .lucide-cloud")).toHaveCount(1);
    mode = "rain";
    await refresh("opening.no-sun");
    await expect(page.locator(".opening-theatre .lucide-cloud-rain")).toHaveCount(1);
    await expect(page.locator(".opening-theatre .lucide-sun")).toHaveCount(0);
    await page.waitForTimeout(1000);
    assert.equal(await activeCount(page), 0);
    checks.push("real weather changes replace props without a retained sunny signal");

    mode = "sun"; offers = [openingOffer("cocktail")];
    await open("opening.golden-hour");
    await expect(page.locator(".opening-theatre [data-pose='cocktail-seated']")).toHaveCount(1);
    await expect.poll(() => activeCount(page)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => activeCount(page)).toBe(0);
    const afterReduce = await recordCount(page);
    for (const target of await page.locator(".opening-puppet, .opening-weather-prop").all())
      assert.equal(await target.evaluate((node) => getComputedStyle(node).transform), "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    assert.equal(await recordCount(page), afterReduce, "restoring motion preference does not replay the entrance");
    await assertOpeningControls(page);
    await assertCharacterScope(page);
    checks.push("reduced motion cancels an active drop and immediately reveals its static final state");

    await page.locator(".finder-submit").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".opening-theatre")).toHaveCount(0);
    await assertOpeningBackdrop(page, false);
    await expect(page.locator(".cast-character")).toHaveCount(0);
    await page.getByRole("button", { name: "Ændr søgning", exact: true }).click();
    await expect(page.locator(".opening-theatre")).toHaveCount(0);
    await page.locator(".finder-language select").selectOption("en");
    await refreshAfterSearch();
    await expect(page.locator(".opening-theatre")).toHaveCount(0);
    await expect(page.locator(".cast-character")).toHaveCount(0);
    await page.getByRole("button", { name: "Open filters", exact: true }).click();
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page.locator(".opening-intro")).toHaveCount(0);
    await page.getByRole("button", { name: "Open filters", exact: true }).click();
    await page.getByRole("button", { name: "Reset to sunshine and open now", exact: true }).click();
    await expect(page.locator(".opening-theatre, .opening-intro")).toHaveCount(0);
    await assertOpeningBackdrop(page, false);
    checks.push("first search consumes the opening for the mount, including subsequent edits and locale/polling");
    assert.deepEqual(errors, []);
    return checks;
  } catch (error) {
    await page.screenshot({ path: "artifacts/opening-motion-failure.png" }).catch(() => {});
    throw error;
  } finally { await context.close(); }

  async function refreshAfterSearch() {
    const before = requests;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => requests).toBeGreaterThan(before);
  }
}
