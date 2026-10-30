import test from "node:test";
import assert from "node:assert/strict";
import { createAccountApi, googlePhoto } from "../server/account.js";
import { sqliteHangStore } from "../server/hang-store.js";

test("Google account API isolates users, persists profile and never trusts an input identity", async (t) => {
  const store = await sqliteHangStore();
  t.after(() => store.close());
  let user = null;
  const handle = createAccountApi({
    getSession: async () => ({ user }),
    getStore: async () => store,
    photo: async () => null,
  });
  const call = (value, origin = "https://sunspot.test") =>
    handle(
      new Request("https://sunspot.test/api/account", {
        method: value ? "PUT" : "GET",
        headers: { origin, "content-type": "application/json" },
        body: value ? JSON.stringify(value) : undefined,
      }),
    );
  assert.deepEqual(await (await call()).json(), { enabled: true, user: null });
  const input = {
    name: "Carl",
    photo: null,
    activity: "beer",
    id: "b".repeat(64),
    expectedUserId: "a".repeat(64),
  };
  assert.equal((await call(input)).status, 401);
  user = {
    id: "a".repeat(64),
    name: "Google name",
    email: "host@example.test",
  };
  assert.equal((await (await call()).json()).profile.name, "Google name");
  assert.equal((await call(input, "https://evil.test")).status, 403);
  assert.equal(
    (await call({ ...input, expectedUserId: "b".repeat(64) })).status,
    409,
  );
  assert.equal((await call(input)).status, 200);
  assert.equal((await (await call()).json()).profile.name, "Carl");
  assert.equal(await store.get("b".repeat(64)), null);
  user = {
    id: "b".repeat(64),
    name: "Other user",
    email: "other@example.test",
  };
  assert.equal((await (await call()).json()).profile.name, "Other user");
  user = { id: "a".repeat(64), name: "Changed at Google" };
  const response = await call();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).profile.name, "Carl");
  assert.equal((await call({ ...input, name: "" })).status, 400);
  assert.equal(
    (await call({ ...input, photo: "https://evil.test/image" })).status,
    400,
  );
  assert.equal((await call({ ...input, activity: "invalid" })).status, 400);
  assert.equal((await call({ ...input, name: "a".repeat(40000) })).status, 413);
  user = null;
  assert.equal((await call(input)).status, 401);
});

test("concurrent account initialization preserves the winning stored profile", async (t) => {
  const store = await sqliteHangStore();
  t.after(() => store.close());
  const handle = createAccountApi({
    getSession: async () => ({ user: { id: "c".repeat(64), name: "Anna" } }),
    getStore: async () => store,
    photo: async () => null,
  });
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      handle(new Request("https://sunspot.test/api/account")),
    ),
  );
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(JSON.parse(await store.get("c".repeat(64))).name, "Anna");
});

test("missing configuration leaves the anonymous app available and fails writes honestly", async () => {
  const handle = createAccountApi({
    enabled: () => false,
    getSession: () => {
      throw Error("must not authenticate");
    },
    getStore: () => {
      throw Error("must not read storage");
    },
  });
  assert.deepEqual(
    await (
      await handle(new Request("https://sunspot.test/api/account"))
    ).json(),
    { enabled: false, user: null },
  );
  assert.equal(
    (
      await handle(
        new Request("https://sunspot.test/api/account", { method: "PUT" }),
      )
    ).status,
    503,
  );
});

test("Google photo import refuses arbitrary URLs without fetching them", async () => {
  for (const url of [
    "http://localhost/image",
    "https://lh3.googleusercontent.com.evil.test/image",
    "https://evil.test",
    "https://lh3.googleusercontent.com:123/image",
    "https://user@lh3.googleusercontent.com/image",
    null,
  ])
    assert.equal(await googlePhoto(url), null);
});
