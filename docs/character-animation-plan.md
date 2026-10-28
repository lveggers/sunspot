# SunSpot — animationsplan

Udarbejdet med Astra (`gpt-6-astra`), 28. oktober 2026. **Den anbefalede første leverance er implementeret med Astra.** Karakteridentiteterne og papir-/blækstilen bevares. Bevægelse skal gøre tilstandsskift lettere at se. Tekst er neutral og konkret; figurerne skal ikke irettesætte brugeren eller spille komiske reaktioner.

## Implementeret første leverance

Den primære karakterscene har korte indgange og tilstandsskift, en begrænset loadingbevægelse og diskret kvittering efter bekræftet claim/RSVP. Implementeringen bruger eksisterende PNG'er, vejrikoner, CSS-layout og native Web Animations API. Kortets farveskift er fortsat øjeblikkelige. Der er ingen ny dependency eller illustrationsbestilling.

Alle scener skal ende i ro senest 3,6 sekunder efter start. CTA, fejl, datastatus, kuponkode og timer er synlige og opdateres med det samme. Animation er aldrig en betingelse for at fortsætte. Ingen nye obligatoriske godkendelsestrin indgår.

## Integrationsregler i den færdige kode

- `CharacterScene` er statisk som standard. Kun primære flader får `animate`; lister, kategorier og deltagerudklip bevarer ro. Invitationsparret bruger én fælles wrapper.
- En kort indlæsningssekvens genbruger samme native animationshandle gennem Reacts udviklingsprobe. Faktiske inputs ændrer eller afbryder bevægelsen; skjult dokument, reduceret bevægelse, offscreen og overliggende dialog stopper den uden genstart ved retur.
- Nye claims kvitterer kun ved HTTP 201. HTTP 200 betyder en allerede eksisterende kupon og giver ingen ny succes. GET-genåbning etablerer kun baseline; en senere observeret redeemedAt-overgang på samme id kan kvitteres én gang.
- Kuponuret resyncer sit monotone anker ved nye serverNow-data uden at remounte scene eller kodefelt. Kuponens id er den stabile nøgle; koden bevarer fokus og markering under polling.
- RSVP-kvittering kræver både accepteret POST og vellykket genhentning. Ny invitation bruger en engangsmarkør i sessionStorage til den aktuelle navigation; markøren er ude af URL, delingslink og permanent host-storage. Blokeret lager springer kun den dekorative indgang over.
- Neutral tekst, sol-/vejrgates, serverens kuponregler og kortets øjeblikkelige farvefokus er bevaret.

## Faktisk grundlag og grænser

- `Character.jsx` viser enten et udsnit af det fælles karakterark eller en pose fra `characterPoses.js`. Arkets indre `img` har allerede `transform` og `clip-path` til beskæring. Animér den ydre `.cast-character` eller en dedikeret omsluttende node; overskriv aldrig billedets transform.
- De fem poser er flade PNG'er: `beer-seated`, `cocktail-seated`, `cloud-angry`, `rain-bag` og `cycling`. Bænken er tegnet ind i de siddende poser. En bevægelse af dem flytter både person, glas og bænk.
- `CharacterScene.jsx` har ét separat Lucide-vejrikon. Hele sol-, sky-, regn- eller måneikonet kan flyttes med CSS. `CloudRain` er ét samlet SVG i den nuværende komponent; regndråberne skal ikke antages at være uafhængige lag.
- Vejr-, tilbuds-, kupon- og invitationsvalg kommer fra `characterExperience.js`, `offerExperience.js` og `invitationExperience.js`. Behold dem som autoritet. Animation må ikke træffe et andet valg eller udlede tilstand af den oversatte tekst.
- Den gamle `golden-bob` i `styles.css` er allerede slået fra af `identity.css`. Genaktivér ikke den uendelige bevægelse. Den eksisterende globale `prefers-reduced-motion`-regel bevares.

Med disse aktiver kan vi lave indgange, dæmpning, korte forskydninger og bevægelse af separate vejrikoner. Vi kan **ikke** lave blink, blikretning, hoveddrejning, skuldre, armbevægelser, skål, slurk, pedaltråd eller roterende hjul uden at flytte resten af rasterbilledet. Maskering af et anslået kropsområde er ikke en erstatning for rigtige segmenter.

## Fælles bevægelsesregler

Alle afstande herunder er CSS-pixels ved den faktisk viste størrelse. `ud` betyder `cubic-bezier(0.22, 1, 0.36, 1)`, `rolig` betyder `cubic-bezier(0.45, 0, 0.55, 1)`. Opacitetsskift bruger `linear`. Ingen bounce, elastik, overshoot, zoom af hele skærmen eller bevægelse af tekst.

**Indgang:** figurens ydre node fra `translateY(4px)` og opacity `0.75` til `translateY(0)` og opacity `1`, 220 ms, `ud`, én gennemløbning, ingen forsinkelse. Vejrikonet er straks det korrekte ikon. Denne bevægelse bruges kun på den primære scene, ikke også på en samtidig tomtilstandsfigur eller hver figur i en resultatliste.

**Tilstandsskift:** montér den nye korrekte figur i samme reserverede plads og fjern den gamle straks. Den nye figur går kun fra opacity `0.75` til `1` på 160 ms, én gang. Ingen udgående figur bliver hængende over den nye tilstand. Ved skift fra bekræftet sol til loading, cloud, rain, night, missing, unknown eller stale fjernes solikonet og alle positive soleffekter i samme opdatering som tilstanden; der er ingen udtoning af det gamle solsignal.

**Retning og input:** førstegangsindgang kommer 4 px nedefra; senere skift er rene opacity-skift uden retningsbevægelse. Senere/tidligere tidspunkt, tastaturvalg, touch og filterændringer får samme behandling. Figurer spejlvendes ikke efter kortets panoreringsretning eller brugerens bevægelse. Cyklistens tegnede retning bevares. Ingen parallax, cursor-follow eller hoveranimation er nødvendig på touch eller desktop.

**Identitet og afbrydelse:** hold DOM-noder stabile; `language`, oversættelser, nedtællingens sekunder, `serverNow` og objektidentitet er aldrig animationsnøgler. Sammenlign de primitive værdier `moment.id`, `moment.character`, `moment.pose` og `moment.weather` på den enkelte flade. Ved samme værdier sker intet, også efter polling eller sprogskift. En faktisk ændring af `moment.weather` tæller med: `planned.grey` kan skifte mellem regn og sky uden nyt id. Ny tilstand afbryder aktiv bevægelse og sætter korrekt slutposition straks, før den tilladte nye bevægelse starter; ingen kø af animationer.

På et nyåbnet tilbud må en indgang ske én gang pr. åbning, men genhentning af samme tilbud gør intet. Kvitteringer kræver en afsluttet brugerhandling i den nuværende visning; åbning af en allerede gyldig kupon eller et allerede afgivet RSVP må ikke afspille en ny succes. Lad ikke en animation på mount stå for denne skelnen.

## Bevægelse pr. situation

Tabellen angiver samlet sekvens pr. hændelse. Når en særskilt bevægelse er angivet, erstatter den den generelle indgang; den lægges ikke oveni. Alle loops er endelige og slutter i slutpositionen uden transform.

| Situation og trigger | Figur og konkret bevægelse | Varighed, easing, amplitude, antal | Efter sekvensen |
|---|---|---|---|
| `weather.loading`, ved indtræden i en ny indlæsningsperiode | Grøn jakke står stille; kun dens opacity pulserer `1 → 0.72 → 1`. Data og loadingtekst vises straks. | 1.200 ms pr. loop, `rolig`, 0 px/0°, 3 loops, samlet 3.600 ms. Afbryd straks ved svar. | Stille ved opacity 1, også hvis request stadig afventer. Loadingtekst forbliver synlig. |
| `weather.sun`, frisk sol bekræftet af eksisterende selector | Football får generel indgang. Solikonet står stille. | 220 ms, `ud`, +4 → 0 px, 1 gang. | Stille; ingen gentagelse ved poll. |
| `planned.sun` | Striber med solikon; samme indgang. Teksten angiver prognose for valgt tidspunkt. | 220 ms, `ud`, +4 → 0 px, 1 gang. | Ingen garanti om sol på ankomsttidspunktet. |
| `weather.cloud` eller `planned.grey` med cloud | Blå skjorte står stille; det eksisterende skyikon glider `translateX(3px) → 0`. Ikonets eksisterende `rotate(-8deg)` bevares. | 360 ms, `ud`, 3 px, 1 gang. | Stille; ingen vred rysten eller falsk øjenbevægelse. |
| `weather.rain` eller `planned.grey` med rain | Regnpose/Striber henholdsvis den eksisterende blå skjorte; hele regnikonet går `translateY(-2px) → 0`. | 320 ms, `ud`, 2 px, 1 gang. | Ingen gentagelse eller påstået separat faldende regn. |
| `weather.night` | Rullekrave og måne; kun månens opacity `0.65 → 1`. | 300 ms, `linear`, 0 px/0°, 1 gang. | Stille; datastatus ved manglende vejr bevares. |
| `weather.missing`, `weather.unknown`, `weather.stale` | Grøn jakke uden vejrikon. Kun fælles tilstandsskift. | 160 ms, `linear`, 0 px/0°, 1 gang. | Stille. Ingen loadingloop før brugeren faktisk genstarter hentning. |
| `weather.no-spot` | Cyklisten og prognosens solikon får kun fælles tilstandsskift. | 160 ms, `linear`, 0 px/0°, 1 gang. | Ingen solfejring eller farve på kortet. Teksten skelner prognose fra bekræftet sted. |
| Tomt udvalg, ingen typer, position nægtet, udenfor dækning, ubekræftet åbent | Eksisterende valgte figur; fælles tilstandsskift. | 160 ms, `linear`, 0 px/0°, 1 gang. | Ingen anklagende reaktion. Handlingen er umiddelbart tilgængelig. |
| Golden Hour `offer.beer` / `offer.cocktail` | Puffer med øl eller blå frakke med cocktail, inklusive indtegnet bænk. Kun opacity `0.75 → 1` på primært tilbudsdetaljekort. | 220 ms, `linear`, 0 px/0°, 1 gang. | Stille. Listekort, små markører og discoveryknap animeres ikke. |
| `offer.checking`, ved nyt claim-request | Behold samme siddende pose og eksisterende dæmpning på 0.55. Ingen figurloop; knaptekst beskriver ventetiden. | Øjeblikkeligt, 0 ms, 0 loops. | Serverens busytilstand styrer knappen, ikke animationen. |
| Claim lykkes med ny kupon i det aktuelle flow | Kupondata og kode vises straks. Kun figurens opacity `0.75 → 1`. Ingen bevægelse af kort, kode eller timer. | 220 ms, `linear`, 0 px/0°, 1 gang. | Gentaget claim med samme kupon-id er ikke ny succes. |
| `offer.rejected` | Blå skjorte skifter ind med fælles tilstandsskift; serverens grund står straks som fejl. | 160 ms, `linear`, 0 px/0°, 1 gang. | Ingen shake, ingen forsinket retry. Netværksfejl opfinder ikke en afvisningsgrund. |
| `voucher.valid`, åbnet fra gemt link | Kode, status, tid og figur vises direkte. | 0 ms, 0 loops. | Ingen animeret nedtælling eller gentagne glimt. |
| `voucher.expired`, ved passeret udløb | Eksisterende afmætning og opacity 0.7 sættes straks. | 0 ms, 0 loops. | Ingen tømning af glas. Ny tekst/status kommer uden ventetid. |
| `voucher.redeemed`, efter serverbekræftet indløsning observeret i aktiv visning | Status opdateres straks; figurens opacity `0.75 → 1` én gang. | 220 ms, `linear`, 0 px/0°, 1 gang. | Ingen skål med glas, som ikke kan bevæges separat. |
| Invitation oprettet i det aktuelle flow | Blå frakke og Striber får én fælles indgang som gruppe, samtidig. | 220 ms, `ud`, +4 → 0 px, 1 gang; ingen forskydning mellem figurer. | Del link er klar med det samme. Ved genåbning står gruppen stille. |
| Invitationens `invite-sun`, `invite-grey`, `invite-unknown` | Fælles tilstandsskift ved faktisk ændring; ingen særskilt succes. | 160 ms, `linear`, 0 px/0°, 1 gang. | Brug invitationens faktiske tidspunkt og eksisterende vejrvalg. |
| RSVP, først efter serverens svar og genhentning af invitation | Kun hovedfiguren får opacity `0.75 → 1`. Radiofigurernes valgte tilstand ændres straks uden animation. | 180 ms, `linear`, 0 px/0°, 1 gang pr. bekræftet indsendelse. | Ja/måske/nej tælles separat. Deltagerudklip i rækken står stille, også ved polling. |
| `invite-cancelled` | Rullekrave og aflyst status vises straks; stop aktive invitationseffekter. | 0 ms, 0 loops. | Ingen udgangsparade eller antydning af sendte beskeder. |

`offer.none`, `offer.unavailable` og ukendt drikketype får fortsat ingen drikkefigur. EKSEMPEL og DEMO bevarer deres synlige mærker og adskilte dataflows. Eksemplet kan bruge samme endelige opacity-skift ved lokal prøvehandling, men må ikke ligne en serverbekræftet kupon.

## Kortets farvefokus

Første leverance beholder det eksisterende øjeblikkelige farveskift. `sunFocusPoints()` afgør fortsat, hvilke steder der må få farve: ingen pendingberegning, vejrtilstand sun, dagslys, bekræftet bygningssol, eligibility og bekræftet åbent. Friskhed og prognosedækning kommer gennem det eksisterende vejrflow; animation må ikke omgå det.

Ved tab af en betingelse skjules farvelaget straks, inklusive midt i en eventuel senere indtoning. Ved ændret udvalg opdateres masken straks, så tidligere steder ikke fortsat er farvede. Radius på 54 px ændres ikke; den viser kontekst omkring et sted og er ikke en fysisk solgrænse. Ingen voksende cirkler, pulserende solpletter eller flydende masker. Pan/zoom styres af Leaflet; `zoomstart` skjuler laget, og det eksisterende updateflow placerer masken korrekt igen. Ingen ekstra animation ved pan, zoom, resize eller sprogskift.

**Mulig lille opfølgning:** først når den statiske første leverance er målt, kan selve farvelagets opacity gå `0 → 1` over 180 ms, `linear`, én gang, kun ved en reel overgang fra nul til mindst ét bekræftet solsted. Læg den korrekte maske på før indtoningen. Bortfald er stadig 0 ms. Ingen animation af `filter`, tileposition eller `clip-path`. Dette er ikke del af den anbefalede første leverance.

## Idle, tilgængelighed og drift

- Ingen almindelige idleloops. Loading har højst tre loops; øvrige bevægelser afspilles én gang. Ingen tilfældige intervaller eller animationstimers. En scene, der er færdig, genstarter ikke, fordi brugeren scroller væk og tilbage.
- Begræns specialbevægelse til hero eller den aktive dialog-/detaljeflade. Brug eksisterende synligheds-/dialogstate; brug kun `IntersectionObserver`, hvor en primær scene faktisk kan være monteret uden for viewport. Når den bliver skjult, færdiggøres/annulleres bevægelsen og forbliver færdig ved retur. Sæt også sluttilstand ved skjult dokument. Datapolling og kuponur må ikke bindes til denne dekorative pause.
- `prefers-reduced-motion: reduce` giver alle sluttilstande straks: ingen animation, transform eller opacitypuls. Bevar faktisk datadæmpning som offer.checking og afmætning som voucher.expired. Respektér ændring af OS-indstillingen midt i en animation. Den eksisterende globale CSS-regel suppleres kun hvor nødvendigt; native animationer skal også annulleres.
- Dekorative scener forbliver `aria-hidden` og `pointer-events: none`. Fokus flyttes ikke af animation. Eksisterende fokus på tid/område efter en brugerhandling og fokusstyring i dialoger bevares. Hvis en formular erstattes af en kvittering, håndteres fokus af flowet straks og ikke af `animationend`.
- Loading/status/fejl kommunikeres i tekst gennem de eksisterende status- og alertfelter. Ingen live-announcement af hvert loop eller hvert sekund på kuponuret. Ja, måske og nej skal være lige lette at vælge; ingen ekstra lokkende effekt på ja.
- Kuponens `VoucherClock` bevarer sit serverforankrede, monotone tidsgrundlag. Animationsstate placeres uden for urinitialisering; tilføj aldrig moment, sprog eller animationsnøgle til `VoucherClock`-key. Udløb/redeemed opdateres før visuel kvittering. Ingen ekstra gyldighed fra animation, tabskift, vejr eller sprog.
- På mobil bruges de samme eller mindre afstande, aldrig større. Reserver eksisterende billedformat og bredde; ingen animation af højde, margin, grid, fontstørrelse eller tekst. Ingen layoutændring og ingen overlap med CTA på 360×640.
- Animér kun `transform`/`opacity`; den eksisterende statiske kuponafmætning animeres ikke. Ingen nye store billedkopier, canvas, Lottie, GSAP eller Framer Motion. Ingen permanent `will-change`, ingen React-state pr. frame og ingen requestAnimationFrame-løkke til dekoration. Ryd animationshandles og event listeners op ved unmount.

## Senere illustrationer, hvis bevægelsen skal være mere udtryksfuld

Bestil kun de segmenter, der svarer til en konkret valgt bevægelse. De er ikke nødvendige for første leverance.

| Ønsket bevægelse | Nødvendigt nyt materiale | Krav til tegningen |
|---|---|---|
| Løfte øl/cocktail | Separat bænk, torso, over-/underarm, hånd og glas, eller to færdige alternative positurer | Samme identitet og proportioner. Skjulte flader bag armen tegnes; glas og hånd har korrekt overlap. |
| Blink eller ændret blik | Separat hoved/ansigt samt tegnede øjen- eller blinkvarianter | Ingen strækning af rasterøjne. Brugeren ser de samme tunge øjenlåg og ansigtsform. |
| Pedaltråd og hjul | Hjul adskilt fra stel, krank og separate ben med tegnede overlap | Kroppen og cyklen må ikke dreje samlet. Ingen antydning af at appens gårute er en cykelrute. |
| Posens bevægelse i regn | Pose, arme og relevant torso separat, alternativt tegnet posevariant | Ingen kunstig deformation af det eksisterende udklip. |
| Faldende regn bag personen | Separat sky og få tegnede/SVG-regnstreger i den eksisterende stil | Kan udføres som nye native SVG-lag uden ny rasterillustration; stadig endelig sekvens og reduced-motion. |

## Implementering og testbare acceptkriterier

Hold ændringen i `CharacterScene.jsx` og de tilhørende CSS-filer, med små eksplicitte signaler fra `App.jsx`, `GoldenHour.jsx` og `Invite.jsx`, hvor en bekræftet brugerhandling skal skelnes fra genåbning. Tilføj ikke en generisk animationsmotor. Galleriet, kategorimarkørerne, kortet og RSVP-rækken er statiske. Læs de relevante lokalt installerede Next-guides før implementering, som repoets `AGENTS.md` kræver.

De eksisterende selector-tests suppleres af `tests/character-motion.test.js`. `scripts/verify-character-experience.mjs` kontrollerer reduced motion og kalder `verify-character-motion.mjs` for normal bevægelse, native handles, timing, afbrydelse og flowkvitteringer. Verifikationen køres i projektets Docker-stack med syntetiske data.

| Kontrol | Bestået når |
|---|---|
| Alle vejrsituationer | Loading, sun, cloud, rain, night, missing, stale, unknown, no-spot, planned.sun og begge planned.grey-varianter viser selectorens korrekte figur/ikon før animation afsluttes. |
| Sol → usikker tilstand | Første render med cloud/rain/stale/missing/unknown/pending/nat har intet gammelt positivt solsignal og ingen aktiv farvemaske på kortet. Ingen udtoningshale. |
| Stabilitet | Sprog DA → EN → SV, samme-state polling og fem nedtællingsticks starter ingen nye animationer; scenens DOM-node og kuponens udløb er stabile. |
| Afbrydelse | Hurtige skift sun → cloud → rain under 160 ms ender kun med rain; ingen kø, gammel figur eller tilbagevendende sol. |
| Varighed og idle | Normal-motion-tests måler angivne keyframes/iterationer; efter 3.700 ms findes ingen kørende dekorativ animation i scenen. Ved tidligt svar stopper loading straks. |
| Tilbud | Beer/cocktail beholder korrekt figur; bænk og glas bevæges ikke separat. Unknown kind giver ingen figur. CTA kan bruges under indgang; busy følger requestens faktiske levetid. |
| Kupon | Samme kupon-id ved gentaget claim giver ingen ny succes. Udløb og redeemed vises korrekt under animation, sprogskift og tabretur; `redeemedAt` vinder over udløb. Ingen animation ændrer `expiresAt` eller urforankringen. |
| Invitation | RSVP-anmodning alene ændrer ingen optælling eller viser succes. Bekræftet svar giver højst én kvittering; 2 ja/1 måske/1 nej bliver ved med at være tre separate tal. Aflysning stopper scenens effekter straks. |
| Reduced motion | Test både fra start og ved ændring under loading: ingen dekorative bevægelser, alle tekster/handlinger synlige og korrekt statusdæmpning bevaret. |
| Fokus og mobil | Tastaturfokus, fokusindikator og tabrækkefølge er stabile. På 360×640 og 390×844 er hovedhandlingen synlig og klikbar fra første frame; ingen vandret overflow eller layoutskift fra figuren. |
| Kort og performance | Pan/zoom/resize forbliver responsivt og følger Leaflets eksisterende bevægelser. Performanceoptagelse på mobilprofil viser ingen layoutarbejde forårsaget af animation og ingen nye kontinuerlige frame-loops. Gentagen åbning/lukning efterlader ikke aktive animationer eller listeners. |

Leveringen er færdig, når de relevante eksisterende tests og de målrettede browserchecks består. Der kræves ingen udvidet illustrationspakke for at levere denne første version.
