import { LanguageProvider, LanguageSelect, useLanguage } from "./Language.jsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  SlidersHorizontal,
  List,
  Sparkles,
  CalendarDays,
  ChevronRight,
  Clock3,
  Cloud,
  CloudRain,
  CloudSun,
  Sprout,
  Info,
  MapPin,
  Search,
  Sun,
  Users,
  Utensils,
  Wine,
  Wind,
  X,
} from "lucide-react";
import NearbyPlaces from "./NearbyPlaces.jsx";
import {
  venueEvidence,
  terraceLabel,
  evidenceReviewedAt,
} from "./venueEvidence.js";
import MapView from "./MapView.jsx";
import EventDetails from "./EventDetails.jsx";
import Invite from "./Invite.jsx";
import * as SunCalc from "suncalc";
import { createDemoEvents, eventsAt } from "./events.js";
import { distanceMeters } from "./exposure.js";
import { useSolarModel } from "./useSolarModel.js";
import SolarWatch, { solarLabel } from "./SolarWatch.jsx";
import { activityFor, activityNames, places } from "./places.js";
import {
  api,
  normalizeSearch,
  atHour,
  clock,
  dayOptions,
  localDate,
  durationLabel,
  saved,
  save,
  weatherAt,
  weatherText,
} from "./lib.js";
const categories = [
  {
    id: "all",
    label: "Alla",
    icon: Sun,
  },
  {
    id: "park",
    label: "Touchgrass",
    icon: Sprout,
  },
  {
    id: "bar",
    label: "Bar",
    icon: Wine,
  },
  {
    id: "restaurant",
    label: "Mat",
    icon: Utensils,
  },
  {
    id: "event",
    label: "Event",
    icon: Sparkles,
  },
];
function WeatherIcon({ symbol = "", ...props }) {
  const Icon = symbol.includes("rain")
    ? CloudRain
    : symbol.includes("clearsky")
      ? Sun
      : symbol.includes("fair") || symbol.includes("partlycloudy")
        ? CloudSun
        : Cloud;
  return <Icon {...props} />;
}
function Modal({ title, children, onClose, className = "" }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      className={`modal ${className}`}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("Stäng")}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function PlaceCard({ place, selected, result, onSelect }) {
  const { t } = useLanguage();
  return (
    <button
      className={`place-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(place)}
      aria-pressed={selected}
    >
      <div className="place-art" data-category={place.category}>
        <span>{place.emoji}</span>
        <small>
          {place.category === "park"
            ? t("UTE")
            : place.category === "bar"
              ? t("BAR")
              : t("MAT")}
        </small>
      </div>
      <div className="place-copy">
        <div className="place-name">
          <h3>{place.name}</h3>
          <ArrowUpRight size={17} />
        </div>
        <p>
          {t(place.kind)} <span>·</span> {place.district}
        </p>
        <div className={`sun-status ${result?.state === "sun" ? "" : "muted"}`}>
          <Sun size={14} />
          {t(solarLabel(result))}
        </div>
        <small className="opening-status">
          {t(result?.opening.label) || t("Öppettider kontrolleras…")}
        </small>
      </div>
    </button>
  );
}
function CreateForm({ place, date, hour, duration, onClose }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [host, setHost] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api("/gatherings", {
        method: "POST",
        body: JSON.stringify({
          placeId: place.id,
          activity: activityFor(place.category),
          startsAt: atHour(date, hour).toISOString(),
          duration,
          host,
          message,
        }),
      });
      const stored = save(`host:${created.id}`, created.hostToken);
      save("gatherings", [
        {
          id: created.id,
          name: place.name,
        },
        ...saved("gatherings", []),
      ]);
      if (!stored) {
        setError(
          "Träffen skapades men webbläsaren blockerar lagring. Tillåt lokal lagring för att kunna hantera träffen.",
        );
        setBusy(false);
        return;
      }
      router.push(`/invite/${created.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal title={t("Samla dina vänner")} onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <div className="plan-summary">
          <span className="plan-emoji">{place.emoji}</span>
          <div>
            <strong>{place.name}</strong>
            <p>{t(activityNames[activityFor(place.category)])}</p>
          </div>
        </div>
        <div className="plan-time">
          <CalendarDays size={17} />
          {date}
          <span>·</span>
          {clock(atHour(date, hour))}
          <span>·</span>
          {durationLabel(duration)}
        </div>
        <label htmlFor="host">{t("Ditt namn")}</label>
        <input
          id="host"
          required
          autoFocus
          autoComplete="given-name"
          maxLength={50}
          placeholder={t("Till exempel Carl")}
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <label htmlFor="message">
          {t("Ett meddelande ")}
          <span className="optional">{t("(valfritt)")}</span>
        </label>
        <textarea
          id="message"
          rows={3}
          maxLength={300}
          placeholder={t("Ska vi ses här och fånga lite sol?")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="fineprint">
          {t(
            "Du får en länk med plats, tid och möjlighet att svara. Solläget är en uppskattning; ingen bordsbokning görs.",
          )}
        </p>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? t("Skapar…") : t("Skapa inbjudan")}
          <ArrowUpRight size={19} />
        </button>
      </form>
    </Modal>
  );
}
function SunspotApp() {
  const { t, locale } = useLanguage();
  const [days, setDays] = useState(dayOptions);
  const demoEvents = useMemo(
    () => createDemoEvents(days.map((day) => day.value)),
    [days],
  );
  const [showDemoEvents, setShowDemoEvents] = useState(() =>
    saved("demo-events", false),
  );
  const [eventFeed, setEventFeed] = useState({
    events: [],
    loading: true,
    message: null,
  });
  const events = [...eventFeed.events, ...(showDemoEvents ? demoEvents : [])];
  const eventFrom = atHour(days[0].value, 0).toISOString();
  const eventTo = atHour(
    localDate(new Date(atHour(days.at(-1).value, 12).getTime() + 86400_000)),
    0,
  ).toISOString();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [watchOpen, setWatchOpen] = useState(false);
  const [date, setDate] = useState(days[0].value),
    [hour, setHour] = useState(() => {
      const [h, m] = clock(new Date()).split(":").map(Number);
      return h + m / 60;
    }),
    [duration, setDuration] = useState(90);
  const [category, setCategory] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(places[0]);
  const [weather, setWeather] = useState(null),
    [weatherLoading, setWeatherLoading] = useState(true),
    [modal, setModal] = useState(null);
  const inviteId = window.location.pathname.startsWith("/invite/")
    ? window.location.pathname.split("/")[2]
    : null;
  useEffect(() => {
    if (inviteId) return;
    const controller = new AbortController();
    api("/weather", {
      signal: controller.signal,
    })
      .then(setWeather)
      .catch((e) => {
        if (e.name !== "AbortError")
          setWeather({
            available: false,
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false);
      });
    return () => controller.abort();
  }, [inviteId]);
  useEffect(() => {
    if (inviteId) return;
    const controller = new AbortController();
    const loadEvents = () =>
      api(
        `/events?from=${encodeURIComponent(eventFrom)}&to=${encodeURIComponent(eventTo)}`,
        {
          signal: controller.signal,
        },
      )
        .then((data) => {
          if (!controller.signal.aborted)
            setEventFeed({
              ...data,
              loading: false,
            });
        })
        .catch((error) => {
          if (error.name !== "AbortError")
            setEventFeed({
              events: [],
              loading: false,
              message: "Event kunde inte hämtas. Försök igen om en stund.",
            });
        });
    loadEvents();
    const timer = setInterval(loadEvents, 15 * 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [inviteId, eventFrom, eventTo]);
  const [onlySun, setOnlySun] = useState(true),
    [onlyOpen, setOnlyOpen] = useState(false);
  const [seatError, setSeatError] = useState("");
  const [viewReset, setViewReset] = useState(0);
  const activeFilters =
    Number(category !== "all") +
    Number(Boolean(query.trim())) +
    Number(onlySun) +
    Number(onlyOpen);
  const [editing, setEditing] = useState(false),
    [watchId, setWatchId] = useState(null),
    [live, setLive] = useState(true);
  const [overrides, setOverrides] = useState(() => {
    const value = saved("seats:v1") || {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, p]) =>
          places.some((v) => v.id === id) &&
          Array.isArray(p) &&
          p.length === 2 &&
          p.every(Number.isFinite) &&
          p[0] >= 12.53 &&
          p[0] <= 12.632 &&
          p[1] >= 55.662 &&
          p[1] <= 55.711,
      ),
    );
  });
  const syncNow = useCallback(() => {
    const now = new Date();
    const today = localDate(now);
    setDays((previous) =>
      previous[0].value === today ? previous : dayOptions(),
    );
    setDate(today);
    const [h, m] = clock(now).split(":").map(Number);
    setHour(h + m / 60);
  }, []);
  const goNow = useCallback(() => {
    syncNow();
    setLive(true);
  }, [syncNow]);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(syncNow, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") syncNow();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [live, syncNow]);
  const timelineMinute = Math.round(hour * 60);
  const timelineMax = 1439;
  const instant = atHour(date, hour).toISOString();
  const solar = useSolarModel(instant, overrides, duration, !inviteId);
  const results = solar.results;
  const matchingEvents = events.filter((event) =>
    normalizeSearch(
      [event.name, event.venue, ...(event.tags || [])].join(" "),
    ).includes(normalizeSearch(query)),
  );
  const visibleEvents =
    category === "all" || category === "event"
      ? eventsAt(matchingEvents, instant)
      : [];
  const activeEvent = visibleEvents.find(
    (event) => event.id === selectedEventId,
  );
  const result = results[selected.id];
  const sunset = SunCalc.getTimes(atHour(date, 12), 55.6865, 12.581).sunset;
  const forecast = weatherAt(weather, atHour(date, hour));
  const matching = places.filter(
    (p) =>
      (category === "all" ||
        (p.category === category && (category !== "park" || p.greenSpace))) &&
      normalizeSearch(`${p.name} ${p.district}`).includes(
        normalizeSearch(query),
      ),
  );
  const filtered = matching
    .filter((p) => {
      const r = results[p.id];
      if (
        onlySun &&
        (!r ||
          !r.eligible ||
          r.state === "shade" ||
          r.opening.state === "closed")
      )
        return false;
      if (onlyOpen && r?.opening.state !== "open") return false;
      return true;
    })
    .sort((a, b) => (results[b.id]?.until || 0) - (results[a.id]?.until || 0));
  const choosePoint = useCallback(
    (point) => {
      if (
        point[0] < 12.53 ||
        point[0] > 12.632 ||
        point[1] < 55.662 ||
        point[1] > 55.711 ||
        distanceMeters(point, [selected.lng, selected.lat]) > 100
      ) {
        setSeatError("Välj en sittplats inom 100 meter från stället.");
        return;
      }
      setSeatError("");
      setOverrides((previous) => {
        const next = {
          ...previous,
          [selected.id]: point,
        };
        save("seats:v1", next);
        return next;
      });
      setEditing(false);
    },
    [selected],
  );
  const selectPlace = useCallback(
    (place) => {
      setSelected(place);
      setDetailOpen(true);
      setSelectedEventId(null);
      setModal(null);
      setWatchOpen(false);
      setEditing(false);
    },
    [setModal],
  );
  const selectMarker = useCallback(
    (item) => {
      if (item.category === "event") {
        setSelectedEventId(item.id);
        setDetailOpen(false);
        setEditing(false);
        setModal(null);
      } else selectPlace(item);
    },
    [selectPlace, setModal],
  );
  const closeEvent = useCallback(() => setSelectedEventId(null), []);
  function jumpToEvent(event) {
    const chosen = new Date(
      Math.max(Date.parse(event.startsAt), Date.parse(eventFrom)),
    );
    setDate(localDate(chosen));
    const [h, m] = clock(chosen).split(":").map(Number);
    setHour(h + m / 60);
    setLive(false);
    setCategory("event");
    selectMarker(event);
  }
  function clearFilters() {
    setCategory("all");
    setDetailOpen(false);
    setSelectedEventId(null);
    setQuery("");
    setOnlySun(false);
    setOnlyOpen(false);
    setEditing(false);
    setSeatError("");
    setViewReset((value) => value + 1);
  }
  function changeCategory(value) {
    if (value === "all") {
      clearFilters();
      return;
    }
    setCategory(value);
    setEditing(false);
    setDetailOpen(false);
    setSelectedEventId(null);
  }
  return (
    <>
      <header className={`header ${!inviteId ? "map-header" : ""}`}>
        <Link className="brand" href="/" aria-label={t("SunSpot startsida")}>
          <span className="brand-icon">
            <Sun size={27} strokeWidth={2.1} />
          </span>
          SunSpot<span className="beta">{t("preview")}</span>
        </Link>
        <nav aria-label="Huvudmeny">
          <Link href="/" className={!inviteId ? "nav-active" : ""}>
            {t("Utforska")}
          </Link>
          <button onClick={() => setModal("gatherings")}>
            <Users size={16} />
            {t(" Mina träffar")}
          </button>
        </nav>
        <div className="header-city">
          <MapPin size={15} />
          {t(" Köpenhamn")}
          <span className="city-flag">🇩🇰</span>
        </div>
      </header>
      {inviteId ? (
        <>
          <div className="invite-language">
            <LanguageSelect />
          </div>
          <Invite id={inviteId} />
        </>
      ) : (
        <>
          <main className="map-workspace" data-solar-pending={solar.pending}>
            <div className="map-toolbar">
              <div className="map-search-row">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    aria-label={t("Sök plats eller område")}
                    placeholder={t("Sök en plats eller ett område")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label={t("Rensa sökning")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <button
                  className="toolbar-button"
                  aria-label={t("Öppna filter")}
                  onClick={() => setModal("filters")}
                >
                  <SlidersHorizontal size={19} />
                  {activeFilters > 0 && (
                    <span className="filter-count">{activeFilters}</span>
                  )}
                </button>
                <button
                  className="toolbar-button"
                  aria-label={t("Visa platslista")}
                  onClick={() => setModal("list")}
                >
                  <List size={19} />
                </button>
              </div>
              <div className="activity-tabs">
                {categories.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={category === id ? "active" : ""}
                    data-category={id}
                    aria-pressed={category === id}
                    onClick={() => changeCategory(id)}
                  >
                    <Icon size={17} />
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
            <MapView
              pending={solar.pending}
              category={category}
              viewReset={viewReset}
              places={filtered}
              events={visibleEvents}
              selected={activeEvent || (detailOpen ? selected : null)}
              onSelect={selectMarker}
              date={date}
              hour={hour}
              results={results}
              buildings={solar.buildings}
              dataError={solar.error}
              onRetry={solar.retry}
              point={
                detailOpen ? result?.point || overrides[selected.id] : null
              }
              editing={editing}
              seatError={seatError}
              onCancelEdit={() => setEditing(false)}
              onPointChange={choosePoint}
            >
              {detailOpen && !activeEvent && (
                <article className="detail-card" aria-label={t("Vald plats")}>
                  <button
                    className="detail-close icon-button"
                    aria-label={t("Stäng plats")}
                    onClick={() => {
                      setDetailOpen(false);
                      setEditing(false);
                    }}
                  >
                    <X size={18} />
                  </button>
                  <div className="detail-top">
                    <span className="detail-category">
                      {t(selected.kind)} <span>·</span> {selected.district}
                    </span>
                    <span className="demo-badge">
                      {t("BERÄKNAT · OSÄKERT")}
                    </span>
                  </div>
                  <h2>
                    {selected.name}
                    <span>{selected.emoji}</span>
                  </h2>
                  <div className="sun-window">
                    <div>
                      <Sun size={22} />
                      <span>
                        {selected.category === "park"
                          ? t("Parkens provpunkter")
                          : t("Vald utomhuspunkt")}
                        <strong>
                          {solar.pending
                            ? t("Beräknar solläge…")
                            : t(solarLabel(result))}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="place-confidence">
                    <p>
                      {selected.category === "park"
                        ? t("Delvis sol · trädskuggor ingår inte")
                        : t(terraceLabel(selected))}
                    </p>
                    {selected.category !== "park" && (
                      <p>
                        {result?.pointSource === "chosen"
                          ? t("Din valda punkt")
                          : t("Uppskattad sittpunkt")}{" "}
                        {t("· inte fältverifierad")}
                      </p>
                    )}
                    <p>
                      {t("Prognos:")}{" "}
                      {forecast
                        ? `${Math.round(forecast.temperature)}° · ${t(weatherText(forecast.symbol))}`
                        : t("saknas")}{" "}
                      {t("· separat från byggnadssol")}
                    </p>
                  </div>
                  <details className="place-more">
                    <summary>{t("Mer om platsen")}</summary>
                    <p className="detail-description">
                      {t(selected.description)}
                    </p>
                    {venueEvidence[selected.id] && (
                      <p className="point-note">
                        {t(venueEvidence[selected.id].note)}{" "}
                        {venueEvidence[selected.id].url && (
                          <a
                            href={venueEvidence[selected.id].url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("Källa:")}{" "}
                            {venueEvidence[selected.id].sourceName ||
                              t("ställets webbplats")}
                          </a>
                        )}{" "}
                        {t("· Underlag granskat ")}
                        {evidenceReviewedAt}
                        {t(". Sittplatsens läge är inte verifierat.")}
                      </p>
                    )}
                    <p className="point-note">
                      {selected.category === "park"
                        ? result?.state === "unknown"
                          ? t(
                              "Solläget är okänt när skuggdata saknas eller solen står för lågt. Trädskuggor ingår inte.",
                            )
                          : t(
                              "Delvis soliga parker finns kvar i urvalet. Trädskuggor ingår inte.",
                            )
                        : result?.pointSource === "chosen"
                          ? t(
                              "Din valda punkt visas i blått. Höjder är delvis uppskattade.",
                            )
                          : t(
                              "Blå punkt är en uppskattad utomhuspunkt, inte en verifierad uteservering.",
                            )}
                    </p>
                    {result && !filtered.some((p) => p.id === selected.id) && (
                      <p className="point-note">
                        {t(
                          "Platsen döljs av ditt filter. Det valda kortet finns kvar så att du kan följa förändringen.",
                        )}
                      </p>
                    )}
                    {selected.category !== "park" && (
                      <div className="seat-actions">
                        <button
                          onClick={() => {
                            setSeatError("");
                            setEditing((v) => !v);
                          }}
                        >
                          {editing
                            ? t("Avbryt punktval")
                            : t("Välj min sittplats på kartan")}
                        </button>
                        <button
                          disabled={
                            !result?.eligible ||
                            result?.state === "unknown" ||
                            solar.pending
                          }
                          onClick={() => {
                            setWatchId(selected.id);
                            setWatchOpen(true);
                          }}
                        >
                          {t("Bevaka solen här")}
                        </button>
                      </div>
                    )}
                    <div className="detail-foot">
                      <a
                        href={`https://www.openstreetmap.org/${selected.osm}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin size={14} />
                        {t(" Visa platskälla")}
                      </a>
                      <span title={result?.opening.raw || undefined}>
                        {t(result?.opening.label) || t("Öppettider okända")}
                      </span>
                    </div>
                  </details>
                  <button
                    className="primary wide"
                    onClick={() => setModal("create")}
                  >
                    {t("Ses här med vänner")}
                    <ArrowUpRight size={20} />
                  </button>
                </article>
              )}
              {watchId && (
                <button
                  className="watch-peek"
                  onClick={() => setWatchOpen((value) => !value)}
                >
                  {t(solarLabel(results[watchId]))}
                  {t(" · Visa solbevakning")}
                </button>
              )}
            </MapView>
            {activeEvent && (
              <EventDetails
                key={activeEvent.id}
                event={activeEvent}
                weather={weather}
                stale={eventFeed.stale}
                onClose={closeEvent}
              />
            )}

            {!detailOpen && !activeEvent && !watchId && (
              <button
                className="nearby-launch"
                onClick={() => setModal("nearby")}
              >
                <MapPin size={18} />
                {t(" Sol nära mig")}
              </button>
            )}
            <section
              className="time-dock controls"
              aria-label={t("Dag och tid")}
            >
              <div className="days">
                {days.map((d) => (
                  <button
                    className={date === d.value ? "active" : ""}
                    key={d.value}
                    aria-pressed={date === d.value}
                    onClick={() => {
                      setLive(false);
                      setDate(d.value);
                    }}
                  >
                    <span>{t(d.label)}</span>
                    <strong>{d.day.split(" ")[0]}</strong>
                  </button>
                ))}
              </div>
              <div className="time-label">
                <label htmlFor="time">{t("Tid på dagen")}</label>
                <button
                  className="now-button"
                  aria-pressed={live}
                  onClick={goNow}
                >
                  {t("Nu")}
                </button>
                <input
                  className="exact-time"
                  type="time"
                  aria-label={t("Exakt klockslag")}
                  step="300"
                  value={clock(atHour(date, hour))}
                  onChange={(event) => {
                    if (!/^\d{2}:\d{2}$/.test(event.target.value)) return;
                    const [h, m] = event.target.value.split(":").map(Number);
                    setLive(false);
                    setHour(h + m / 60);
                  }}
                />
              </div>
              <input
                id="time"
                type="range"
                min="0"
                max={timelineMax}
                step="1"
                value={timelineMinute}
                aria-label={t("Tid på dagen")}
                aria-valuetext={`${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Copenhagen" }).format(atHour(date, hour))} ${clock(atHour(date, hour))}`}
                onChange={(e) => {
                  setLive(false);
                  const minute = Number(e.target.value);
                  setHour(minute / 60);
                }}
                style={{
                  "--progress": `${(timelineMinute / timelineMax) * 100}%`,
                }}
              />
              <div className="range-labels">
                <span>00:00</span>
                <span>12:00</span>
                <span>23:59</span>
              </div>
              <div className="timeline-status">
                <button
                  aria-label={t("Visa veckans event")}
                  onClick={() => {
                    setCategory("event");
                    setModal("list");
                  }}
                >
                  {category === "all" || category === "event" ? (
                    <>
                      {eventFeed.loading
                        ? t("Hämtar event…")
                        : eventFeed.message
                          ? t("Eventkälla saknas / äldre data")
                          : t("{0} event nu · se veckan", [
                              visibleEvents.length,
                            ])}{" "}
                      {showDemoEvents && (
                        <span className="demo-label">{t("inkl. demo")}</span>
                      )}
                    </>
                  ) : (
                    t("{0} platser", [filtered.length])
                  )}
                </button>
                <button
                  onClick={() => setModal("weather")}
                  aria-label={t("Visa väderprognos")}
                >
                  {forecast
                    ? `${Math.round(forecast.temperature)}° · ${t(weatherText(forecast.symbol))}`
                    : t("Väder saknas")}{" "}
                  <CloudSun size={14} />
                </button>
              </div>
            </section>
          </main>
          {watchId && (
            <div className="watch-panel" hidden={!watchOpen}>
              <button
                className="watch-minimize"
                onClick={() => setWatchOpen(false)}
              >
                {t("Tillbaka till kartan ")}
                <X size={14} />
              </button>
              <SolarWatch
                id={watchId}
                results={results}
                instant={instant}
                duration={duration}
                live={live}
                pending={solar.pending}
                onStop={() => setWatchId(null)}
                onSelect={selectPlace}
                onLive={goNow}
              />
            </div>
          )}
          {modal === "filters" && (
            <Modal title={t("Filter")} onClose={() => setModal(null)}>
              <div className="filter-panel controls">
                <LanguageSelect />
                <div className="solar-filters">
                  <label>
                    <input
                      type="checkbox"
                      checked={onlySun}
                      onChange={(e) => setOnlySun(e.target.checked)}
                    />
                    {t("Dölj skugga och stängda platser")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyOpen}
                      onChange={(e) => setOnlyOpen(e.target.checked)}
                    />
                    {t("Bara öppet enligt tillgängliga tider")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showDemoEvents}
                      onChange={(e) => {
                        setShowDemoEvents(e.target.checked);
                        save("demo-events", e.target.checked);
                      }}
                    />
                    {t("Visa demo-event")}
                  </label>
                  <button
                    className="text-button"
                    aria-pressed={live}
                    onClick={() => (live ? setLive(false) : goNow())}
                  >
                    {live
                      ? t("● Följer klockan · pausa")
                      : t("Följ klockan nu")}
                  </button>
                </div>
                <p className="fineprint">
                  {t(
                    "Sol och öppettider filtrerar platser. Event visas under sin start- och sluttid.",
                  )}
                </p>
                <div className="duration-row">
                  <label htmlFor="duration">
                    <Clock3 size={15} />
                    {t(" Tid tillsammans")}
                  </label>
                  <select
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    {[30, 60, 90, 120].map((n) => (
                      <option key={n} value={n}>
                        {durationLabel(n)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    clearFilters();
                    setModal(null);
                  }}
                >
                  {t("Visa allt — ta bort alla filter")}
                </button>
                <button className="primary wide" onClick={() => setModal(null)}>
                  {t("Visa kartan ")}
                  <ChevronRight size={18} />
                </button>
                <button
                  className="text-button mobile-gatherings"
                  onClick={() => setModal("gatherings")}
                >
                  <Users size={16} />
                  {t(" Mina träffar")}
                </button>
                <button
                  className="text-button"
                  onClick={() => setModal("about")}
                >
                  {t("Om förhandsvisningen")}
                </button>
              </div>
            </Modal>
          )}
          {modal === "list" && (
            <Modal
              title={
                category === "event"
                  ? t("Event denna vecka")
                  : t("Platser just nu")
              }
              onClose={() => setModal(null)}
            >
              {category !== "event" && (
                <section className="results">
                  <div className="results-heading">
                    <h2>
                      {solar.pending
                        ? t("Beräknar solläge…")
                        : t("{0} platser att upptäcka", [filtered.length])}
                    </h2>
                    <span>{t("Byggnadsskuggor")}</span>
                  </div>
                  <div className="place-list">
                    {filtered.map((p) => (
                      <PlaceCard
                        key={p.id}
                        place={p}
                        selected={selected.id === p.id}
                        result={results[p.id]}
                        onSelect={selectPlace}
                      />
                    ))}
                    {!filtered.length &&
                      !visibleEvents.length &&
                      !solar.pending && (
                        <div className="empty-state">
                          <Search size={26} />
                          <h3>{t("Ingen plats hittades")}</h3>
                          <p>
                            {solar.error
                              ? t(
                                  "Skuggdata kunde inte laddas. Försök igen på kartan.",
                                )
                              : t(
                                  "Prova en annan tid eller visa även skugga och stängda platser.",
                                )}
                          </p>
                          <button
                            className="text-button"
                            onClick={clearFilters}
                          >
                            {t("Återställ sökningen")}
                          </button>
                        </div>
                      )}
                  </div>
                  <p className="list-note">
                    <Info size={13} />
                    {t(
                      " Beräknad byggnadssol. Barers utomhuspunkter är uppskattade tills du väljer sittplats. Parkers provpunkter tar hänsyn till byggnader och registrerat vatten, inte träd. Okända sollägen och öppettider är märkta.",
                    )}
                  </p>
                </section>
              )}
              {(category === "all" || category === "event") && (
                <>
                  <div className="event-list-heading">
                    <h3>{t("Event denna vecka")}</h3>
                    <span>{matchingEvents.length}</span>
                  </div>
                  {eventFeed.loading && (
                    <p role="status">{t("Hämtar event från Köpenhamn…")}</p>
                  )}
                  {eventFeed.message && (
                    <p className="fineprint" role="status">
                      {t(eventFeed.message)}
                    </p>
                  )}
                  <div className="event-list">
                    {matchingEvents
                      .sort(
                        (a, b) =>
                          Date.parse(a.startsAt) - Date.parse(b.startsAt),
                      )
                      .map((event) => (
                        <button
                          key={event.id}
                          className="event-list-item"
                          onClick={() => jumpToEvent(event)}
                        >
                          <span>{event.emoji}</span>
                          <strong>{event.name}</strong>
                          <small>
                            {clock(new Date(event.startsAt))}–
                            {clock(new Date(event.endsAt))} ·{" "}
                            {localDate(new Date(event.startsAt))}
                            {event.demo ? " · demo" : ""}
                          </small>
                        </button>
                      ))}
                  </div>
                </>
              )}
              {category === "event" &&
                !matchingEvents.length &&
                !eventFeed.loading && (
                  <p className="fineprint">
                    {t("Inga event hittades för den här veckan och sökningen.")}
                  </p>
                )}
            </Modal>
          )}
          {modal === "nearby" && (
            <Modal title={t("Sol nära mig")} onClose={() => setModal(null)}>
              <NearbyPlaces
                places={matching}
                results={results}
                instant={instant}
                pending={solar.pending}
                error={solar.error}
                forecast={forecast}
                onlyOpen={onlyOpen}
                onNow={goNow}
                onSelect={selectPlace}
              />
            </Modal>
          )}
          {modal === "weather" && (
            <Modal
              title={t("Väder för vald tid")}
              onClose={() => setModal(null)}
            >
              <div className="weather-card">
                <div className="weather-top">
                  <div className="weather-icon">
                    {forecast ? (
                      <WeatherIcon symbol={forecast.symbol} size={28} />
                    ) : (
                      <Cloud size={28} />
                    )}
                  </div>
                  <div>
                    <strong>
                      {weatherLoading
                        ? t("Hämtar väder…")
                        : forecast
                          ? `${Math.round(forecast.temperature)}° · ${t(weatherText(forecast.symbol))}`
                          : t("Väderprognos saknas")}
                    </strong>
                    <p>
                      {forecast ? (
                        <>
                          <Wind size={12} />
                          {Math.round(forecast.wind)} m/s <span>·</span>{" "}
                          {forecast.rain ?? "—"} mm / {forecast.hours} h
                        </>
                      ) : weather?.available ? (
                        t("Utanför prognosens tidsintervall")
                      ) : (
                        t("För vald tid i Köpenhamn")
                      )}
                    </p>
                  </div>
                </div>
                <div className="weather-source">
                  <a
                    href="https://www.met.no/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Väder: MET Norway")}
                  </a>
                  <span>
                    {weather?.stale
                      ? t("Äldre prognos")
                      : weather?.available
                        ? t("Uppd. {0}", [clock(new Date(weather.updatedAt))])
                        : t("Yr / MET-spåret")}
                  </span>
                </div>
              </div>
              <p className="fineprint">
                {t("Solnedgång ")}
                {clock(sunset)}
                {t(" · Köpenhamn")}
              </p>
            </Modal>
          )}
        </>
      )}
      {modal === "create" && (
        <CreateForm
          place={selected}
          date={date}
          hour={hour}
          duration={duration}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "about" && (
        <Modal
          title={t("En första titt på SunSpot")}
          onClose={() => setModal(null)}
        >
          <div className="about-content">
            <p>
              {t(
                "Utforska Köpenhamn, välj aktivitet och tid och skapa en träff med dina vänner.",
              )}
            </p>
            <h3>{t("Det här är riktig data")}</h3>
            <p>
              {t("Platsnamn och kartpositioner kommer från")}{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap
              </a>{" "}
              {t("(ODbL). Väder hämtas från")}{" "}
              <a href="https://www.met.no/" target="_blank" rel="noreferrer">
                MET Norway
              </a>{" "}
              (Norsk lisens for offentlige data / CC BY 4.0).{" "}
              {t("Evenemang hämtas från")}{" "}
              <a
                href="https://bibliotek.kk.dk/"
                target="_blank"
                rel="noreferrer"
              >
                Københavns Biblioteker
              </a>
              {t(
                " – öppet API. Soluppgång och solnedgång beräknas med SunCalc.",
              )}
            </p>
            <h3>{t("Beräknade byggnadsskuggor")}</h3>
            <p>
              {t(
                "Kartans mörka lager följer vald dag och tid. Det beräknas från OpenStreetMaps byggnadskonturer och solens position. Där angiven höjd saknas används våningsantal × 3 meter, annars 12 meter. Träd, terräng och detaljerade takformer ingår inte. Streckade ytor ligger utanför modellens täckning. Moln visas bara i väderprognosen.",
              )}
            </p>
            <h3>{t("Urvalet följer solen")}</h3>
            <p>
              {t(
                "Kort och karta använder samma byggnadsmodell. Barer bedöms vid en uppskattad eller självvald utomhuspunkt. Parker provtas över ytan och behålls vid delvis sol. Öppettider kommer från OSM och daterade kontroller av ställenas egna webbplatser; okända eller ej tolkbara tider anges som okända. Modellen är inte fältverifierad.",
              )}
            </p>
            <h3>{t("Träffar fungerar lokalt")}</h3>
            <p>
              {t(
                "Inbjudningar och gästsvar sparas i den lokala versionen. Den hostade versionen behöver en gemensam databas för delade träffar. Solinformationen är en uppskattning.",
              )}
            </p>
            <button className="primary wide" onClick={() => setModal(null)}>
              {t("Utforska SunSpot")}
              <ChevronRight size={18} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "gatherings" && (
        <Modal title={t("Mina träffar")} onClose={() => setModal(null)}>
          <div className="my-gatherings">
            {saved("gatherings", []).length ? (
              saved("gatherings", []).map((g) => (
                <Link href={`/invite/${g.id}`} key={g.id}>
                  <Users size={20} />
                  <span>{g.name}</span>
                  <ChevronRight size={18} />
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <Users size={30} />
                <h3>{t("Det börjar med en plats.")}</h3>
                <p>
                  {t(
                    "Välj ett ställe på kartan och bjud in till din första träff.",
                  )}
                </p>
              </div>
            )}
            <p className="fineprint">
              {t("Här visas träffar som du skapat i den här webbläsaren.")}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <SunspotApp />
    </LanguageProvider>
  );
}
