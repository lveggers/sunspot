import test from "node:test";
import assert from "node:assert/strict";
import { characterMotion } from "../src/characterMotion.js";

const motion = (id, extra = {}) => characterMotion({ id, initial: true, ...extra });

test("first weather entrances are finite and animate only the available artwork", () => {
  for (const id of ["weather.sun", "planned.sun"]) {
    const result = motion(id);
    assert.equal(result.options.duration, 220);
    assert.equal(result.keyframes[0].transform, "translateY(4px)");
    assert.equal(result.target, "figure");
  }
  for (const [id, weather, duration, translation] of [
    ["weather.cloud", "cloud", 360, "translateX(3px)"],
    ["weather.rain", "rain", 320, "translateY(-2px)"],
    ["planned.grey", "cloud", 360, "translateX(3px)"],
    ["planned.grey", "rain", 320, "translateY(-2px)"],
  ]) {
    const result = motion(id, { weather });
    assert.equal(result.target, "weather");
    assert.equal(result.options.duration, duration);
    assert.deepEqual(result.keyframes, [{ transform: `${translation} rotate(-8deg)` }, { transform: "rotate(-8deg)" }]);
  }
  assert.deepEqual(motion("weather.night").keyframes, [{ opacity: 0.65 }, { opacity: 1 }]);
  assert.equal(motion("weather.night").options.duration, 300);
});

test("loading finishes at full opacity after exactly three loops without translation", () => {
  for (const initial of [true, false]) {
    const result = motion("weather.loading", { initial });
    assert.equal(result.options.duration * result.options.iterations, 3600);
    assert.deepEqual(result.keyframes, [{ opacity: 1 }, { opacity: 0.72 }, { opacity: 1 }]);
  }
});

test("uncertain states and subsequent changes fade without entrance movement", () => {
  for (const id of ["weather.missing", "weather.unknown", "weather.stale", "weather.no-spot", "empty.no-types", "empty.location", "empty.outside", "empty.unconfirmed-open", "invite-grey", "invite-unknown", "offer.rejected"]) {
    const result = motion(id);
    assert.equal(result.options.duration, 160);
    assert.deepEqual(result.keyframes, [{ opacity: 0.75 }, { opacity: 1 }]);
  }
  for (const id of ["weather.sun", "planned.sun", "weather.cloud", "weather.rain", "weather.night", "planned.grey"]) {
    const result = motion(id, { initial: false });
    assert.equal(result.options.duration, 160);
    assert.deepEqual(result.keyframes, [{ opacity: 0.75 }, { opacity: 1 }]);
  }
});

test("busy, expired and cancelled states override even explicit confirmations", () => {
  for (const id of ["offer.checking", "voucher.expired", "example.expired", "invite-cancelled"]) {
    assert.equal(motion(id), null);
    assert.equal(motion(id, { confirmed: true }), null);
  }
});

test("saved vouchers and invitations need an explicit completed-action event", () => {
  for (const id of ["voucher.valid", "voucher.redeemed", "example.voucher", "invite-created"]) {
    assert.equal(motion(id), null);
    assert.equal(motion(id, { initial: false }), null);
    assert.equal(motion(id, { confirmed: true }).options.duration, 220);
  }
  assert.equal(motion("invite-created", { confirmed: true }).keyframes[0].transform, "translateY(4px)");
  for (const id of ["invite-responses", "invite-sun", "invite-grey"]) {
    const result = motion(id, { confirmed: true });
    assert.equal(result.options.duration, 180);
    assert.deepEqual(result.keyframes, [{ opacity: 0.75 }, { opacity: 1 }]);
  }
  for (const id of ["offer.beer", "offer.cocktail", "offer.demo", "example.offer"]) {
    assert.deepEqual(motion(id).keyframes, [{ opacity: 0.75 }, { opacity: 1 }]);
    assert.equal(motion(id).options.duration, 220);
  }
});
