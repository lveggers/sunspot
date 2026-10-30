"use client";
import dynamic from "next/dynamic";
const HangPage = dynamic(() => import("../HangPage.jsx"), {
  ssr: false,
  loading: () => (
    <p className="app-loading" role="status">
      SunSpot…
    </p>
  ),
});
export default function Hang(props: { id: string; canExplore: boolean }) {
  return <HangPage {...props} />;
}
