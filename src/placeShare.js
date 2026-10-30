import { clock, dateLabel } from "./lib.js";

// Share a venue pin, never the visitor's GPS position or private SunSpot URL.
export function placeMapsUrl(place) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${place.lat},${place.lng}`);
  return url.href;
}

export function placeShareData({
  place,
  result,
  instant,
  live,
  pending,
  locale,
  t,
}) {
  const when = `${dateLabel(instant, locale)} ${clock(instant)}`;
  let sunlight = t("Solläget är inte känt för den valda tiden.");
  if (!pending && result?.eligible && result.state !== "unknown") {
    if (result.state === "shade")
      sunlight = t("Platsen ligger i beräknad byggnadsskugga.");
    else if (result.state === "sun") {
      if (result.park)
        sunlight = t(
          "Delar av parken har beräknad sol. Trädskuggor ingår inte.",
        );
      else if (Number.isFinite(result.until) && result.until > 0) {
        const end = clock(new Date(Date.parse(instant) + result.until * 60000));
        sunlight =
          result.reason === "shade"
            ? t("Ca {0} min möjlig sol från vald tid, till ca {1}.", [
                result.until,
                end,
              ])
            : t("Minst {0} min möjlig sol från vald tid, till ca {1}.", [
                result.until,
                end,
              ]);
      }
    }
  }
  const text = [
    live
      ? t("Jag sitter på {0} – kom!", [place.name])
      : t("Ska vi ses på {0}?", [place.name]),
    `${place.district} · ${t("Köpenhamn")}`,
    t("Solläge för {0} (Köpenhamnstid):", [when]),
    sunlight,
    t("Uppskattning från byggnader; moln kan skymma solen."),
  ].join("\n");
  return { title: place.name, text, url: placeMapsUrl(place) };
}
