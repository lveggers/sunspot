import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocale, translate } from "../src/i18n.js";
import da from "../src/locales/da.json" with { type: "json" };
import en from "../src/locales/en.json" with { type: "json" };
import { venueEvidence } from "../src/venueEvidence.js";
test("saved language wins; browser variants resolve in order; unsupported languages fall back", () => {
  assert.equal(resolveLocale("sv", ["da-DK"]), "sv");
  assert.equal(resolveLocale(null, ["fr-FR", "da-DK", "en-US"]), "da");
  assert.equal(resolveLocale("invalid", ["en-US"]), "en");
  assert.equal(resolveLocale(null, ["fr-FR"]), "en");
});
test("catalogues have the same keys and preserve all interpolation parameters", () => {
  assert.deepEqual(Object.keys(da).sort(), Object.keys(en).sort());
  const tokens = (text) =>
    [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
  for (const catalogue of [da, en])
    for (const [key, value] of Object.entries(catalogue)) {
      assert.ok(value.trim(), key);
      assert.deepEqual(tokens(value), tokens(key), key);
    }
});
test("interpolation keeps names and arbitrary values intact without recursive substitution", () => {
  assert.equal(
    translate("en", "Visa {0}", ["Nørrebro {1} <b>"]),
    "Show Nørrebro {1} <b>",
  );
  assert.equal(translate("sv", "Visa {0}", ["Kayak Bar"]), "Visa Kayak Bar");
  assert.equal(translate("da", "\n  "), "\n  ");
  assert.equal(translate("sv", " Välj  en plats "), " Välj  en plats ");
  assert.equal(translate("en", null), null);
});
test("model labels translate without changing solar or opening calculations", () => {
  assert.equal(translate("en", "Stänger om 5 min"), "Closes in 5 min");
  assert.equal(
    translate("en", "Skugga om ca 10 min"),
    "Shade in approx. 10 min",
  );
  assert.equal(
    translate("en", "Sol på ca 65 % av provpunkterna"),
    "Sun on approx. 65% of sample points",
  );
  assert.equal(translate("da", "Stänger om 5 min"), "Lukker om 5 min");
});
test("venue evidence notes have both translations", () => {
  for (const evidence of Object.values(venueEvidence))
    if (evidence.note) {
      assert.ok(da[evidence.note], evidence.note);
      assert.ok(en[evidence.note], evidence.note);
    }
});
