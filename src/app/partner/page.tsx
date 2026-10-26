import type { Metadata } from "next";
import { PartnerPortal } from "../../GoldenHour.jsx";

export const metadata: Metadata = {
  title: "Partnerportal — SunSpot",
  robots: { index: false, follow: false },
};

export default function PartnerPage() {
  return <PartnerPortal />;
}
