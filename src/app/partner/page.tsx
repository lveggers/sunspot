import type { Metadata } from "next";
import { PartnerPortal } from "../../GoldenHour.jsx";
import { requestLanguage } from "../../request-language.js";
import { translate } from "../../i18n.js";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(await requestLanguage(), "finder.partnerTitle"), robots: { index: false, follow: false } };
}

export default function PartnerPage() {
  return <PartnerPortal />;
}
