import Hang from "@/components/Hang";
export const metadata = {
  title: "Kom förbi · SunSpot",
  description: "En plats. En länk. Vi ses där.",
  robots: { index: false, follow: false },
};
export default async function HangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Hang id={id} canExplore={process.env.SUNSPOT_RECIPIENT_ONLY !== "1"} />
  );
}
