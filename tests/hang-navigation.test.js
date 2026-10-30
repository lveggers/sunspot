import test from "node:test";
import assert from "node:assert/strict";
import {
  readRecentHangs,
  rememberVisitedHang,
  writeHangLocal,
} from "../src/hangs.js";

test("recent hangouts recover legacy hosts, reject corrupt entries and keep fresh guest status", () => {
  const data = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
  });
  try {
    const id = "a".repeat(32),
      now = Date.now();
    writeHangLocal("mine", [{ id, name: "Old name", endsAt: now + 60000 }]);
    writeHangLocal("recent", [
      null,
      { id: "bad", name: "Bad", endsAt: now },
      { id: "b".repeat(32), name: "Expired", endsAt: now - 2 * 86400000 },
    ]);
    assert.equal(readRecentHangs().length, 1);
    rememberVisitedHang({
      id,
      place: { name: "Kayak Bar" },
      startsAt: now,
      endsAt: now + 60000,
      status: "active",
      joined: true,
      isHost: false,
    });
    assert.equal(readRecentHangs().length, 1);
    assert.equal(readRecentHangs()[0].name, "Kayak Bar");
    assert.equal(readRecentHangs()[0].joined, true);
    rememberVisitedHang({
      id,
      place: { name: "Kayak Bar" },
      endsAt: now + 60000,
      status: "ended",
    });
    assert.equal(readRecentHangs()[0].status, "ended");
    writeHangLocal("recent", { corrupted: true });
    assert.equal(readRecentHangs().length, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});
