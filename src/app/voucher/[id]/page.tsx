import type { Metadata } from "next";
import { GoldenVoucherPage } from "../../../GoldenHour.jsx";

export const metadata: Metadata = {
  title: "Din kupong — SunSpot",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GoldenVoucherPage id={id} />;
}
