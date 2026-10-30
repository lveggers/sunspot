import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { useLanguage } from "./Language.jsx";
export default function HangNavigation({ canExplore, returnTo, current }) {
  const { t } = useLanguage();
  const back = returnTo || (canExplore ? "/" : "/hangs");
  const label = back.startsWith("/hang/")
    ? "Till hänget"
    : back === "/"
      ? "Till kartan"
      : "Mina häng";
  return (
    <nav className="hang-navigation" aria-label={t("Sidnavigering")}>
      <Link href={back} prefetch={false}>
        <ArrowLeft size={17} />
        {t(label)}
      </Link>
      {back !== "/hangs" && current !== "hangs" && (
        <Link href="/hangs" prefetch={false}>
          <Users size={17} />
          {t("Mina häng")}
        </Link>
      )}
    </nav>
  );
}
