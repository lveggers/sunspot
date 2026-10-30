import da from "./locales/da.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
export const locales = ["sv", "da", "en"];
export const intlLocales = { sv: "sv-SE", da: "da-DK", en: "en-GB" };
export const localeKey = "sunspot:language";
export function resolveLocale(stored, browserLanguages = []) {
  if (locales.includes(stored)) return stored;
  for (const language of browserLanguages) {
    const code = language.toLowerCase().split("-")[0];
    if (locales.includes(code)) return code;
  }
  return "en";
}
const dictionaries = { da, en };
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A few labels arrive as Swedish model/API strings. Match only declared messages,
// never arbitrary user or organizer content, and never alter data or API values.
const patterns = Object.keys(en)
  .filter((key) => key.includes("{0}"))
  .map((key) => ({
    key,
    regex: new RegExp(
      "^" +
        key
          .split(/\{\d+\}/)
          .map(escape)
          .join("(.+?)") +
        "$",
    ),
  }));
export function translate(locale, text, params) {
  if (typeof text !== "string" || !text) return text;
  const key = text.replace(/\s+/g, " ").trim();
  if (!key || (locale === "sv" && !params)) return text;
  let result = dictionaries[locale]?.[key] ?? key;
  let values = params;
  if (
    !params &&
    locale !== "sv" &&
    !Object.hasOwn(dictionaries[locale] || {}, key)
  ) {
    for (const pattern of patterns) {
      const match = key.match(pattern.regex);
      if (match) {
        result = dictionaries[locale]?.[pattern.key] ?? key;
        values = match.slice(1);
        break;
      }
    }
  }
  result = result.replace(/\{(\w+)\}/g, (match, name) =>
    values?.[name] === undefined ? match : String(values[name]),
  );
  return (
    (text.match(/^\s+/)?.[0] || "") + result + (text.match(/\s+$/)?.[0] || "")
  );
}
