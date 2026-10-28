# SunSpot — karakterer og situationer

Opdateret 28. oktober 2026. Den oprindelige situations- og illustrationsplan blev udarbejdet med Fable. Brugerens seneste instruktion erstatter den tidligere humoristiske tekstretning: al apptekst skal nu være kort, neutral og hjælpsom. Karakterernes identiteter og udtryk bevares.

Kildekravene findes i [Jurnie-kravene](jurnie-requirements-2026-10-26.md). Astra har implementeret den første bevægelsesleverance beskrevet i [animationsplanen](character-animation-plan.md).

## Implementeret

- Karakterer vælges ud fra vejr, tidspunkt, søgefiltre, tilbud, kuponer og invitationer.
- Fem transparente PNG-positurer: sur over skyer, stofpose som regnskærm, cykling, siddende med øl og siddende med cocktail. Bænkene indgår i de to siddende kompositioner. Separate native SVG-ikoner viser vejr.
- Det godkendte ni-personers papirark og galleriet er bevaret. Små kategorimarkører er dekoration; en situationsfigur forklarer en konkret tilstand.
- Dansk, engelsk og svensk med husket sprogvalg. Teksten beskriver status, usikkerhed og næste handling uden sarkasme, vittigheder eller kommentarer om brugerens adfærd.
- Kortet har en grå, falmet basis og normale farver omkring bekræftede, åbne solsteder. Farvevinduerne er kortkontekst omkring beregningspunkter, ikke opmålte fysiske solgrænser.

## Tekstregler

Brug almindelige ord og korte sætninger. Beskriv det, data kan bekræfte. Forklar, hvad brugeren kan gøre. Ukendte eller forældede data skal fremgå tydeligt. Undgå personificering af vejret, ironiske overskrifter, salgsjokes og vurderinger af brugerens valg. Figuren må fortsat have et genkendeligt udtryk.

De aktuelle tekster findes i `src/locales/characterExperience.js`, `offerExperience.js` og `invitationExperience.js`, suppleret af de fælles kataloger. Katalogerne er den autoritative tekstkilde; planen kopierer ikke teksterne, så de ikke kommer ud af takt. Alle tre sprog skal have samme betydning og bevare de samme datafelter. Partnerens tilbudstekst, stednavne og brugernes beskeder bevares som skrevet.

## Kerneflow

Område eller nær mig + tidspunkt + uafhængige park/bar/mad-filtre → op til otte udvalgte steder → gårute eller invitation. Typerne kombineres med OR; alle typer slået fra giver et tomt udvalg. Skygge/usikker sol og ikke-bekræftet åbent er skjult som standard. København er første dækningsområde. Den eksterne events-funktion er fjernet.

## Situationer

| # | Situation og grundlag | Figur | Næste handling |
|---|---|---|---|
| 1 | Solmodel, vejr eller position indlæses | Grøn jakke | Vent; søgeknappen er deaktiveret |
| 2 | Frisk solprognose, dagslys og beregnet sol i det valgte udvalg | Fodboldtrøje + sol | Find et solsted |
| 3 | Dokumenteret overskyet prognose | Blå skjorte, skypositur | Vælg andet tidspunkt |
| 4 | Nedbør i prognosen | Striber, stofpose over hovedet | Vælg andet tidspunkt |
| 5 | Solen er under horisonten ved valgt tidspunkt | Rullekrave + måne | Planlæg i morgen |
| 6 | Vejrdata mangler, er udækkede eller har ukendt klassifikation | Grøn jakke | Hent vejret igen |
| 7 | Eksisterende stale-flag er sat | Grøn jakke | Hent en ny prognose |
| 8 | Solprognose, men intet bekræftet solspot i udvalget | Cyklist | Vælg område eller typer |
| 9 | Beregnet bygningsskygge rammer snart valgt sted | Cyklist på cykel | Åbn gåruten; vis faktisk beregnet klokkeslæt |
| 10 | Ingen steder matcher filtre og tidspunkt | Krøller | Tilpas typer, område eller tidspunkt |
| 11 | Ingen typer valgt | Krøller | Vælg mindst én type |
| 12 | Intet match er bekræftet åbent, men åbent-filteret skjuler steder | Rullekrave | Vis alle åbningstider |
| 13 | Adgang til position er afvist | Krøller | Vælg område eller tillad position |
| 14 | Position er uden for dækningen | Cyklist | Vælg område i København |
| 15 | Valgt fremtidigt tidspunkt har frisk solprognose og beregnet sol | Striber + sol | Planlæg en aftale |
| 16 | Valgt tidspunkt har skyer eller nedbør i prognosen | Blå skjorte | Vælg andet tidspunkt |
| 17 | Sted er valgt og rute kan åbnes | Cyklist på cykel | Åbn Google Maps-gårute |
| 18 | Invitation er oprettet og har et server-id | Blå frakke + striber | Del invitationslink |
| 19 | Modtager åbner invitation med frisk solprognose for dens startsAt | Fodboldtrøje + sol | Svar ja, måske eller nej |
| 20 | Invitationens tidspunkt har skyer eller nedbør i prognosen | Blå skjorte | Svar på invitation |
| 21 | Svar er gemt eller vært har modtaget svar | Blå frakke; små ja-markører | Se tre separate svartal eller åbn rute |
| 22 | Vært har aflyst | Rullekrave | Planlæg ny aftale |
| 23 | Ingen aktuelle tilbud | Ingen drikkefigur | Tilbage til steder |
| 24 | Claimable øltilbud | Rød puffer siddende med øl | Hent kupon |
| 25 | Claimable cocktailtilbud | Blå frakke siddende med cocktail | Hent kupon |
| 26 | Claim afventer svar | Samme drikkefigur, dæmpet | Vent på kontrol |
| 27 | Claim er afvist | Blå skjorte uden påstået vejr | Vis lokaliseret faktisk grund |
| 28 | Kupon er gyldig efter serverforankret tid | Siddende figur efter kind | Vis kode og nedtælling til personalet |
| 29 | expiresAt er passeret, uden redeemedAt | Siddende figur, dæmpet | Se udløbstid eller gå til steder |
| 30 | redeemedAt findes | Siddende figur | Vis indløsningstid |
| 31 | Simuleret øleksempel | Rød puffer + tydelig eksempelmærkning | Prøv lokal ugyldig eksempelkupon |
| 32 | Lokalt syntetisk partnerflow i udvikling | Figur efter kind + tydelig testmærkning | Test login, aktivering, claim og indløsning lokalt |

## Valg og datagrænser

Hver flade har et selvstændigt, deterministisk valg. `selectWeatherMoment` og `selectEmptyMoment` vælger finderens tilstand. `selectOfferMoment`, `selectVoucherMoment` og `selectExampleMoment` håndterer tilbud. `selectInvitationMoment` vælger invitationens tilstand. En ændring i heroens vejr ændrer aldrig en eksisterende kupon.

Vejrprioritet: indlæsning → nat → manglende prognose/dækning → stale → unknown → nedbør → skyer → sol uden solsted → sol med solsted. Ved planlagte tidspunkter har sol og gråt vejr særskilte tekster. Nat kan beregnes lokalt; manglende vejrdata oplyses stadig. `sun`, `cloud`, `rain` og `unknown` kommer fra `sunshineWeather(weather, instant).state`, ikke rå MET-symboler. Ingen ny vilkårlig udløbsgrænse er indført.

Kortfarver kræver `weatherState=sun`, dagslys, færdig beregning, `eligible=true`, `state=sun` og `opening.state=open`. Manglende, forældet eller usikkert vejr giver ingen farve. Det samme gælder skyer, regn og nat. Solmodellen og muligheden for at vælge et siddepunkt er bevaret; det gamle shadow-overlay er fjernet fra visningen.

Drikkefiguren følger kun `offer.kind`: beer giver puffer, cocktail giver blå frakke, ukendt type giver ingen drikkefigur. Et aktivt tilbud er ikke nødvendigvis claimable. Serveren afgør sol, vejr, åbent, aktivering og claim. `offer.activeUntil` er kampagnens sluttid; `offer.eligibleUntil` er den beregnede solgrænse; `voucher.expiresAt` er kuponens selvstændige udløb. De må ikke blandes sammen. Glasformen lover ikke en bestemt størrelse eller opskrift.

Kuponstatus: `redeemedAt` har prioritet, derefter passeret `expiresAt`, ellers gyldig. Nedtællingen bruger eksisterende serverNow og monotont lokalt forløb. Gentaget claim kan returnere samme kupon uden ny udløbstid. Sprog, vejr, animation og kampagnestatus må ikke forlænge tiden. Serveren afgør endelig gyldighed ved indløsning.

Invitationens vejr bindes til dens faktiske startsAt. Aflysning opdaterer invitationen, men sender ingen besked til modtagerne. Ja, måske og nej tælles separat. UI viser højst ni dekorative ja-figurer og et præcist resterende antal; de tre svartal er altid fulde. Personlige beskeder oversættes ikke.

Sprogvalget gemmes i en valideret cookie. Datoer og beløb bruger Intl; København-tid og maskinværdier bevares. EN/SV viser DKK, og priser bevarer op til to decimaler. Formularværdier, fejl, valg og kuponur overlever sprogskift uden nye mutationer.

## Kontrol og senere arbejde

Eksisterende native tests og browserforløb kontrollerer datagrænser, alpha/crops, ni-personers galleri, mobile primærhandlinger, kortzoom og farvefokus, kuponur, invitation/RSVP/aflysning og de tre sprog. Tekstændringer skal også kontrolleres for mobiloverløb.

Korte primærscene-animationer og bekræftede kvitteringer er implementeret med Astra; ingen kontinuerlige idleloops er tilføjet. Senere illustrationsvarianter (tomme glas, skålende positurer, tommel op, aflysningsskilt og ekstra pege-/skuldertræk) kræver fortsat en konkret bestilling. Flere byer, nye drikketyper, push om kommende sol og forslag til alternativ invitationstid er ikke del af den aktuelle app.
