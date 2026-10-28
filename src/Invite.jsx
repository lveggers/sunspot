import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  MapPin,
  Navigation,
  Users,
  X,
} from "lucide-react";
import { api, clock, dateLabel, durationLabel, saved, save, placeText, sunshineWeather, weatherConditionLabel } from "./lib.js";
import CharacterScene from "./CharacterScene.jsx";
import { invitationCounts, selectInvitationMoment } from "./invitationExperience.js";
import { getDirectionsUrl } from "./spotSearch.js";
import { useLanguage } from "./Language.jsx";
import "./invitation-experience.css";

export default function Invite({ id }) {
  const { language, t, errorText } = useLanguage();
  const [g, setG] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [confirmCancel, setConfirmCancel] = useState(false);
  const [name, setName] = useState(() => saved(`rsvp:${id}`)?.name || "");
  const [answer, setAnswer] = useState(
    () => saved(`rsvp:${id}`)?.answer || "yes",
  );
  const [sent, setSent] = useState(false);
  const [weatherSnapshot, setWeatherSnapshot] = useState(null);
  const hostToken = saved(`host:${id}`);
  const startsAt = g?.startsAt;
  const active = Boolean(g && !g.cancelled);
  const load = useCallback(
    (signal) =>
      api(`/gatherings/${id}`, {
        signal,
        headers: hostToken ? { "x-host-token": hostToken } : {},
      })
        .then((data) => {
          if (signal?.aborted) return;
          setG(data);
          setError("");
        })
        .catch((error) => {
          if (!signal?.aborted) setError(error);
        }),
    [id, hostToken],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (!startsAt || !active) return;
    let controller;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      api("/weather", { signal: request.signal })
        .then((weather) => {
          if (!request.signal.aborted) setWeatherSnapshot({ startsAt, weather });
        })
        .catch((error) => {
          if (!request.signal.aborted && error.name !== "AbortError")
            setWeatherSnapshot({ startsAt, weather: { available: false } });
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
  }, [startsAt, active]);
  async function respond(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api(`/gatherings/${id}/rsvp`, {
        method: "POST",
        body: JSON.stringify({
          name,
          answer,
          editToken: saved(`rsvp:${id}`)?.editToken,
        }),
      });
      if (!save(`rsvp:${id}`, { name, answer, editToken: result.editToken }))
        throw new Error(
          "flows.invite.storage",
        );
      await load();
      setSent(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await api(`/gatherings/${id}`, {
        method: "PATCH",
        headers: { "x-host-token": hostToken },
        body: JSON.stringify({ cancelled: true }),
      });
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setError("flows.invite.copyFallback");
    }
  }
  const weatherLoading = active && weatherSnapshot?.startsAt !== startsAt;
  const weather = weatherSnapshot?.startsAt === startsAt ? weatherSnapshot?.weather : null;
  const condition = sunshineWeather(weather, startsAt);
  const counts = invitationCounts(g);
  // Show nine people; use a grouped attendee view if large gatherings become common.
  const visibleYes = Math.min(counts.yes, 9);
  const moment = selectInvitationMoment({ invitation: g, weather, loading: weatherLoading, responded: sent || Boolean(saved(`rsvp:${id}`)?.editToken) });
  const situation = moment.id.replace("invite-", "");
  const copyKey = situation === "sun" && !g?.host ? "experience.invite.sunAnonymous" : `experience.invite.${situation}`;
  const shareSection = g && (
    <div className="share-section">
      <label htmlFor="invite-url">{t("flows.invite.link")}</label>
      <div className="copy-row">
        <input id="invite-url" readOnly value={window.location.href} onFocus={(e) => e.target.select()} />
        <button onClick={copy} aria-label={t("flows.invite.copy")}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>
      <p className="fineprint">{t("flows.invite.local")}</p>
    </div>
  );
  return (
    <main className="invite-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={17} />
        {t("flows.invite.back")}
      </Link>
      <div className="invite-card">
        {!g ? (
          <>
            <h1>{error ? t("flows.invite.missing") : t("flows.invite.loading")}</h1>
            <p role="alert">{errorText(error)}</p>
          </>
        ) : (
          <>
            <div className="invite-character-heading">
              <div>
                <span className="eyebrow">
                  {g.cancelled ? t("flows.invite.cancelled") : t("flows.invite.kicker")}
                </span>
                <h1>{t(`flows.activity.${g.activity}`)}.</h1>
                <p className="invite-intro">
                  {t("flows.invite.host", { host: g.host })}{" "}<strong>{g.place.name}</strong>.
                </p>
              </div>
              <div className="invite-cast">
                <CharacterScene moment={moment} />
                {situation === "created" && <CharacterScene moment={{ ...moment, character: "stripes" }} />}
              </div>
            </div>
            <p className="invite-moment-copy" data-invitation-state={moment.id}>
              {t(copyKey, { hostName: g.host, time: clock(new Date(g.startsAt)), placeName: g.place?.name || t("experience.invite.placeFallback"), yesCount: counts.yes, maybeCount: counts.maybe, noCount: counts.no })}
            </p>
            {g.isHost && !g.cancelled && shareSection}
            <div className="invite-facts">
              <p>
                <CalendarDays size={19} />
                {dateLabel(g.startsAt, language)}
              </p>
              <p>
                <Clock3 size={19} />
                {clock(new Date(g.startsAt))}–
                {clock(new Date(Date.parse(g.startsAt) + g.duration * 60_000))}{" "}
                · {durationLabel(g.duration, language)}{" "}{t("flows.invite.timezone")}</p>
              <p>
                <MapPin size={19} />
                {placeText(g.place, "meeting", language)}
              </p>
            </div>
            {!g.cancelled && (
              <p className="invite-weather" role="status">
                {t("experience.invite.forecast", {
                  date: dateLabel(g.startsAt, language),
                  time: clock(new Date(g.startsAt)),
                  condition: weatherLoading ? t("experience.invite.weatherLoading") : weather?.stale ? t("experience.invite.weatherStale") : weatherConditionLabel(condition, language),
                })}
              </p>
            )}
            {g.message && <blockquote>{g.message}</blockquote>}
            <div className="rsvp-counts">
              <span>
                <Check size={16} />
                {t("flows.invite.yesCount", { count: counts.yes })}
              </span>
              <span>{t("flows.invite.maybeCount", { count: counts.maybe })}</span>
              <span>{t("flows.invite.noCount", { count: counts.no })}</span>
            </div>
            {counts.yes > 0 && !g.cancelled && (
              <div className="rsvp-people" aria-hidden="true">
                {Array.from({ length: visibleYes }, (_, index) => (
                  <CharacterScene key={index} moment={{ id: "invite-responses", character: "blue-coat" }} sizes="96px" />
                ))}
                {counts.yes > visibleYes && <span>{t("experience.invite.moreYes", { count: counts.yes - visibleYes })}</span>}
              </div>
            )}
            {situation === "responses" && !g.cancelled && g.place && (
              <a className="primary wide invite-next-action" href={getDirectionsUrl(g.place)} target="_blank" rel="noreferrer">
                {t("experience.invite.directions")} <Navigation size={18} />
              </a>
            )}
            {g.cancelled && <Link href="/" className="secondary wide invite-next-action">{t("experience.invite.newInvitation")}</Link>}
            {!g.cancelled && (
              <form onSubmit={respond} className="rsvp-form">
                <label htmlFor="guest-name">{t("flows.invite.name")}</label>
                <input
                  id="guest-name"
                  autoComplete="given-name"
                  required
                  maxLength={50}
                  placeholder={t("flows.invite.namePlaceholder")}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSent(false);
                  }}
                />
                <fieldset>
                  <legend>{t("flows.invite.question")}</legend>
                  <div className="answer-options">
                    {[
                      ["yes", t("flows.invite.yes"), "puffer"],
                      ["maybe", t("flows.invite.maybe"), "green-jacket"],
                      ["no", t("flows.invite.no"), "turtleneck"],
                    ].map(([value, label, character]) => (
                      <label
                        className={answer === value ? "chosen" : ""}
                        key={value}
                      >
                        <CharacterScene moment={{ id: `invite-answer-${value}`, character }} />
                        <span>
                          <input
                            type="radio"
                            name="answer"
                            value={value}
                            checked={answer === value}
                            onChange={() => {
                              setAnswer(value);
                              setSent(false);
                            }}
                          />
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="primary wide" disabled={busy}>
                  {busy ? t("flows.invite.saving") : sent ? t("flows.invite.saved") : t("flows.invite.saveAnswer")}
                  {sent ? <Check size={18} /> : <Users size={18} />}
                </button>
              </form>
            )}
            {sent && (
              <p className="success" role="status">{t("flows.invite.success")}</p>
            )}
            {error && (
              <p className="error" role="alert">
                {errorText(error)}
              </p>
            )}
            {(!g.isHost || g.cancelled) && shareSection}
            {g.isHost && (
              <section className="host-section">
                <h2>{t("flows.invite.hostHeading")}</h2>
                {g.answers.length ? (
                  <ul>
                    {g.answers.map((r, i) => (
                      <li key={i}>
                        <span>{r.name}</span>
                        <b>
                          {
                            { yes: t("flows.invite.attending"), maybe: t("flows.invite.maybe"), no: t("flows.invite.no") }[
                              r.answer
                            ]
                          }
                        </b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("flows.invite.noAnswers")}</p>
                )}
                {!g.cancelled &&
                  (confirmCancel ? (
                    <div className="cancel-confirm">
                      <p>{t("flows.invite.confirmCancel")}</p>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={cancel}
                      >{t("flows.invite.cancelYes")}
                      </button>
                      <button onClick={() => setConfirmCancel(false)}>{t("flows.invite.keep")}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => setConfirmCancel(true)}
                    >
                      <X size={15} />
                      {t("flows.invite.cancel")}
                    </button>
                  ))}
              </section>
            )}
            <p className="fineprint">{t("flows.invite.disclaimer")}</p>
          </>
        )}
      </div>
    </main>
  );
}
