import { formatInTimeZone } from "date-fns-tz";
const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
// Deliberately narrow OSM weekly syntax. Seasonal/holiday/open-ended rules stay unknown.
export function parseWeeklyHours(raw) {
  if (raw === "24/7")
    return [{ days: [0, 1, 2, 3, 4, 5, 6], start: 0, end: 1440 }];
  if (typeof raw !== "string" || !raw.trim()) return null;
  const periods = [];
  for (const rule of raw
    .replace(/(?<=\d{2}:\d{2}),\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-|\s))/g, ";")
    .split(";")) {
    const day = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
    const dayRange = `${day}(?:-${day})?`;
    const match = rule
      .trim()
      .match(
        new RegExp(
          `^(?:(${dayRange}(?:,\\s*${dayRange})*)\\s+)?(off|\\d{2}:\\d{2}-\\d{2}:\\d{2}(?:,\\s*\\d{2}:\\d{2}-\\d{2}:\\d{2})*)$`,
        ),
      );
    if (!match) return null;
    const days = [];
    for (const group of (match[1] || "Mo-Su").split(",")) {
      const [a, b = a] = group.trim().split("-");
      let i = weekdays.indexOf(a),
        end = weekdays.indexOf(b);
      for (let n = 0; n < 7; n++, i = (i + 1) % 7) {
        days.push(i);
        if (i === end) break;
      }
    }
    if (match[2] === "off") {
      if (periods.some((p) => p.days.some((d) => days.includes(d))))
        return null;
      continue;
    }
    for (const range of match[2].split(",")) {
      const [a, b] = range
        .trim()
        .split("-")
        .map((x) => {
          const [h, m] = x.split(":").map(Number);
          return m < 60 && h <= 24 && (h < 24 || m === 0) ? h * 60 + m : NaN;
        });
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || a === 1440)
        return null;
      periods.push({ days, start: a, end: b <= a ? b + 1440 : b });
    }
  }
  return periods;
}
export function openingAt(raw, instant, duration = 0) {
  if (raw === "24/7")
    return {
      state: "open",
      label: "Öppet enligt OSM",
      remaining: Infinity,
      raw,
    };
  const periods = parseWeeklyHours(raw);
  if (!periods) return { state: "unknown", label: "Öppettider okända", raw };
  const day = Number(formatInTimeZone(instant, "Europe/Copenhagen", "i")) - 1;
  const minute =
    Number(formatInTimeZone(instant, "Europe/Copenhagen", "H")) * 60 +
    Number(formatInTimeZone(instant, "Europe/Copenhagen", "m"));
  let remaining = 0;
  for (const p of periods) {
    if (p.days.includes(day) && minute >= p.start && minute < p.end)
      remaining = Math.max(remaining, p.end - minute);
    if (p.days.includes((day + 6) % 7) && p.end > 1440 && minute < p.end - 1440)
      remaining = Math.max(remaining, p.end - 1440 - minute);
  }
  return remaining
    ? {
        state: "open",
        label:
          remaining < duration
            ? `Stänger om ${remaining} min`
            : "Öppet enligt OSM",
        remaining,
        closesBeforeEnd: remaining < duration,
        raw,
      }
    : { state: "closed", label: "Stängt enligt OSM", remaining: 0, raw };
}
