import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/lib.js";

test("API status distinguishes a new claim from a repeated claim without changing ordinary results", async () => {
  const original = globalThis.fetch;
  const payload = { voucher: { id: "same-voucher" } };
  try {
    for (const status of [201, 200]) {
      globalThis.fetch = async (path, options) => {
        assert.equal(path, "/api/example/claim");
        assert.equal(options.method, "POST");
        assert.equal(Object.hasOwn(options, "withStatus"), false);
        return new Response(JSON.stringify(payload), { status });
      };
      assert.deepEqual(await api("/example/claim", { method: "POST", withStatus: true }), { data: payload, status });
      assert.deepEqual(await api("/example/claim", { method: "POST" }), payload);
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "Not available", code: "error.offerExpired", params: {} }), { status: 409 });
    await assert.rejects(api("/example/claim", { withStatus: true }), (error) => error.status === 409 && error.code === "error.offerExpired");
  } finally {
    globalThis.fetch = original;
  }
});
