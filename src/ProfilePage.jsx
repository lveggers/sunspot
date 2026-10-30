"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, Sun } from "lucide-react";
import { LanguageProvider, LanguageSelect, useLanguage } from "./Language.jsx";
import { hangActivities } from "./hangs.js";
import { readProfile, prepareProfilePhoto } from "./profile.js";
import { useAccount } from "./Account.jsx";
import HangNavigation from "./HangNavigation.jsx";
import Avatar from "./Avatar.jsx";
function Profile({ returnTo, canExplore, authError }) {
  const { t, locale } = useLanguage();
  const account = useAccount();
  const [profile, setProfile] = useState(() => account.profile);
  const [authBusy, setAuthBusy] = useState(false);
  const [localProfile] = useState(readProfile);
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(false);
  const fileInput = useRef(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const back = returnTo !== "/" || canExplore ? returnTo : "/";
  function change(value) {
    setProfile((p) => ({ ...p, ...value }));
    setSaved(false);
    setError("");
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const version = ++generation.current;
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const photo = await prepareProfilePhoto(file);
      if (version === generation.current) change({ photo });
    } catch (err) {
      if (version === generation.current) setError(err.message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setProfile(await account.save(profile));
      setSaved(true);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  async function authenticate(logout = false) {
    setAuthBusy(true);
    setError("");
    try {
      const { signIn, signOut } = await import("next-auth/react");
      const redirectTo = `/profile${returnTo === "/" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`}`;
      if (logout) await signOut({ redirectTo });
      else await signIn("google", { redirectTo });
    } catch {
      setError("Inloggningen avbröts. Försök igen eller fortsätt utan konto.");
      setAuthBusy(false);
    }
  }
  return (
    <main className="profile-page hang-page">
      <header className="profile-header">
        <span className="hang-brand">
          <Sun size={22} />
          SunSpot
        </span>
        <span className="profile-header-spacer" />
      </header>
      <HangNavigation
        canExplore={canExplore}
        returnTo={returnTo !== "/" ? returnTo : undefined}
        current="profile"
      />
      <section className="profile-card">
        <p className="hang-eyebrow">{t("Lite mer du.")}</p>
        <h1>
          {t("Min profil")}
          <span>.</span>
        </h1>
        <section className="profile-account" aria-label={t("Ditt konto")}>
          {account.user ? (
            <>
              <div className="profile-account-status">
                <Check size={16} />
                <strong>{t("Inloggad med Google")}</strong>
              </div>
              <p className="profile-account-email">{account.user.email}</p>
              <p>
                {t(
                  "Namn, bild och profilval följer med när du loggar in på en annan enhet.",
                )}
              </p>
              <button
                type="button"
                className="text-button"
                disabled={authBusy || loading}
                onClick={() => authenticate(true)}
              >
                {t("Logga ut")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="google-signin"
                disabled={!account.enabled || authBusy || loading}
                onClick={() => authenticate()}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M43.61 20.46H24v7.86h11.3c-.49 2.53-1.98 4.67-4.22 6.11v5.1h6.83c4-3.69 6.31-9.11 6.31-15.53 0-1.18-.1-2.39-.31-3.54Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 44c5.4 0 9.92-1.78 13.23-4.47l-6.83-5.1c-1.83 1.22-4.18 1.95-6.4 1.95-5.19 0-9.59-3.5-11.17-8.22H5.79v5.27C9.18 40.19 16.04 44 24 44Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12.83 28.16a12.03 12.03 0 0 1 0-8.32v-5.27H5.79a20 20 0 0 0 0 18.86l7.04-5.27Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 11.62c2.96 0 5.62 1.02 7.72 3.02l5.79-5.8C34.09 5.65 29.4 4 24 4 16.04 4 9.18 7.81 5.79 14.57l7.04 5.27C14.41 15.12 18.81 11.62 24 11.62Z"
                  />
                </svg>
                {t(authBusy ? "Öppnar Google…" : "Fortsätt med Google")}
              </button>
              <p>
                {t(
                  account.enabled
                    ? "Helt frivilligt. Spara din profil mellan enheter – eller fortsätt utan konto."
                    : "Google-inloggning aktiveras snart.",
                )}
              </p>
            </>
          )}
          {(authError || account.error) && (
            <p className="hang-error" role="alert">
              {t(
                account.error
                  ? "Profilen kunde inte hämtas. Försök igen."
                  : "Inloggningen avbröts. Försök igen eller fortsätt utan konto.",
              )}
            </p>
          )}
        </section>
        <form onSubmit={submit}>
          <div className="profile-photo-editor">
            <button
              type="button"
              className="profile-photo-button"
              aria-label={t("Välj profilbild")}
              onClick={() => fileInput.current.click()}
              disabled={loading}
            >
              <Avatar name={profile.name} photo={profile.photo} />
              <span className="profile-camera">
                <Camera size={18} />
              </span>
            </button>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={t("Ladda upp profilbild")}
              onChange={upload}
              tabIndex={-1}
            />
            <div>
              <button
                type="button"
                className="text-button"
                onClick={() => fileInput.current.click()}
                disabled={loading}
              >
                {t(
                  loading
                    ? "Förbereder bild…"
                    : profile.photo
                      ? "Byt bild"
                      : "Lägg till en bild",
                )}
              </button>
              <p>{t("JPG, PNG eller WebP · max 10 MB")}</p>
              {profile.photo && (
                <button
                  type="button"
                  className="text-button profile-remove"
                  disabled={loading}
                  onClick={() => change({ photo: null })}
                >
                  {t("Ta bort bild")}
                </button>
              )}
            </div>
          </div>
          <label>
            {t("Ditt förnamn")}
            <input
              autoComplete="given-name"
              maxLength={32}
              required
              value={profile.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>{t("Helst ses jag över…")}</legend>
            <div className="hang-activities">
              {hangActivities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={profile.activity === a.id}
                  onClick={() =>
                    change({ activity: profile.activity === a.id ? "" : a.id })
                  }
                >
                  <span aria-hidden="true">{a.emoji}</span>
                  {t(a.label)}
                </button>
              ))}
            </div>
            <p className="profile-hint">
              {t("Förvalt nästa gång du bjuder in. Du kan alltid ändra.")}
            </p>
          </fieldset>
          <p className="profile-privacy">
            {t(
              account.user
                ? "Din profil sparas på ditt konto. Namn och bild visas för alla med länken när du skapar ett häng eller svarar. Ändringar gäller nästa inbjudan eller svar."
                : "Din profil sparas i den här webbläsaren. Namn och bild visas för alla med länken när du skapar ett häng eller svarar. Ändringar gäller nästa inbjudan eller svar.",
            )}
          </p>
          {account.user && localProfile.name && (
            <button
              type="button"
              className="text-button profile-import"
              disabled={loading}
              onClick={() => change(localProfile)}
            >
              {t("Använd profilen från den här enheten")}
            </button>
          )}
          {error && (
            <p role="alert" className="hang-error">
              {t(error)}
            </p>
          )}
          <button className="primary wide" disabled={loading}>
            {saved ? <Check size={18} /> : null}
            {t(saved ? "Profil sparad" : "Spara profil")}
          </button>
          {saved && (
            <p role="status" className="profile-saved">
              {t("Klart! Din profil är redo för nästa häng.")}{" "}
              <Link href={back}>{t("Tillbaka")} →</Link>
            </p>
          )}
        </form>
      </section>
      <section className="profile-settings">
        <LanguageSelect />
        <p className="profile-hint">{t("Språkvalet sparas direkt.")}</p>
      </section>
      <section className="profile-meetups">
        <Link href="/hangs" className="secondary wide">
          {t("Mina häng")} →
        </Link>
        <p className="profile-hint">
          {t(
            "Häng och svar hanteras fortfarande från webbläsaren där du skapade dem.",
          )}
        </p>
      </section>
      <p className="profile-local-note">
        <Link
          href={`/privacy?lang=${locale}&returnTo=${encodeURIComponent(returnTo)}`}
        >
          {t("Din integritet")}
        </Link>
      </p>
      <p className="profile-local-note">
        {t(
          account.user
            ? "Du väljer vad du delar. Din e-post visas aldrig för andra deltagare."
            : "Ingen inloggning behövs. Profilen följer inte automatiskt med till andra webbläsare eller enheter.",
        )}
      </p>
    </main>
  );
}
function ReadyProfile(props) {
  const account = useAccount();
  const { t } = useLanguage();
  if (account.loading)
    return (
      <p className="app-loading" role="status">
        {t("Hämtar profil…")}
      </p>
    );
  return <Profile key={account.user?.id || "guest"} {...props} />;
}
export default function ProfilePage(props) {
  return (
    <LanguageProvider>
      <ReadyProfile {...props} />
    </LanguageProvider>
  );
}
