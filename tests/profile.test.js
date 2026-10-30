import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeProfilePhoto } from "../server/profile-photo.js";
import { profileReturn } from "../src/profile.js";
import { createHangApi } from "../server/hangs.js";
import { sqliteHangStore } from "../server/hang-store.js";
const jpeg = async () =>
  `data:image/jpeg;base64,${(
    await sharp({
      create: { width: 300, height: 220, channels: 3, background: "#567ea9" },
    })
      .jpeg()
      .withMetadata()
      .toBuffer()
  ).toString("base64")}`;
test("photos become small JPEGs without original metadata; invalid image input is rejected", async () => {
  const normalized = await normalizeProfilePhoto(await jpeg());
  const info = await sharp(Buffer.from(normalized, "base64")).metadata();
  assert.equal(info.width, 192);
  assert.equal(info.height, 192);
  assert.equal(info.exif, undefined);
  assert.equal(info.icc, undefined);
  assert.equal(await normalizeProfilePhoto(null), null);
  for (const input of [
    "https://evil.example/photo",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/jpeg;base64,ZmFrZQ==",
    "data:image/jpeg;base64," + "a".repeat(25000),
  ])
    await assert.rejects(normalizeProfilePhoto(input), (e) => e.status === 400);
});
test("profile return path stays inside app, including malformed and cross-origin input", () => {
  assert.equal(
    profileReturn("/hang/" + "a".repeat(32)),
    "/hang/" + "a".repeat(32),
  );
  assert.equal(profileReturn("/hangs"), "/hangs");
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/profile",
    "/hang/../api",
    null,
    ["/"],
  ])
    assert.equal(profileReturn(value), "/");
});
test("host and guest photos are public only under their invitation, survive extension and disappear on withdrawal/expiry", async (t) => {
  const store = await sqliteHangStore();
  t.after(() => store.close());
  const handle = createHangApi({ store });
  const host = "h".repeat(64),
    guest = "g".repeat(64);
  const call = (path, body, token = host) =>
    handle(
      new Request(`https://sunspot.test/api/hangs${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin: "https://sunspot.test",
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  const data = await jpeg();
  let r = await call("", {
    host: "Carl",
    photo: data,
    activity: "beer",
    placeId: "kayak-bar",
    duration: 90,
  });
  assert.equal(r.status, 201);
  let h = await r.json();
  assert.ok(h.hostPhoto);
  assert.doesNotMatch(JSON.stringify(h), /base64|Exif/);
  const image = await call(h.hostPhoto.replace("/api/hangs", ""));
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.equal(image.headers.get("cache-control"), "no-store");
  assert.ok((await image.arrayBuffer()).byteLength > 0);
  h = await (
    await call(
      `/${h.id}/rsvp`,
      { coming: true, name: "Anna", photo: data },
      guest,
    )
  ).json();
  const photo = h.guests[0].photo;
  assert.ok(photo);
  assert.equal((await call(photo.replace("/api/hangs", ""))).status, 200);
  await call(`/${h.id}/extend`, { endsAt: h.endsAt + 1800000 });
  assert.equal((await call(photo.replace("/api/hangs", ""))).status, 200);
  await call(`/${h.id}/rsvp`, { coming: false }, guest);
  assert.equal((await call(photo.replace("/api/hangs", ""))).status, 404);
  const raw = await store.get(h.id);
  await store.swap(h.id, raw, raw, Date.now() - 1);
  assert.equal((await call(h.hostPhoto.replace("/api/hangs", ""))).status, 404);
});
