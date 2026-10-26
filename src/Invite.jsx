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
import { api, clock, dateLabel, durationLabel, saved, save } from "./lib.js";
import { activityNames } from "./places.js";
import Character from "./Character.jsx";

export default function Invite({ id }) {
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
      if (!save(`rsvp:${id}`, { name, answer, editToken: result.editToken }))
        throw new Error(
          "Svaret sparades, men webbläsaren kan inte spara behörigheten att ändra det.",
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
        headers: { "x-host-token": hostToken },
        body: JSON.stringify({ cancelled: true }),
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
        <ArrowLeft size={17} /> Tillbaka till kartan
      </Link>
      <div className="invite-card">
        {!g ? (
          <>
            <h1>{error ? "Inbjudan saknas" : "Hämtar din inbjudan…"}</h1>
            <p role="alert">{error}</p>
          </>
        ) : (
          <>
            <div className="invite-character-heading">
              <div>
                <span className="eyebrow">
                  {g.cancelled ? "TRÄFFEN ÄR INSTÄLLD" : "EN STUND TILLSAMMANS"}
                </span>
                <h1>{activityNames[g.activity]}.</h1>
                <p className="invite-intro">
                  {g.host} bjuder in dig till <strong>{g.place.name}</strong>.
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
                {dateLabel(g.startsAt)}
              </p>
              <p>
                <Clock3 size={19} />
                {clock(new Date(g.startsAt))}–
                {clock(new Date(Date.parse(g.startsAt) + g.duration * 60_000))}{" "}
                · {durationLabel(g.duration)} · Köpenhamnstid
              </p>
              <p>
                <MapPin size={19} />
                {g.place.meeting}
              </p>
            </div>
            {g.message && <blockquote>{g.message}</blockquote>}
            <div className="rsvp-counts">
              <span>
                <Check size={16} />
                {g.counts.yes} kommer
              </span>
              <span>{g.counts.maybe} kanske</span>
              <span>{g.counts.no} kan inte</span>
            </div>
            {!g.cancelled && (
              <form onSubmit={respond} className="rsvp-form">
                <label htmlFor="guest-name">Ditt namn</label>
                <input
                  id="guest-name"
                  autoComplete="given-name"
                  required
                  maxLength={50}
                  placeholder="Vad heter du?"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSent(false);
                  }}
                />
                <fieldset>
                  <legend>Kan du komma?</legend>
                  <div className="answer-options">
                    {[
                      ["yes", "Jag kommer", "puffer"],
                      ["maybe", "Kanske", "green-jacket"],
                      ["no", "Kan inte", "turtleneck"],
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
                  {busy ? "Sparar…" : sent ? "Svar sparat" : "Spara mitt svar"}
                  {sent ? <Check size={18} /> : <Users size={18} />}
                </button>
              </form>
            )}
            {sent && (
              <p className="success" role="status">
                Ditt svar är sparat. Du kan ändra det i den här webbläsaren.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="share-section">
              <label htmlFor="invite-url">Inbjudningslänk</label>
              <div className="copy-row">
                <input
                  id="invite-url"
                  readOnly
                  value={window.location.href}
                  onFocus={(e) => e.target.select()}
                />
                <button onClick={copy} aria-label="Kopiera inbjudningslänk">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="fineprint">
                Lokal förhandsvisning: länken fungerar på den här datorn. Extern
                delning kräver att SunSpot publiceras.
              </p>
            </div>
            {g.isHost && (
              <section className="host-section">
                <h2>Du är värd</h2>
                {g.answers.length ? (
                  <ul>
                    {g.answers.map((r, i) => (
                      <li key={i}>
                        <span>{r.name}</span>
                        <b>
                          {
                            { yes: "Kommer", maybe: "Kanske", no: "Kan inte" }[
                              r.answer
                            ]
                          }
                        </b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Inga svar ännu. Öppna länken i ett annat webbläsarfönster
                    för att prova.
                  </p>
                )}
                {!g.cancelled &&
                  (confirmCancel ? (
                    <div className="cancel-confirm">
                      <p>Ställa in träffen för alla?</p>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={cancel}
                      >
                        Ja, ställ in
                      </button>
                      <button onClick={() => setConfirmCancel(false)}>
                        Behåll träffen
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => setConfirmCancel(true)}
                    >
                      <X size={15} /> Ställ in träffen
                    </button>
                  ))}
              </section>
            )}
            <p className="fineprint">
              Platsens solfönster är exempeldata. Träffen är ingen
              bordsreservation.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
