import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const scenes = [
  ["Bænken i solen", "bench-sun.png"],
  ["Vestegnen på tur", "vestegnen.png"],
  ["Den sidste solplet", "tiny-sun-patch.png"],
  ["Efter solen", "chasing-sun.png"],
  ["Golden Hour", "golden-hour-friends.png"],
];
const provenance = "EKSEMPEL · simuleret sol, vejr og tilbud";
const poses = ["beer-seated", "cocktail-seated", "cloud-angry", "rain-bag", "cycling"];
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 667 },
  reducedMotion: "reduce",
});
await context.addCookies([{ name: "sunspot-language", value: "da", url: base }]);
const page = await context.newPage();
await page.clock.setSystemTime(new Date("2026-10-28T11:00:00Z"));
await context.route("**/api/weather", (route) => route.fulfill({
  json: {
    available: true,
    stale: false,
    timeseries: [{
      time: "2026-10-28T11:00:00Z",
      data: {
        instant: { details: { air_temperature: 12, cloud_area_fraction: 100 } },
        next_1_hours: { summary: { symbol_code: "cloudy" }, details: { precipitation_amount: 0 } },
      },
    }],
  },
}));
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
  assert.equal(
    await gallery.locator(".theatre-character-grid").evaluate(
      (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
    ),
    viewport === "mobile" ? 2 : 3,
    `the ${viewport} gallery has the expected column count`,
  );
  const names = [];
  for (const [index, card] of (await cards.all()).entries()) {
    await expect(card).toHaveRole("img");
    await expect(card).toHaveAccessibleName(/\S/);
    names.push(await card.getAttribute("aria-label"));
    await waitForIllustration(card.locator("img"), "sunspot-complete-cast.png");
    const atlas = await card.locator("img").evaluate((img, cell) => {
      const portrait = img.parentElement;
      const frame = portrait.getBoundingClientRect();
      const image = img.getBoundingClientRect();
      const style = getComputedStyle(portrait);
      const width = frame.width - portrait.clientLeft - parseFloat(style.borderRightWidth);
      const height = frame.height - portrait.clientTop - parseFloat(style.borderBottomWidth);
      const close = (actual, expected) => Math.abs(actual - expected) < 1;
      return close(image.width, width * 3) &&
        close(image.height, height * 3) &&
        close(image.left - frame.left - portrait.clientLeft, -(cell % 3) * width) &&
        close(image.top - frame.top - portrait.clientTop, -Math.floor(cell / 3) * height);
    }, index);
    assert.ok(atlas, `character ${index + 1} shows its exact atlas cell`);
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
const assertSearchAccessible = async () => {
  const submit = page.locator(".finder-submit");
  await expect(submit).toBeInViewport({ ratio: 1 });
  assert.ok(
    await submit.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      ));
    }),
    "the initial search button is unobstructed before any scrolling",
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
    "sunspot-cutout-cast.png",
    ...poses.map((pose) => `poses/${pose}.png`),
  ]) {
    const response = await context.request.get(`${base}/illustrations/${file}`);
    assert.equal(response.status(), 200, `illustration ${file} is served`);
    assert.match(response.headers()["content-type"] || "", /^image\//);
    const image = await response.body();
    assert.ok(
      image.length > 1024,
      `illustration ${file} has image content`,
    );
    if (file === "sunspot-complete-cast.png" || file === "sunspot-cutout-cast.png") {
      assert.equal(image.readUInt32BE(16), 1024, "the PNG atlas is 1024px wide");
      assert.equal(image.readUInt32BE(20), 1536, "the PNG atlas is 1536px high");
    }
    if (file === "sunspot-cutout-cast.png" || file.startsWith("poses/")) {
      const alpha = await sharp(image).extractChannel("alpha").raw().toBuffer();
      assert.ok(
        alpha.filter((value) => value === 0).length / alpha.length >= 0.25,
        `${file} has a substantial fully transparent background`,
      );
      assert.ok(
        alpha.filter((value) => value >= 250).length / alpha.length >= 0.1,
        `${file} retains substantial opaque character artwork`,
      );
    }
  }
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  const hero = page.locator('.experience-hero[data-experience="weather.cloud"]');
  await expect(hero).toBeVisible();
  const heroCharacters = hero.locator(".cast-character");
  await expect(heroCharacters).toHaveCount(1);
  assert.deepEqual(
    await heroCharacters.evaluateAll((characters) =>
      characters.map((character) => [
        character.dataset.character,
        character.dataset.pose,
      ]),
    ),
    [["blue-shirt", "cloud-angry"]],
    "documented overcast weather selects the single angry blue-shirt character",
  );
  await expect(hero.locator('.character-scene[data-moment="weather.cloud"]')).toHaveCount(1);
  await expect(hero.locator(".character-weather-prop")).toHaveCount(1);
  for (const character of await heroCharacters.all()) {
    await expect(character).toHaveAttribute("aria-hidden", "true");
    assert.equal(
      await character.evaluate((element) => getComputedStyle(element).pointerEvents),
      "none",
      "decorative characters do not intercept pointer input",
    );
    await waitForIllustration(character.locator("img"), "cloud-angry.png");
  }
  await assertSearchAccessible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await assertSearchAccessible();
  await page.setViewportSize({ width: 390, height: 667 });
  await expect(launcher()).toBeVisible();
  await assertTouchTarget(launcher(), "character theatre launcher");
  await assertNoOverflow();
  await assertMapAccessible();
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
    "beer-seated.png",
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
        "illustration assets including paper and transparent atlases and five transparent poses",
        "one weather-driven hero character and an unobstructed search button",
        "nine named characters in exact atlas cells, three desktop and two mobile columns",
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
