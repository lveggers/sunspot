import Hangs from "@/components/Hangs";
export const metadata = {
  title: "Mina häng · SunSpot",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Hangs canExplore={process.env.SUNSPOT_RECIPIENT_ONLY !== "1"} />;
}
