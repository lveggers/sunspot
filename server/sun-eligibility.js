import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzePlaces, createExposureModel } from "../src/exposure.js";
import { openingAt } from "../src/openingHours.js";
import { sunshineWeather, weatherAt } from "../src/lib.js";
import { places } from "../src/places.js";
import { venueAreas } from "../src/venueAreas.js";

export function createSunEligibility(getWeather) {
  let model;
  return async function getSunEligibility(placeId, now = new Date()) {
    const denied = (reason) => ({ allowed: false, reason, until: 0 });
    now = new Date(now);
    if (!Number.isFinite(Number(now))) return denied("Tidpunkten är ogiltig.");
    const place = places.find((candidate) => candidate.id === placeId);
    if (!place || !["bar", "restaurant"].includes(place.category))
      return denied("Golden Hour gäller anslutna barer och restauranger.");
    if (place.outdoor === "no")
      return denied("Ingen uteservering är registrerad för platsen.");
    if (openingAt(place.openingHours, now).state !== "open")
      return denied("Platsen måste vara bekräftat öppen enligt OSM.");
    let weather;
    try {
      weather = await getWeather();
    } catch {
      return denied("Vädret kunde inte kontrolleras. Försök igen.");
    }
    const condition = sunshineWeather(weather, now);
    if (condition.state !== "sun") return denied(condition.label);
    try {
      model ??= createExposureModel(
        JSON.parse(
          readFileSync(
            join(process.cwd(), "public/data/copenhagen-buildings.json"),
            "utf8",
          ),
        ),
      );
      const result = analyzePlaces(model, [place], venueAreas, now)[place.id];
      if (!result.eligible || result.state !== "sun")
        return denied(
          result.state === "shade"
            ? "Utepunkten ligger i byggnadsskugga eller solen har gått ner."
            : "Solläget vid utepunkten kan inte bekräftas.",
        );
      const forecast = weatherAt(weather, now);
      const forecastMinutes =
        (Date.parse(forecast.time) + forecast.hours * 3600_000 - Number(now)) /
        60000;
      return {
        allowed: true,
        reason: "Öppet, beräknad byggnadssol och sol i aktuell prognos.",
        until: Math.max(
          0,
          Math.min(result.until, result.opening.remaining, forecastMinutes),
        ),
      };
    } catch {
      return denied("Skuggdata kunde inte kontrolleras. Försök igen.");
    }
  };
}
