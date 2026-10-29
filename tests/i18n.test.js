import test from "node:test";
import assert from "node:assert/strict";
import { messages, translate, normalizeLanguage, localeFor, formatError } from "../src/i18n.js";
import { createApi } from "../server/api.js";

const languages = ["da", "en", "sv"];
const parameters = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

test("every catalog entry covers the supported languages with matching parameters", () => {
  assert.ok(Object.keys(messages).length > 0);
  for (const [key, translations] of Object.entries(messages)) {
    for (const language of languages) {
      assert.equal(typeof translations[language], "string", `${key}.${language} exists`);
      assert.ok(translations[language].trim(), `${key}.${language} is not empty`);
      assert.deepEqual(parameters(translations[language]), parameters(translations.da), `${key}.${language} keeps its parameters`);
      const params = Object.fromEntries(parameters(translations[language]).map((name) => [name, `value_${name}`]));
      const output = translate(language, key, params);
      for (const value of Object.values(params)) assert.ok(output.includes(value), `${key}.${language} interpolates ${value}`);
      assert.deepEqual(parameters(output), [], `${key}.${language} leaves no unresolved parameters`);
    }
  }
});

test("language normalization defaults to Danish and selects the intended locale", () => {
  assert.equal(normalizeLanguage(undefined), "da");
  assert.equal(normalizeLanguage("invalid"), "da");
  for (const [language, locale] of [["da", "da-DK"], ["en", "en-GB"], ["sv", "sv-SE"]]) {
    assert.equal(normalizeLanguage(language), language);
    assert.equal(localeFor(language), locale);
  }
  assert.equal(translate("da", "common.language"), "Sprog");
  assert.equal(translate("en", "common.language"), "Language");
  assert.equal(translate("sv", "common.language"), "Språk");
});

test("API error codes are translated when rendered, without freezing the first language", () => {
  const error = Object.assign(new Error("Server fallback"), { code: "error.credentials" });
  for (const language of languages) {
    assert.equal(formatError(language, error), messages[error.code][language]);
    assert.notEqual(formatError(language, error), error.message);
  }
});

test("API failures expose translation codes while retaining their compatible error strings", async () => {
  const api = createApi({ development: true });
  try {
    for (const [path, body, status, code, message] of [
      ["/partner/login", { email: "missing@example.test", password: "invalid" }, 401, "error.credentials", "Fel e-post eller lösenord."],
      ["/gatherings", {}, 400, "error.gatheringInvalid", "Välj en giltig aktivitet, plats och framtida tid inom sju dagar. Ange ditt namn (högst 50 tecken)."],
    ]) {
      const response = await api.handle(new Request(`http://localhost:3000/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      const data = await response.json();
      assert.equal(response.status, status);
      assert.equal(data.code, code);
      assert.equal(data.error, message);
      for (const language of languages) assert.equal(formatError(language, { ...data, message: data.error }), messages[code][language]);
    }
  } finally {
    api.db.close();
  }
});
