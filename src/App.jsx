import Link from "next/link";
import Character, { categoryCharacters } from "./Character.jsx";
import CharacterScene from "./CharacterScene.jsx";
import { selectWeatherMoment, selectEmptyMoment } from "./characterExperience.js";
import { LanguageSwitcher, useLanguage } from "./Language.jsx";
import { localeFor } from "./i18n.js";
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
import { activityFor, places } from "./places.js";
import {
  api,
  atHour,
  clock,
  dayOptions,
  dateLabel,
  localDate,
  durationLabel,
  saved,
  save,
  weatherAt,
  weatherText,
  sunshineWeather,
  applySunshineWeather,
  weatherConditionLabel,
  openingLabel,
  placeText,
} from "./lib.js";

import {
  filterSpots,
  getDirectionsUrl,
  isCopenhagenPoint,
} from "./spotSearch.js";

const categoryOptions = [
  { id: "park", label: "finder.park", caption: "finder.parkCaption" },
  { id: "bar", label: "finder.bar", caption: "finder.barCaption" },
  { id: "restaurant", label: "finder.food", caption: "finder.foodCaption" },
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
  const { language, t } = useLanguage();
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
            ? t("finder.outdoors")
            : place.category === "bar"
              ? t("finder.barBadge")
              : t("finder.foodBadge")}
        </small>
      </div>
      <div className="place-copy">
        <div className="place-name">
          <h3>{place.name}</h3>
          <ArrowUpRight size={17} />
        </div>
        <p>
          {placeText(place, "kind", language)} <span>·</span> {placeText(place, "district", language)}
        </p>
        <div className={`sun-status ${result?.state === "sun" ? "" : "muted"}`}>
          <Sun size={14} />
          {solarLabel(result, language)}
        </div>
        <small className="opening-status">
          {openingLabel(result?.opening, language)}
        </small>
      </div>
    </button>
  );
}
function CreateForm({ place, date, hour, duration, onClose }) {
  const { language, t, errorText } = useLanguage();
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
        setError("finder.storageError");
        setBusy(false);
        return;
      }
      try {
        sessionStorage.setItem(`sunspot:created-invite:${created.id}`, "1");
      } catch {
        // Creation succeeds even when optional animation handoff storage is blocked.
      }
      router.push(`/invite/${created.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <Modal title={t("finder.createTitle")} onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <div className="plan-summary">
          <Character character="stripes" className="plan-character" />
          <div>
            <strong>{place.name}</strong>
            <p>{t(`flows.activity.${activityFor(place.category)}`)}</p>
          </div>
        </div>
        <div className="plan-time">
          <CalendarDays size={17} />
          {meetingTime ? meetingTime.replace("T", " · ") : t("finder.chooseStart")}
          <span>·</span>
          {durationLabel(duration, language)}
        </div>
        <label htmlFor="meeting-time">{t("finder.meetingStart")}</label>
        <input
          id="meeting-time"
          type="datetime-local"
          required
          value={meetingTime}
          onChange={(event) => setMeetingTime(event.target.value)}
        />
        <label htmlFor="host">{t("finder.yourName")}</label>
        <input
          id="host"
          required
          autoFocus
          autoComplete="given-name"
          maxLength={50}
          placeholder={t("finder.nameExample")}
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <label htmlFor="message">
          {t("finder.message")} <span className="optional">{t("finder.optional")}</span>
        </label>
        <textarea
          id="message"
          rows={3}
          maxLength={300}
          placeholder={t("finder.messageExample")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="fineprint">
          {t("finder.invitationNote")}
        </p>
        {error && (
          <p className="error" role="alert">
            {errorText(error)}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? t("finder.creating") : t("finder.create")}
          <ArrowUpRight size={19} />
        </button>
      </form>
    </Modal>
  );
}

export default function App() {
  const { language, t, errorText } = useLanguage();
  const number = new Intl.NumberFormat(localeFor(language));
  const days = dayOptions(language);
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
  const [weatherRevision, setWeatherRevision] = useState(0);
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
  }, [inviteId, weatherRevision]);
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
  const night = SunCalc.getPosition(atHour(date, hour), 55.6865, 12.581).altitude <= 0;
  const sunPlaces = filtered.filter((place) => results[place.id]?.eligible && results[place.id]?.state === "sun");
  const weatherMoment = selectWeatherMoment({
    loading: pending || locating,
    night,
    available: Boolean(weather?.available && forecast),
    stale: weather?.stale,
    condition: condition.state,
    hasSun: sunPlaces.length > 0,
    planned: !live,
  });
  const withoutOpeningFilter = onlyOpen && !filtered.length && filterSpots(places, results, {
    categories, query, district, onlySun, onlyOpen: false, origin,
  });
  const emptyMoment = selectEmptyMoment({
    noTypes: !categories.length,
    outsideCoverage: locationError === "finder.outsideCoverage",
    locationError: locationError === "experience.empty.location.body",
    unconfirmedOpen: Boolean(withoutOpeningFilter?.length),
    weatherMoment,
  });
  const heroMoment = !categories.length || locationError === "finder.outsideCoverage" || locationError === "experience.empty.location.body"
    ? emptyMoment : weatherMoment;
  const momentParams = {
    placeName: sunPlaces[0]?.name || t("finder.city"),
    date: date === localDate() ? t("day.today") : dateLabel(atHour(date, 12), language),
    time: clock(atHour(date, hour)),
  };
  const emptyMessage = solar.error ? t("finder.shadowError") : t(`experience.${emptyMoment.id}.body`, momentParams);

  function experienceAction(moment) {
    if (moment.id === "weather.loading" || moment.id === "weather.sun" || moment.id === "planned.sun") return null;
    if (moment.id === "weather.night") return { label: "experience.action.tomorrow", run: () => {
      setDate(days[1].value); setHour(12); setLive(false); setFinderOpen(true); setDetailOpen(false);
    } };
    if (["weather.missing", "weather.stale", "weather.unknown"].includes(moment.id)) return { label: "experience.action.refresh", run: () => {
      setWeatherLoading(true); setWeatherRevision((value) => value + 1);
    } };
    if (moment.id === "empty.unconfirmed-open") return { label: "experience.action.unconfirmed", run: () => {
      setOnlyOpen(false); setFitResultsToken((value) => value + 1);
    } };
    const later = ["weather.cloud", "weather.rain", "planned.grey"].includes(moment.id);
    return { label: later ? "experience.action.later" : "experience.action.area", run: () => {
      setFinderOpen(true); setFinderExpanded(true); setDetailOpen(false);
      requestAnimationFrame(() => document.querySelector(later ? 'input[type="time"]' : '#district')?.focus());
    } };
  }
  const heroAction = experienceAction(heroMoment);
  const emptyAction = experienceAction(emptyMoment);

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
        setSeatError("finder.seatRange");
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
      setLocationError("finder.locationUnsupported");
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
          setLocationError("finder.outsideCoverage");
          return;
        }
        setOrigin(point);
        setDistrict("");
      },
      (error) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setOrigin(null);
        setLocationError(error.code === 1 ? "experience.empty.location.body" : "finder.locationFailed");
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
        <Link className="brand" href="/" aria-label={t("finder.home")}>
          <span className="brand-icon">
            <Sun size={27} strokeWidth={2.1} />
          </span>
          SunSpot
        </Link>
        <nav aria-label={t("finder.navigation")}>
          <Link href="/" className={!inviteId ? "nav-active" : ""}>
            {t("finder.findSun")}
          </Link>
          <button onClick={() => setModal("gatherings")} aria-label={t("finder.gatherings")}>
            <Users size={16} /> <span className="header-nav-text">{t("finder.gatherings")}</span>
          </button>
          <Link href="/partner">
            {t("finder.partners")} <ArrowUpRight size={14} />
          </Link>
        </nav>
        <div className="header-city">
          <MapPin size={15} /> {t("finder.city")}<span className="city-flag">🇩🇰</span>
        </div>
        <LanguageSwitcher />
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
              aria-label={t("finder.finderLabel")}
            >
              <div className="finder-brand-row">
                <span className="finder-eyebrow">
                  <Sun size={16} /> SUNSPOT · {t("finder.city").toLocaleUpperCase(localeFor(language))}
                </span>
                <BrandTheatre compact />
                <div className="finder-language"><LanguageSwitcher /></div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("finder.gatherings")}
                  onClick={() => setModal("gatherings")}
                >
                  <Users size={18} />
                </button>
              </div>
              {solar.error && (
                <div className="finder-retry" role="alert">
                  <p>{t("finder.noShadowData")}</p>
                  <button type="button" onClick={solar.retry}>
                    {t("finder.retryShadowData")}
                  </button>
                </div>
              )}
              {finderOpen ? (
                <form onSubmit={findSpots}>
                  <div className="golden-hero paper-hero experience-hero" lang={language} data-experience={heroMoment.id}>
                    <div>
                      <span className="paper-edition">{t("finder.edition")}</span>
                      <h1>{t(`experience.${heroMoment.id}.title`)}</h1>
                      <p className="hero-invitation">{t(`experience.${heroMoment.id}.body`, momentParams)}</p>
                      {heroMoment.id === "weather.night" && !weather?.available && <small>{t("experience.weatherStatusMissing")}</small>}
                      {heroAction && <button type="button" className="experience-action" onClick={heroAction.run}>{t(heroAction.label)}</button>}
                    </div>
                    <CharacterScene moment={heroMoment} className="hero-moment" animate={!modal} />
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
                      {finderExpanded ? t("finder.closeFields") : t("finder.openFields")}
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
                        ? t("finder.locating")
                        : origin
                          ? t("finder.nearRadius")
                          : t("finder.near")}
                    </button>
                  </div>
                  <div className="finder-current-choice">
                    {origin ? t("finder.near") : placeText({ district }, "district", language) || t("finder.city")}{" "}
                    <span>·</span> {date === localDate() ? t("day.today") : dateLabel(atHour(date, 12), language)}{" "}
                    <span>·</span> {clock(atHour(date, hour))}
                  </div>
                  {locationError && !["finder.outsideCoverage", "experience.empty.location.body"].includes(locationError) && (
                    <p className="finder-notice" role="status">
                      {errorText(locationError)}
                    </p>
                  )}
                  <div id="finder-fields" className="finder-fields">
                    <div className="finder-location-label">
                      <label htmlFor="district">{t("finder.where")}</label>
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
                      <option value="">{t("finder.wholeCity")}</option>
                      {districts.map((value) => (
                        <option key={value} value={value}>
                          {placeText({ district: value }, "district", language)}
                        </option>
                      ))}
                    </select>

                    <div className="finder-time-heading">
                      <span>{t("finder.when")}</span>
                      <button
                        type="button"
                        className={`now-button ${live ? "active" : ""}`}
                        aria-pressed={live}
                        onClick={() => setLive(true)}
                      >
                        {t("finder.now")}
                      </button>
                    </div>
                    <div className="finder-date-time">
                      <label>
                        <span className="sr-only">{t("finder.day")}</span>
                        <select
                          aria-label={t("finder.day")}
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
                        <span className="sr-only">{t("finder.time")}</span>
                        <input
                          type="time"
                          aria-label={t("finder.exactTime")}
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
                      <legend>{t("finder.types")}</legend>
                      <div>
                        {categoryOptions.map(({ id, label, caption }) => (
                          <button
                            key={id}
                            type="button"
                            className={categories.includes(id) ? "active" : ""}
                            data-category={id}
                            aria-label={t(label)}
                            aria-pressed={categories.includes(id)}
                            onClick={() => toggleCategory(id)}
                          >
                            <Character character={categoryCharacters[id]} />
                            <strong>{t(label)}</strong>
                            <small>{t(caption)}</small>
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
                    {pending ? t("finder.searching") : t("finder.submit")}
                    <ArrowUpRight size={20} />
                  </button>
                  <GoldenHourDiscovery compact />
                  <div className="finder-secondary">
                    <span>
                      <Sun size={12} />
                      {onlySun ? t("finder.onlySun") : t("finder.allSunlight")} ·{" "}
                      {onlyOpen ? t("finder.onlyOpen") : t("finder.allHours")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModal("filters")}
                      aria-label={t("finder.openFilters")}
                    >
                      <SlidersHorizontal size={14} />
                      {t("finder.change")}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="finder-weather"
                    onClick={() => setModal("weather")}
                    aria-label={t("finder.forecast")}
                  >
                    <WeatherIcon symbol={forecast?.symbol} size={17} />
                    <span>
                      {weatherLoading
                        ? t("finder.loadingForecast")
                        : forecast
                          ? `${Math.round(forecast.temperature)}° · ${weatherText(forecast.symbol, language)}`
                          : t("finder.forecastMissing")}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </form>
              ) : (
                <div className={`finder-summary ${!pending && !filtered.length ? "is-empty" : ""}`}>
                  <div className="finder-result-heading">
                    <div>
                      <h1>
                        {pending
                          ? t("finder.resultSearching")
                          : filtered.length
                            ? t("finder.resultTitle")
                            : t(`experience.${emptyMoment.id}.title`)}
                      </h1>
                      <p>
                        {origin ? t("finder.near") : placeText({ district }, "district", language) || t("finder.city")} ·{" "}
                        {date === localDate() ? t("day.today") : dateLabel(atHour(date, 12), language)} ·{" "}
                        {clock(atHour(date, hour))}
                      </p>
                      {!pending && filtered.length > 0 && (
                        <strong>
                          {t("finder.matchCount", { count: filtered.length, shown: visiblePlaces.length })}
                        </strong>
                      )}
                    </div>
                    {!filtered.length && <CharacterScene moment={emptyMoment} className="summary-character" sizes="64px" />}
                  </div>
                  <div className="finder-summary-actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        setFinderOpen(true);
                        setFinderExpanded(true);
                        setDetailOpen(false);
                      }}
                    >
                      {t("finder.changeSearch")}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={t("finder.openFilters")}
                      onClick={() => setModal("filters")}
                    >
                      <SlidersHorizontal size={19} />
                    </button>
                    {filtered.length > 0 && (
                      <button
                        className="icon-button"
                        aria-label={t("finder.showList")}
                        onClick={() => setModal("list")}
                      >
                        <List size={19} />
                      </button>
                    )}
                    <div className="finder-language"><LanguageSwitcher /></div>
                  </div>
                  {!pending && !filtered.length && (
                    <div className="finder-empty" role="status" data-experience={emptyMoment.id}>
                      <p>{emptyMessage}</p>
                      {emptyAction && <button type="button" className="experience-action" onClick={emptyAction.run}>{t(emptyAction.label)}</button>}
                    </div>
                  )}
                  {visiblePlaces.length > 0 && (
                    <section className="finder-place-preview" aria-label={t("finder.suggestions")} lang={language}>
                      <h2>{t("finder.startHere")}</h2>
                      {visiblePlaces.slice(0, 3).map((place) => (
                        <PlaceCard
                          key={place.id}
                          place={place}
                          selected={detailOpen && selected.id === place.id}
                          result={results[place.id]}
                          onSelect={selectPlace}
                        />
                      ))}
                    </section>
                  )}
                  <GoldenHourDiscovery compact />
                  <button
                    className="finder-weather"
                    onClick={() => setModal("weather")}
                    aria-label={t("finder.forecast")}
                  >
                    <WeatherIcon symbol={forecast?.symbol} size={17} />
                    <span>{weatherConditionLabel(condition, language)}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </aside>
            <div className="map-provenance" aria-label={t("finder.dataSources")}>
              <span>
                <i />{" "}
                {solar.error
                  ? t("finder.shadowMissing")
                  : solar.pending
                    ? t("finder.shadowPending")
                    : t("finder.shadowCalculated")}
              </span>
              <span>
                {weatherLoading
                  ? t("finder.loadingForecast")
                  : weather?.stale && forecast
                    ? t("finder.forecastStale")
                    : forecast
                      ? t("finder.forecastSource")
                      : t("finder.forecastMissing")}
              </span>
            </div>
            <MapView
              pending={solar.pending}
              weatherState={weatherLoading ? "loading" : condition.state}
              focusPlaces={filtered}
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
              seatError={errorText(seatError)}
              onCancelEdit={() => setEditing(false)}
              onPointChange={choosePoint}
            >
              {detailOpen && (
                <article className="detail-card" aria-label={t("finder.selectedPlace")}>
                  <button
                    className="detail-close icon-button"
                    aria-label={t("finder.closePlace")}
                    onClick={() => {
                      setDetailOpen(false);
                      setEditing(false);
                    }}
                  >
                    <X size={18} />
                  </button>
                  <div className="detail-heading">
                    <div>
                      <div className="detail-top">
                        <span className="detail-category">
                          {placeText(selected, "kind", language)} <span>·</span> {placeText(selected, "district", language)}
                        </span>
                        <span className="demo-badge">{t("finder.estimated")}</span>
                      </div>
                      <h2>{selected.name}</h2>
                    </div>
                    <Character character={categoryCharacters[selected.category]} />
                  </div>
                  <div className="sun-window">
                    <div>
                      <Sun size={22} />
                      <span>
                        {selected.category === "park"
                          ? t("finder.parkPoints")
                          : t("finder.outdoorPoint")}
                        <strong>
                          {solar.pending
                            ? t("finder.sunPending")
                            : solarLabel(result, language)}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="detail-actions">
                    <a
                      className="primary wide directions-button"
                      href={getDirectionsUrl(selected)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("finder.directions")} <Navigation size={16} />
                    </a>
                    <button
                      className="secondary wide invite-friends"
                      onClick={() => setModal("create")}
                    >
                      {t("finder.invite")}
                    </button>
                  </div>
                  <details className="place-more">
                    <summary>{t("finder.morePlace")}</summary>
                    <div className="place-moment" data-experience="place.directions">
                      <CharacterScene moment={{ id: "place.directions", character: "cyclist", pose: "cycling" }} sizes="56px" />
                      <p>{t("experience.place.directions")}</p>
                    </div>
                    <p className="detail-description">{placeText(selected, "description", language)}</p>
                    <p className="point-note">
                      {selected.category === "park"
                        ? result?.state === "unknown"
                          ? t("finder.parkUnknown")
                          : t("finder.parkPartial")
                        : result?.pointSource === "chosen"
                          ? t("finder.chosenPoint")
                          : t("finder.estimatedPoint")}
                    </p>
                    {result && !filtered.some((p) => p.id === selected.id) && (
                      <p className="point-note">
                        {t("finder.filteredPlace")}
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
                            ? t("finder.cancelPoint")
                            : t("finder.chooseSeat")}
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
                          {t("finder.watchSun")}
                        </button>
                      </div>
                    )}
                    <div className="detail-foot">
                      <a
                        href={`https://www.openstreetmap.org/${selected.osm}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin size={14} /> {t("finder.placeSource")}
                      </a>
                      <span title={selected.openingHours || undefined}>
                        {openingLabel(result?.opening, language)}
                      </span>
                    </div>
                  </details>
                </article>
              )}
              {watchId && (
                <button
                  className="watch-peek"
                  onClick={() => setWatchOpen((value) => !value)}
                >
                  {solarLabel(results[watchId], language)} · {t("finder.showWatch")}
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
                {t("finder.backMap")} <X size={14} />
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
            <Modal title={t("finder.filterTitle")} onClose={() => setModal(null)}>
              <div className="filter-panel controls">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label={t("finder.searchLabel")}
                    placeholder={t("finder.searchPlaceholder")}
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
                    {t("finder.hideShade")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyOpen}
                      onChange={(event) => setOnlyOpen(event.target.checked)}
                    />
                    {t("finder.confirmedOpen")}
                  </label>
                </div>
                <p className="fineprint">
                  {t("finder.filterNote")}
                </p>
                <div className="duration-row">
                  <label htmlFor="duration">
                    <Clock3 size={15} />
                    {t("finder.duration")}
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
                        {durationLabel(value, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="primary wide" onClick={() => setModal(null)}>
                  {t("finder.applyFilters")}
                  <ChevronRight size={18} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    resetSearch();
                    setModal(null);
                  }}
                >
                  {t("finder.reset")}
                </button>
                <button
                  className="text-button"
                  onClick={() => setModal("about")}
                >
                  {t("finder.aboutData")}
                </button>
              </div>
            </Modal>
          )}
          {modal === "list" && (
            <Modal title={t("finder.listTitle")} onClose={() => setModal(null)}>
              <section className="results">
                <div className="results-heading">
                  <h2>
                    {pending
                      ? t("finder.sunPending")
                      : t("finder.placesCount", { count: visiblePlaces.length })}
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
                  {t("finder.listNote")}
                </p>
              </section>
            </Modal>
          )}
          {modal === "weather" && (
            <Modal title={t("finder.weatherTitle")} onClose={() => setModal(null)}>
              <div className="weather-card">
                <div className="weather-top">
                  <div className="weather-icon">
                    <WeatherIcon symbol={forecast?.symbol} size={28} />
                  </div>
                  <div>
                    <strong>
                      {weatherLoading
                        ? t("finder.loadingWeather")
                        : forecast
                          ? `${Math.round(forecast.temperature)}° · ${weatherText(forecast.symbol, language)}`
                          : t("finder.forecastMissing")}
                    </strong>
                    <p>
                      {forecast ? (
                        <>
                          <Wind size={12} />
                          {Math.round(forecast.wind)} m/s <span>·</span>{" "}
                          {forecast.rain == null ? "—" : number.format(forecast.rain)} mm / {forecast.hours} h
                        </>
                      ) : (
                        t("finder.cityWeather")
                      )}
                    </p>
                  </div>
                </div>
                <p className="finder-notice">{weatherConditionLabel(condition, language)}</p>
                <div className="weather-source">
                  <a
                    href="https://www.met.no/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("finder.forecastSource")}
                  </a>
                  <span>
                    {weather?.stale
                      ? t("finder.oldForecast")
                      : weather?.updatedAt
                        ? t("finder.updated", { time: clock(new Date(weather.updatedAt)) })
                        : t("finder.forecastMissing")}
                  </span>
                </div>
              </div>
              <p className="fineprint">
                {t("finder.sunsetNote", { time: clock(sunset) })}
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
        <Modal title={t("finder.aboutTitle")} onClose={() => setModal(null)}>
          <div className="about-content">
            <p>
              {t("finder.aboutIntro")}
            </p>
            <h3>{t("finder.aboutSourcesTitle")}</h3>
            <p>
              {t("finder.aboutSources")}
            </p>
            <p>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap
              </a> · {" "}
              <a href="https://www.met.no/" target="_blank" rel="noreferrer">
                MET Norway
              </a>
            </p>
            <p>
              {t("finder.aboutLimits")}
            </p>
            <h3>{t("finder.localTitle")}</h3>
            <p>
              {t("finder.localNote")}
            </p>
            <button className="primary wide" onClick={() => setModal(null)}>
              {t("finder.backSun")}
              <ChevronRight size={18} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "gatherings" && (
        <Modal title={t("finder.gatherings")} onClose={() => setModal(null)}>
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
                <h3>{t("finder.emptyGatheringsTitle")}</h3>
                <p>
                  {t("finder.emptyGatherings")}
                </p>
              </div>
            )}
            <p className="fineprint">
              {t("finder.savedGatherings")}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
