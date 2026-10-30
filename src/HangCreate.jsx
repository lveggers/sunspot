import { rememberProfileName } from "./profile.js";
import { useAccount } from "./Account.jsx";
import Avatar from "./Avatar.jsx";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpRight } from "lucide-react";
import { useLanguage } from "./Language.jsx";
import {
  hangActivities,
  readHangLocal,
  writeHangLocal,
  newHangToken,
  hangRequest,
  rememberHang,
  hangTime,
  hangDate,
} from "./hangs.js";

export default function HangCreate({
  place,
  result,
  instant,
  live,
  pending,
  onClose,
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const dialog = useRef(null);
  const { profile, user, loading: accountLoading } = useAccount();
  const [draft] = useState(() => {
    const saved = readHangLocal("pending");
    return saved?.placeId === place.id ? saved : null;
  });

  const [hostDraft, setHost] = useState(() => draft?.body?.host ?? null);
  const host = hostDraft ?? profile.name;
  const [activityDraft, setActivity] = useState(draft?.body?.activity ?? null);
  const activity =
    activityDraft ??
    (profile.activity ||
      (place.category === "bar"
        ? "beer"
        : place.category === "restaurant"
          ? "food"
          : "hang"));
  const [duration, setDuration] = useState(draft?.body?.duration || 90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Freeze the selected time when opening, not on each map/live-clock render.
  const [start] = useState(
    () => draft?.body?.startsAt || (live ? null : Date.parse(instant)),
  );
  const [credential] = useState(() => draft?.token || newHangToken());
  const attempt = useRef(draft?.body || null);
  const [uncertain, setUncertain] = useState(Boolean(draft?.body));
  useEffect(() => {
    const d = dialog.current;
    d.showModal();
    return () => d.close();
  }, []);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Save before the request: a lost response can be retried with the same key.

      if (!attempt.current)
        attempt.current = {
          host,
          photo: profile.photo,
          activity,
          placeId: place.id,
          duration,
          ...(start ? { startsAt: start } : {}),
          ...(!pending &&
          result?.eligible &&
          !result.park &&
          result.state === "sun" &&
          result.reason === "shade" &&
          result.until > 0
            ? {
                sunAt: Date.parse(instant),
                sunUntil: Date.parse(instant) + result.until * 60000,
              }
            : {}),
        };
      if (
        !writeHangLocal("pending", {
          token: credential,
          placeId: place.id,
          body: attempt.current,
        })
      )
        throw Error(
          "Tillåt lokal lagring i webbläsaren för att skapa ett häng.",
        );
      setUncertain(true);
      const h = await hangRequest("", {
        token: credential,
        body: attempt.current,
      });
      if (!rememberHang(h, credential))
        throw Error(
          "Tillåt lokal lagring i webbläsaren för att skapa ett häng.",
        );
      if (!user) rememberProfileName(h.host);
      writeHangLocal("pending", null);
      router.push(`/hang/${h.id}`);
    } catch (err) {
      if (err.status && err.status < 500) {
        attempt.current = null;
        writeHangLocal("pending", null);
      }
      setUncertain(Boolean(attempt.current));
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={busy ? (e) => e.preventDefault() : onClose}
      className="hang-create modal"
      aria-label={t("Bjud in till ett häng")}
    >
      <div className="modal-top">
        <span className="hang-eyebrow">{t("Lite mer spontant.")}</span>
        <button
          className="icon-button"
          aria-label={t("Stäng")}
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <h2>{place.name}</h2>
      {profile.photo && (
        <div className="profile-create-identity">
          <Avatar name={host} photo={profile.photo} />
          <span>{host}</span>
        </div>
      )}
      <p className="hang-muted">
        {start
          ? `${hangDate(start, locale)} · ${hangTime(start, locale)}`
          : t("Jag är här. Kom förbi.")}
      </p>
      <form onSubmit={submit}>
        <label>
          {t("Ditt förnamn")}
          <input
            autoComplete="given-name"
            required
            maxLength={32}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={busy || uncertain}
          />
        </label>
        <fieldset disabled={busy || uncertain}>
          <legend>{t("Vad gör vi?")}</legend>
          <div className="hang-activities">
            {hangActivities.map((a) => (
              <button
                type="button"
                key={a.id}
                aria-pressed={activity === a.id}
                onClick={() => setActivity(a.id)}
              >
                <span aria-hidden="true">{a.emoji}</span>
                {t(a.label)}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          {t("Jag stannar ungefär")}
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={busy || uncertain}
          >
            {[30, 60, 90, 120, 180].map((m) => (
              <option value={m} key={m}>
                {t("{0} minuter", [m])}
              </option>
            ))}
          </select>
        </label>
        <p className="hang-privacy">
          {t(
            "Alla med länken kan se platsen, ditt namn, din bild och vilka som kommer. Hänget avslutas automatiskt.",
          )}
        </p>
        {error && (
          <p role="alert" className="hang-error">
            {t(error)}
          </p>
        )}
        <button className="primary wide" disabled={busy || accountLoading}>
          {t(busy ? "Skapar…" : "Skapa häng")}
          <ArrowUpRight size={20} />
        </button>
      </form>
    </dialog>
  );
}
