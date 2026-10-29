"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatError, normalizeLanguage, translate } from "./i18n.js";

/**
 * @typedef {Object} LanguageValue
 * @property {"da" | "en" | "sv"} language
 * @property {(key: string, params?: Record<string, string | number>) => string} t
 * @property {(error: unknown) => string} errorText
 * @property {(value: string) => void} changeLanguage
 */
/** @type {import("react").Context<LanguageValue | null>} */
const LanguageContext = createContext(null);

export function LanguageProvider({ initialLanguage = "da", children }) {
  const router = useRouter();
  const [language, setLanguage] = useState(() => normalizeLanguage(initialLanguage));
  const t = useCallback((key, params) => translate(language, key, params), [language]);
  const errorText = useCallback((error) => formatError(language, error), [language]);
  const changeLanguage = useCallback((value) => {
    const next = normalizeLanguage(value);
    document.cookie = `sunspot-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setLanguage(next);
    router.refresh();
  }, [router]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, t, errorText, changeLanguage }), [language, t, errorText, changeLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is required");
  return value;
}

export function LanguageSwitcher() {
  const { language, t, changeLanguage } = useLanguage();
  return (
    <label className="language-switcher">
      <span className="sr-only">{t("common.language")}</span>
      <select name="language" aria-label={t("common.language")} value={language} onChange={(event) => changeLanguage(event.target.value)}>
        <option value="da">Dansk</option>
        <option value="en">English</option>
        <option value="sv">Svenska</option>
      </select>
    </label>
  );
}
