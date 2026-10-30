import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
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
await host.addInitScript(() => {
  localStorage.setItem("sunspot:language", "sv");
  window.shares = [];
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async (data) => {
      window.shares.push({
        ...data,
        activation: navigator.userActivation.isActive,
      });
      if (window.cancelShare) throw new DOMException("Cancelled", "AbortError");
    },
  });
});
try {
  await p.route("**/api/events?**", (r) =>
    r.fulfill({ json: { events: [], available: true, stale: false } }),
  );
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p
    .locator('.map-workspace[data-solar-pending="false"]')
    .waitFor({ timeout: 45000 });
  await p.getByRole("button", { name: "Alla", exact: true }).click();
  await p.getByLabel("Sök plats eller område").fill("Kayak");
  await p.getByRole("button", { name: "Visa Kayak Bar", exact: true }).click();
  await p
    .getByRole("button", { name: "Jag är här – kom!", exact: true })
    .click();
  const modal = p.getByRole("dialog", { name: "Bjud in till ett häng" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Ditt förnamn").fill("Carl QA");
  await modal.getByRole("button", { name: "En öl", exact: true }).click();
  await mkdir("artifacts", { recursive: true });
  await p.screenshot({ path: "artifacts/hang-create-mobile.png" });
  let lostCreation = null;
  await p.route("**/api/hangs", async (route) => {
    if (!lostCreation) {
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      lostCreation = await response.json();
      await route.abort("failed");
    } else await route.continue();
  });
  await modal.getByRole("button", { name: "Skapa häng", exact: true }).click();
  await expect(modal.getByRole("alert")).toBeVisible();
  await modal.getByRole("button", { name: "Stäng", exact: true }).click();
  await p
    .getByRole("button", { name: "Jag är här – kom!", exact: true })
    .click();
  await expect(modal.getByLabel("Ditt förnamn")).toHaveValue("Carl QA");
  await expect(modal.getByLabel("Ditt förnamn")).toBeDisabled();
  await modal.getByRole("button", { name: "Skapa häng", exact: true }).click();
  await p.waitForURL("**/hang/**");
  await expect(p.getByRole("button", { name: "Dela med vänner" })).toBeVisible({
    timeout: 15000,
  });
  await p.getByRole("button", { name: "Dela med vänner" }).click();
  const share = (await p.evaluate(() => window.shares))[0];
  assert.ok(share.activation);
  assert.match(share.text, /Carl QA.*Kayak Bar/);
  assert.doesNotMatch(share.url, /_vercel_share|token|localhost.*vercel/);
  const id = new URL(share.url).pathname.split("/").pop();
  assert.equal(
    id,
    lostCreation.id,
    "lost creation response must recover the same hangout",
  );
  const guestUrl = process.env.SUNSPOT_GUEST_ORIGIN
    ? `${process.env.SUNSPOT_GUEST_ORIGIN}/hang/${id}`
    : share.url;
  await p.evaluate(() => (window.cancelShare = true));
  await p.getByRole("button", { name: "Dela med vänner" }).click();
  await expect(p.locator("textarea")).toHaveCount(0);
  const requests = [];
  g.on("request", (r) => requests.push(r.url()));
  await g.goto(guestUrl, { waitUntil: "domcontentloaded" });
  await expect(g.getByRole("heading", { name: "Kayak Bar." })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    g.getByRole("button", { name: "Jeg kommer", exact: true }),
  ).toBeVisible();
  assert.ok(
    !requests.some((u) => /buildings|solar-worker|leaflet/.test(u)),
    "recipient does not load map data",
  );
  await g.screenshot({ path: "artifacts/hang-guest-mobile-da.png" });
  await g.getByRole("button", { name: "Jeg kommer", exact: true }).click();
  await g.getByRole("button", { name: "Annuller", exact: true }).click();
  await expect(g.getByLabel("Dit fornavn")).toHaveCount(0);
  await g.getByRole("button", { name: "Jeg kommer", exact: true }).click();
  await g.getByLabel("Dit fornavn").fill("Anna QA");
  await g.getByRole("button", { name: "Jeg kommer", exact: true }).click();
  await expect(g.getByText("Du kommer. Vi ses der!")).toBeVisible({
    timeout: 15000,
  });
  await g.reload();
  await expect(g.getByText("Du kommer. Vi ses der!")).toBeVisible();
  await p.reload();
  await expect(p.getByText("Anna QA kommer", { exact: true })).toBeVisible();
  const before = await p.locator(".hang-time").innerText();
  await p.getByRole("button", { name: "Vi stannar 30 min till" }).click();
  await expect(p.locator(".hang-time")).not.toHaveText(before, {
    timeout: 10000,
  });
  await p.screenshot({ path: "artifacts/hang-host-mobile.png" });
  await g.getByLabel("Sprog").selectOption("en");
  await expect(g.getByRole("link", { name: "Get directions" })).toHaveAttribute(
    "href",
    /google.com\/maps\/search/,
  );
  await g.getByRole("button", { name: "I can’t make it" }).click();
  await expect(
    g.getByRole("button", { name: "I’m coming", exact: true }),
  ).toBeVisible();
  await g.setViewportSize({ width: 320, height: 667 });
  assert.equal(
    await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await g.screenshot({ path: "artifacts/hang-guest-small-en.png" });
  await p.getByRole("link", { name: "Min profil", exact: true }).click();
  await expect(
    p.getByRole("link", { name: "Till hänget", exact: true }),
  ).toHaveAttribute("href", `/hang/${id}`);
  await p.getByRole("link", { name: "Din integritet", exact: true }).click();
  await p.getByRole("link", { name: "English", exact: true }).click();
  await expect(
    p.getByRole("link", { name: "Back to profile" }),
  ).toHaveAttribute(
    "href",
    `/profile?returnTo=${encodeURIComponent(`/hang/${id}`)}`,
  );
  await p.getByRole("link", { name: "Back to profile" }).click();
  await p.getByRole("link", { name: "Till hänget", exact: true }).click();
  await p
    .getByRole("navigation")
    .getByRole("link", { name: "Mina häng", exact: true })
    .click();
  const activeRow = p.locator(".recent-hang").filter({ hasText: "Kayak Bar" });
  await expect(activeRow).toContainText("Du är värd");
  await p.screenshot({
    path: "artifacts/hangs-overview-mobile.png",
    fullPage: true,
  });
  await activeRow.click();
  await p.getByRole("button", { name: "Avsluta hänget", exact: true }).click();
  const confirm = p.getByRole("dialog", { name: "Avsluta hänget?" });
  await expect(
    confirm.getByRole("button", { name: "Fortsätt hänga" }),
  ).toBeFocused();
  await p.screenshot({ path: "artifacts/hang-end-confirm-mobile.png" });
  await confirm.getByRole("button", { name: "Fortsätt hänga" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(
    p.getByRole("button", { name: "Dela med vänner" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Avsluta hänget", exact: true }).click();
  await p.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await p.getByRole("button", { name: "Avsluta hänget", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Ja, avsluta hänget", exact: true })
    .click();
  await expect(p.getByText("Hänget är avslutat", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await g.reload();
  await expect(
    g.getByText("This hangout has ended", { exact: true }),
  ).toBeVisible();
  await expect(
    g.getByRole("button", { name: "I’m coming", exact: true }),
  ).toHaveCount(0);
  await g
    .getByRole("navigation")
    .getByRole("link", { name: "My hangouts", exact: true })
    .click();
  await expect(g.locator(".past-hangs")).toBeVisible();
  await g.locator(".past-hangs summary").click();
  await expect(g.locator(".past-hangs .recent-hang")).toContainText("Ended");
  await g.locator(".past-hangs .recent-hang").click();
  await expect(
    g.getByText("This hangout has ended", { exact: true }),
  ).toBeVisible();
  await g.goto(new URL(`/hang/${"f".repeat(32)}`, guestUrl).href);
  await expect(
    g.getByText("This hangout is no longer available.", { exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        pass: true,
        flow: "map → create → share → anonymous guest → RSVP → host → extend → withdraw → end",
        languages: ["sv", "da", "en"],
        consoleErrors: errors,
        guestUrl,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
