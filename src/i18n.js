import common from "./locales/common.js";
import map from "./locales/map.js";
import finder from "./locales/finder.js";
import theatre from "./locales/theatre.js";
import flows from "./locales/flows.js";
import characterExperience from "./locales/characterExperience.js";
import offerExperience from "./locales/offerExperience.js";
import invitationExperience from "./locales/invitationExperience.js";

export const messages = { ...common, ...map, ...finder, ...theatre, ...flows, ...characterExperience, ...offerExperience, ...invitationExperience };
export const normalizeLanguage = (value) => ["da", "en", "sv"].includes(value) ? value : "da";
export const localeFor = (language) => ({ da: "da-DK", en: "en-GB", sv: "sv-SE" })[normalizeLanguage(language)];

export function translate(language, key, params = {}) {
  const translations = Object.hasOwn(messages, key) ? messages[key] : null;
  const message = translations?.[normalizeLanguage(language)] ?? translations?.da ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) => params[name] === undefined ? match : String(params[name]));
}

export function formatError(language, error) {
  if (!error) return "";
  const code = typeof error === "string" ? error : error.code;
  if (Object.hasOwn(messages, code)) return translate(language, code, error.params);
  const source = typeof error === "string" ? error : error.message;
  if (Object.hasOwn(messages, source)) return translate(language, source, error.params);
  const entry = Object.entries(messages).find(([, value]) => Object.values(value).includes(source));
  return translate(language, entry?.[0] || "common.error", error.params);
}
