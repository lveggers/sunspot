import { useLanguage } from "./Language.jsx";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  MapPin,
  Sun,
  Users,
  X,
} from "lucide-react";
import { api, clock, dateLabel, durationLabel, saved, save } from "./lib.js";
import { activityNames } from "./places.js";
export default function Invite({ id }) {
  const { t, locale } = useLanguage();
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
        headers: hostToken
          ? {
              "x-host-token": hostToken,
            }
          : {},
      })
        .then((data) => {
          if (signal?.aborted) return;
          setG(data);
          setError("");
        })
        .catch((error) => {
          if (!signal?.aborted) setError(error.message);
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
      if (
        !save(`rsvp:${id}`, {
          name,
          answer,
          editToken: result.editToken,
        })
      )
        throw new Error(
          t(
            "Svaret sparades, men webbläsaren kan inte spara behörigheten att ändra det.",
          ),
        );
      await load();
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await api(`/gatherings/${id}`, {
        method: "PATCH",
        headers: {
          "x-host-token": hostToken,
        },
        body: JSON.stringify({
          cancelled: true,
        }),
      });
      await load();
    } catch (e) {
      setError(e.message);
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
      setError("Kopiera länken från fältet nedan.");
    }
  }
  return (
    <main className="invite-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={17} />
        {t(" Tillbaka till kartan")}
      </Link>
      <div className="invite-card">
        <div className="invite-sun">
          <Sun size={34} />
        </div>
        {!g ? (
          <>
            <h1>{error ? t("Inbjudan saknas") : t("Hämtar din inbjudan…")}</h1>
            <p role="alert">{t(error)}</p>
          </>
        ) : (
          <>
            <span className="eyebrow">
              {g.cancelled
                ? t("TRÄFFEN ÄR INSTÄLLD")
                : t("EN STUND TILLSAMMANS")}
            </span>
            <h1>{t(activityNames[g.activity])}.</h1>
            <p className="invite-intro">
              {g.host}
              {t(" bjuder in dig till ")}
              <strong>{g.place.name}</strong>.
            </p>
            <div className="invite-facts">
              <p>
                <CalendarDays size={19} />
                {dateLabel(g.startsAt, locale)}
              </p>
              <p>
                <Clock3 size={19} />
                {clock(new Date(g.startsAt))}–
                {clock(new Date(Date.parse(g.startsAt) + g.duration * 60_000))}{" "}
                · {durationLabel(g.duration)}
                {t(" · Köpenhamnstid")}
              </p>
              <p>
                <MapPin size={19} />
                {t(g.place.meeting)}
              </p>
            </div>
            {g.message && <blockquote>{g.message}</blockquote>}
            <div className="rsvp-counts">
              <span>
                <Check size={16} />
                {g.counts.yes}
                {t(" kommer")}
              </span>
              <span>
                {g.counts.maybe}
                {t(" kanske")}
              </span>
              <span>
                {g.counts.no}
                {t(" kan inte")}
              </span>
            </div>
            {!g.cancelled && (
              <form onSubmit={respond} className="rsvp-form">
                <label htmlFor="guest-name">{t("Ditt namn")}</label>
                <input
                  id="guest-name"
                  autoComplete="given-name"
                  required
                  maxLength={50}
                  placeholder={t("Vad heter du?")}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSent(false);
                  }}
                />
                <fieldset>
                  <legend>{t("Kan du komma?")}</legend>
                  <div className="answer-options">
                    {[
                      ["yes", t("Jag kommer")],
                      ["maybe", t("Kanske")],
                      ["no", t("Kan inte")],
                    ].map(([value, label]) => (
                      <label
                        className={answer === value ? "chosen" : ""}
                        key={value}
                      >
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
                        {t(label)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="primary wide" disabled={busy}>
                  {busy
                    ? t("Sparar…")
                    : sent
                      ? t("Svar sparat")
                      : t("Spara mitt svar")}
                  {sent ? <Check size={18} /> : <Users size={18} />}
                </button>
              </form>
            )}
            {sent && (
              <p className="success" role="status">
                {t(
                  "Ditt svar är sparat. Du kan ändra det i den här webbläsaren.",
                )}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {t(error)}
              </p>
            )}
            <div className="share-section">
              <label htmlFor="invite-url">{t("Inbjudningslänk")}</label>
              <div className="copy-row">
                <input
                  id="invite-url"
                  readOnly
                  value={window.location.href}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={copy}
                  aria-label={t("Kopiera inbjudningslänk")}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="fineprint">
                {t(
                  "Lokal förhandsvisning: länken fungerar på den här datorn. Extern delning kräver att SunSpot publiceras.",
                )}
              </p>
            </div>
            {g.isHost && (
              <section className="host-section">
                <h2>{t("Du är värd")}</h2>
                {g.answers.length ? (
                  <ul>
                    {g.answers.map((r, i) => (
                      <li key={i}>
                        <span>{r.name}</span>
                        <b>
                          {
                            {
                              yes: t("Kommer"),
                              maybe: t("Kanske"),
                              no: t("Kan inte"),
                            }[r.answer]
                          }
                        </b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {t(
                      "Inga svar ännu. Öppna länken i ett annat webbläsarfönster för att prova.",
                    )}
                  </p>
                )}
                {!g.cancelled &&
                  (confirmCancel ? (
                    <div className="cancel-confirm">
                      <p>{t("Ställa in träffen för alla?")}</p>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={cancel}
                      >
                        {t("Ja, ställ in")}
                      </button>
                      <button onClick={() => setConfirmCancel(false)}>
                        {t("Behåll träffen")}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => setConfirmCancel(true)}
                    >
                      <X size={15} />
                      {t(" Ställ in träffen")}
                    </button>
                  ))}
              </section>
            )}
            <p className="fineprint">
              {t(
                "Solinformationen är en uppskattning. Träffen är ingen bordsreservation.",
              )}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
