# Privat mobilversion på Vercel

Första publicering: 2026-09-16. Projekt: `sunspot-private`, konto/team `calletennis-7918s-projects`. Appkod: `be4f6f6`, Next.js 16.3.5, Node 24.x.

Adress: https://sunspot-private.vercel.app/

Deploy-ID: `dpl_9sZZfc34HWBjsKQADVWWnEFVC3rC`, status READY. Bygge cirka en minut inklusive installation. Vercel registrerade första publiceringen som **production** och gav den stabila adressen, trots CLI-valet `--target preview`. Inloggningsskydd för **all** var därför aktiverat och verifierat före uppladdningen och gäller även den stabila adressen. Det är en privat testversion, inte en öppet tillgänglig lansering.

## Åtkomst

Öppna adressen i mobilens webbläsare och logga in på det Vercel-konto som äger projektet, eller ett konto som har fått åtkomst. Datorn behöver inte vara igång och mobilen behöver inte använda samma wifi. Skyddet hanteras i projektets Deployment Protection; `ssoProtection.deploymentType` är `all`. En oinloggad begäran till både startsidan och event-API:t omdirigeras till inloggning. Ingen publik bypass-länk delas.

## Funktioner och begränsningar

Karta, byggnadsskuggor, tidsreglage, platsfilter, väder och event körs i den hostade versionen. Inbjudningar kräver fortfarande en gemensam beständig databas och returnerar ett förklarande 503-svar på Vercel. Lokal SQLite-data, sessionsfiler, miljöfiler och skärmbilder är exkluderade med `.vercelignore`. Funktionen för solnotiser förutsätter fortfarande en öppen app och användarens tillstånd; bakgrundspush är inte implementerad.

Git-repot är inte kopplat till automatisk publicering i detta nya Vercel-projekt. Framtida publiceringar görs av en autentiserad projektmedlem med Vercel CLI. Publicera en preview med `vercel deploy`, kontrollera den och uppdatera den stabila adressen med `vercel deploy --prod`. Behåll inloggningsskyddet. Vercels projektkoppling och CLI:s behörigheter ligger utanför versionshanteringen.

## Verifiering

Vercel-bygget passerade. Den riktiga eventkällan returnerade 54 event för testveckan och väder-API:t returnerade tillgänglig, färsk prognos. Kartan och eventpanelen testades i en autentiserad mobilvy på den riktiga deploymenten: inga sidfel, inget horisontellt överflöde och tidsreglaget åtkomligt. Oinloggad åtkomst till startsida och event-API returnerade 302 till inloggning. Automatiserad kontroll använde Vercel CLI:s skyddade åtkomst; skyddet stängdes aldrig av.

Ingen separat kontinuerlig övervakning eller loggexport har konfigurerats. Vercels standardloggar är tillgängliga för projektägaren.

Källa för åtkomstskydd: [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

## Uppdatering 2026-09-17

Kartan har nu markörgrupper, mindre mobilkontroller och skuggritning i bakgrunden. Appkod `ffdca50`. En skyddad preview verifierades med `test:map`; Vercel skapade därefter ett nytt produktionsbygge vid promotion. Produktion `dpl_Eu1E68aRtjKYAaivpDUrAUexe7bw` har status READY och den stabila adressen är fortfarande https://sunspot-private.vercel.app/. Åtkomstskyddet är kvar på `all`. [Ändringar och mätningar](17-map-performance.md).

## Sol nära mig och dagreglage — 2026-09-17

Appkod `7cefe2c` är publicerad på den stabila privata adressen. Produktion `dpl_5Gd5cxSTe8mApgVby4SHYkBG2uGX` har status READY efter skyddad preview `dpl_F1hthnswkmpZMKD1z51eWMkbw72B`. [Beteende och källunderlag](18-nearby-and-trust.md).

53 tester, lint och produktionsbygge passerade. Alla fem browserkontroller (browser, solar, events, map, nearby) passerade lokalt. Nearby-flödet passerade även på Vercel-preview med Chromium-geolocation, uttrycklig användaraktivering, simulerad nekad åtkomst, områdesval, datumbyte, källinformation och liten skärm. Karttestets 45-stegs dragsekvens registrerade 0 långa huvudtrådsuppgifter.

Den stabila produktionsadressen kontrollerades i autentiserad mobilvy: dagreglage 00:00–23:59, worker-rendering, 19 markörer vid testtillfället, tre förslag från Nørrebros områdesmitt, inga sidfel och inget horisontellt överflöde. Oinloggad startsida och väder-API returnerade 302. Projektets skydd för all åtkomst är kvar. Fysisk iPhone, verkliga GPS-mätningar och sittpunkter i fält är fortfarande inte verifierade.

## Bar och Mat utan cirkulärt fokuslager — 2026-09-17

Appkod `4c17c42`, produktion `dpl_H7eiYTojZY2Pq9cPdBffNFiy36Nb`, publicerad på samma privata adress. Kategorifilter och byggnadsskuggor behålls, de cirkulära utsnitten tas bort. Lint, produktionsbygge och befintlig browser-/inbjudningssvit passerade. Autentiserad mobilkontroll på produktionsadressen bekräftade noll cirkellager för både Bar och Mat, byggnadsskuggor kvar, inget horisontellt överflöde och 139 parkmarkeringar i Touchgrass. Inga sidfel; oinloggad åtkomst returnerade 302.

## Svenska, danska och engelska — 2026-09-17

Appkod `5397fcd`, produktion `dpl_3vpoovHxE6FNHUCZpLCT6xZPH7mi`, status READY på den stabila privata adressen. Skyddad preview `dpl_96apJzJSzNK2Jd9QBvcudQuubdtG` verifierades före promotion. Vercel skapade även denna gång ett nytt produktionsbygge.

58 tester, lint och produktionsbygge passerade. Samtliga sex browserkontroller (browser, solar, events, map, nearby, i18n) passerade lokalt; ett första soltest fick timeout vid kartinläsning, omkörningen passerade. Språkprovet passerade även på preview och den stabila produktionsadressen: engelska/danska/svenska, sparat val, bevarad dag/tid/kategori, platskort, områdesval och liten mobilvy. Inga sidfel. Karttestet registrerade 0 långa huvudtrådsuppgifter och identisk skuggbild mellan worker och fallback. Fysisk iPhone är inte verifierad.

Oinloggad startsida och väder-API returnerar fortsatt 302, och projektets skydd är kvar på `all`. Ingen delningslänk eller väninbjudan har skapats. [Guide för språk, tre testare och platskort](19-languages-and-sharing.md).

## Kompakt platskort och direktdelning — 2026-09-20

Appkod `4a62eae`, produktion `dpl_8GYtdSBernogYKifpj56oWpQBbBm`, status READY på den stabila adressen. Skyddad preview `dpl_AEvwaU3jJAaBofh9Pfe7m3pQ9SXb` verifierades före promotion. Den tidigare skapade delningslänken fungerar även efter denna publicering; token lagras inte i repot.

46 tester, lint och produktionsbygge passerade. Browserkontroller för delning, hela appen inklusive lokala inbjudningar, språk och solbevakning passerade. Det lokala inbjudningstestet kördes med localhost för att matcha serverns origin-kontroll; 127.0.0.1 gav korrekt 403. Delningssviten passerade även på skyddad preview. Kortet mäter 284 px i mobiltestet (390 × 844); CTA är åtkomlig även vid 390 × 667. Slutkontroll på produktion via befintlig delningslänk bekräftade kompakt kort, Maps-länk, gömda detaljer, väder-API 200 och inga sidfel. Oinloggad åtkomst utan delningslänk returnerar fortfarande 302. Faktisk iOS-delning återstår att verifiera på fysisk mobil.

[Flöde och begränsningar](20-compact-place-sharing.md). Ändringen ligger också i den öppna pull requesten till `lveggers/sunspot`.

## Spontana häng med publik mottagarsida — 2026-09-20

Appkod `f67b0e4`. Privata kartappen: produktion `dpl_HwSdEURvroKFwv281n4KCp6mXkeF`, READY på samma stabila adress. Validerad preview: `dpl_A2JY6HzmkVDmKCTHpN7hkeATKrPX`. Mottagarsidan har ett separat projekt, `sunspot-hangouts`: produktion `dpl_6fMbueemMkGbzEqfyRQjgPaAaTcx`, READY på https://sunspot-hangouts.vercel.app/. Publika inbjudningar använder `/hang/[id]`; startsidan är endast en liten introduktion. Privata projektets skydd är kvar på `all`, medan mottagarprojektet är publikt och begränsat till mottagarflödet. API:t nekar skapande på mottagardomänen.

Gemensam Upstash Redis har aktiverats efter användarens godkännande av villkoren. Gratisplan, region Frankfurt, automatisk uppgradering avstängd. Nya häng och svar fungerar mellan olika mobiler och försvinner ett dygn efter sluttiden. Värd- och gästbehörigheter ligger i respektive webbläsare, aldrig i delningslänken. Äldre `/invite` använder fortfarande det lokala flödet; använd den nya primära knappen på platskortet för delade häng.

52 tester, lint och produktionsbygge passerade. Mobilflödet verifierades lokalt och mellan den skyddade previewn och en oinloggad webbläsare på den publika domänen: skapa, återhämta tappat serversvar utan dubblett, dela, svara, ladda om, förlänga, återkalla svar och avsluta. Svenska, danska och engelska, 320 px bredd och inga sidfel. Sol- och språkregressionerna passerade efter omstart av lokal server med det aktuella bygget. Fysisk iPhone och bakgrundspush ingår fortfarande inte i verifieringen.

[Arkitektur, användarflöde och begränsningar](21-spontaneous-hangouts.md).

Slutkontroll på den stabila produktionsadressen via befintlig delningslänk passerade samma värd/gäst-flöde mot den publika mottagarsidan, inklusive tappat serversvar och automatisk återhämtning. Den befintliga åtkomstlänken gav 200; privat adress utan åtkomstlänk gav 302. Testhängen avslutades efter kontrollen.

## Profiler med namn och bild — 2026-09-20

Appkod `c54b81c`. Privat produktion `dpl_3RwLiPDqBGwgRB3EW3a9ULS8V8NK` och publik mottagarproduktion `dpl_FudgZbw9YJLgkxUhkcgyS9voBXkb`, båda READY. Den privata previewn `dpl_6eihRBG59KjXX64hjuLSLFzgKBXk` verifierades mot en separat, oinloggad mottagare före promotion. Vercel skapade ett nytt produktionsbygge vid promotion.

Profilknappen finns bredvid kartsökningen och i inbjudans sidhuvud. Namn, bild och favoritaktivitet sparas i den aktuella webbläsaren; språkval och egna häng finns på samma sida. Profilen synkas inte mellan enheter eller mellan den privata och publika domänen. Namn och miniatyrbild följer med nya inbjudningar och svar. Bilder i redan delade inbjudningar ändras inte automatiskt. [Profilflöde och bildhantering](22-profiles.md).

55 tester, lint och produktionsbygge passerade. Mobiltestet passerade lokalt och mot Vercel: uppladdning, felaktig filtyp, lagring efter omladdning, förifyllt namn/aktivitet, värd- och gästbilder, borttagning, tre språk och 320 px bredd. Inga sidfel. Befintliga häng utan profilbild verifierades med `test:hangs`. Publik `/profile` gav 200 och orelaterad publik `/api/weather` gav fortsatt 404. Fysisk iPhone-kamera och bildväljare återstår att verifiera.

Samma profiltest passerade därefter på den stabila produktionsadressen mot den publika mottagardomänen. Direktlänken till profilen med befintlig delningsåtkomst gav 200, och privat profil utan åtkomst gav 302. Testhänget avslutades efter verifieringen.

## Valfri Google-inloggning, 20 september 2026

Appcommit `1df5aa0` lägger till Google-inloggning på profilen och sparar inloggade namn, bilder och aktivitetsval i samma Upstash-databas. Gästflödet är fortsatt kontofritt. Google Cloud-projektet `sunspot-509215`, klienten `SunSpot Web`, är External / In production. Endast `openid email profile` begärs. Servernycklar finns som sensitive-miljövariabler i båda projekten för Production och Preview. [Teknik och begränsningar](23-google-login.md).

- Privat produktion: `dpl_GaJ5vQS2W4vWzYRmYoSt5BJzKzCw`, READY, https://sunspot-private.vercel.app . Vercel-skyddet är kvar.
- Publik mottagarsida: `dpl_8NBjXvVeQEhbUgHMUmUibPdG8C25`, READY, https://sunspot-hangouts.vercel.app . `/profile`, `/privacy`, `/api/account` och Auth.js-rutter är öppna; orelaterad `/api/weather` ger fortsatt 404.
- Validerad förhandsversion: `dpl_9ffakS3PXky82843JciMeTWFmd9U`. Den byggdes före kompletteringen av Preview-nycklarna och visar därför Google-knappen som otillgänglig; produktionen byggdes separat med korrekta produktionsnycklar och den aktiva knappen verifierades där. Nya förhandsversioner får Preview-nycklarna men behöver en registrerad Google-returadress för att slutföra OAuth.

59 enhets-/API-tester passerade, liksom lint och produktionsbygge. Mobiltestet för profiler passerade lokalt och från privat Vercel-förhandsversion till publik mottagarsida: bilder, namn, aktivitet, uppladdningsvalidering, språk och 320 px. Separata lokala sessioner verifierade kontoisolering, lagrad profil och bild på andra enheten, CSRF, OAuth/PKCE-start och utloggning. Produktionskontrollen verifierade Google-knappen, anonym kontostatus, integritetssidan, mobilrendering och bibehållet åtkomstskydd.

Riktig Google-inloggning på den publika adressen nådde kontoval och Googles samtycke för namn, bild och e-post. Ägarens klick på ”Fortsätt” inväntas; Google-callbacken och sparandet efter just det verkliga samtycket är ännu inte verifierade. Inga testcookies eller syntetiska inloggningsvägar finns i produktionen.

## Tydlig navigering och avslut av häng — 20 september 2026

Appcommit `0af2534`. Privat produktion `dpl_YkRiMwKxNdYh5S8UiDHXZqkg2dai` och publik mottagarproduktion `dpl_GqG7344eA32fU6meTJvFY3py8WFt`, båda READY. Förhandsversionen `dpl_GLWgfPUSYH9v6avww9LGSLvhWhKu` verifierades med separat oinloggad mottagare före promotion. Vercel skapade ett nytt produktionsbygge vid promotion.

Profiler och inbjudningar har tydliga tillbaka-länkar. `/hangs` visar nyligen öppnade häng i aktuell webbläsare med aktiva och tidigare häng åtskilda; den publika startsidan visar samma översikt. Avslut är synligt för värden och kräver en bekräftelse som går att avbryta. Integritetssidans språkbyte bevarar returvägen till inbjudan. [Flöde och begränsningar](24-navigation-and-hangouts.md).

60 enhets-/API-tester, lint och produktionsbygge passerade. Mobiltester verifierade profil/bildflödet, återgång till inbjudan, integritetssidans returväg, historik, avbryt/Escape/bekräfta avslut och gästens avslutade vy i tre språk. Förhandsversionens värdflöde mot publik gäst passerade utan sidfel. Publik startsida och profilretur verifierades vid 320 px; publik `/api/weather` gav 404 och privat `/hangs` utan åtkomst gav 302.

Samma utökade värd/gäst-test passerade därefter på den stabila produktionsadressen mot den publika mottagarsidan, utan sidfel. Testhänget avslutades efter kontrollen.
