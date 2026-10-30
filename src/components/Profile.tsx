"use client";
import dynamic from "next/dynamic";
const ProfilePage = dynamic(() => import("../ProfilePage.jsx"), {
  ssr: false,
  loading: () => (
    <p className="app-loading" role="status">
      SunSpot…
    </p>
  ),
});
export default function Profile(props: {
  returnTo: string;
  canExplore: boolean;
  authError: boolean;
}) {
  return <ProfilePage {...props} />;
}
