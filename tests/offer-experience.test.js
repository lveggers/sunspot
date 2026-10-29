import test from "node:test";
import assert from "node:assert/strict";
import {
  formatOfferPrice,
  selectExampleMoment,
  selectOfferMoment,
  selectVoucherMoment,
} from "../src/offerExperience.js";


import messages from "../src/locales/offerExperience.js";

const offer = Object.freeze({ kind: "beer", claimable: true, state: "active" });

test("offer moments follow actual kind, claimability and claim response without inventing weather", () => {
  const cases = [
    [{}, "offer.none", null],
    [{ offer }, "offer.beer", "puffer", "beer-seated"],
    [{ offer: { ...offer, kind: "cocktail" } }, "offer.cocktail", "blue-coat", "cocktail-seated"],
    [{ offer: { ...offer, kind: "unknown" } }, "offer.other", null],
    [{ offer: { ...offer, kind: "constructor" } }, "offer.other", null],
    [{ offer, busy: true }, "offer.checking", "puffer", "beer-seated"],
    [{ offer, busy: true, rejected: true }, "offer.rejected", "blue-shirt", "cloud-angry"],
    [{ offer: { ...offer, claimable: false } }, "offer.unavailable", null],
    [{ offer: { ...offer, demo: true } }, "offer.demo", "puffer", "beer-seated"],
    [{ offer: { ...offer, kind: "cocktail", demo: true } }, "offer.demo", "blue-coat", "cocktail-seated"],
  ];
  for (const [input, id, character, pose] of cases) {
    const expected = { id, character, ...(pose ? { pose } : {}) };
    assert.deepEqual(selectOfferMoment(input), expected);
    assert.deepEqual(selectOfferMoment(input), selectOfferMoment(input));
    assert.equal(selectOfferMoment(input).weather, undefined);
    assert.ok(messages[`offerExperience.${id}`], `${id} has copy`);
  }
});

test("voucher status uses the existing countdown, with redemption first and no coupling to weather or campaign", () => {
  const voucher = Object.freeze({
    id: "unchanged-code",
    kind: "cocktail",
    expiresAt: "2026-10-28T16:30:00Z",
    redeemedAt: null,
  });
  for (const [remaining, redeemedAt, state] of [
    [1, null, "valid"], [0, null, "expired"], [-1, null, "expired"],
    [1, "2026-10-28T15:45:00Z", "redeemed"],
    [-1, "2026-10-28T15:45:00Z", "redeemed"],
  ]) {
    const input = { voucher: { ...voucher, redeemedAt }, remaining };
    const expected = { id: `voucher.${state}`, character: "blue-coat", pose: "cocktail-seated" };
    assert.deepEqual(selectVoucherMoment(input), expected);
    for (const weather of ["sun", "cloud", "rain", "unknown"])
      assert.deepEqual(selectVoucherMoment({ ...input, weather, language: "sv", activeUntil: 0 }), expected);
    assert.ok(messages[`offerExperience.voucher.${state}`]);
  }
  assert.equal(selectVoucherMoment({ voucher: { ...voucher, kind: "unknown" }, remaining: 1 }).character, null);
  assert.equal(voucher.id, "unchanged-code");
  assert.equal(voucher.expiresAt, "2026-10-28T16:30:00Z");
});

test("the simulated example stays a separate beer example and weather cannot cancel its started countdown", () => {
  for (const [input, state] of [
    [{}, "offer"], [{ sunny: false }, "blocked"],
    [{ started: true, remaining: 1 }, "voucher"],
    [{ sunny: false, started: true, remaining: 1 }, "voucher"],
    [{ started: true, remaining: 0 }, "expired"],
  ]) {
    assert.deepEqual(selectExampleMoment(input), {
      id: `example.${state}`, character: "puffer", pose: "beer-seated",
    });
    assert.ok(messages[`offerExperience.example.${state}`]);
  }
});

test("offer prices preserve partner decimals and identify Danish kroner in every language", () => {
  for (const [language, currency] of [["da", "kr."], ["en", "DKK"], ["sv", "DKK"]]) {
    const formatted = formatOfferPrice(12.35, language);
    assert.ok(formatted.includes(currency), formatted);
    assert.match(formatted, /12[,.]35/);
    assert.match(formatOfferPrice(0.01, language), /0[,.]01/);
    assert.match(formatOfferPrice(12.5, language), /12[,.]5(?:\D|$)/);
  }
});

test("experience copy is complete in DA/EN/SV with matching template parameters", () => {
  const params = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, copy] of Object.entries(messages)) {
    for (const language of ["da", "en", "sv"]) {
      assert.ok(copy[language]?.trim(), `${key}.${language}`);
      assert.deepEqual(params(copy[language]), params(copy.da), `${key}.${language}`);
    }
  }
});
