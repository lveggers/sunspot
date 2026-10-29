import type { Metadata } from "next";
import Explore from "@/components/Explore";
import { requestLanguage } from "../../../request-language.js";
import { translate } from "../../../i18n.js";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(await requestLanguage(), "finder.invitationTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default function InvitationPage() {
  return <Explore />;
}
