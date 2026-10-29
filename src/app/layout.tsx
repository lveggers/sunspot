import type { Metadata } from "next";
import { LanguageProvider } from "../Language.jsx";
import { translate } from "../i18n.js";
import { requestLanguage } from "../request-language.js";
import "leaflet/dist/leaflet.css";
import "../styles.css";
import "../identity.css";

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: translate(language, "finder.metaTitle"),
    description: translate(language, "finder.metaDescription"),
    icons: { icon: "/favicon.svg" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = await requestLanguage();
  return (
    <html lang={language}>
      <body><LanguageProvider initialLanguage={language}>{children}</LanguageProvider></body>
    </html>
  );
}
