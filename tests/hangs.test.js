import test from "node:test";
import assert from "node:assert/strict";
import { createHangApi } from "../server/hangs.js";
import { sqliteHangStore } from "../server/hang-store.js";
const host = "h".repeat(64),
  anna = "a".repeat(64),
  lukas = "l".repeat(64);
async function setup(t, opts = {}) {
  const store = await sqliteHangStore();
  t.after(() => store.close());
  let time = Date.now();
  const api = createHangApi({
    store,
    now: () => time,
    publicOrigin: "https://hang.example",
    ...opts,
  });
  const call = async (
    path = "",
    body,
    secret = host,
    origin = "https://private.example",
  ) => {
    const res = await api(
      new Request(`https://private.example/api/hangs${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin,
          "Content-Type": "application/json",
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    return { status: res.status, data: await res.json(), headers: res.headers };
  };
  const create = () =>
    call("", {
      placeId: "kayak-bar",
      host: "Carl",
      activity: "beer",
      duration: 90,
    });
  return {
    call,
    create,
    advance: (ms) => {
      time += ms;
    },
    store,
  };
}
test("public link omits secrets; guests join across clients and host alone controls timing", async (t) => {
  const { call, create } = await setup(t);
  const first = await create();
  assert.equal(first.status, 201);
  const h = first.data;
  assert.equal(h.url, `https://hang.example/hang/${h.id}`);
  assert.equal(h.isHost, true);
  assert.equal(h.status, "active");
  const guest = await call(`/${h.id}`, undefined, "");
  assert.equal(guest.data.isHost, false);
  assert.equal(guest.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(
    JSON.stringify(guest.data),
    /hostHash|_vercel_share|hhhhhh/,
  );
  const joined = await call(
    `/${h.id}/rsvp`,
    { name: "Anna", coming: true },
    anna,
  );
  assert.equal(joined.data.joined, true);
  assert.equal((await call(`/${h.id}`)).data.guests[0].name, "Anna");
  assert.equal((await call(`/${h.id}/close`, {}, anna)).status, 403);
  assert.equal(
    (await call(`/${h.id}/extend`, { endsAt: h.endsAt + 1800000 }, anna))
      .status,
    403,
  );
  const extended = await call(`/${h.id}/extend`, {
    endsAt: h.endsAt + 1800000,
  });
  assert.equal(extended.status, 200);
  assert.equal(
    (await call(`/${h.id}/extend`, { endsAt: h.endsAt + 1800000 })).data.endsAt,
    extended.data.endsAt,
  );
  await call(`/${h.id}/close`, {});
  assert.equal((await call(`/${h.id}`)).data.status, "ended");
  assert.equal(
    (await call(`/${h.id}/rsvp`, { coming: true, name: "Lukas" }, lukas))
      .status,
    410,
  );
});
test("creation and RSVP retries are idempotent and concurrent guests do not overwrite", async (t) => {
  const { call, create } = await setup(t);
  const h = (await create()).data;
  assert.equal((await create()).data.id, h.id);
  const replies = await Promise.all([
    call(`/${h.id}/rsvp`, { name: "Anna", coming: true }, anna),
    call(`/${h.id}/rsvp`, { name: "Lukas", coming: true }, lukas),
  ]);
  assert.ok(replies.every((r) => r.status === 200));
  assert.equal((await call(`/${h.id}`)).data.guests.length, 2);
  await call(`/${h.id}/rsvp`, { name: "Anna", coming: true }, anna);
  assert.equal((await call(`/${h.id}`)).data.guests.length, 2);
  await call(`/${h.id}/rsvp`, { coming: false }, anna);
  const remaining = (await call(`/${h.id}`)).data.guests;
  assert.deepEqual(
    remaining.map((g) => g.name),
    ["Lukas"],
  );
});
test("expiry is enforced by server even if client says active", async (t) => {
  const { call, create, advance } = await setup(t);
  const h = (await create()).data;
  advance(91 * 60000);
  assert.equal((await call(`/${h.id}`)).data.status, "ended");
  assert.equal(
    (await call(`/${h.id}/rsvp`, { coming: true, name: "Anna" }, anna)).status,
    410,
  );
  assert.equal(
    (await call(`/${h.id}/extend`, { endsAt: h.endsAt + 1800000 })).status,
    410,
  );
});
test("scheduled hangs, bounded durations and untrusted input", async (t) => {
  const { call } = await setup(t);
  const future = Date.now() + 86400000;
  const h = (
    await call("", {
      placeId: "kayak-bar",
      host: " Carl ",
      activity: "coffee",
      duration: 30,
      startsAt: future,
    })
  ).data;
  assert.equal(h.status, "scheduled");
  assert.equal(h.host, "Carl");
  assert.equal(
    (
      await call(
        "",
        { placeId: "fake", host: "A", activity: "beer", duration: 90 },
        anna,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "",
        {
          placeId: "kayak-bar",
          host: "<script>",
          activity: "beer",
          duration: 90,
        },
        anna,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "",
        { placeId: "kayak-bar", host: "A", activity: "beer", duration: 100000 },
        anna,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `/${h.id}/rsvp`,
        { coming: true, name: "Anna" },
        anna,
        "https://evil.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call(`/${h.id}/rsvp`, { coming: true, name: "Anna" }, "short"))
      .status,
    401,
  );
});
test("recipient deployment cannot create hangs and storage failure is honest", async (t) => {
  const { create } = await setup(t, { recipientOnly: true });
  assert.equal((await create()).status, 403);
  const api = createHangApi({
    store: {
      get: async () => {
        throw Error("secret URL");
      },
    },
  });
  const r = await api(new Request(`https://x/api/hangs/${"a".repeat(32)}`));
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /secret/);
});
test("rate limits survive handler instances and stored records have automatic retention", async (t) => {
  const { call, create, store } = await setup(t, { rateLimit: 3 });
  const h = (await create()).data;
  const record = JSON.parse(await store.get(h.id));
  assert.equal(record.retainUntil, h.endsAt + 86400000);
  await call(`/${h.id}/rsvp`, { coming: true, name: "Anna" }, anna);
  await call(`/${h.id}/rsvp`, { coming: false }, anna);
  await call(`/${h.id}/rsvp`, { coming: true, name: "Anna" }, anna);
  assert.equal(
    (await call(`/${h.id}/rsvp`, { coming: false }, anna)).status,
    429,
  );
});
