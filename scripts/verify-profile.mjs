import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const base = process.env.SUNSPOT_URL || "http://localhost:4175";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const host = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "sv-SE",
  storageState: process.env.SUNSPOT_STORAGE_STATE || undefined,
});
const guest = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "da-DK",
});
const p = await host.newPage(),
  g = await guest.newPage();
const errors = [];
for (const page of [p, g]) page.on("pageerror", (e) => errors.push(e.message));
const fixture = await sharp({
  create: { width: 600, height: 400, channels: 3, background: "#567ea9" },
})
  .png()
  .toBuffer();
try {
  await host.addInitScript(() => {
    localStorage.setItem("sunspot:language", "sv");
    window.shares = [];
    Object.defineProperty(navigator, "share", {
      value: async (data) => window.shares.push(data),
      configurable: true,
    });
  });
  await p.goto(base);
  await p.getByRole("link", { name: "Min profil", exact: true }).click();
  await expect(p.getByRole("heading", { name: "Min profil." })).toBeVisible();
  await p.getByLabel("Ditt förnamn").fill("Carl Profile QA");
  await p.getByLabel("Ladda upp profilbild").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: fixture,
  });
  await expect(
    p.getByRole("button", { name: "Byt bild", exact: true }),
  ).toBeEnabled();
  await p.getByRole("button", { name: "Kaffe", exact: true }).click();
  await p.getByRole("button", { name: "Spara profil", exact: true }).click();
  await expect(p.getByRole("status")).toContainText("Klart!");
  await p.reload();
  await expect(p.getByLabel("Ditt förnamn")).toHaveValue("Carl Profile QA");
  await expect(
    p.getByRole("button", { name: "Kaffe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(p.locator(".profile-photo-button img")).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await p.screenshot({ path: "artifacts/profile-mobile.png", fullPage: true });
  await p.getByLabel("Ladda upp profilbild").setInputFiles({
    name: "fake.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(p.locator(".profile-card").getByRole("alert")).toHaveText(
    "Välj en JPG-, PNG- eller WebP-bild.",
  );
  await expect(p.locator(".profile-photo-button img")).toBeVisible();
  await p.getByRole("link", { name: "Till kartan", exact: true }).click();
  await p.getByRole("button", { name: "Alla", exact: true }).click();
  await p.getByLabel("Sök plats eller område").fill("Kayak");
  await p.getByRole("button", { name: "Visa Kayak Bar", exact: true }).click();
  await p
    .getByRole("button", { name: "Jag är här – kom!", exact: true })
    .click();
  const dialog = p.getByRole("dialog");
  await expect(dialog.getByLabel("Ditt förnamn")).toHaveValue(
    "Carl Profile QA",
  );
  await expect(
    dialog.getByRole("button", { name: "Kaffe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator("img")).toBeVisible();
  await dialog.getByRole("button", { name: "Skapa häng", exact: true }).click();
  await p.waitForURL("**/hang/**");
  await p.getByRole("button", { name: "Dela med vänner" }).click();
  const share = (await p.evaluate(() => window.shares))[0];
  const path = new URL(share.url).pathname;
  await g.goto(
    process.env.SUNSPOT_GUEST_ORIGIN
      ? `${process.env.SUNSPOT_GUEST_ORIGIN}${path}`
      : share.url,
  );
  const hostPhoto = g.locator(".hang-avatars img").first();
  await expect(hostPhoto).toBeVisible();
  await expect
    .poll(() => hostPhoto.evaluate((img) => img.naturalWidth))
    .toBe(192);
  await g.getByRole("link", { name: "Min profil", exact: true }).click();
  await g.getByLabel("Dit fornavn").fill("Anna Profile QA");
  await g.getByLabel("Upload profilbillede").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: fixture,
  });
  await expect(g.getByRole("button", { name: "Gem profil" })).toBeEnabled();
  await g.getByRole("button", { name: "Gem profil" }).click();
  await expect(g.getByRole("status")).toBeVisible();
  await g
    .getByRole("link", { name: "Tilbage til aftalen", exact: true })
    .first()
    .click();
  await g.getByRole("button", { name: "Jeg kommer", exact: true }).click();
  await expect(g.getByLabel("Dit fornavn")).toHaveValue("Anna Profile QA");
  await g.getByRole("button", { name: "Jeg kommer", exact: true }).click();
  await expect(g.getByText("Du kommer. Vi ses der!")).toBeVisible();
  await p.reload();
  await expect(p.locator(".hang-avatars img")).toHaveCount(2);
  await expect
    .poll(() =>
      p
        .locator(".hang-avatars img")
        .last()
        .evaluate((img) => img.naturalWidth),
    )
    .toBe(192);
  await g.screenshot({ path: "artifacts/profile-invitation-mobile.png" });
  await g.getByRole("link", { name: "Min profil", exact: true }).click();
  await g.getByLabel("Sprog").selectOption("en");
  await expect(g.getByRole("heading", { name: "My profile." })).toBeVisible();
  await g.getByRole("button", { name: "Remove photo" }).click();
  await g.getByRole("button", { name: "Save profile" }).click();
  await g.reload();
  await expect(g.locator(".profile-photo-button img")).toHaveCount(0);
  await g.setViewportSize({ width: 320, height: 667 });
  assert.ok(
    await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await g.screenshot({
    path: "artifacts/profile-small-en.png",
    fullPage: true,
  });
  await p.getByRole("button", { name: "Avsluta hänget", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Ja, avsluta hänget", exact: true })
    .click();
  await expect(
    p.getByText("Hänget är avslutat", { exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        pass: true,
        checks: [
          "upload and validation",
          "profile persistence",
          "name and activity prefill",
          "public host and guest photos",
          "remove photo",
          "three languages",
          "320px layout",
        ],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
