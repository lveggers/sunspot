import test from "node:test";
import assert from "node:assert/strict";
import { placeMapsUrl, placeShareData } from "../src/placeShare.js";
import { translate } from "../src/i18n.js";
const place = {
  name: "Kayak Bar",
  district: "Indre By",
  lat: 55.6741,
  lng: 12.5839,
};
const result = {
  eligible: true,
  state: "sun",
  reason: "shade",
  until: 40,
  point: [12.58, 55.67],
};
const make = (overrides = {}) =>
  placeShareData({
    place,
    result,
    instant: "2026-09-20T14:00:00Z",
    live: true,
    pending: false,
    locale: "sv",
    t: (s, p) => translate("sv", s, p),
    ...overrides,
  });
test("share links contain the venue coordinates, never personal GPS or a private app link", () => {
  const url = new URL(placeMapsUrl(place));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("query"), "55.6741,12.5839");
  assert.equal(make().url, url.href);
  assert.doesNotMatch(
    JSON.stringify(make()),
    /vercel|_share|token|12\.58,55\.67/,
  );
});
test("live share contains named place, Copenhagen date/time and absolute end of estimated sunshine", () => {
  const { text } = make();
  assert.match(text, /Jag sitter på Kayak Bar/);
  assert.match(text, /20 september 16:00/);
  assert.match(text, /40 min.*16:40/);
  assert.match(text, /moln/);
});
test("planning does not claim to be at the venue now", () => {
  const { text } = make({ live: false });
  assert.match(text, /Ska vi ses på Kayak Bar/);
  assert.doesNotMatch(text, /Jag sitter/);
});
test("pending, unknown, missing and ineligible solar results never share an old duration", () => {
  for (const opts of [
    { pending: true },
    { result: undefined },
    { result: { ...result, state: "unknown" } },
    { result: { ...result, eligible: false } },
  ]) {
    const { text } = make(opts);
    assert.match(text, /inte känt/);
    assert.doesNotMatch(text, /40 min|16:40/);
  }
});
test("shade, partially sunny parks and horizon limits remain distinct", () => {
  assert.match(
    make({ result: { ...result, state: "shade" } }).text,
    /byggnadsskugga/,
  );
  const park = make({ result: { ...result, park: true, fraction: 0.5 } }).text;
  assert.match(park, /Delar av parken/);
  assert.doesNotMatch(park, /40 min/);
  assert.match(
    make({ result: { ...result, reason: "horizon", until: 180 } }).text,
    /Minst 180 min.*19:00/,
  );
});
test("Danish and English share messages translate while retaining venue names and times", () => {
  for (const [locale, opening] of [
    ["da", "Jeg sidder"],
    ["en", "I’m at"],
  ]) {
    const data = make({ locale, t: (s, p) => translate(locale, s, p) });
    assert.ok(data.text.startsWith(opening));
    assert.match(data.text, /Kayak Bar/);
    assert.match(data.text, /16:40/);
    assert.doesNotMatch(data.text, /\{\d+\}/);
  }
});
