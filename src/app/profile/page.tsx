import Profile from "@/components/Profile";
import { profileReturn } from "@/profile.js";
export const metadata = {
  title: "Din profil · SunSpot",
  robots: { index: false, follow: false },
};
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo, error } = await searchParams;
  return (
    <Profile
      returnTo={profileReturn(returnTo)}
      authError={Boolean(error)}
      canExplore={process.env.SUNSPOT_RECIPIENT_ONLY !== "1"}
    />
  );
}
