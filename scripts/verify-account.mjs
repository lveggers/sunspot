import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.SUNSPOT_URL || "http://localhost:4175";
if (new URL(base).hostname !== "localhost")
  throw Error("Synthetic sessions may only be used on localhost");
const config = JSON.parse(
  await readFile(".data/auth-test-config.json", "utf8"),
);
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH,
});
const cookie = "authjs.session-token";
const contexts = [];
async function device(id) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "sv-SE",
  });
  contexts.push(context);
  if (id) {
    const value = await encode({
      secret: config.AUTH_SECRET,
      salt: cookie,
      token: {
        sub: id.repeat(64),
        name: id === "a" ? "Google Anna" : "Google Bea",
        email: `${id}@example.test`,
      },
    });
    await context.addCookies([
      { name: cookie, value, url: base, httpOnly: true, sameSite: "Lax" },
    ]);
  }
  await context.addInitScript(() =>
    localStorage.setItem("sunspot:language", "sv"),
  );
  return context;
}
try {
  const a = await device("a"),
    second = await device("a"),
    b = await device("b"),
    anonymous = await device();
  const p = await a.newPage(),
    p2 = await second.newPage(),
    other = await b.newPage(),
    guest = await anonymous.newPage();
  const errors = [];
  for (const page of [p, p2, other, guest])
    page.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${base}/profile`);
  await expect(
    p.getByText("Inloggad med Google", { exact: true }),
  ).toBeVisible();
  await p.getByLabel("Ditt förnamn").fill("Anna account QA");
  const coffee = p.getByRole("button", { name: "Kaffe", exact: true });
  if ((await coffee.getAttribute("aria-pressed")) !== "true")
    await coffee.click();
  const photo = await sharp({
    create: { width: 300, height: 300, channels: 3, background: "#9abaff" },
  })
    .png()
    .toBuffer();
  await p
    .getByLabel("Ladda upp profilbild")
    .setInputFiles({
      name: "account-qa.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await expect(
    p.getByRole("button", { name: "Byt bild", exact: true }),
  ).toBeEnabled();
  await p.getByRole("button", { name: "Spara profil", exact: true }).click();
  await expect(p.getByRole("status")).toContainText("Klart!");
  await p2.goto(`${base}/profile`);
  await expect(p2.getByLabel("Ditt förnamn")).toHaveValue("Anna account QA");
  await expect(
    p2.getByRole("button", { name: "Kaffe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(p2.locator(".profile-photo-button img")).toBeVisible();
  await other.goto(`${base}/profile`);
  await expect(other.getByLabel("Ditt förnamn")).toHaveValue("Google Bea");
  await guest.goto(`${base}/profile`);
  await expect(guest.getByLabel("Ditt förnamn")).toHaveValue("");
  await expect(
    guest.getByRole("button", { name: "Fortsätt med Google" }),
  ).toBeEnabled();
  const unauthorized = await anonymous.request.put(`${base}/api/account`, {
    headers: { origin: base },
    data: {
      name: "intruder",
      activity: "beer",
      photo: null,
      id: "a".repeat(64),
    },
  });
  assert.equal(unauthorized.status(), 401);
  const forgery = await a.request.put(`${base}/api/account`, {
    headers: { origin: "https://evil.test" },
    data: { name: "intruder", activity: "beer", photo: null },
  });
  assert.equal(forgery.status(), 403);
  // Observe the real Auth.js sign-in redirect without visiting Google using fake credentials.
  let authorization;
  await guest.route("https://accounts.google.com/**", (route) => {
    authorization = new URL(route.request().url());
    return route.fulfill({
      contentType: "text/plain",
      body: "OAuth navigation intercepted for local QA",
    });
  });
  await guest.getByRole("button", { name: "Fortsätt med Google" }).click();
  await expect.poll(() => authorization?.hostname).toBe("accounts.google.com");
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    `${base}/api/auth/callback/google`,
  );
  assert.ok(authorization.searchParams.get("code_challenge"));
  assert.equal(authorization.searchParams.get("scope"), "openid email profile");
  await mkdir("artifacts", { recursive: true });
  await p.screenshot({ path: "artifacts/account-mobile.png", fullPage: true });
  await p.getByRole("button", { name: "Logga ut", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Fortsätt med Google" }),
  ).toBeVisible();
  await expect(p.getByLabel("Ditt förnamn")).toHaveValue("");
  assert.equal(
    (await a.request.get(`${base}/api/account`).then((r) => r.json())).user,
    null,
  );
  await p.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two-device profile sync, account isolation, anonymous access, CSRF, OAuth/PKCE initiation, sign-out, 320px layout; real Google consent still requires live verification.",
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
}
