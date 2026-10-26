import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const ZONE = "Europe/Copenhagen";
export const localDate = (date = new Date()) =>
  formatInTimeZone(date, ZONE, "yyyy-MM-dd");
export function dayOptions() {
  const today = fromZonedTime(`${localDate()}T12:00:00`, ZONE);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() + i * 86400_000);
    return {
      value: localDate(date),
      label:
        i === 0
          ? "Idag"
          : i === 1
            ? "Imorgon"
            : new Intl.DateTimeFormat("sv-SE", {
                weekday: "short",
                timeZone: ZONE,
              })
                .format(date)
                .replace(".", ""),
      day: new Intl.DateTimeFormat("sv-SE", {
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
export const dateLabel = (date) =>
  new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONE,
  }).format(new Date(date));
export const durationLabel = (mins) =>
  mins >= 60
    ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}`
    : `${mins} min`;

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
  if (!forecast || weather.stale)
    return { state: "unknown", label: "Aktuell väderprognos saknas" };
  const symbol = forecast.symbol || "";
  if (/rain|snow|sleet|thunder/.test(symbol) || forecast.rain > 0)
    return { state: "rain", label: "Nederbörd i prognosen" };
  // Conservative cloud cutoff; use direct-sun probability if MET supplies it.
  if (symbol === "cloudy" || symbol === "fog" || forecast.cloud >= 80)
    return { state: "cloud", label: "Moln eller dimma i prognosen" };
  if (/^(clearsky|fair|partlycloudy)_day$/.test(symbol))
    return { state: "sun", label: "Möjlig sol enligt prognosen" };
  return { state: "unknown", label: "Sol kan inte bekräftas av prognosen" };
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

export function weatherText(symbol = "") {
  if (symbol.includes("thunder")) return "Åskrisk";
  if (symbol.includes("rain")) return "Regn i prognosen";
  if (symbol.includes("snow") || symbol.includes("sleet"))
    return "Snö / snöblandat";
  if (symbol.includes("clearsky")) return "Klart väder";
  if (symbol.includes("fair")) return "Mestadels klart";
  if (symbol.includes("partlycloudy")) return "Växlande molnighet";
  if (symbol.includes("fog")) return "Dimma";
  return "Molnigt";
}
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Något gick fel. Försök igen.");
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
