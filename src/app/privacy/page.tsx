import { profileReturn } from "@/profile.js";
import Link from "next/link";
const notices = {
  sv: {
    title: "Din integritet",
    back: "Till profilen",
    intro:
      "SunSpot hjälper dig att hitta en plats och bjuda in vänner. Ett konto är frivilligt.",
    sections: [
      [
        "Utan konto",
        "Ditt namn, din profilbild, språkval och uppgifter för att hantera dina häng sparas i din webbläsare. Om du rensar webbläsarens lagring försvinner den lokala profilen och möjligheten att hantera gamla häng därifrån.",
      ],
      [
        "Med Google",
        "Vi ber om namn, e-postadress och profilbild för att identifiera ditt konto. Vi får aldrig ditt Google-lösenord och ber inte om tillgång till Gmail, kontakter eller kalender. Namn, en liten profilbild och din valda aktivitet sparas i SunSpots databas så att de kan följa med mellan enheter. Din e-post visas bara för dig.",
      ],
      [
        "Det du delar",
        "När du skapar eller svarar på ett häng visas ditt valda namn och din bild för alla som har länken, tillsammans med plats, tid och deltagare. Uppgifterna är en kopia från det tillfället. Senare profiländringar ändrar inte gamla inbjudningar. Dela bara länken med dem du vill bjuda in.",
      ],
      [
        "Lagring och leverantörer",
        "SunSpot körs hos Vercel och använder Upstash för sparade profiler och häng. Google hanterar Google-inloggningen. Kontoprofiler sparas tills du ber oss ta bort dem. Häng tas bort automatiskt 24 timmar efter att de slutar. Inloggningscookies kan gälla i upp till 30 dagar och tas bort vid utloggning. Tekniska driftloggar kan behandlas av våra leverantörer.",
      ],
      [
        "Dina val",
        "Du kan redigera din profil, ta bort din bild och logga ut på profilsidan. En gäst kan ta tillbaka sitt svar via samma webbläsare. För frågor eller för att radera din sparade kontoprofil, kontakta SunSpot via supportadressen som visas i Googles inloggningsruta. Du kan också ta bort SunSpots Google-åtkomst i ditt Google-konto; det raderar inte automatiskt data som redan sparats i SunSpot.",
      ],
    ],
    updated: "Uppdaterad 20 september 2026",
  },
  da: {
    title: "Dit privatliv",
    back: "Til profilen",
    intro:
      "SunSpot hjælper dig med at finde et sted og invitere venner. En konto er valgfri.",
    sections: [
      [
        "Uden konto",
        "Dit navn, profilbillede, sprogvalg og oplysninger til at administrere dine aftaler gemmes i din browser. Hvis du rydder browserens lager, forsvinder den lokale profil og muligheden for at administrere gamle aftaler derfra.",
      ],
      [
        "Med Google",
        "Vi beder om navn, e-mailadresse og profilbillede for at identificere din konto. Vi får aldrig din Google-adgangskode og beder ikke om adgang til Gmail, kontakter eller kalender. Navn, et lille profilbillede og din valgte aktivitet gemmes i SunSpots database, så de kan følge med på tværs af enheder. Din e-mail vises kun for dig.",
      ],
      [
        "Det du deler",
        "Når du opretter eller svarer på en aftale, vises dit valgte navn og billede for alle med linket, sammen med sted, tidspunkt og deltagere. Oplysningerne er en kopi fra det tidspunkt. Senere profilændringer ændrer ikke gamle invitationer. Del kun linket med dem, du vil invitere.",
      ],
      [
        "Lagring og leverandører",
        "SunSpot kører hos Vercel og bruger Upstash til gemte profiler og aftaler. Google håndterer Google-login. Kontoprofiler gemmes, indtil du beder os om at slette dem. Aftaler slettes automatisk 24 timer efter afslutning. Login-cookies kan gælde i op til 30 dage og fjernes ved logout. Tekniske driftslogfiler kan behandles af vores leverandører.",
      ],
      [
        "Dine valg",
        "Du kan redigere din profil, fjerne dit billede og logge ud på profilsiden. En gæst kan trække sit svar tilbage via samme browser. Ved spørgsmål eller ønske om at slette din gemte kontoprofil kan du kontakte SunSpot via supportadressen i Googles loginvindue. Du kan også fjerne SunSpots Google-adgang i din Google-konto; det sletter ikke automatisk data, der allerede er gemt i SunSpot.",
      ],
    ],
    updated: "Opdateret 20. september 2026",
  },
  en: {
    title: "Your privacy",
    back: "Back to profile",
    intro:
      "SunSpot helps you find a place and invite friends. An account is optional.",
    sections: [
      [
        "Without an account",
        "Your name, profile photo, language choice and credentials for managing your hangouts are saved in your browser. Clearing browser storage removes the local profile and access to manage old hangouts from that browser.",
      ],
      [
        "With Google",
        "We request your name, email address and profile photo to identify your account. We never receive your Google password and do not request access to Gmail, contacts or calendars. Your name, a small profile photo and preferred activity are stored in SunSpot's database so they can follow you across devices. Your email is shown only to you.",
      ],
      [
        "What you share",
        "When you host or respond to a hangout, your chosen name and photo are visible to anyone with the link, alongside the place, time and attendees. These details are a snapshot from that moment. Later profile changes do not update old invitations. Share the link only with people you want to invite.",
      ],
      [
        "Storage and providers",
        "SunSpot runs on Vercel and uses Upstash to store profiles and hangouts. Google handles Google sign-in. Account profiles are kept until you ask us to remove them. Hangouts are automatically deleted 24 hours after they end. Sign-in cookies can last up to 30 days and are removed on sign-out. Our providers may process technical operational logs.",
      ],
      [
        "Your choices",
        "You can edit your profile, remove your photo and sign out on the profile page. A guest can withdraw their response using the same browser. For questions or deletion of your saved account profile, contact SunSpot using the support email shown in Google's sign-in screen. You can also revoke SunSpot's Google access in your Google account; this does not automatically delete data already stored in SunSpot.",
      ],
    ],
    updated: "Updated 20 September 2026",
  },
};
export const metadata = { title: "Privacy · SunSpot" };
export default async function Privacy({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; returnTo?: string }>;
}) {
  const { lang, returnTo } = await searchParams;
  const suffix = `&returnTo=${encodeURIComponent(profileReturn(returnTo))}`;
  const locale = lang === "sv" || lang === "da" ? lang : "en";
  const copy = notices[locale];
  return (
    <main className="profile-page privacy-page" lang={locale}>
      <header className="profile-header">
        <Link
          href={`/profile?returnTo=${encodeURIComponent(profileReturn(returnTo))}`}
        >
          ← {copy.back}
        </Link>
        <strong>SunSpot</strong>
      </header>
      <nav className="privacy-languages" aria-label="Language">
        <Link href={`/privacy?lang=sv${suffix}`} lang="sv">
          Svenska
        </Link>
        <Link href={`/privacy?lang=da${suffix}`} lang="da">
          Dansk
        </Link>
        <Link href={`/privacy?lang=en${suffix}`} lang="en">
          English
        </Link>
      </nav>
      <article className="profile-card">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        {copy.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <small>{copy.updated}</small>
      </article>
    </main>
  );
}
