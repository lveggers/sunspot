import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { api, clock, dateLabel, durationLabel, saved, save, placeText } from "./lib.js";
import Character from "./Character.jsx";
import { useLanguage } from "./Language.jsx";

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
  const hostToken = saved(`host:${id}`);
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
                <Character character={g.cancelled ? "green-jacket" : "puffer"} />
                <Character character={g.cancelled ? "turtleneck" : "blue-shirt"} />
              </div>
            </div>
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
            {g.message && <blockquote>{g.message}</blockquote>}
            <div className="rsvp-counts">
              <span>
                <Check size={16} />
                {t("flows.invite.yesCount", { count: g.counts.yes })}
              </span>
              <span>{t("flows.invite.maybeCount", { count: g.counts.maybe })}</span>
              <span>{t("flows.invite.noCount", { count: g.counts.no })}</span>
            </div>
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
                        <Character character={character} />
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
            <div className="share-section">
              <label htmlFor="invite-url">{t("flows.invite.link")}</label>
              <div className="copy-row">
                <input
                  id="invite-url"
                  readOnly
                  value={window.location.href}
                  onFocus={(e) => e.target.select()}
                />
                <button onClick={copy} aria-label={t("flows.invite.copy")}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="fineprint">{t("flows.invite.local")}</p>
            </div>
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
