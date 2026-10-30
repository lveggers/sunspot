"use client";
import dynamic from "next/dynamic";
const HangsPage = dynamic(() => import("../HangsPage.jsx"), {
  ssr: false,
  loading: () => (
    <p className="app-loading" role="status">
      SunSpot…
    </p>
  ),
});
export default function Hangs(props: { canExplore: boolean }) {
  return <HangsPage {...props} />;
}
