import { useEffect, useRef, useState } from "react";
import { Bell, X, Footprints, Sun } from "lucide-react";
import { places } from "./places.js";
import { recommendNext } from "./exposure.js";
import { clock, durationLabel } from "./lib.js";
export function solarLabel(result) {
  if (!result) return "Solläge saknas";
  if (!result.eligible) return "Ingen uteservering enligt OSM";
  if (result.state === "weather-unknown") return "Väder för sol saknas";
  if (result.state === "cloud") return "Moln eller dimma i prognosen";
  if (result.state === "rain") return "Nederbörd i prognosen";
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
      new Notification(`Skugga närmar sig ${place.name}`, {
        body: `Beräknad skugga om cirka ${result.until} minuter. Öppna SunSpot för soliga alternativ.`,
        tag: `sunspot-${id}`,
      });
      sent.current.add(key);
    } catch {
      // Reflect a synchronous failure of the external Notification API.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoticeError("Systemnotiser stöds inte här. Varningen visas i appen.");
    }
  }, [live, warning, permission, id, shadowAt, result, place]);
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
      setNoticeError("Notiser kunde inte aktiveras. Varningen visas i appen.");
    }
  }
  return (
    <section
      className={`solar-watch ${warning ? "urgent" : ""}`}
      id="sun-watch"
      aria-label="Solbevakning"
    >
      <div className="watch-heading">
        <Bell size={18} />
        <strong>
          {live ? "Följer din sittplats" : "Förhandsvisning vid vald tid"} ·{" "}
          {place.name}
        </strong>
        <button
          className="icon-button"
          onClick={onStop}
          aria-label="Avsluta solbevakning"
        >
          <X size={17} />
        </button>
      </div>
      <p role="status">
        {pending
          ? "Beräknar skuggans ankomst…"
          : warning
            ? `Skuggan når din punkt om cirka ${result.until} minuter (${clock(new Date(shadowAt))}).`
            : solarLabel(result)}
      </p>
      {result?.pointSource !== "chosen" && (
        <p>
          Utomhuspunkten är uppskattad. Välj din sittplats på kartan före en
          verklig bevakning.
        </p>
      )}
      <div className="watch-actions">
        {!live && <button onClick={onLive}>Följ klockan nu</button>}
        {live && permission === "default" && (
          <button onClick={enable}>Aktivera systemnotiser</button>
        )}
        <span>
          {live
            ? "Bevakning medan appen är öppen."
            : "Ändra klockslaget för att prova varningen."}
        </span>
      </div>
      {permission === "denied" && live && (
        <small>Systemnotiser är blockerade. Varningen visas här i appen.</small>
      )}
      {noticeError && <small>{noticeError}</small>}
      <h3>
        <Sun size={15} />
        Nästa soliga{" "}
        {place.category === "bar"
          ? "bar"
          : place.category === "restaurant"
            ? "restaurang"
            : "plats"}{" "}
        i närheten
      </h3>
      <p className="watch-explainer">
        Beräknad byggnadssol efter gångtid och under {durationLabel(duration)}.
        Vädret kontrolleras vid vald tid; moln kan ändras. Träd ingår inte.
      </p>
      <div className="next-places">
        {recommendations.map(
          ({ place: p, distance, walk, opening, pointSource }) => (
            <button key={p.id} onClick={() => onSelect(p)}>
              <strong>{p.name}</strong>
              <span>
                <Footprints size={13} />
                ca {walk} min · {distance} m fågelvägen
              </span>
              <small>
                {opening.label} ·{" "}
                {pointSource === "chosen"
                  ? "vald punkt"
                  : "sittplats ej verifierad"}
              </small>
            </button>
          ),
        )}
      </div>
      {!pending && !recommendations.length && (
        <p>
          Inga alternativ med tillräcklig beräknad sol hittades inom 1,5 km.
          Prova en kortare vistelse.
        </p>
      )}
    </section>
  );
}
