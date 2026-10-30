import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "./Language.jsx";
import {
  hangDate,
  hangTime,
  readRecentHangs,
  readHangLocal,
  hangRequest,
} from "./hangs.js";
export default function RecentHangs({ canExplore = true, onExplore }) {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState(readRecentHangs);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    const refresh = async () => {
      if (document.hidden || fetching) return;
      fetching = true;
      const current = readRecentHangs();
      const next = await Promise.all(
        current.map(async (item) => {
          try {
            const h = await hangRequest(`/${item.id}`, {
              token:
                readHangLocal(`host:${item.id}`) ||
                readHangLocal(`guest:${item.id}`),
              signal: controller.signal,
            });
            return {
              id: h.id,
              name: h.place.name,
              startsAt: h.startsAt,
              endsAt: h.endsAt,
              status: h.status,
              isHost: h.isHost,
              joined: h.joined,
            };
          } catch (error) {
            return {
              ...item,
              unavailable: error.status === 404,
              stale: error.status !== 404,
            };
          }
        }),
      );
      fetching = false;
      if (!controller.signal.aborted) {
        setItems(next);
        setClock(Date.now());
      }
    };
    refresh();
    const tick = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const active = items.filter(
    (h) => !h.unavailable && h.status !== "ended" && h.endsAt > clock,
  );
  const past = items.filter(
    (h) => h.unavailable || h.status === "ended" || h.endsAt <= clock,
  );
  function row(h) {
    const ended = h.unavailable || h.status === "ended" || h.endsAt <= clock;
    return (
      <Link
        className="recent-hang"
        key={h.id}
        href={`/hang/${h.id}`}
        prefetch={false}
      >
        <div>
          <strong>{h.name}</strong>
          <small>
            {t(
              h.unavailable
                ? "Inte längre tillgängligt"
                : h.stale
                  ? "Kunde inte uppdatera"
                  : ended
                    ? "Avslutat"
                    : h.startsAt > clock
                      ? "Planerat"
                      : "Pågår nu",
            )}
            {" · "}
            {hangDate(h.endsAt, locale)} · {hangTime(h.endsAt, locale)}
          </small>
          <span>
            {t(h.isHost ? "Du är värd" : h.joined ? "Du kommer" : "Inbjudan")}
          </span>
        </div>
        <ChevronRight size={18} />
      </Link>
    );
  }
  return (
    <div className="recent-hangs">
      <h2>{t("Pågående och kommande")}</h2>
      {active.length ? (
        active.map(row)
      ) : (
        <p className="hang-muted">{t("Inga pågående häng här just nu.")}</p>
      )}
      {past.length > 0 && (
        <details className="past-hangs">
          <summary>
            {t("Tidigare häng")} ({past.length})
          </summary>
          {past.map(row)}
        </details>
      )}
      {canExplore && (
        <Link className="secondary wide" href="/" onClick={onExplore}>
          {t("Hitta en plats på kartan")}
        </Link>
      )}
      {!canExplore && !items.length && (
        <p className="hang-muted">
          {t(
            "Öppna länken från din vän. Hänget sparas här så att du hittar tillbaka.",
          )}
        </p>
      )}
      <p className="profile-hint">
        {t("Här finns häng du öppnat i den här webbläsaren.")}
      </p>
    </div>
  );
}
