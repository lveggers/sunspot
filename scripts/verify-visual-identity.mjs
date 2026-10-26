import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const scenes = [
  ["Bænken i solen", "bench-sun.png"],
  ["Vestegnen på tur", "vestegnen.png"],
  ["Den sidste solplet", "tiny-sun-patch.png"],
  ["Efter solen", "chasing-sun.png"],
  ["Golden Hour", "golden-hour-friends.png"],
];
const provenance = "EKSEMPEL · simuleret sol, vejr og tilbud";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 667 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
const claimRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.route("**/api/golden-hour/offers/*/claim", async (route) => {
  claimRequests.push(route.request().url());
  await route.fulfill({
    status: 409,
    json: { error: "The illustrated example must not claim a real offer." },
  });
});
const theatre = () =>
  page.getByRole("dialog", { name: "SunSpot dukketeater", exact: true });
const launcher = () =>
  page.getByRole("button", { name: "Mød SunSpot-figurerne", exact: true });
const waitForIllustration = async (illustration, filename) => {
  await expect(illustration).toBeVisible();
  if (filename) {
    const imageUrl = new URL(
      await illustration.getAttribute("src"),
      page.url(),
    );
    const source =
      imageUrl.pathname === "/_next/image"
        ? imageUrl.searchParams.get("url")
        : imageUrl.href;
    const imagePath = new URL(source, page.url()).pathname;
    const stem = filename.replace(/\.png$/, "");
    assert.match(
      imagePath,
      new RegExp(`/${stem}(?:\\.[A-Za-z0-9_-]+)?\\.png$`),
    );
  }
  await expect
    .poll(
      () =>
        illustration.evaluate((img) => img.complete && img.naturalWidth > 0),
      { timeout: 15000 },
    )
    .toBe(true);
  await illustration.evaluate((img) => img.decode());
};

const assertNoOverflow = async () => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "the prototype does not create horizontal viewport overflow",
  );
};
const assertCharacterGallery = async (viewport) => {
  const gallery = theatre().getByRole("region", {
    name: "SunSpots komplette karaktergalleri",
    exact: true,
  });
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toBeVisible();
  const cards = gallery.locator(".theatre-character-card");
  await expect(cards).toHaveCount(9);
  await expect(gallery.getByRole("img")).toHaveCount(9);
  const names = [];
  for (const card of await cards.all()) {
    await expect(card).toHaveRole("img");
    await expect(card).toHaveAccessibleName(/\S/);
    names.push(await card.getAttribute("aria-label"));
    await waitForIllustration(card.locator("img"), "sunspot-complete-cast.png");
  }
  assert.equal(new Set(names).size, 9, "each character has a distinct accessible name");
  assert.ok(
    await gallery.evaluate((region) => {
      const grid = region.querySelector(".theatre-character-grid");
      return grid && grid.scrollWidth <= grid.clientWidth;
    }),
    `all nine character cards fit the ${viewport} gallery width`,
  );
  await assertNoOverflow();
  await gallery.screenshot({
    path: `artifacts/visual-identity-character-gallery-${viewport}.png`,
  });
};
const assertTouchTarget = async (locator, name) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(
    box && box.width >= 44 && box.height >= 44,
    `${name} is at least 44×44px`,
  );
};
const assertMapAccessible = async () => {
  const share = await page.evaluate(() => {
    const map = document.querySelector(".leaflet-container");
    let exposed = 0;
    let sampled = 0;
    for (let y = 20; y < innerHeight - 20; y += 40) {
      for (let x = 20; x < innerWidth - 20; x += 40) {
        const hit = document.elementFromPoint(x, y);
        sampled += 1;
        if (map && hit && (hit === map || map.contains(hit))) exposed += 1;
      }
    }
    return sampled ? exposed / sampled : 0;
  });
  assert.ok(
    share >= 0.35,
    `the initial map remains directly usable (${Math.round(share * 100)}% exposed)`,
  );
};

try {
  await mkdir("artifacts", { recursive: true });
  for (const file of [
    ...scenes.map(([, filename]) => filename),
    "sunspot-cast.png",
    "sunspot-friends-trio.png",
    "sunspot-complete-cast.png",
  ]) {
    const response = await context.request.get(`${base}/illustrations/${file}`);
    assert.equal(response.status(), 200, `illustration ${file} is served`);
    assert.match(response.headers()["content-type"] || "", /^image\//);
    assert.ok(
      (await response.body()).length > 1024,
      `illustration ${file} has image content`,
    );
  }
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await expect(launcher()).toBeVisible();
  await assertTouchTarget(launcher(), "character theatre launcher");
  await assertNoOverflow();
  await assertMapAccessible();
  await waitForIllustration(page.locator(".paper-hero-scene"), "bench-sun.png");
  await waitForIllustration(launcher().locator("img"), "sunspot-cast.png");
  await page.screenshot({ path: "artifacts/visual-identity-mobile.png" });

  await launcher().click();
  await expect(theatre()).toBeVisible();
  const tabs = theatre().getByRole("tablist", { name: "Scener fra København" });
  await expect(tabs.getByRole("tab")).toHaveCount(5);
  for (const [name, filename] of scenes) {
    const tab = tabs.getByRole("tab", { name, exact: true });
    await assertTouchTarget(tab, `scene tab ${name}`);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const illustration = theatre().locator("[data-scene] img").first();
    await waitForIllustration(illustration, filename);
  }
  const firstTab = tabs.getByRole("tab", { name: scenes[0][0], exact: true });
  await tabs
    .getByRole("tab", { name: scenes.at(-1)[0], exact: true })
    .press("Home");
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
  await firstTab.press("ArrowRight");
  await expect(
    tabs.getByRole("tab", { name: scenes[1][0], exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  for (const name of ["Forrige scene", "Næste scene"])
    await assertTouchTarget(
      theatre().getByRole("button", { name, exact: true }),
      name,
    );

  const demo = theatre().getByRole("region", {
    name: "Golden Hour-eksempel",
    exact: true,
  });
  await expect(demo).toHaveAttribute("data-demo", "true");
  await expect(demo).toContainText(provenance);
  await expect(demo).toContainText("Café Stefanshus");
  await expect(demo).toContainText(/60\s*min|1\s*time/i);
  await expect(demo).toContainText(/10(?:[,.]00)?\s*(?:kr|DKK)/i);
  const claim = demo.getByRole("button", {
    name: "Prøv eksempelkuponen",
    exact: true,
  });
  await demo.getByRole("button", { name: "Overskyet", exact: true }).click();
  await expect(claim).toBeDisabled();
  await expect(
    demo.getByRole("button", { name: "Overskyet", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await demo.getByRole("button", { name: "Solskin", exact: true }).click();
  await expect(claim).toBeEnabled();
  for (const name of ["Overskyet", "Solskin", "Prøv eksempelkuponen"])
    await assertTouchTarget(
      demo.getByRole("button", { name, exact: true }),
      name,
    );
  await claim.click();
  await expect(
    demo.getByRole("timer", { name: "Tid tilbage på eksempelkuponen" }),
  ).toHaveText(/^(60:00|59:\d{2})$/);
  await expect(demo).toContainText(provenance);
  await assertTouchTarget(
    demo.getByRole("button", { name: "Nulstil eksempel", exact: true }),
    "example reset",
  );
  await demo
    .getByRole("button", { name: "Nulstil eksempel", exact: true })
    .click();
  await expect(claim).toBeEnabled();
  assert.deepEqual(
    claimRequests,
    [],
    "the example never requests an actual offer claim",
  );
  await expect
    .poll(() =>
      theatre().evaluate(
        (dialog) =>
          dialog
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  await assertNoOverflow();
  await waitForIllustration(theatre().locator(".theatre-stage img"));
  await waitForIllustration(
    demo.locator(".theatre-example-picture img"),
    "golden-hour-friends.png",
  );
  await page.screenshot({
    path: "artifacts/visual-identity-theatre-mobile.png",
  });
  await page.keyboard.press("Escape");
  await expect(theatre()).toHaveCount(0);
  await expect(launcher()).toBeFocused();
  await assertMapAccessible();

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow();
  await assertMapAccessible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await launcher().click();
  await expect(theatre()).toBeVisible();
  await assertNoOverflow();
  await theatre().locator(".theatre-stage").scrollIntoViewIfNeeded();
  await waitForIllustration(
    theatre().locator(".theatre-stage img"),
    "bench-sun.png",
  );
  await page.screenshot({
    path: "artifacts/visual-identity-theatre-desktop.png",
  });
  await assertCharacterGallery("desktop");
  await page.setViewportSize({ width: 390, height: 667 });
  await assertCharacterGallery("mobile");
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "eight illustration assets including the complete nine-character atlas",
        "nine individually named characters decoded without overflow on desktop and mobile",
        "five accessible scenes",
        "keyboard scene navigation",
        "clearly simulated notification and ticket",
        "no real offer claim requests",
        "44px new touch controls",
        "reduced motion",
        "mobile map access and overflow",
        "dialog return to map",
      ],
    }),
  );
} finally {
  await browser.close();
}
