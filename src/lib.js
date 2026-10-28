import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { localeFor, translate } from "./i18n.js";

export const ZONE = "Europe/Copenhagen";
export const localDate = (date = new Date()) =>
  formatInTimeZone(date, ZONE, "yyyy-MM-dd");
export function dayOptions(language = "da") {
  const today = fromZonedTime(`${localDate()}T12:00:00`, ZONE);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() + i * 86400_000);
    return {
      value: localDate(date),
      label:
        i === 0
          ? translate(language, "day.today")
          : i === 1
            ? translate(language, "day.tomorrow")
            : new Intl.DateTimeFormat(localeFor(language), {
                weekday: "short",
                timeZone: ZONE,
              })
                .format(date)
                .replace(".", ""),
      day: new Intl.DateTimeFormat(localeFor(language), {
        day: "numeric",
        month: "short",
        timeZone: ZONE,
      }).format(date),
    };
  });
}
export const atHour = (date, hour) =>
  fromZonedTime(
    `${date}T${String(Math.floor(Math.round(hour * 60) / 60)).padStart(2, "0")}:${String(Math.round(hour * 60) % 60).padStart(2, "0")}:00`,
    ZONE,
  );
export const clock = (date) =>
  date ? formatInTimeZone(date, ZONE, "HH:mm") : "—";
export const dateLabel = (date, language = "da") =>
  new Intl.DateTimeFormat(localeFor(language), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONE,
  }).format(new Date(date));
export function durationLabel(mins, language = "da") {
  const number = new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 1 });
  return translate(language, mins < 60 ? "duration.minutes" : mins % 60 ? "duration.hoursMinutes" : "duration.hours", {
    hours: number.format(Math.floor(mins / 60)),
    minutes: number.format(mins < 60 ? mins : mins % 60),
  });
}

export function weatherAt(weather, date) {
  if (!weather?.available) return null;
  const target = new Date(date).getTime();
  const rows = weather.timeseries;
  if (!rows?.length || target < Date.parse(rows[0].time)) return null;
  let row;
  for (const candidate of rows) {
    if (Date.parse(candidate.time) <= target) row = candidate;
    else break;
  }
  if (!row) return null;
  const key = ["next_1_hours", "next_6_hours", "next_12_hours"].find(
    (k) => row.data[k],
  );
  if (!key) return null;
  const hours = Number(key.split("_")[1]);
  if (target >= Date.parse(row.time) + hours * 3600_000) return null;
  return {
    temperature: row.data.instant?.details?.air_temperature,
    wind: row.data.instant?.details?.wind_speed,
    cloud: row.data.instant?.details?.cloud_area_fraction,
    symbol: row.data[key].summary?.symbol_code,
    rain: row.data[key].details?.precipitation_amount,
    hours,
    time: row.time,
  };
}

export function sunshineWeather(weather, instant) {
  const forecast = weatherAt(weather, instant);
  const condition = (state, code) => ({ state, code, label: translate("sv", code) });
  if (!forecast || weather.stale)
    return condition("unknown", "weather.currentMissing");
  const symbol = forecast.symbol || "";
  if (/rain|snow|sleet|thunder/.test(symbol) || forecast.rain > 0)
    return condition("rain", "weather.precipitation");
  // Conservative cloud cutoff; use direct-sun probability if MET supplies it.
  if (symbol === "cloudy" || symbol === "fog" || forecast.cloud >= 80)
    return condition("cloud", "weather.cloudFog");
  if (/^(clearsky|fair|partlycloudy)_day$/.test(symbol))
    return condition("sun", "weather.possibleSun");
  return condition("unknown", "weather.unconfirmedSun");
}

export function weatherConditionLabel(condition, language = "da") {
  const code = condition?.code || ({ sun: "weather.possibleSun", cloud: "weather.cloudFog", rain: "weather.precipitation" })[condition?.state] || "weather.currentMissing";
  return translate(language, code);
}

export function openingLabel(opening, language = "da") {
  if (!opening) return translate(language, "opening.pending");
  if (opening.state === "open")
    return translate(language, opening.closesBeforeEnd ? "opening.closing" : "opening.open", { minutes: opening.remaining });
  return translate(language, opening.state === "closed" ? "opening.closed" : "opening.unknown");
}

// OSM additions use category copy; add an ID override when curating a new place.
const editorialPlaces = new Set(["kongens-have", "kayak-bar", "la-banchina", "orstedsparken", "brus", "host", "ofelia"]);
const editorialKinds = new Set(["kayak-bar", "la-banchina", "orstedsparken", "brus", "ofelia"]);

export function placeText(place, field, language = "da") {
  if (!place) return "";
  if (field === "district") return place.district === "Köpenhamn med omnejd" ? translate(language, "place.district.surroundings") : place.district;
  if (field === "kind") return translate(language, `place.kind.${editorialKinds.has(place.id) ? place.id : place.category}`);
  if (field === "description" || field === "meeting") {
    const key = editorialPlaces.has(place.id) ? place.id : place.category === "park" ? "park" : "venue";
    return translate(language, `place.${field}.${key}`);
  }
  return place[field] || "";
}

export function applySunshineWeather(results, condition) {
  if (condition.state === "sun") return results;
  const state =
    condition.state === "unknown" ? "weather-unknown" : condition.state;
  return Object.fromEntries(
    Object.entries(results).map(([id, result]) => [
      id,
      result.state === "sun" ? { ...result, state } : result,
    ]),
  );
}

export function weatherText(symbol = "", language = "da") {
  if (symbol.includes("thunder")) return translate(language, "weather.thunder");
  if (symbol.includes("rain")) return translate(language, "weather.rain");
  if (symbol.includes("snow") || symbol.includes("sleet"))
    return translate(language, "weather.snow");
  if (symbol.includes("clearsky")) return translate(language, "weather.clear");
  if (symbol.includes("fair")) return translate(language, "weather.fair");
  if (symbol.includes("partlycloudy")) return translate(language, "weather.partlyCloudy");
  if (symbol.includes("fog")) return translate(language, "weather.fog");
  return translate(language, "weather.cloudy");
}
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Något gick fel. Försök igen."), { status: response.status, code: data.code, params: data.params || {} });
  return data;
}
export function saved(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(`sunspot:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(`sunspot:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Scandinavian spelling variants: ø/ö/o, æ/ä/ae and å/a.
export function normalizeSearch(value) {
  return value
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ä", "ae")
    .replaceAll("ø", "o")
    .replaceAll("ö", "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/faelledsparken/g, "faelledparken")
    .trim();
}
