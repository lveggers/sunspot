import Link from "next/link";
import Character, { categoryCharacters } from "./Character.jsx";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  SlidersHorizontal,
  List,
  LocateFixed,
  Navigation,
  CalendarDays,
  ChevronRight,
  Clock3,
  Cloud,
  CloudRain,
  CloudSun,
  Info,
  MapPin,
  Search,
  Sun,
  Users,
  Wind,
  X,
} from "lucide-react";
import MapView from "./MapView.jsx";
import Modal from "./Modal.jsx";
import { GoldenHourDiscovery } from "./GoldenHour.jsx";
import BrandTheatre from "./BrandTheatre.jsx";
import Invite from "./Invite.jsx";
import * as SunCalc from "suncalc";
import { distanceMeters } from "./exposure.js";
import { useSolarModel } from "./useSolarModel.js";
import SolarWatch, { solarLabel } from "./SolarWatch.jsx";
import { activityFor, activityNames, places } from "./places.js";
import {
  api,
  atHour,
  clock,
  dayOptions,
  localDate,
  durationLabel,
  saved,
  save,
  weatherAt,
  weatherText,
  sunshineWeather,
  applySunshineWeather,
} from "./lib.js";

import {
  filterSpots,
  getDirectionsUrl,
  isCopenhagenPoint,
} from "./spotSearch.js";

const categoryOptions = [
  { id: "park", label: "Park", caption: "En bænk. Ingen hast." },
  { id: "bar", label: "Bar", caption: "Én til i solen." },
  { id: "restaurant", label: "Mat", caption: "Godt på tallerkenen." },
];

const districts = [...new Set(places.map((place) => place.district))].sort(
  (a, b) => a.localeCompare(b, "da"),
);

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
function PlaceCard({ place, selected, result, onSelect }) {
  return (
    <button
      className={`place-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(place)}
      aria-pressed={selected}
    >
      <div className="place-art" data-category={place.category}>
        <Character character={categoryCharacters[place.category]} />
        <small>
          {place.category === "park"
            ? "UTE"
            : place.category === "bar"
              ? "BAR"
              : "MAT"}
        </small>
      </div>
      <div className="place-copy">
        <div className="place-name">
          <h3>{place.name}</h3>
          <ArrowUpRight size={17} />
        </div>
        <p>
          {place.kind} <span>·</span> {place.district}
        </p>
        <div className={`sun-status ${result?.state === "sun" ? "" : "muted"}`}>
          <Sun size={14} />
          {solarLabel(result)}
        </div>
        <small className="opening-status">
          {result?.opening.label || "Öppettider kontrolleras…"}
        </small>
      </div>
    </button>
  );
}
function CreateForm({ place, date, hour, duration, onClose }) {
  const router = useRouter();
  const [meetingTime, setMeetingTime] = useState(() => {
    const start = new Date(
      Math.ceil(
        Math.max(atHour(date, hour).getTime(), Date.now() + 15 * 60000) /
          300000,
      ) * 300000,
    );
    return `${localDate(start)}T${clock(start)}`;
  });
  const [host, setHost] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const [meetingDate, meetingClock] = meetingTime.split("T");
      const [meetingHour, meetingMinute] = meetingClock.split(":").map(Number);
      const created = await api("/gatherings", {
        method: "POST",
        body: JSON.stringify({
          placeId: place.id,
          activity: activityFor(place.category),
          startsAt: atHour(
            meetingDate,
            meetingHour + meetingMinute / 60,
          ).toISOString(),
          duration,
          host,
          message,
        }),
      });
      const stored = save(`host:${created.id}`, created.hostToken);
      save("gatherings", [
        { id: created.id, name: place.name },
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
    <Modal title="Samla dina vänner" onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <div className="plan-summary">
          <Character character="blue-shirt" className="plan-character" />
          <div>
            <strong>{place.name}</strong>
            <p>{activityNames[activityFor(place.category)]}</p>
          </div>
        </div>
        <div className="plan-time">
          <CalendarDays size={17} />
          {meetingTime ? meetingTime.replace("T", " · ") : "Välj starttid"}
          <span>·</span>
          {durationLabel(duration)}
        </div>
        <label htmlFor="meeting-time">Starttid för träffen</label>
        <input
          id="meeting-time"
          type="datetime-local"
          required
          value={meetingTime}
          onChange={(event) => setMeetingTime(event.target.value)}
        />
        <label htmlFor="host">Ditt namn</label>
        <input
          id="host"
          required
          autoFocus
          autoComplete="given-name"
          maxLength={50}
          placeholder="Till exempel Carl"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <label htmlFor="message">
          Ett meddelande <span className="optional">(valfritt)</span>
        </label>
        <textarea
          id="message"
          rows={3}
          maxLength={300}
          placeholder="Ska vi ses här och fånga lite sol?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="fineprint">
          Du får en länk med plats, tid och möjlighet att svara. Solläget är en
          uppskattning; ingen bordsbokning görs.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? "Skapar…" : "Skapa inbjudan"}
          <ArrowUpRight size={19} />
        </button>
      </form>
    </Modal>
  );
}

export default function App() {
  const days = dayOptions();
  const [date, setDate] = useState(localDate);
  const [hour, setHour] = useState(() => {
    const [h, m] = clock(new Date()).split(":").map(Number);
    return h + m / 60;
  });
  const [duration, setDuration] = useState(60);
  const [categories, setCategories] = useState(["park", "bar", "restaurant"]);
  const [district, setDistrict] = useState("");
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef(0);
  const [locationError, setLocationError] = useState("");
  const [query, setQuery] = useState("");
  const [onlySun, setOnlySun] = useState(true);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [selected, setSelected] = useState(places[0]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(true);
  const [finderExpanded, setFinderExpanded] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [fitResultsToken, setFitResultsToken] = useState(0);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [seatError, setSeatError] = useState("");
  const [watchId, setWatchId] = useState(null);
  const [watchOpen, setWatchOpen] = useState(false);
  const [live, setLive] = useState(true);
  const [overrides, setOverrides] = useState(() => {
    const value = saved("seats:v1") || {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, point]) =>
          places.some((place) => place.id === id) && isCopenhagenPoint(point),
      ),
    );
  });
  const inviteId = window.location.pathname.startsWith("/invite/")
    ? window.location.pathname.split("/")[2]
    : null;

  useEffect(() => {
    if (inviteId) return;
    let controller;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      api("/weather", { signal: request.signal })
        .then((data) => {
          if (!request.signal.aborted) setWeather(data);
        })
        .catch((error) => {
          if (!request.signal.aborted && error.name !== "AbortError")
            setWeather({ available: false });
        })
        .finally(() => {
          if (!request.signal.aborted) setWeatherLoading(false);
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = setInterval(visible, 10 * 60_000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [inviteId]);
  useEffect(() => {
    return () => {
      locationRequest.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!live || inviteId) return;
    const tick = () => {
      const now = new Date();
      setDate(localDate(now));
      const [h, m] = clock(now).split(":").map(Number);
      setHour(h + m / 60);
    };
    tick();
    const timer = setInterval(tick, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [live, inviteId]);

  const instant = atHour(date, hour).toISOString();
  const solar = useSolarModel(instant, overrides, duration, !inviteId);
  const condition = sunshineWeather(weather, instant);
  const results = applySunshineWeather(solar.results, condition);
  const forecast = weatherAt(weather, instant);
  const sunset = SunCalc.getTimes(atHour(date, 12), 55.6865, 12.581).sunset;
  const filtered = filterSpots(places, results, {
    categories,
    query,
    district,
    onlySun,
    onlyOpen,
    origin,
  });
  const visiblePlaces = hasResults ? filtered.slice(0, 8) : [];
  const result = results[selected.id];
  const pending = solar.pending || weatherLoading;
  const emptyMessage = !categories.length
    ? "Välj minst en typ av plats."
    : solar.error
      ? "Skuggdata kunde inte laddas. Försök igen på kartan."
      : onlySun &&
          SunCalc.getPosition(atHour(date, hour), 55.6865, 12.581).altitude <= 0
        ? "Solen är under horisonten vid vald tid. Prova en tid före solnedgången."
        : onlySun && condition.state !== "sun"
          ? `${condition.label}. Prova en annan tid, eller välj att visa platser utan bekräftad sol.`
          : "Ingen plats matchar ditt område och dina filter. Prova ett annat område, en annan tid eller ändra filtren.";

  const selectPlace = useCallback(
    (place) => {
      setSelected(place);
      setDetailOpen(true);
      setModal(null);
      setWatchOpen(false);
      setEditing(false);
    },
    [setModal],
  );
  const choosePoint = useCallback(
    (point) => {
      if (
        !isCopenhagenPoint(point) ||
        distanceMeters(point, [selected.lng, selected.lat]) > 100
      ) {
        setSeatError("Välj en sittplats inom 100 meter från stället.");
        return;
      }
      setSeatError("");
      setOverrides((previous) => {
        const next = { ...previous, [selected.id]: point };
        save("seats:v1", next);
        return next;
      });
      setEditing(false);
    },
    [selected],
  );

  function findSpots(event) {
    event.preventDefault();
    setHasResults(true);
    setFinderOpen(false);
    setFitResultsToken((value) => value + 1);
    setEditing(false);
    setDetailOpen(Boolean(filtered.length));
    if (filtered.length) setSelected(filtered[0]);
  }
  function toggleCategory(id) {
    setCategories((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
    setDetailOpen(false);
  }
  function nearMe() {
    if (!navigator.geolocation) {
      setLocationError(
        "Din webbläsare kan inte hitta positionen. Välj ett område i stället.",
      );
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        const point = [coords.longitude, coords.latitude];
        if (!isCopenhagenPoint(point)) {
          setOrigin(null);
          setLocationError(
            "SunSpot täcker centrala Köpenhamn just nu. Välj ett område i Köpenhamn i stället.",
          );
          return;
        }
        setOrigin(point);
        setDistrict("");
      },
      () => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setOrigin(null);
        setLocationError(
          "Positionen kunde inte hämtas. Tillåt platsåtkomst eller välj ett område.",
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  function resetSearch() {
    locationRequest.current += 1;
    setLocating(false);
    setCategories(["park", "bar", "restaurant"]);
    setQuery("");
    setDistrict("");
    setOrigin(null);
    setLocationError("");
    setOnlySun(true);
    setOnlyOpen(true);
    setLive(true);
    setDetailOpen(false);
    setFinderOpen(true);
    setFinderExpanded(false);
    setHasResults(false);
    setEditing(false);
  }

  return (
    <>
      <header className={`header ${!inviteId ? "map-header" : ""}`}>
        <Link className="brand" href="/" aria-label="SunSpot startsida">
          <span className="brand-icon">
            <Sun size={27} strokeWidth={2.1} />
          </span>
          SunSpot
        </Link>
        <nav aria-label="Huvudmeny">
          <Link href="/" className={!inviteId ? "nav-active" : ""}>
            Hitta sol
          </Link>
          <button onClick={() => setModal("gatherings")}>
            <Users size={16} /> Mina träffar
          </button>
          <Link href="/partner">
            För partners <ArrowUpRight size={14} />
          </Link>
        </nav>
        <div className="header-city">
          <MapPin size={15} /> Köpenhamn<span className="city-flag">🇩🇰</span>
        </div>
      </header>
      {inviteId ? (
        <Invite id={inviteId} />
      ) : (
        <>
          <main
            className={`map-workspace finder-workspace ${hasResults ? "has-results" : ""} ${finderOpen ? "finder-open" : ""}`}
            data-solar-pending={solar.pending}
          >
            <aside
              className={`spot-finder ${finderOpen ? "is-expanded" : ""} ${finderExpanded ? "controls-expanded" : "controls-compact"}`}
              aria-label="Hitta en plats i solen"
            >
              <div className="finder-brand-row">
                <span className="finder-eyebrow">
                  <Sun size={16} /> SUNSPOT · KØBENHAVN
                </span>
                <BrandTheatre compact />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mina träffar"
                  onClick={() => setModal("gatherings")}
                >
                  <Users size={18} />
                </button>
              </div>
              {solar.error && (
                <div className="finder-retry" role="alert">
                  <p>Solberäkningen saknar skuggdata.</p>
                  <button type="button" onClick={solar.retry}>
                    Ladda skuggdata igen
                  </button>
                </div>
              )}
              {finderOpen ? (
                <form onSubmit={findSpots}>
                  <div className="golden-hero paper-hero" lang="da">
                    <div>
                      <span className="paper-edition">BYEN ER BEDRE UDENFOR</span>
                      <h1>
                        En plads
                        <br />
                        <em>i solen.</em>
                      </h1>
                      <p className="hero-invitation">Tag dit gode selskab med.</p>
                    </div>
                    <div className="hero-cast" aria-hidden="true">
                      <Character character="blue-shirt" />
                      <Character character="curls" />
                      <Character character="turtleneck" />
                    </div>
                  </div>
                  <div className="finder-edit-row">
                    <button
                      className="finder-toggle"
                      type="button"
                      aria-expanded={finderExpanded}
                      aria-controls="finder-fields"
                      onClick={() => setFinderExpanded((value) => !value)}
                    >
                      <SlidersHorizontal size={16} />{" "}
                      {finderExpanded ? "Luk sted og tid" : "Vælg sted og tid"}
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      className={
                        origin ? "nearby-button active" : "nearby-button"
                      }
                      onClick={nearMe}
                      disabled={locating}
                    >
                      <LocateFixed size={14} />
                      {locating
                        ? "Hittar dig…"
                        : origin
                          ? "Inom 1,5 km från dig"
                          : "Nära mig"}
                    </button>
                  </div>
                  <div className="finder-current-choice">
                    {origin ? "Nær dig" : district || "København"}{" "}
                    <span>·</span> {date === localDate() ? "I dag" : date}{" "}
                    <span>·</span> {clock(atHour(date, hour))}
                  </div>
                  {locationError && (
                    <p className="finder-notice" role="status">
                      {locationError}
                    </p>
                  )}
                  <div id="finder-fields" className="finder-fields">
                    <div className="finder-location-label">
                      <label htmlFor="district">Var?</label>
                    </div>
                    <select
                      id="district"
                      value={district}
                      disabled={locating}
                      onChange={(event) => {
                        setDistrict(event.target.value);
                        setOrigin(null);
                        setLocationError("");
                      }}
                    >
                      <option value="">Hela Köpenhamn</option>
                      {districts.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>

                    <div className="finder-time-heading">
                      <span>När?</span>
                      <button
                        type="button"
                        className={`now-button ${live ? "active" : ""}`}
                        aria-pressed={live}
                        onClick={() => setLive(true)}
                      >
                        Nu
                      </button>
                    </div>
                    <div className="finder-date-time">
                      <label>
                        <span className="sr-only">Dag</span>
                        <select
                          aria-label="Dag"
                          value={date}
                          onChange={(event) => {
                            setDate(event.target.value);
                            setLive(false);
                          }}
                        >
                          {days.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label} · {day.day}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="sr-only">Klockslag</span>
                        <input
                          type="time"
                          aria-label="Exakt klockslag"
                          step="60"
                          value={clock(atHour(date, hour))}
                          onChange={(event) => {
                            if (!/^\d{2}:\d{2}$/.test(event.target.value))
                              return;
                            const [h, m] = event.target.value
                              .split(":")
                              .map(Number);
                            setHour(h + m / 60);
                            setLive(false);
                          }}
                        />
                      </label>
                    </div>
                    <fieldset className="finder-types">
                      <legend>Vad har du lust till?</legend>
                      <div>
                        {categoryOptions.map(({ id, label, caption }) => (
                          <button
                            key={id}
                            type="button"
                            className={categories.includes(id) ? "active" : ""}
                            data-category={id}
                            aria-label={label}
                            aria-pressed={categories.includes(id)}
                            onClick={() => toggleCategory(id)}
                          >
                            <Character character={categoryCharacters[id]} />
                            <strong>{label}</strong>
                            <small>{caption}</small>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <button
                    className="primary wide finder-submit"
                    disabled={pending || locating}
                  >
                    <Sun size={21} />
                    {pending ? "Hittar solen…" : "Hitta min plats i solen"}
                    <ArrowUpRight size={20} />
                  </button>
                  <GoldenHourDiscovery compact />
                  <div className="finder-secondary">
                    <span>
                      <Sun size={12} />
                      {onlySun ? "Bara sol" : "Alla sollägen"} ·{" "}
                      {onlyOpen ? "Bara öppet" : "Alla öppettider"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModal("filters")}
                      aria-label="Öppna filter"
                    >
                      <SlidersHorizontal size={14} />
                      Ändra
                    </button>
                  </div>
                  <button
                    type="button"
                    className="finder-weather"
                    onClick={() => setModal("weather")}
                    aria-label="Visa väderprognos"
                  >
                    <WeatherIcon symbol={forecast?.symbol} size={17} />
                    <span>
                      {weatherLoading
                        ? "Hämtar prognos…"
                        : forecast
                          ? `${Math.round(forecast.temperature)}° · ${weatherText(forecast.symbol)}`
                          : "Väderprognos saknas"}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </form>
              ) : (
                <div className="finder-summary">
                  <Character
                    character={filtered.length ? "cyclist" : "green-jacket"}
                    className="summary-character"
                  />
                  <h1>
                    {pending
                      ? "Söker solen…"
                      : filtered.length
                        ? "Din stund i solen."
                        : "Ingen plats matchar just nu."}
                  </h1>
                  <p>
                    {origin ? "Nära dig" : district || "Köpenhamn"} ·{" "}
                    {date === localDate() ? "Idag" : date} ·{" "}
                    {clock(atHour(date, hour))}
                  </p>
                  {!pending && filtered.length > 0 && (
                    <strong>
                      {filtered.length} match · visar {visiblePlaces.length}{" "}
                      utvalda
                    </strong>
                  )}
                  {!pending && !filtered.length && (
                    <p className="finder-empty" role="status">
                      {emptyMessage}
                    </p>
                  )}
                  <GoldenHourDiscovery compact />
                  <div className="finder-summary-actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        setFinderOpen(true);
                        setFinderExpanded(true);
                        setDetailOpen(false);
                      }}
                    >
                      Ändra sökning
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Öppna filter"
                      onClick={() => setModal("filters")}
                    >
                      <SlidersHorizontal size={19} />
                    </button>
                    {filtered.length > 0 && (
                      <button
                        className="icon-button"
                        aria-label="Visa platslista"
                        onClick={() => setModal("list")}
                      >
                        <List size={19} />
                      </button>
                    )}
                  </div>
                  <button
                    className="finder-weather"
                    onClick={() => setModal("weather")}
                    aria-label="Visa väderprognos"
                  >
                    <WeatherIcon symbol={forecast?.symbol} size={17} />
                    <span>{condition.label}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </aside>
            <div className="map-provenance" aria-label="Datakilder på kortet">
              <span>
                <i />{" "}
                {solar.error
                  ? "Skyggedata mangler"
                  : solar.pending
                    ? "Beregner skygge"
                    : "Beregnet bygningsskygge"}
              </span>
              <span>
                {weatherLoading
                  ? "Henter prognose"
                  : weather?.stale && forecast
                    ? "Ældre MET-prognose"
                    : forecast
                      ? "Vejr: MET Norway"
                      : "Vejrprognose mangler"}
              </span>
            </div>
            <MapView
              pending={solar.pending}
              categories={categories}
              focusResults={hasResults}
              fitResultsToken={fitResultsToken}
              places={visiblePlaces}
              selected={detailOpen ? selected : null}
              onSelect={selectPlace}
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
              {detailOpen && (
                <article className="detail-card" aria-label="Vald plats">
                  <button
                    className="detail-close icon-button"
                    aria-label="Stäng plats"
                    onClick={() => {
                      setDetailOpen(false);
                      setEditing(false);
                    }}
                  >
                    <X size={18} />
                  </button>
                  <div className="detail-top">
                    <span className="detail-category">
                      {selected.kind} <span>·</span> {selected.district}
                    </span>
                    <span className="demo-badge">BERÄKNAT · OSÄKERT</span>
                  </div>
                  <div className="detail-heading">
                    <div>
                      <p className="detail-invitation" lang="da">Her kan I mødes.</p>
                      <h2>{selected.name}</h2>
                    </div>
                    <Character character={categoryCharacters[selected.category]} />
                  </div>
                  <div className="sun-window">
                    <div>
                      <Sun size={22} />
                      <span>
                        {selected.category === "park"
                          ? "Parkens provpunkter"
                          : "Vald utomhuspunkt"}
                        <strong>
                          {solar.pending
                            ? "Beräknar solläge…"
                            : solarLabel(result)}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <details className="place-more">
                    <summary>Mer om platsen</summary>
                    <p className="detail-description">{selected.description}</p>
                    <p className="point-note">
                      {selected.category === "park"
                        ? result?.state === "unknown"
                          ? "Solläget är okänt när skuggdata saknas eller solen står för lågt. Trädskuggor ingår inte."
                          : "Delvis soliga parker finns kvar i urvalet. Trädskuggor ingår inte."
                        : result?.pointSource === "chosen"
                          ? "Din valda punkt visas i blått. Höjder är delvis uppskattade."
                          : "Blå punkt är en uppskattad utomhuspunkt, inte en verifierad uteservering."}
                    </p>
                    {result && !filtered.some((p) => p.id === selected.id) && (
                      <p className="point-note">
                        Platsen döljs av ditt filter. Det valda kortet finns
                        kvar så att du kan följa förändringen.
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
                            ? "Avbryt punktval"
                            : "Välj min sittplats på kartan"}
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
                          Bevaka solen här
                        </button>
                      </div>
                    )}
                    <div className="detail-foot">
                      <a
                        href={`https://www.openstreetmap.org/${selected.osm}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin size={14} /> Visa platskälla
                      </a>
                      <span title={selected.openingHours || undefined}>
                        {result?.opening.label || "Öppettider okända"}
                      </span>
                    </div>
                  </details>
                  <a
                    className="primary wide directions-button"
                    href={getDirectionsUrl(selected)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ta mig dit <Navigation size={18} />
                  </a>
                  <button
                    className="secondary wide invite-friends"
                    onClick={() => setModal("create")}
                  >
                    Ses här med vänner
                    <ArrowUpRight size={20} />
                  </button>
                </article>
              )}
              {watchId && (
                <button
                  className="watch-peek"
                  onClick={() => setWatchOpen((value) => !value)}
                >
                  {solarLabel(results[watchId])} · Visa solbevakning
                </button>
              )}
            </MapView>
          </main>
          {watchId && (
            <div className="watch-panel" hidden={!watchOpen}>
              <button
                className="watch-minimize"
                onClick={() => setWatchOpen(false)}
              >
                Tillbaka till kartan <X size={14} />
              </button>
              <SolarWatch
                id={watchId}
                results={results}
                instant={instant}
                duration={duration}
                live={live}
                pending={pending}
                onStop={() => setWatchId(null)}
                onSelect={selectPlace}
                onLive={() => setLive(true)}
              />
            </div>
          )}
          {modal === "filters" && (
            <Modal title="Ditt urval" onClose={() => setModal(null)}>
              <div className="filter-panel controls">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Sök plats eller område"
                    placeholder="Sök en plats eller ett område"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="solar-filters">
                  <label>
                    <input
                      type="checkbox"
                      checked={onlySun}
                      onChange={(event) => setOnlySun(event.target.checked)}
                    />
                    Dölj skugga och osäkert solläge
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyOpen}
                      onChange={(event) => setOnlyOpen(event.target.checked)}
                    />
                    Bara bekräftat öppet enligt OSM
                  </label>
                </div>
                <p className="fineprint">
                  Solurvalet kräver byggnadssol och en aktuell prognos utan regn
                  eller mulet väder. Okända öppettider döljs när bara öppet är
                  valt.
                </p>
                <div className="duration-row">
                  <label htmlFor="duration">
                    <Clock3 size={15} />
                    Tid på platsen
                  </label>
                  <select
                    id="duration"
                    value={duration}
                    onChange={(event) =>
                      setDuration(Number(event.target.value))
                    }
                  >
                    {[30, 60, 90, 120].map((value) => (
                      <option key={value} value={value}>
                        {durationLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="primary wide" onClick={() => setModal(null)}>
                  Använd filter
                  <ChevronRight size={18} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    resetSearch();
                    setModal(null);
                  }}
                >
                  Återställ till sol och öppet nu
                </button>
                <button
                  className="text-button"
                  onClick={() => setModal("about")}
                >
                  Om SunSpot och datan
                </button>
              </div>
            </Modal>
          )}
          {modal === "list" && (
            <Modal title="Dina utvalda platser" onClose={() => setModal(null)}>
              <section className="results">
                <div className="results-heading">
                  <h2>
                    {pending
                      ? "Beräknar solläge…"
                      : `${visiblePlaces.length} platser att upptäcka`}
                  </h2>
                </div>
                <div className="place-list">
                  {visiblePlaces.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      selected={detailOpen && selected.id === place.id}
                      result={results[place.id]}
                      onSelect={selectPlace}
                    />
                  ))}
                  {!pending && !visiblePlaces.length && (
                    <p role="status">{emptyMessage}</p>
                  )}
                </div>
                <p className="list-note">
                  <Info size={13} />
                  Byggnadssol och väderprognos är uppskattningar. Trädskugga
                  ingår inte. Kontrollera öppettider hos platsen.
                </p>
              </section>
            </Modal>
          )}
          {modal === "weather" && (
            <Modal title="Väder för vald tid" onClose={() => setModal(null)}>
              <div className="weather-card">
                <div className="weather-top">
                  <div className="weather-icon">
                    <WeatherIcon symbol={forecast?.symbol} size={28} />
                  </div>
                  <div>
                    <strong>
                      {weatherLoading
                        ? "Hämtar väder…"
                        : forecast
                          ? `${Math.round(forecast.temperature)}° · ${weatherText(forecast.symbol)}`
                          : "Väderprognos saknas"}
                    </strong>
                    <p>
                      {forecast ? (
                        <>
                          <Wind size={12} />
                          {Math.round(forecast.wind)} m/s <span>·</span>{" "}
                          {forecast.rain ?? "—"} mm / {forecast.hours} h
                        </>
                      ) : (
                        "För vald tid i Köpenhamn"
                      )}
                    </p>
                  </div>
                </div>
                <p className="finder-notice">{condition.label}</p>
                <div className="weather-source">
                  <a
                    href="https://www.met.no/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Väder: MET Norway
                  </a>
                  <span>
                    {weather?.stale
                      ? "Äldre prognos"
                      : weather?.updatedAt
                        ? `Uppd. ${clock(new Date(weather.updatedAt))}`
                        : "Prognos saknas"}
                  </span>
                </div>
              </div>
              <p className="fineprint">
                Solnedgång {clock(sunset)} · Köpenhamn. Prognosen gäller staden,
                inte molnen vid en enskild stol.
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
        <Modal title="Om SunSpot" onClose={() => setModal(null)}>
          <div className="about-content">
            <p>
              Hitta en plats i solen i centrala Köpenhamn och bjud in dina
              vänner.
            </p>
            <h3>Sol, skuggor och väder</h3>
            <p>
              Byggnader, platser och öppettider kommer från{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap
              </a>{" "}
              (ODbL). Solens position beräknas med SunCalc och väderprognosen
              hämtas från{" "}
              <a href="https://www.met.no/" target="_blank" rel="noreferrer">
                MET Norway
              </a>
              . Solurvalet tar hänsyn till regn och moln; en prognos är ingen
              garanti.
            </p>
            <p>
              Byggnadshöjder är delvis uppskattade. Träd, terräng och
              detaljerade takformer ingår inte. Barers utomhuspunkter är
              uppskattade tills du väljer sittplats. Parker provtas över ytan.
              Okända sollägen och öppettider räknas inte som bekräftade.
            </p>
            <h3>Träffar fungerar lokalt</h3>
            <p>
              Inbjudningar och gästsvar sparas. Lokala länkar fungerar på den
              här datorn. En publik server med beständig lagring behövs för att
              dela dem över internet.
            </p>
            <button className="primary wide" onClick={() => setModal(null)}>
              Tillbaka till solen
              <ChevronRight size={18} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "gatherings" && (
        <Modal title="Mina träffar" onClose={() => setModal(null)}>
          <div className="my-gatherings">
            {saved("gatherings", []).length ? (
              saved("gatherings", []).map((gathering) => (
                <Link href={`/invite/${gathering.id}`} key={gathering.id}>
                  <Users size={20} />
                  <span>{gathering.name}</span>
                  <ChevronRight size={18} />
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <Character character="green-jacket" />
                <h3>Det börjar med en plats.</h3>
                <p>
                  Hitta ett ställe i solen och bjud in till din första träff.
                </p>
              </div>
            )}
            <p className="fineprint">
              Här visas träffar som du skapat i den här webbläsaren.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
