import Hangs from "@/components/Hangs";
import Explore from "@/components/Explore";
export default function Home() {
  if (process.env.SUNSPOT_RECIPIENT_ONLY === "1")
    return <Hangs canExplore={false} />;
  return <Explore />;
}
