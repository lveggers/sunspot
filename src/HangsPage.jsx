"use client";
import { LanguageProvider, LanguageSelect, useLanguage } from "./Language.jsx";
import { Sun } from "lucide-react";
import ProfileLink from "./ProfileLink.jsx";
import HangNavigation from "./HangNavigation.jsx";
import RecentHangs from "./RecentHangs.jsx";
function Hangs({ canExplore }) {
  const { t } = useLanguage();
  return (
    <main className="hang-page">
      <header className="hang-header">
        <span className="hang-brand">
          <Sun size={24} />
          SunSpot
        </span>
        <div className="hang-header-actions">
          <LanguageSelect />
          <ProfileLink returnTo="/hangs" />
        </div>
      </header>
      {canExplore && <HangNavigation canExplore current="hangs" />}
      <section className="hang-card hangs-overview">
        <p className="hang-eyebrow">{t("Vi ses där.")}</p>
        <h1>{t("Mina häng")}.</h1>
        <RecentHangs canExplore={canExplore} />
      </section>
    </main>
  );
}
export default function HangsPage(props) {
  return (
    <LanguageProvider>
      <Hangs {...props} />
    </LanguageProvider>
  );
}
