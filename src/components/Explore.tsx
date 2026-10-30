"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// Leaflet and the solar worker require the browser. Keep their imports out of SSR.
const App = dynamic(() => import("../App.jsx"), {
  ssr: false,
  loading: () => (
    <p role="status" className="app-loading">
      SunSpot…
    </p>
  ),
});

export default function Explore() {
  const pathname = usePathname();
  return <App key={pathname} />;
}
