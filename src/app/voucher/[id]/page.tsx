import type { Metadata } from "next";
import { GoldenVoucherPage } from "../../../GoldenHour.jsx";
import { requestLanguage } from "../../../request-language.js";
import { translate } from "../../../i18n.js";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(await requestLanguage(), "finder.voucherTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function VoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GoldenVoucherPage id={id} />;
}
