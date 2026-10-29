import { useEffect, useRef, useState } from "react";
import { Bell, X, Footprints, Sun } from "lucide-react";
import { places } from "./places.js";
import { recommendNext } from "./exposure.js";
import { clock, durationLabel, openingLabel } from "./lib.js";
import { translate } from "./i18n.js";
import { useLanguage } from "./Language.jsx";
export function solarLabel(result, language = "da") {
  if (!result) return translate(language, "solar.missing");
  if (!result.eligible) return translate(language, "solar.noOutdoor");
  if (result.state === "weather-unknown") return translate(language, "solar.weatherUnknown");
  if (result.state === "cloud") return translate(language, "weather.cloudFog");
  if (result.state === "rain") return translate(language, "weather.precipitation");
  if (result.state === "unknown") return translate(language, "solar.unknown");
  if (result.state === "shade") return translate(language, "solar.shade");
  if (result.park)
    return translate(language, "solar.parkFraction", { percent: Math.round(result.fraction * 100) });
  return result.reason === "shade"
    ? translate(language, "solar.shadeSoon", { minutes: result.until })
    : translate(language, "solar.minimumSun", { duration: durationLabel(result.until, language) });
}
export default function SolarWatch({
  id,
  results,
  instant,
  duration,
  live,
  pending,
  onStop,
  onSelect,
  onLive,
}) {
  const { language, t } = useLanguage();
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported",
  );
  const [noticeError, setNoticeError] = useState("");
  const sent = useRef(new Set());
  const place = places.find((p) => p.id === id),
    result = results[id];
  const warning =
    result?.state === "sun" && result.reason === "shade" && result.until <= 10;
  const shadowAt = warning
    ? Number(new Date(instant)) + result.until * 60000
    : null;
  useEffect(() => {
    if (
      !live ||
      !warning ||
      permission !== "granted" ||
      !result ||
      result.pointSource !== "chosen"
    )
      return;
    const key = `${id}:${result.point.join(",")}:${new Date(shadowAt).toISOString().slice(0, 16)}`;
    if (sent.current.has(key)) return;
    try {
      new Notification(t("watch.notificationTitle", { name: place.name }), {
        body: t("watch.notificationBody", { minutes: result.until }),
        tag: `sunspot-${id}`,
      });
      sent.current.add(key);
    } catch {
      // Reflect a synchronous failure of the external Notification API.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoticeError("watch.notificationUnsupported");
    }
  }, [live, warning, permission, id, shadowAt, result, place, t]);
  if (!place) return null;
  const recommendations =
    result && !pending
      ? recommendNext(
          places.filter((p) => p.id === id || results[p.id]?.state === "sun"),
          results,
          id,
          instant,
          duration,
        )
      : [];
  async function enable() {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setNoticeError("watch.notificationFailed");
    }
  }
  return (
    <section
      className={`solar-watch ${warning ? "urgent" : ""}`}
      id="sun-watch"
      aria-label={t("watch.region")}
    >
      <div className="watch-heading">
        <Bell size={18} />
        <strong>
          {t(live ? "watch.following" : "watch.preview")} ·{" "}
          {place.name}
        </strong>
        <button
          className="icon-button"
          onClick={onStop}
          aria-label={t("watch.stop")}
        >
          <X size={17} />
        </button>
      </div>
      <p role="status">
        {pending
          ? t("watch.pending")
          : warning
            ? t("watch.warning", { minutes: result.until, time: clock(new Date(shadowAt)) })
            : solarLabel(result, language)}
      </p>
      {warning && <p data-experience="place.shade-soon">{t("experience.place.shade-soon", { time: clock(new Date(shadowAt)) })}</p>}
      {result?.pointSource !== "chosen" && (
        <p>
          {t("watch.pointUnverified")}
        </p>
      )}
      <div className="watch-actions">
        {!live && <button onClick={onLive}>{t("watch.live")}</button>}
        {live && permission === "default" && (
          <button onClick={enable}>{t("watch.enableNotifications")}</button>
        )}
        <span>
          {t(live ? "watch.whileOpen" : "watch.previewHelp")}
        </span>
      </div>
      {permission === "denied" && live && (
        <small>{t("watch.notificationsBlocked")}</small>
      )}
      {noticeError && <small>{t(noticeError)}</small>}
      <h3>
        <Sun size={15} />
        {t(`watch.next.${place.category}`)}
      </h3>
      <p className="watch-explainer">
        {t("watch.explainer", { duration: durationLabel(duration, language) })}
      </p>
      <div className="next-places">
        {recommendations.map(
          ({ place: p, distance, walk, opening, pointSource }) => (
            <button key={p.id} onClick={() => onSelect(p)}>
              <strong>{p.name}</strong>
              <span>
                <Footprints size={13} />
                {t("watch.walkDistance", { walk, distance })}
              </span>
              <small>
                {openingLabel(opening, language)} ·{" "}
                {t(pointSource === "chosen" ? "watch.chosenPoint" : "watch.unverifiedSeat")}
              </small>
            </button>
          ),
        )}
      </div>
      {!pending && !recommendations.length && (
        <p>
          {t("watch.noAlternatives")}
        </p>
      )}
    </section>
  );
}
