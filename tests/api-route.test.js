import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApi } from "../server/api.js";
import { places } from "../src/places.js";

const input = () => ({
  placeId: places[0].id,
  activity: "walk",
  startsAt: new Date(Date.now() + 86400_000).toISOString(),
  duration: 60,
  host: "Värd",
});
const request = (path, body, headers = {}) =>
  new Request(`http://localhost:3000/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("Next API persists invitations across database reopen and keeps credentials private", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sunspot-api-"));
  let api;
  try {
    const database = join(directory, "test.sqlite");
    api = createApi({ database });
    const created = await (
      await api.handle(request("/gatherings", input()))
    ).json();
    const guest = await (
      await api.handle(
        request(`/gatherings/${created.id}/rsvp`, {
          name: "Gäst",
          answer: "yes",
        }),
      )
    ).json();
    const stored = api.db
      .prepare("SELECT host_hash FROM gatherings WHERE id = ?")
      .get(created.id);
    assert.notEqual(stored.host_hash, created.hostToken);
    api.db.close();
    api = createApi({ database });
    const response = await api.handle(request(`/gatherings/${created.id}`));
    assert.equal(response.headers.get("cache-control"), "no-store");
    const publicView = await response.json();
    assert.equal(publicView.counts.yes, 1);
    assert.equal(publicView.answers, undefined);
    assert.equal(publicView.hostToken, undefined);
    const edit = await api.handle(
      request(`/gatherings/${created.id}/rsvp`, {
        name: "Gäst",
        answer: "maybe",
        editToken: guest.editToken,
      }),
    );
    assert.equal(edit.status, 200);
    const privateView = await (
      await api.handle(
        request(`/gatherings/${created.id}`, undefined, {
          "x-host-token": created.hostToken,
        }),
      )
    ).json();
    assert.deepEqual(privateView.answers, [{ name: "Gäst", answer: "maybe" }]);
  } finally {
    api?.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Next API bounds request bodies, checks origin and rejects unsupported methods", async () => {
  const api = createApi({ origin: "https://sunspot.example" });
  try {
    assert.equal(
      (
        await api.handle(
          request("/gatherings", input(), { origin: "http://localhost:3000" }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await api.handle(
          request("/gatherings", input(), {
            origin: "https://sunspot.example",
          }),
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await api.handle(
          request("/gatherings", { ...input(), message: "a".repeat(9000) }),
        )
      ).status,
      413,
    );
    assert.equal((await api.handle(request("/gatherings", []))).status, 400);
    assert.equal(
      (
        await api.handle(
          new Request("http://localhost:3000/api/gatherings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api.handle(
          request("/gatherings", input(), { "content-type": "text/plain" }),
        )
      ).status,
      415,
    );
    assert.equal((await api.handle(request("/gatherings"))).status, 405);
    assert.equal((await api.handle(request("/unknown"))).status, 404);
  } finally {
    api.db.close();
  }
});

test("Next API weather errors are explicit and rate budget does not trust forwarded headers", async () => {
  const api = createApi({
    limit: 2,
    getWeather: async () => {
      throw new Error("private upstream detail");
    },
  });
  try {
    const failed = await api.handle(request("/weather"));
    assert.equal(failed.status, 500);
    assert.ok(!(await failed.text()).includes("private upstream detail"));
    assert.equal((await api.handle(request("/unknown"))).status, 404);
    const limited = await api.handle(
      request("/weather", undefined, { "x-forwarded-for": "1.2.3.4" }),
    );
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  } finally {
    api.db.close();
  }
});

test("explicit development aliases preserve exact-origin checks", async () => {
  const api = createApi({
    origin: ["http://localhost:3085", "http://127.0.0.1:3085"],
  });
  try {
    for (const origin of ["http://localhost:3085", "http://127.0.0.1:3085"])
      assert.equal(
        (await api.handle(request("/gatherings", {}, { origin }))).status,
        400,
      );
    for (const origin of [
      "https://example.com",
      "http://localhost:9999",
      "http://0.0.0.0:3085",
    ])
      assert.equal(
        (await api.handle(request("/gatherings", {}, { origin }))).status,
        403,
      );
  } finally {
    api.db.close();
  }
});
