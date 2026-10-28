import { expect } from "@playwright/test";
import assert from "node:assert/strict";

const now = "2026-10-28T11:00:00Z";
const hero = ".experience-hero .character-scene";

// Test-only observation of native handles catches even a short, incorrect restart.
async function observeMotion(context) {
  await context.addInitScript(() => {
    window.characterAnimations = [];
    window.characterSunTails = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      const scene = this.closest(".character-scene");
      if (scene) {
        const record = { animation, scene, moment: scene.dataset.moment, target: this.tagName, createdAt: performance.now() };
        const cancel = animation.cancel.bind(animation);
        animation.cancel = () => { record.cancellation = { elapsed: performance.now() - record.createdAt, stack: new Error().stack.split("\n").slice(1, 7).join("\n") }; cancel(); };
        window.characterAnimations.push(record);
      }
      return animation;
    };
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const scene = document.querySelector(".experience-hero .character-scene");
        if (!scene || ["weather.sun", "planned.sun", "weather.no-spot"].includes(scene.dataset.moment)) return;
        const pane = document.querySelector(".sun-focus-color-pane");
        const count = Number(pane?.dataset.activeCount || 0);
        const style = pane && getComputedStyle(pane);
        const visibleColour = count > 0 && style?.visibility === "visible" && style.display !== "none" && Number(style.opacity) > 0 && pane.closest(".sun-focus-map")?.dataset.sunFocusEnabled !== "false";
        if (scene.classList.contains("scene-sun") || scene.querySelector(".lucide-sun") || visibleColour)
          window.characterSunTails.push({ moment: scene.dataset.moment, count });
      });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-moment", "data-active-count"] });
  });
}

const animationCount = (page) => page.evaluate(() => window.characterAnimations.length);
async function records(page, since = 0) {
  const values = await page.evaluate((start) => window.characterAnimations.slice(start).map(({ animation, scene, moment, target, createdAt, cancellation }) => ({
    moment, target, connected: scene.isConnected,
    timing: animation.effect.getTiming(),
    frames: animation.effect.getKeyframes(),
    playState: animation.playState,
    currentTime: animation.currentTime,
    elapsed: performance.now() - createdAt,
    cancellation,
  })), since);
  values.forEach(assertAllowedAnimation);
  return values;
}
const activeCount = (page, selector = ".character-scene") => page.locator(selector).evaluateAll((nodes) => nodes.flatMap((node) => node.getAnimations({ subtree: true })).filter((animation) => animation.playState === "running" || animation.pending).length);
const atRest = (page, selector) => expect.poll(() => activeCount(page, selector)).toBe(0);

function assertAllowedAnimation(record) {
  assert.notEqual(record.target, "IMG", "the atlas crop is never an animation target");
  assert.ok(Number.isFinite(record.timing.iterations) && record.timing.iterations <= 3, "all character animations are finite");
  assert.ok([160, 180, 220, 300, 320, 360, 1200].includes(record.timing.duration), "duration follows an approved finite sequence");
  assert.equal(record.timing.iterations, record.moment === "weather.loading" ? 3 : 1);
  assert.ok(record.timing.duration * record.timing.iterations <= 3600, "every sequence ends within 3.6 seconds");
  assert.equal(record.timing.delay, 0);
  assert.equal(record.timing.endDelay, 0);
  const movement = record.frames.some((frame) => frame.transform && frame.transform !== "none");
  assert.equal(record.timing.easing, record.moment === "weather.loading" ? "cubic-bezier(0.45, 0, 0.55, 1)" : movement ? "cubic-bezier(0.22, 1, 0.36, 1)" : "linear");
  for (const frame of record.frames) {
    const animatedProperties = Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key));
    assert.ok(animatedProperties.every((key) => ["transform", "opacity"].includes(key)), `only transform/opacity animate: ${animatedProperties}`);
  }
}

async function assertAction(page, selector) {
  const action = page.locator(selector);
  await expect(action).toBeInViewport({ ratio: 1 });
  assert.ok(await action.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  }), "the primary action is unobstructed during motion");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "motion does not create horizontal overflow");
}

export async function verifyCharacterMotion(browser, base) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, timezoneId: "Europe/Copenhagen", reducedMotion: "no-preference" });
  await context.addCookies([{ name: "sunspot-language", value: "da", url: base }]);
  await observeMotion(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let mode = "loading";
  let weatherRequests = 0;
  let serverTime = Date.parse(now);
  const heldWeather = [];
  let heldClaim;
  let heldRsvp;
  let claims = 0;
  let replies = 0;
  const forecast = () => mode === "missing" ? { available: false } : {
    available: true, stale: mode === "stale",
    timeseries: Array.from({ length: 72 }, (_, hour) => ({
      time: new Date(Date.parse("2026-10-28T00:00:00Z") + hour * 3600000).toISOString(),
      data: {
        instant: { details: { cloud_area_fraction: mode === "cloud" ? 100 : 5 } },
        next_1_hours: { summary: { symbol_code: ({ cloud: "cloudy", rain: "rain", unknown: "unclassified" })[mode] || "clearsky_day" }, details: { precipitation_amount: mode === "rain" ? 2 : 0 } },
      },
    })),
  };
  const offer = {
    id: "motion-offer", placeId: "osm-335962972", placeName: "Café Stefanshus", kind: "beer",
    title: "Motion fixture beer", description: "Synthetic motion test offer", priceDkk: 10,
    state: "active", activeUntil: "2026-10-28T12:00:00Z", claimable: true, demo: false,
  };
  const voucher = { ...offer, id: "motion-voucher", offerId: offer.id, claimedAt: now, expiresAt: "2026-10-28T12:00:00Z", redeemedAt: null };
  const invitation = {
    id: "motion-invitation", host: "Ida", activity: "bar", startsAt: "2026-10-29T12:00:00Z", duration: 60,
    place: { id: offer.placeId, name: offer.placeName, category: "bar" },
    cancelled: false, isHost: false, answers: [], counts: { yes: 1, maybe: 1, no: 1 },
  };
  const createdInvitation = { ...invitation, id: "motion-created", isHost: true, counts: { yes: 0, maybe: 0, no: 0 } };
  const failedCreatedInvitation = { ...createdInvitation, id: "motion-created-failure" };
  let createdGetFails = true;
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const respond = (json, status = 200) => route.fulfill({ status, json: { ...json, serverNow: new Date(serverTime).toISOString() } });
    if (path === "/api/weather") {
      weatherRequests += 1;
      if (mode === "loading") { heldWeather.push(route); return; }
      return respond(forecast());
    }
    if (path === "/api/golden-hour/offers") return respond({ offers: [] });
    if (path === `/api/golden-hour/offers/${offer.id}`) return respond({ offer });
    if (path === `/api/golden-hour/offers/${offer.id}/claim`) { claims += 1; heldClaim = route; return; }
    if (path === `/api/golden-hour/vouchers/${voucher.id}`) return respond({ voucher });
    if (path === `/api/gatherings/${invitation.id}`) return respond(invitation);
    if (path === `/api/gatherings/${invitation.id}/rsvp`) { replies += 1; heldRsvp = route; return; }
    if (path === `/api/gatherings/${createdInvitation.id}`) return respond(createdInvitation);
    if (path === `/api/gatherings/${failedCreatedInvitation.id}`)
      return createdGetFails ? respond({ error: "Synthetic invitation load failure", code: "common.error" }, 503) : respond(failedCreatedInvitation);
    return route.continue();
  });
  const currentMoment = () => page.locator(hero).getAttribute("data-moment");
  async function navigate(url) {
    if (page.url() !== "about:blank") {
      await records(page);
      assert.deepEqual(await page.evaluate(() => window.characterSunTails), [], "no uncertain frame retains an old sunshine signal");
    }
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  async function open(nextMode, expected) {
    mode = nextMode;
    await page.clock.setSystemTime(new Date(now));
    await navigate(base);
    if (nextMode !== "loading") await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
    await expect(page.locator(hero)).toHaveAttribute("data-moment", expected);
  }
  async function refresh(nextMode, expected) {
    mode = nextMode;
    const before = weatherRequests;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => weatherRequests).toBeGreaterThan(before);
    await expect(page.locator(hero)).toHaveAttribute("data-moment", expected);
  }
  async function releaseWeather(nextMode) {
    mode = nextMode;
    await Promise.all(heldWeather.splice(0).map((route) => route.fulfill({ json: forecast() }).catch(() => {})));
  }
  const checks = [];
  try {
    await open("loading", "weather.loading");
    await expect.poll(async () => (await records(page)).filter((record) => record.moment === "weather.loading").length).toBe(1);
    const loading = (await records(page)).find((record) => record.moment === "weather.loading");
    assert.equal(loading.timing.duration, 1200);
    assert.equal(loading.timing.iterations, 3);
    assert.deepEqual(loading.frames.map((frame) => Number(frame.opacity)), [1, 0.72, 1]);
    assert.ok(loading.frames.every((frame) => !frame.transform || frame.transform === "none"), "loading has no positional motion");
    await expect.poll(() => activeCount(page, hero)).toBe(1);
    await expect(page.locator(".finder-submit")).toBeDisabled();
    await assertAction(page, ".finder-submit");
    await page.waitForTimeout(3700);
    assert.equal(await activeCount(page, hero), 0, "loading stops after three loops even without a response");
    assert.equal(await currentMoment(), "weather.loading");
    assert.equal(await page.locator(`${hero} .character-motion-group`).evaluate((node) => getComputedStyle(node).opacity), "1");
    await releaseWeather("sun");
    await expect(page.locator(hero)).toHaveAttribute("data-moment", "weather.sun", { timeout: 20000 });
    await atRest(page, hero);
    checks.push("native loading keyframes, 3×1200ms and no loop after 3.7s");

    await open("loading", "weather.loading");
    await expect.poll(() => activeCount(page, hero)).toBe(1);
    await page.evaluate(() => { window.interruptedLoading = document.querySelector(".experience-hero .character-scene").getAnimations({ subtree: true }); });
    await releaseWeather("sun");
    await expect(page.locator(hero)).toHaveAttribute("data-moment", "weather.sun", { timeout: 20000 });
    assert.ok(await page.evaluate(() => window.interruptedLoading.every((animation) => animation.playState === "idle")), "a response immediately cancels the loading handle");
    await atRest(page, hero);
    await page.evaluate(() => { window.stableHeroNode = document.querySelector(".experience-hero .character-scene"); });
    let before = await animationCount(page);
    let requests = weatherRequests;
    for (const language of ["en", "sv", "da"]) {
      const select = page.locator(".finder-language select");
      await select.focus();
      await select.selectOption(language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(select).toBeFocused();
    }
    assert.equal(weatherRequests, requests, "locale changes do not request weather");
    assert.equal(await animationCount(page), before, "locale changes do not replay motion");
    await refresh("sun", "weather.sun");
    assert.equal(await animationCount(page), before, "same-state polling does not replay motion");
    assert.ok(await page.evaluate(() => window.stableHeroNode === document.querySelector(".experience-hero .character-scene")), "the primary scene DOM node remains stable");
    checks.push("stable DOM and no replay or request on locale/same-state polling");

    await refresh("cloud", "weather.cloud");
    // Pause inside its allowed interval so cancellation is deterministic under CPU load.
    await page.evaluate(() => {
      window.interruptedCloud = document.querySelector(".experience-hero .character-scene").getAnimations({ subtree: true });
      for (const animation of window.interruptedCloud) { animation.pause(); animation.currentTime = 40; }
    });
    assert.ok(await page.evaluate(() => window.interruptedCloud.length > 0), "the cloud transition has a native animation to interrupt");
    await refresh("rain", "weather.rain");
    assert.ok(await page.evaluate(() => window.interruptedCloud.every((animation) => animation.playState === "idle")), "rain cancels the earlier transition without a queue");
    await expect(page.locator(`${hero} .lucide-cloud-rain`)).toHaveCount(1);
    await expect(page.locator(`${hero} .scene-sun, ${hero} .lucide-sun`)).toHaveCount(0);
    await assertAction(page, ".finder-submit");
    await page.locator(".experience-action").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('input[type="time"]')).toBeFocused();
    await atRest(page, hero);
    checks.push("sun→cloud→rain interruption preserves the correct figure, action and focus");

    await open("cloud", "weather.cloud");
    await page.locator(".finder-toggle").click();
    await page.locator(".finder-date-time select").selectOption("2026-10-29");
    await expect(page.locator(hero)).toHaveAttribute("data-moment", "planned.grey");
    await page.locator(".finder-toggle").click();
    await atRest(page, hero);
    before = await animationCount(page);
    await refresh("rain", "planned.grey");
    await expect(page.locator(`${hero} .lucide-cloud-rain`)).toHaveCount(1);
    await expect.poll(() => animationCount(page)).toBeGreaterThan(before);
    const changedWeather = (await records(page, before)).filter((record) => record.moment === "planned.grey");
    assert.equal(changedWeather.length, 1, "same-id weather change produces one transition");
    assert.equal(changedWeather[0].timing.duration, 160);
    assert.ok(changedWeather[0].frames.every((frame) => !frame.transform || frame.transform === "none"), "later changes are opacity-only");
    await atRest(page, hero);
    checks.push("planned.grey cloud→rain changes despite an unchanged moment id");

    for (const next of ["stale", "missing", "unknown"]) {
      await open("sun", "weather.sun");
      await refresh(next, `weather.${next}`);
      await expect(page.locator(`${hero}.scene-sun, ${hero} .lucide-sun`)).toHaveCount(0);
      await expect(page.locator(".sun-focus-color-pane")).toHaveAttribute("data-active-count", "0");
    }
    await open("sun", "weather.sun");
    await page.clock.setSystemTime(new Date("2026-10-28T22:00:00Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.locator(hero)).toHaveAttribute("data-moment", "weather.night");
    await expect(page.locator(`${hero} .lucide-moon`)).toHaveCount(1);
    await expect(page.locator(`${hero}.scene-sun, ${hero} .lucide-sun`)).toHaveCount(0);
    await expect(page.locator(".sun-focus-color-pane")).toHaveAttribute("data-active-count", "0");
    assert.deepEqual(await page.evaluate(() => window.characterSunTails), [], "uncertain states have no old sunshine signal on their first rendered frame");
    checks.push("uncertain weather removes old sun and map colour without a fade-out tail");

    await open("loading", "weather.loading");
    await expect.poll(() => activeCount(page, hero)).toBe(1);
    before = await animationCount(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await atRest(page, hero);
    assert.equal(await page.locator(`${hero} .character-motion-group`).evaluate((node) => getComputedStyle(node).transform), "none");
    assert.equal(await page.locator(`${hero} .character-motion-group`).evaluate((node) => getComputedStyle(node).opacity), "1");
    await releaseWeather("rain");
    await expect(page.locator(hero)).toHaveAttribute("data-moment", "weather.rain");
    assert.equal(await animationCount(page), before, "reduced motion creates no new native animation");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await atRest(page, hero);
    assert.equal(await animationCount(page), before, "restoring motion preference does not replay an already shown state");
    checks.push("mid-animation reduced-motion cancellation and immediate final state");

    mode = "cloud";
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(`${base}/?offer=${offer.id}`);
    const offerScene = ".golden-offer-summary .character-scene";
    await expect(page.locator(offerScene)).toHaveAttribute("data-moment", "offer.beer");
    await expect.poll(async () => (await records(page)).filter((record) => record.moment === "offer.beer").length).toBe(1);
    const offerEntry = (await records(page)).find((record) => record.moment === "offer.beer");
    assert.equal(offerEntry.timing.duration, 220);
    assert.ok(offerEntry.frames.every((frame) => !frame.transform || frame.transform === "none"), "the whole seated pose only fades");
    assert.ok((await records(page)).every((record) => record.moment.startsWith("offer.")), "the hero and secondary figures do not move behind an offer dialog");
    await assertAction(page, ".golden-offer-detail .golden-button");
    await page.locator(".golden-offer-detail .golden-button").click();
    await expect.poll(() => Boolean(heldClaim)).toBe(true);
    await expect(page.locator(offerScene)).toHaveAttribute("data-moment", "offer.checking");
    await expect(page.locator(".golden-offer-detail .golden-button")).toBeDisabled();
    assert.equal(await activeCount(page, offerScene), 0, "busy follows the actual request without a figure loop");
    assert.equal(await page.locator(offerScene).evaluate((node) => getComputedStyle(node).opacity), "0.55");
    await expect(page.locator(".golden-voucher-code")).toHaveCount(0);
    await heldClaim.fulfill({ status: 201, json: { voucher, serverNow: now } });
    const voucherScene = ".golden-voucher-summary .character-scene";
    await expect(page.locator(".golden-voucher-code textarea")).toHaveValue(voucher.id);
    await expect.poll(async () => (await records(page)).filter((record) => record.moment === "voucher.valid").length).toBe(1);
    assert.equal((await records(page)).find((record) => record.moment === "voucher.valid").timing.duration, 220);
    await atRest(page, voucherScene);
    await page.evaluate(() => { window.stableVoucherNode = document.querySelector(".golden-voucher-summary .character-scene"); });
    before = await animationCount(page);
    const timer = page.locator(".golden-countdown");
    const toSeconds = (text) => text.split(":").reduce((minutes, part) => minutes * 60 + Number(part), 0);
    const timerBefore = toSeconds(await timer.innerText());
    await page.waitForTimeout(5100);
    assert.ok(toSeconds(await timer.innerText()) <= timerBefore - 5, "five countdown ticks advance normally");
    await page.getByRole("dialog").locator('select[name="language"]').selectOption("en");
    serverTime += 6000;
    requests = weatherRequests;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => weatherRequests).toBeGreaterThan(requests);
    await expect(page.locator(".golden-voucher-code textarea")).toHaveValue(voucher.id);
    assert.equal(await animationCount(page), before, "timer ticks, locale and same-voucher polling never replay success");
    assert.ok(await page.evaluate(() => window.stableVoucherNode === document.querySelector(".golden-voucher-summary .character-scene")), "voucher polling keeps its scene node");
    assert.ok(toSeconds(await timer.innerText()) <= timerBefore - 5, "polling never extends the countdown");
    assert.equal(voucher.expiresAt, "2026-10-28T12:00:00Z");
    assert.equal(claims, 1);
    await page.evaluate((id) => localStorage.removeItem(`sunspot:golden-voucher:${id}`), offer.id);
    heldClaim = undefined;
    await navigate(`${base}/?offer=${offer.id}`);
    await expect(page.locator(offerScene)).toHaveAttribute("data-moment", "offer.beer");
    await page.locator(".golden-offer-detail .golden-button").click();
    await expect.poll(() => Boolean(heldClaim)).toBe(true);
    await heldClaim.fulfill({ status: 200, json: { voucher, serverNow: new Date(serverTime).toISOString() } });
    await expect(page.locator(".golden-voucher-code textarea")).toHaveValue(voucher.id);
    assert.equal((await records(page)).filter((record) => record.moment === "voucher.valid").length, 0, "a 200 response with the same voucher is not a new success");
    assert.equal(claims, 2);
    await navigate(`${base}/voucher/${voucher.id}`);
    await expect(page.locator(voucherScene)).toHaveAttribute("data-moment", "voucher.valid");
    assert.equal((await records(page)).filter((record) => record.moment.startsWith("voucher.")).length, 0, "opening a stored voucher has no success animation");
    checks.push("claim busy/confirmed motion, five timer ticks and voucher locale/poll stability");

    await context.addCookies([{ name: "sunspot-language", value: "da", url: base }]);
    await navigate(`${base}/invite/${invitation.id}`);
    await expect(page.locator(".rsvp-counts")).toContainText("1 kommer");
    await page.locator("#guest-name").fill("Freja");
    await page.locator('input[value="yes"]').check();
    await atRest(page, ".invite-cast .character-scene");
    before = await animationCount(page);
    await page.locator(".rsvp-form button").click();
    await expect.poll(() => Boolean(heldRsvp)).toBe(true);
    await expect(page.locator(".rsvp-counts")).toContainText("1 kommer");
    assert.equal(await animationCount(page), before, "sending RSVP is not a confirmation");
    await page.locator(".invite-character-heading").scrollIntoViewIfNeeded();
    invitation.counts.yes = 2;
    await heldRsvp.fulfill({ json: { editToken: "motion-edit-token", serverNow: now } });
    await expect(page.locator(".rsvp-counts")).toContainText("2 kommer");
    await expect(page.locator(".rsvp-counts")).toContainText("1 måske");
    await expect(page.locator(".rsvp-counts")).toContainText("1 kan ikke");
    await expect.poll(async () => (await records(page, before)).filter((record) => record.moment === "invite-responses").length).toBe(1);
    const reply = (await records(page, before)).find((record) => record.moment === "invite-responses");
    assert.equal(reply.timing.duration, 180);
    assert.ok((await records(page)).every((record) => !record.moment.startsWith("invite-answer-")), "radio characters are always static");
    await atRest(page, ".invite-cast .character-scene");
    await records(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".invite-cast .character-scene")).toHaveAttribute("data-moment", "invite-responses");
    assert.equal((await records(page)).filter((record) => record.moment === "invite-responses" && record.timing.duration === 180).length, 0, "a saved reply does not replay confirmation");
    assert.equal(replies, 1);
    checks.push("RSVP confirms only after response/refetch and keeps three independent totals");

    await page.evaluate((id) => sessionStorage.setItem(`sunspot:created-invite:${id}`, "1"), createdInvitation.id);
    await navigate(`${base}/invite/${createdInvitation.id}`);
    const createdScene = ".invite-cast .character-scene";
    await expect(page.locator(createdScene)).toHaveAttribute("data-moment", "invite-created");
    await expect(page.locator(`${createdScene} .character-motion-group > .cast-character`)).toHaveCount(2);
    await expect.poll(async () => (await records(page)).filter((record) => record.moment === "invite-created").length).toBe(1);
    const createdEntry = (await records(page)).find((record) => record.moment === "invite-created");
    assert.equal(createdEntry.timing.duration, 220);
    assert.match(createdEntry.frames[0].transform, /translateY\(4px\)/);
    await expect.poll(() => page.evaluate((id) => sessionStorage.getItem(`sunspot:created-invite:${id}`), createdInvitation.id)).toBe(null);
    await atRest(page, createdScene);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(createdScene)).toHaveAttribute("data-moment", "invite-created");
    assert.equal((await records(page)).filter((record) => record.moment === "invite-created").length, 0, "reopening a created invitation never repeats the entrance");

    await page.evaluate((id) => sessionStorage.setItem(`sunspot:created-invite:${id}`, "1"), failedCreatedInvitation.id);
    await navigate(`${base}/invite/${failedCreatedInvitation.id}`);
    await expect(page.locator('.invite-card [role="alert"]')).toHaveText("Noget gik galt. Prøv igen.");
    await expect.poll(() => page.evaluate((id) => sessionStorage.getItem(`sunspot:created-invite:${id}`), failedCreatedInvitation.id)).toBe(null);
    createdGetFails = false;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(createdScene)).toHaveAttribute("data-moment", "invite-created");
    assert.equal((await records(page)).filter((record) => record.moment === "invite-created").length, 0, "a failed first GET consumes the creation marker before a later successful reload");
    checks.push("created invitation has one 220ms group entrance and consumes its marker even on GET failure");

    for (const record of await records(page)) assertAllowedAnimation(record);
    assert.deepEqual(errors, []);
    return checks;
  } catch (error) {
    await page.screenshot({ path: "artifacts/character-motion-failure.png" }).catch(() => {});
    console.error(JSON.stringify({ motionFailure: await records(page), visibility: await page.evaluate(() => ({ hidden: document.hidden, pending: document.querySelector(".map-workspace")?.dataset.solarPending, scene: document.querySelector(".experience-hero .character-scene")?.getBoundingClientRect().toJSON() })) }));
    throw error;
  } finally {
    await releaseWeather("missing");
    await heldClaim?.abort().catch(() => {});
    await heldRsvp?.abort().catch(() => {});
    await context.close();
  }
}
