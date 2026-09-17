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
