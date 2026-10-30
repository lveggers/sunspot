import { useLanguage } from "./Language.jsx";
import { useEffect, useRef, useState } from "react";
import { Bell, X, Footprints, Sun } from "lucide-react";
import { places } from "./places.js";
import { recommendNext } from "./exposure.js";
import { clock, durationLabel } from "./lib.js";
export function solarLabel(result) {
  if (!result) return "Solläge saknas";
  if (!result.eligible) return "Ingen uteservering enligt OSM";
  if (result.state === "unknown") return "Solläge okänt";
  if (result.state === "shade") return "I byggnadsskugga";
  if (result.park)
    return `Sol på ca ${Math.round(result.fraction * 100)} % av provpunkterna`;
  return result.reason === "shade"
    ? `Skugga om ca ${result.until} min`
    : `Minst ${durationLabel(result.until)} möjlig sol`;
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
  const { t } = useLanguage();
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
      new Notification(t("Skugga närmar sig {0}", [place.name]), {
        body: t(
          "Beräknad skugga om cirka {0} minuter. Öppna SunSpot för soliga alternativ.",
          [result.until],
        ),
        tag: `sunspot-${id}`,
      });
      sent.current.add(key);
    } catch {
      // Reflect a synchronous failure of the external Notification API.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoticeError("Systemnotiser stöds inte här. Varningen visas i appen.");
    }
  }, [live, warning, permission, id, shadowAt, result, place, t]);
  if (!place) return null;
  const recommendations =
    result && !pending
      ? recommendNext(places, results, id, instant, duration)
      : [];
  async function enable() {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setNoticeError("Notiser kunde inte aktiveras. Varningen visas i appen.");
    }
  }
  return (
    <section
      className={`solar-watch ${warning ? "urgent" : ""}`}
      id="sun-watch"
      aria-label={t("Solbevakning")}
    >
      <div className="watch-heading">
        <Bell size={18} />
        <strong>
          {live ? t("Följer din sittplats") : t("Förhandsvisning vid vald tid")}{" "}
          · {place.name}
        </strong>
        <button
          className="icon-button"
          onClick={onStop}
          aria-label={t("Avsluta solbevakning")}
        >
          <X size={17} />
        </button>
      </div>
      <p role="status">
        {pending
          ? t("Beräknar skuggans ankomst…")
          : warning
            ? t("Skuggan når din punkt om cirka {0} minuter ({1}).", [
                result.until,
                clock(new Date(shadowAt)),
              ])
            : t(solarLabel(result))}
      </p>
      {result?.pointSource !== "chosen" && (
        <p>
          {t(
            "Utomhuspunkten är uppskattad. Välj din sittplats på kartan före en verklig bevakning.",
          )}
        </p>
      )}
      <div className="watch-actions">
        {!live && <button onClick={onLive}>{t("Följ klockan nu")}</button>}
        {live && permission === "default" && (
          <button onClick={enable}>{t("Aktivera systemnotiser")}</button>
        )}
        <span>
          {live
            ? t("Bevakning medan appen är öppen.")
            : t("Dra tidsreglaget för att prova varningen.")}
        </span>
      </div>
      {permission === "denied" && live && (
        <small>
          {t("Systemnotiser är blockerade. Varningen visas här i appen.")}
        </small>
      )}
      {noticeError && <small>{t(noticeError)}</small>}
      <h3>
        <Sun size={15} />
        {t("Nästa soliga")}{" "}
        {t(
          place.category === "bar"
            ? "bar"
            : place.category === "restaurant"
              ? "restaurang"
              : "plats",
        )}{" "}
        {t("i närheten")}
      </h3>
      <p className="watch-explainer">
        {t("Sol efter uppskattad gångtid och under ")}
        {durationLabel(duration)}
        {t(". Modellförslag, utan träd eller moln.")}
      </p>
      <div className="next-places">
        {recommendations.map(
          ({ place: p, distance, walk, opening, pointSource }) => (
            <button key={p.id} onClick={() => onSelect(p)}>
              <strong>{p.name}</strong>
              <span>
                <Footprints size={13} />
                {t("ca ")}
                {walk}
                {t(" min · ")}
                {distance}
                {t(" m fågelvägen")}
              </span>
              <small>
                {t(opening.label)} ·{" "}
                {pointSource === "chosen"
                  ? t("vald punkt")
                  : t("sittplats ej verifierad")}
              </small>
            </button>
          ),
        )}
      </div>
      {!pending && !recommendations.length && (
        <p>
          {t(
            "Inga alternativ med tillräcklig beräknad sol hittades inom 1,5 km. Prova en kortare vistelse.",
          )}
        </p>
      )}
    </section>
  );
}
