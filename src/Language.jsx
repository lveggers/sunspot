"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { locales, localeKey, resolveLocale, translate } from "./i18n.js";
const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    let stored;
    try {
      stored = localStorage.getItem(localeKey);
    } catch {
      /* Storage can be blocked. */
    }
    return resolveLocale(
      stored,
      typeof navigator === "undefined" ? [] : navigator.languages,
    );
  });
  const changeLocale = useCallback((value) => {
    if (!locales.includes(value)) return;
    setLocale(value);
    try {
      localStorage.setItem(localeKey, value);
    } catch {
      /* Selection still works for this visit. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const t = useCallback(
    (text, params) => translate(locale, text, params),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, changeLocale, t }),
    [locale, changeLocale, t],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
export function LanguageSelect() {
  const { locale, changeLocale, t } = useLanguage();
  return (
    <label className="language-select">
      {t("Språk")}
      <select
        aria-label={t("Språk")}
        value={locale}
        onChange={(e) => changeLocale(e.target.value)}
      >
        <option value="sv" lang="sv">
          Svenska
        </option>
        <option value="da" lang="da">
          Dansk
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </label>
  );
}
