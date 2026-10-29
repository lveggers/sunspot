"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useLanguage } from "../Language.jsx";

function Loading() {
  const { t } = useLanguage();
  return <p role="status" className="app-loading">{t("finder.loadingApp")}</p>;
}

// Leaflet and the solar worker require the browser. Keep their imports out of SSR.
const App = dynamic(() => import("../App.jsx"), {
  ssr: false,
  loading: Loading,
});

export default function Explore() {
  const pathname = usePathname();
  return <App key={pathname} />;
}
