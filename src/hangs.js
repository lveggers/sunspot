export const hangActivities = [
  { id: "beer", emoji: "🍺", label: "En öl", verb: "tar en öl" },
  { id: "coffee", emoji: "☕", label: "Kaffe", verb: "tar en kaffe" },
  { id: "food", emoji: "🍽️", label: "Mat", verb: "äter något" },
  { id: "hang", emoji: "👋", label: "Bara hänga", verb: "hänger" },
];
export function readHangLocal(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(`sunspot:hang:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeHangLocal(key, value) {
  try {
    localStorage.setItem(`sunspot:hang:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function newHangToken() {
  return (
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "")
  );
}
export async function hangRequest(path = "", { token, body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/hangs${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Det gick inte att nå hänget. Försök igen.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Det gick inte att nå hänget. Försök igen.");
  }
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "Det gick inte att nå hänget. Försök igen."),
      { status: response.status },
    );
  return data;
}
export function rememberHang(h, token) {
  rememberVisitedHang(h);
  if (!writeHangLocal(`host:${h.id}`, token)) return false;
  const current = readHangLocal("mine", []).filter(
    (item) => item.endsAt > Date.now() - 86400000 && item.id !== h.id,
  );
  writeHangLocal(
    "mine",
    [{ id: h.id, name: h.place.name, endsAt: h.endsAt }, ...current].slice(
      0,
      30,
    ),
  );
  return true;
}
export function readRecentHangs() {
  const values = [
    readHangLocal("recent", []),
    readHangLocal("mine", []),
  ].flatMap((v) => (Array.isArray(v) ? v : []));
  const unique = new Map();
  for (const h of values)
    if (
      h &&
      /^[a-f0-9]{32}$/.test(h.id) &&
      typeof h.name === "string" &&
      Number.isFinite(h.endsAt) &&
      h.endsAt > Date.now() - 86400000 &&
      !unique.has(h.id)
    )
      unique.set(h.id, h);
  return [...unique.values()].slice(0, 30);
}
export function rememberVisitedHang(h) {
  const item = {
    id: h.id,
    name: h.place.name,
    startsAt: h.startsAt,
    endsAt: h.endsAt,
    status: h.status,
    isHost: h.isHost,
    joined: h.joined,
  };
  const current = readRecentHangs().filter((value) => value.id !== h.id);
  writeHangLocal("recent", [item, ...current].slice(0, 30));
}
export function hangTime(time, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Copenhagen",
  }).format(time);
}
export function hangDate(time, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Copenhagen",
  }).format(time);
}
