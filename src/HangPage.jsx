"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Clock3, MapPin, Share2, Sun } from "lucide-react";
import { LanguageProvider, LanguageSelect, useLanguage } from "./Language.jsx";
import {
  hangActivities,
  readHangLocal,
  writeHangLocal,
  newHangToken,
  hangRequest,
  rememberHang,
  rememberVisitedHang,
  hangTime,
  hangDate,
} from "./hangs.js";
import { rememberProfileName } from "./profile.js";
import { useAccount } from "./Account.jsx";
import HangNavigation from "./HangNavigation.jsx";
import ProfileLink from "./ProfileLink.jsx";
import Avatar from "./Avatar.jsx";
import { placeMapsUrl } from "./placeShare.js";

function Hang({ id, canExplore }) {
  const { t, locale } = useLanguage();
  const [h, setH] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [fatal, setFatal] = useState(false);
  const { profile, user, loading: accountLoading } = useAccount();
  const [nameDraft, setName] = useState(null),
    [joining, setJoining] = useState(false),
    [feedback, setFeedback] = useState(""),
    [manual, setManual] = useState("");
  const name = nameDraft ?? profile.name;
  const [clock, setClock] = useState(() => Date.now());
  const offset = useRef(0);
  const alive = useRef(true);
  const generation = useRef(0);
  const [credential] = useState(
    () =>
      readHangLocal(`host:${id}`) ||
      readHangLocal(`guest:${id}`) ||
      newHangToken(),
  );
  const [closing, setClosing] = useState(false);
  const closeDialog = useRef(null);
  useEffect(() => {
    if (closing) closeDialog.current?.showModal();
  }, [closing]);
  function accept(data) {
    rememberVisitedHang(data);
    offset.current = data.serverNow - Date.now();
    setClock(data.serverNow);
    setH(data);
    setFatal(false);
  }
  useEffect(() => {
    alive.current = true;
    let loading = false;
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden || loading) return;
      loading = true;
      const version = generation.current;
      try {
        const data = await hangRequest(`/${id}`, {
          token: credential,
          signal: controller.signal,
        });
        if (alive.current && version === generation.current) {
          accept(data);
          setError("");
        }
      } catch (err) {
        if (
          alive.current &&
          err.name !== "AbortError" &&
          version === generation.current
        ) {
          setError(err.message);
          setFatal(err.status === 404);
        }
      } finally {
        loading = false;
      }
    }
    refresh();
    const poll = setInterval(refresh, 30000);
    const tick = setInterval(() => setClock(Date.now() + offset.current), 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      alive.current = false;
      controller.abort();
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [id, credential]);
  async function mutate(action, body) {
    setBusy(true);
    setError("");
    generation.current++;
    try {
      if (action === "rsvp" && !writeHangLocal(`guest:${id}`, credential))
        throw Error(
          "Tillåt lokal lagring i webbläsaren för att spara ditt svar.",
        );
      const data = await hangRequest(`/${id}/${action}`, {
        token: credential,
        body:
          action === "rsvp" && body.coming
            ? { ...body, photo: profile.photo }
            : body,
      });
      accept(data);
      if (data.isHost) rememberHang(data, credential);
      if (action === "rsvp") {
        if (!user) rememberProfileName(name.trim());
        setJoining(false);
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      generation.current++;
      setBusy(false);
    }
  }
  const ended = h && (h.status === "ended" || clock >= h.endsAt);
  const scheduled = h && clock < h.startsAt;
  const activity = hangActivities.find((a) => a.id === h?.activity);
  const title = h
    ? t("{0} {1} på {2}", [h.host, t(activity.verb), h.place.name])
    : "";
  async function share() {
    const data = {
      title: "SunSpot",
      text: `${title}. ${hangDate(h.startsAt, locale)} · ${t("Här till {0}", [hangTime(h.endsAt, locale)])}. ${t("Kom förbi!")}`,
      url: h.url,
    };
    setFeedback("");
    setManual("");
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
        setFeedback("Kopierat! Klistra in i chatten.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setManual(`${data.text}\n${data.url}`);
        setFeedback("Markera och kopiera meddelandet nedan.");
      }
    }
  }
  return (
    <main className="hang-page">
      <header className="hang-header">
        <Link className="hang-brand" href="/" aria-label="SunSpot">
          <Sun size={24} />
          SunSpot
        </Link>
        <div className="hang-header-actions">
          <LanguageSelect />
          <ProfileLink returnTo={`/hang/${id}`} />
        </div>
      </header>
      <HangNavigation canExplore={canExplore} />
      {!h || fatal ? (
        <section className="hang-card hang-empty">
          <span className="hang-art">👋</span>
          <h1>{t(error || "Hämtar hänget…")}</h1>
          {error && (
            <button className="secondary" onClick={() => location.reload()}>
              {t("Försök igen")}
            </button>
          )}
        </section>
      ) : (
        <>
          <section className={`hang-card ${ended ? "is-ended" : ""}`}>
            <div className="hang-card-top">
              <span className="hang-status">
                <i />
                {t(
                  ended
                    ? "Hänget är avslutat"
                    : scheduled
                      ? "Vi ses snart"
                      : "Kom förbi",
                )}
              </span>
              <span className="hang-city">{t("Köpenhamn")}</span>
            </div>
            <div className="hang-art" aria-hidden="true">
              {ended ? "👋" : activity.emoji}
              <span className="hang-spark">✳</span>
            </div>
            <p className="hang-eyebrow">
              {t(
                ended ? "{0} bjöd in till ett häng" : "{0} {1}",
                ended ? [h.host] : [h.host, t(activity.verb)],
              )}
            </p>
            <h1>
              {h.place.name}
              <span className="hang-title-dot">.</span>
            </h1>
            <p className="hang-location">
              <MapPin size={15} />
              {h.place.district}
            </p>
            <p className="hang-time">
              <Clock3 size={17} />
              {ended
                ? t("Tack för hänget.")
                : scheduled
                  ? `${hangDate(h.startsAt, locale)} · ${hangTime(h.startsAt, locale)}–${hangTime(h.endsAt, locale)}`
                  : t("Här till {0}", [hangTime(h.endsAt, locale)])}
            </p>
            {ended ? (
              <div className="hang-ended-next">
                <p className="hang-muted">
                  {t("Ingen väntar på svar här längre. Vi ses nästa gång!")}
                </p>
                <Link
                  className="primary wide"
                  href={canExplore ? "/" : "/hangs"}
                >
                  {t(canExplore ? "Hitta nästa häng" : "Mina häng")}
                </Link>
              </div>
            ) : (
              <>
                <div className="hang-guests" aria-live="polite">
                  <div className="hang-avatars">
                    <Avatar name={h.host} photo={h.hostPhoto} />
                    {h.guests.slice(0, 4).map((g) => (
                      <Avatar key={g.id} name={g.name} photo={g.photo} />
                    ))}
                  </div>
                  <p>
                    {h.guests.length
                      ? t("{0} kommer", [
                          h.guests.map((g) => g.name).join(", "),
                        ])
                      : h.isHost
                        ? t("Vem kommer förbi? Dela länken.")
                        : t("Bli först att säga ”jag kommer”.")}
                  </p>
                </div>
                {h.isHost ? (
                  <button
                    className="primary wide hang-main-action"
                    onClick={share}
                  >
                    <Share2 size={19} />
                    {t("Dela med vänner")}
                  </button>
                ) : h.joined ? (
                  <div className="hang-joined">
                    <p>
                      <Check size={19} />
                      {t("Du kommer. Vi ses där!")}
                    </p>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => mutate("rsvp", { coming: false })}
                    >
                      {t("Jag kan inte längre")}
                    </button>
                  </div>
                ) : joining ? (
                  <form
                    className="hang-join-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutate("rsvp", { coming: true, name });
                    }}
                  >
                    <label>
                      {t("Ditt förnamn")}
                      <input
                        autoFocus
                        autoComplete="given-name"
                        required
                        maxLength={32}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <button
                      className="primary wide"
                      disabled={busy || accountLoading}
                    >
                      {t(busy ? "Sparar…" : "Jag kommer")}
                      <ArrowUpRight size={19} />
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => setJoining(false)}
                    >
                      {t("Avbryt")}
                    </button>
                  </form>
                ) : (
                  <button
                    className="primary wide hang-main-action"
                    disabled={busy}
                    onClick={() => setJoining(true)}
                  >
                    {t("Jag kommer")}
                    <ArrowUpRight size={19} />
                  </button>
                )}
                <a
                  className="hang-directions secondary wide"
                  href={placeMapsUrl(h.place)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={18} />
                  {t("Visa vägen")}
                </a>
                {!scheduled && h.sunUntil > clock && (
                  <p className="hang-sun">
                    <Sun size={17} />
                    {t("Ca {0} minuter möjlig sol kvar.", [
                      Math.max(1, Math.ceil((h.sunUntil - clock) / 60000)),
                    ])}
                    <small>
                      {t(
                        "Uppskattning vid inbjudan. Byggnadsskuggor; moln kan skymma solen.",
                      )}
                    </small>
                  </p>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="hang-error">
                {t(error)} {t("Senaste uppgifterna kan vara inaktuella.")}
              </p>
            )}
            {feedback && (
              <p role="status" className="share-feedback">
                {t(feedback)}
              </p>
            )}
            {manual && (
              <textarea
                className="hang-manual"
                aria-label={t("Meddelande att dela")}
                readOnly
                value={manual}
                onFocus={(e) => e.target.select()}
                rows={5}
              />
            )}
            {h.isHost && !ended && (
              <section
                className="hang-host-controls"
                aria-label={t("Ditt häng")}
              >
                <h2>{t("Ditt häng")}</h2>
                <p>{t("Du hanterar hänget i den här webbläsaren.")}</p>
                <button
                  className="secondary wide"
                  disabled={busy || h.endsAt >= h.startsAt + 6 * 3600000}
                  onClick={() =>
                    mutate("extend", {
                      endsAt: Math.min(
                        h.endsAt + 30 * 60000,
                        h.startsAt + 6 * 3600000,
                      ),
                    })
                  }
                >
                  {t("Vi stannar 30 min till")}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setClosing(true)}
                >
                  {t("Avsluta hänget")}
                </button>
              </section>
            )}
          </section>
          <footer className="hang-footer">
            <p>{t("Mer tillsammans. Mindre planerande.")}</p>
            <small>
              {t(
                "Inget konto behövs. Alla med länken kan se namn, bilder och svar. Uppgifterna tas bort ett dygn efter sluttiden.",
              )}
            </small>
            {canExplore && (
              <Link href="/">
                {t("Till kartan")}
                <ArrowUpRight size={15} />
              </Link>
            )}
          </footer>
        </>
      )}
      {closing && (
        <dialog
          ref={closeDialog}
          className="hang-close-dialog"
          aria-labelledby="close-hang-title"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setClosing(false);
          }}
        >
          <h2 id="close-hang-title">{t("Avsluta hänget?")}</h2>
          <p>
            {t(
              "Alla med länken ser att hänget är avslutat. Det går inte att öppna igen.",
            )}
          </p>
          {error && (
            <p role="alert" className="hang-error">
              {t(error)}
            </p>
          )}
          <button
            autoFocus
            className="secondary wide"
            disabled={busy}
            onClick={() => setClosing(false)}
          >
            {t("Fortsätt hänga")}
          </button>
          <button
            className="primary wide"
            disabled={busy}
            onClick={async () => {
              if (await mutate("close", {})) setClosing(false);
            }}
          >
            {t(busy ? "Avslutar…" : "Ja, avsluta hänget")}
          </button>
        </dialog>
      )}
    </main>
  );
}
export default function HangPage(props) {
  return (
    <LanguageProvider>
      <Hang {...props} />
    </LanguageProvider>
  );
}
