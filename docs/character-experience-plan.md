# SunSpot — plan for situationsbestemte karakterer

Plan, 28. oktober 2026. Udarbejdet af Fable (`claude-fable-5-1`) i to gennemløb og gennemgået mod projektets kode og kildekrav. Den oprindelige modelbesvarelse er bevaret i chatens artefakter. **J** henviser til [Jurnie-kravene](jurnie-requirements-2026-10-26.md); **U** er de supplerende brugerkrav i samme dokument; **A** er planens anbefalinger. U-numre er rækkefølgen i dokumentets liste.

## Leverancestatus

**Implementeret nu:** de ni godkendte identiteter bruges som transparente udklip i finder, kategorier, stedvisning, tomme tilstande, tilbud, kuponer og invitationer. Mobilvisningen prioriterer kort, rute og invitation; tilbud og kuponer bruger kompakte karakteroversigter. Dansk er standard, og sprogskift DA/EN/SV huskes via en cookie på tværs af sider. Formularværdier, fejl og kuponens udløbstid bevares ved skift.

**Planlagt her, endnu ikke implementeret:** den fulde datastyrede situationsmatrix, sur sky-positur, siddende øl-/cocktailfigurer, nye vejrrekvisitter og de originale humoristiske tekster nedenfor. Eksisterende stående figurer er fortsat i brug. Matrixen er et arbejdsgrundlag til næste redesign, ikke en beskrivelse af færdig funktionalitet. En regel skal samles ved sit eksisterende fælles kaldested; der skal kun indføres nye hjælpefunktioner, hvor en faktisk UI-flade har brug for dem.

## Kontekst

Appen har kort, typerne park/bar/mad, tidspunkt, vejr fra MET Norway med flagene `weather.available` og `weather.stale`, beregnet solhøjde, beregnet bygningssol pr. sted, rutevejledning som åbner en gårute i Google Maps, invitation med svar ja/måske/nej, og Golden Hour-tilbud med `offer.kind` (beer/cocktail) og kupon. Serveren verificerer sol, vejr og åbent efter sin egen regel. Appen har ingen reverse-geocoder, ingen beregning af næste åbningstid og ingen egen rute-ETA. Ni karakterer er godkendt og vises gennem én fælles komponent. Denne plan giver hver figur en fast rolle pr. flade, binder al tekst til datafelter der findes, og bestiller de positurer der mangler. DA/EN/SV med husket valg er implementeret i arbejdstræet. Invitationssiden henter endnu ikke prognose for invitationens tidspunkt; række 19–20 kræver den kobling, før vejrbaseret tekst kan vises.

## 1. Kerneflow og de fem karakterøjeblikke

Flowet følger J7: hvor (nær mig eller valgt område) + hvornår (nu er standard, J5) + typerne park, bar og mad som uafhængige til/fra (J2). Valgte typer lægges sammen. Et sted vises når det matcher mindst én valgt type. Er alle typer slået fra, er udvalget tomt, og appen beder om mindst én type. Udvalget skjuler skygge, usikker sollæg og ubekræftet åbent som standard (J8). Derefter "Kør mig derhen" og "Inviter" (J4). Events er ude (J3). København er eneste by (J6). Skyer og regn vægter over bygningssol (J1).

Karaktererne optræder fem steder. Kortet får ingen figur (J9).

| Prio | Øjeblik | Hvad figuren gør | Krav |
|---|---|---|---|
| 1 | Vejr-hero på forsiden | Viser vejr nu eller for valgt tidspunkt. Sur ved skyer. | U2, J1 |
| 1 | Golden Hour-kort | Siddende figur efter `offer.kind`. | U3, J10 |
| 1 | Tomme tilstande | Ingen match, ingen typer valgt, position nægtet, udenfor København. | J2, J6, J8 |
| 2 | Kupon | Gyldig, udløbet, indløst, eksempel, demo. | U3 |
| 2 | Invitation | Send, svar, aflys. | J4 |

A: Ingen figur i resultatlisten. Den store figur bor i hero og tilbudskort.

## 2. Rollefordeling

Ni godkendte identiteter, ingen nye. Hver får ét fast ansvar.

| Id | Rolle | Hvorfor den passer |
|---|---|---|
| football | Sol bekræftet, invitation med sol i udsigten | Solbriller og grin. Flasken er godkendt udseende og aldrig et tilbud. |
| blue-shirt | Dokumenteret cloud, afvist claim, gråt planlagt tidspunkt | Korslagte arme. Skal kun kigge op. |
| stripes | Regn, planlægning frem i tid | Stofposen kan holdes over hovedet. |
| turtleneck | Nat, ubekræftet åbent, aflysning | Hænder bag ryggen. Rolig og lidt træt. |
| green-jacket | Loading, vejrdata mangler, stale, tidspunkt uden for prognosen | Hånd på hage. Venter og tvivler. |
| curls | Ingen match, ingen typer valgt, position nægtet | Hånd på hofte. Utålmodig. |
| cyclist | Udenfor område, afsted, bygningsskygge på vej | Cyklen er bevægelse. Rollen holder, selv om ruten åbner som gårute. |
| puffer | Golden Hour med `offer.kind=beer` | Har allerede ølglas. |
| blue-coat | Golden Hour med `offer.kind=cocktail`, invitation | Frakke og hoops. Byens aften. |

## 3. Situationsmatrix

"Grundlag" er de data figuren reagerer på. Tekst er dansk. Alt i krøllede parenteser er et datafelt med kilde i tabellen efter matrixen. Prio 1 skal med i første leverance.

| # | Situation | Grundlag | Brugeren vil | Figur, pose, prop | Tekst (DA) | Næste handling | Prio |
|---|---|---|---|---|---|---|---|
| 1 | Opstart | weather eller position = loading | Finde sol nu | green-jacket, hånd på hage, dæmpet | "Vi kigger op. Vent lidt." | Hovedknap deaktiveret | 1 |
| 2 | Sol bekræftet | available, ikke stale, vejrtilstand sun, solhøjde over horisont, ≥1 sted med bygningssol=sun | Finde sol nu | football, sol-lag bag | "Sol over {placeName}. Du scroller stadig. Folk kan se det." | "Find sol nu" | 1 |
| 3 | Overskyet | vejrtilstand cloud, dag | Finde sol nu | blue-shirt, korslagte arme, kigger op, sky-lag | "Overskyet. Himlen har trukket gardinet for og lader som om den ikke er hjemme." | Vælg senere tidspunkt | 1 |
| 4 | Regn | vejrtilstand rain | Finde sol nu | stripes, stofpose over hovedet, regn-lag | "Det regner. Vi viser ingen sol vi ikke har." | Vælg senere tidspunkt | 1 |
| 5 | Nat | beregnet solhøjde under horisont, uanset vejrdata | Finde sol nu | turtleneck, måne-lag, datastatus-linje hvis vejr mangler | "Solen er gået hjem uden at sige farvel. Planlæg i morgen." | Planlæg i morgen | 1 |
| 6 | Vejrdata mangler eller er usikre | `available=false`, tidspunkt uden for prognosens dækning eller frisk prognose med tilstand unknown | Finde sol nu | green-jacket, grå baggrund | "Vi kan ikke bekræfte vejret for det tidspunkt. Vi gætter ikke på himlen." | Prøv igen | 1 |
| 7 | Stale | `stale=true` | Finde sol nu | green-jacket + datastatus-linje | "Vejrdata er gamle. Himlen kan have skiftet mening imens." | Opdater | 1 |
| 8 | Sol i prognosen, intet bekræftet solspot | vejrtilstand sun, alle steder bygningssol shade/unknown | Finde sol nær mig | cyclist, peger ud af kortet | "Sol i udsigten. Intet bekræftet solspot her. Prøv et større område." | Udvid område | 2 |
| 9 | Bygningsskygge på vej | solvarsel: beregnet skygge rammer valgt sted kl. {shadeAt} | Komme afsted | cyclist på cykel | "Husene tager solen kl. {shadeAt}. Gå nu, eller sid i skyggen og kald det et valg." | Kør mig derhen | 2 |
| 10 | Ingen match | 0 steder matcher valgte typer, tidspunkt og sol-/åbent-filtre | Finde et sted | curls, hånd på hofte | "Ingen steder matcher dine valg lige nu. Slå en type mere til, eller flyt tidspunktet." | Slå type til / skift tid | 1 |
| 11 | Ingen typer valgt | 0 aktive typer, udvalg tomt | Vælge | curls, lille | "Ingen typer valgt. Udvalget er tomt indtil du vælger mindst én. Vi gætter ikke på dine vegne." | Vælg mindst én type | 2 |
| 12 | Kun ubekræftet åbent | alle fundne steder uden bekræftet åbent | Finde åbent sted | turtleneck | "Sol i gården. Ingen bekræftet åbningstid. Vi lover ikke en dør der kan være låst." | Vis ubekræftede | 2 |
| 13 | Position nægtet | geolocation denied | Finde sol nær mig | curls, hånd på hofte | "Du sagde nej til at dele position. Helt i orden. Vælg et område. Så lader vi som om, det var planen." | Vælg område | 1 |
| 14 | Udenfor København | position uden for dækning | Finde sol nær mig | cyclist, peger | "Du er uden for København. Vi dækker ikke resten endnu. Vælg et område i byen." | Vælg område i KBH | 1 |
| 15 | Planlagt, sol i udsigt | valgt tidspunkt inden for prognosen, vejrtilstand sun | Planlægge | stripes, stofpose | "{date} {time}: udsigten siger sol. Udsigten har sagt meget gennem årene." | Del invitation | 2 |
| 16 | Planlagt, gråt | valgt tidspunkt inden for prognosen, vejrtilstand cloud/rain | Planlægge | blue-shirt | "{date} {time} er gråt i udsigten. Prøv et andet tidspunkt." | Flyt tidspunkt | 2 |
| 17 | Kør mig derhen | sted valgt, rute åbnes | Komme frem | cyclist, lille i hjørne | "Gåruten åbner i Google Maps. Solen venter ikke. Den har aldrig ventet." | Åbn rute | 2 |
| 18 | Invitation oprettet | serveren har returneret en oprettet invitation med id | Samle venner | blue-coat + stripes, to små udklip | "Send den. Hvis ingen svarer, var det stedet. Helt sikkert stedet." | Del link | 1 |
| 19 | Modtager åbner, sol i udsigt | A: invitation + ny prognosekobling med sun for tidspunktet | Svare | football | Se eksempel 9 | Ja / Måske / Nej | 1 |
| 20 | Modtager åbner, gråt i udsigt | A: invitation + ny prognosekobling med cloud/rain for tidspunktet | Svare | blue-shirt | "Invitationen gælder stadig. Udsigten for {time} gør ikke. Svar alligevel." | Ja / Måske / Nej. A: "foreslå anden tid" senere | 2 |
| 21 | Svar talt op | RSVP-liste | Se hvem der kommer | ét lille udklip pr. ja; måske og nej som tal | "{yesCount} ja. {maybeCount} måske. {noCount} nej. Måskerne bliver stående som måske." | Kør mig derhen | 2 |
| 22 | Aflysning | vært annullerer | Aflyse | turtleneck | "Aflyst. Invitationen er opdateret, og alle ser det næste gang de åbner den." | Ny invitation | 2 |
| 23 | Ingen aktiv Golden Hour | 0 aktive tilbud i udvalget | Se tilbud | ingen figur | "Ingen tilbud lige nu. Solen koster stadig ingenting." | Ingen | 2 |
| 24 | Tilgængelig Golden Hour, øl | `offer.claimable=true`, `kind=beer` | Øltilbud i sol | puffer siddende, øl | Se eksempel 3 | Hent kupon | 1 |
| 25 | Tilgængelig Golden Hour, cocktail | `offer.claimable=true`, `kind=cocktail` | Cocktailtilbud i sol | blue-coat siddende, cocktail | Se eksempel 4 | Hent kupon | 1 |
| 26 | Ny claim verificeres | claim sendt, svar afventer | Hente kupon | samme siddende figur, dæmpet | "En ny kupon kræver serverens tjek af sol, vejr og åbent. Den stoler ikke på nogen af os." | Vent | 1 |
| 27 | Claim afvist | server afviser med grund {reason} | Hente kupon | blue-shirt | "Der blev ikke udstedt en ny kupon: {reason}." | Ret den konkrete årsag / tilbage til udvalg | 1 |
| 28 | Kupon gyldig | ingen `redeemedAt`, og `expiresAt` ligger efter serverforankret nutid | Bruge kupon | siddende figur + kode + nedtælling | "Kode {code}. Gyldig til {expiresAt}. Vis den. Drik den." | Vis til bar | 1 |
| 29 | Kupon udløbet | ingen `redeemedAt`, og `expiresAt` er passeret | Forstå hvad der skete | siddende figur afmættet | Se eksempel 8 | Tilbage til udvalg | 1 |
| 30 | Kupon indløst | `redeemedAt` findes; har prioritet over udløb | Bekræfte | siddende figur | "Indløst {redeemedAt}. Det var det. Skål." | Inviter nogen | 1 |
| 31 | Simuleret eksempel | fast illustreret øleksempel; lokal prøveknap, intet serverclaim | Forstå funktionen | puffer med øl og "EKSEMPEL"-mærke | "Simuleret eksempel. Prøv en ugyldig eksempelkupon. Den virker kun her." | Prøv eksempelkupon | 1 |
| 32 | Lokalt demo-partnerflow | syntetisk partner i udvikling; demologin og samme aktiverings-/claim-flow | Teste flowet | figur efter `offer.kind`, "DEMO"-mærke | "Demo-partner. Knapperne virker mod den lokale testbackend. Kuponen er ikke et rigtigt tilbud." | Log ind og test det lokale flow | 1 |

### Datafelter

| Felt | Kilde | Hvis feltet mangler |
|---|---|---|
| {placeName} | stedets navn i udvalget | sætningen uden navn |
| {date}, {time} | valgt tidspunkt via Intl | – |
| {shadeAt} | beregnet bygningsskygge for valgt sted | række 9 vises ikke |
| {fetchedAt} | tidsstempel på vejrobjektet, kun hvis det findes | række 7 uden tid |
| {partner}, {drinkTitle}, {price} | `offer.placeName`, `offer.title`, `offer.priceDkk`; titlen er partnerens tilbudstekst, ikke et særskilt produktnavnfelt | tilbuddet vises ikke |
| {until} | `offer.activeUntil`, kampagnens sluttid; må ikke fremstilles som solgaranti eller kuponens udløb | tidspunkt udelades |
| {code}, {expiresAt}, {redeemedAt} | `voucher.id`, `voucher.expiresAt`, `voucher.redeemedAt`, formateret i valgt sprog | intet indløsningstidspunkt, hvis `redeemedAt` mangler |
| {reason} | serverens afvisningsgrund, kode mappet i ordbogen | "Serveren sagde nej." uden gæt |
| {yesCount}, {maybeCount}, {noCount} | tre separate optællinger af RSVP-listen | 0 |
| {hostName} | afsendernavn, kun hvis invitationen gemmer det | "Du er inviteret ud i solen" |
| {sunrise} | A: kun hvis solmodulet eksponerer solopgang | række 5 uden tid |

## 4. Regler for valg og prioritet

### 4.1 Fire separate valg (U, A)

Hver flade har sin egen rene funktion med egne input og egen opslagstabel. Ingen fælles nøgle går på tværs.

| Flade | Input | Output |
|---|---|---|
| Weather-hero | loading, `available`, `stale`, vejrtilstand, solhøjde, bygningssol pr. sted, prognosens dækning for valgt tidspunkt | hero-nøgle (#1–9) |
| Tilbudskort | offer aktiv, `offer.kind`, {until}, claim-status, {reason}, eksempel-/demo-mærke | tilbudsnøgle (#23–27, 31–32) |
| Kupon | kuponstatus og serverens tidsstempler | kuponnøgle (#28–30) |
| Invitation | invitationens status, RSVP-liste, vejrtilstand for det inviterede tidspunkt | invitationsnøgle (#18–22) |

Hero ændrer aldrig kuponen eller tilbudskortet. Dekoration findes kun i galleriet, som viser alle ni i fast rækkefølge. Ingen seed, ingen daglig rotation, intet tilfældigt ved render.

### 4.2 Weather-hero: første match vinder

`sun`, `cloud`, `rain` og `unknown` er normaliserede tilstande fra `sunshineWeather(weather, instant).state`, ikke rå MET-symboler. MET leverer bl.a. `clearsky_day` og `partlycloudy_day`; den eksisterende fælles klassifikation genbruges. `available`/`stale` og prognosedækning skal kontrolleres før en positiv solpåstand. Manglende eller usikre data forbliver usikre.

| Rang | Betingelse | Figur | Datastatus-linje |
|---|---|---|---|
| 1 | loading | green-jacket, dæmpet | "Henter vejr" |
| 2 | beregnet solhøjde under horisont | turtleneck | "Vejrdata mangler", kun hvis `available=false` |
| 3 | `available=false` eller tidspunkt uden for prognosen | green-jacket, grå | "Ingen vejrdata" |
| 4 | `stale=true` | green-jacket | "Gamle vejrdata" + {fetchedAt} hvis feltet findes |
| 5 | frisk prognose med tilstand unknown | green-jacket | "Vejret kan ikke bekræftes" |
| 6 | rain | stripes | ingen |
| 7 | cloud | blue-shirt | ingen |
| 8 | sun, 0 steder bygningssol=sun | cyclist | ingen |
| 9 | sun, ≥1 sted bygningssol=sun | football | ingen |

Nat ligger over manglende vejrdata, fordi solhøjden beregnes lokalt og er sikker. Datastatus vises som en nøgtern linje under figuren. Unknown, missing og stale giver aldrig blue-shirt og aldrig football. Bygningssol=unknown tæller aldrig som sol. For et fremtidigt tidspunkt bruges prognosen for netop den time. Uden dækning gælder rang 3. Ingen ny udløbsgrænse indføres. `stale` kommer fra det eksisterende flag.

### 4.3 Tilbudskort

Drikkerekvisitten følger alene `offer.kind`: beer giver puffer med øl, cocktail giver blue-coat med cocktail, anden værdi giver ingen siddende drikkefigur. Serveren accepterer aktuelt kun beer og cocktail. Et aktivt tilbud (`state=active`) er ikke nødvendigvis tilgængeligt: en ny kupon kræver `claimable=true`, som også afhænger af den aktuelle serverkontrol. Kortet viser {partner}, {drinkTitle}, {price} og kampagnens sluttid {until}; `offer.eligibleUntil` er den aktuelt beregnede solgrænse, og `voucher.expiresAt` er kuponens selvstændige udløb. Disse tider må ikke blandes sammen. Ved afvisning vises serverens faktiske grund. Appen gætter ikke på skyer, lukket eller for sent. Et gentaget claim kan returnere den allerede udstedte kupon uden at genstarte tiden; det er ikke et nyt claim. Serverens verifikationsregel ændres ikke af denne plan.

### 4.4 Kupon

Der findes ikke et serverfelt `coupon=valid/expired/redeemed`. Visningsstatus udledes af kuponens tidsstempler: `redeemedAt` giver indløst og har første prioritet; ellers giver passeret `expiresAt` udløbet; ellers gyldig. Nedtællingen bruger serverens `serverNow` plus lokalt monotont forløb, ikke brugerens vægur. Serveren afgør den endelige gyldighed ved indløsning. Ændret hero, sprog, vejr eller kampagne ændrer ikke en eksisterende kupons `expiresAt`. Udløbet og indløst er endelige.

### 4.5 Invitation

Aflysning opdaterer invitationen. Modtageren ser det ved åbning eller opdatering. Der sendes ingen besked. Svar lagres som ja, måske og nej og tælles separat. Teksten må drille et måske. Den må ikke tælle det som nej eller opfinde svar.

### 4.6 Én stor figur pr. skærm og mærkning

Hero er stor. Siddende figur er mellemstor. Invitation bruger små udklip. Kortet får ingen figur (J9). Simuleret eksempel bærer "EKSEMPEL" og bevarer sin lokale prøveknap med ugyldig eksempelkupon; det må ikke kalde et rigtigt claim. Det nuværende eksempel viser fast øl, ikke en cocktailvariant. Lokalt demo-partnerflow bærer "DEMO", bruger demologin og det almindelige lokale aktiverings-/claim-flow og vises kun i udvikling. Det har ingen separat testclaim-knap. De to mærker blandes ikke.

### 4.7 Undtagelser fra nøglekravet

Hver figur i en tilstandsflade har en nøgle. Galleriet og figurer brugt som genkendelige kategorimarkører er undtaget og dokumenteres som dekoration.

## 5. Illustrationsbestilling

Alle varianter er af eksisterende identiteter i den godkendte stil: fladt ujævnt pap/ink, tunge øjenlåg, mellemstore tydelige pupiller, skæve proportioner, ingen nitter, hele fødder, blik mod beskueren (U6).

### Startpakke: 5 positurer, 1 bænk, 4 prop-lag

| # | Variant | Udtryk | Props | Komposition | Placering | Dækker # |
|---|---|---|---|---|---|---|
| S1 | puffer siddende med øl | Tilfreds, lille smil, tunge øjenlåg | Generisk ølglas eller flaske; serverens beer angiver ikke fadøl eller størrelse | Frontal på bænk, fødder synlige, øl ved brystet | Tilbudskort venstre, ca. 40 % af bredden | 24, 26, 28–32 (beer) |
| S2 | blue-coat siddende med cocktail | Kølig, hagen lidt hævet | Generisk cocktailglas; formen må ikke love en bestemt opskrift eller størrelse | Samme bænk, ben krydset, glas løftet lidt | Tilbudskort venstre | 25, 26, 28–30, 32 (cocktail) |
| S3 | blue-shirt sur over skyer | Bryn ned, mund flad, blik op | Sky-lag separat | Stående, korslagte arme bevaret, hoved vinklet | Hero, centreret | 3, 16, 20, 27 |
| S4 | stripes med stofpose over hovedet | Skuldre oppe, øjne halvt lukkede | Stofposen i begge hænder; regn-lag separat | Stående, let foroverbøjet | Hero | 4 |
| S5 | cyclist på cyklen | Fremad, fokuseret, tørklædet flagrer | Eksisterende cykel | 3/4-profil, fødder på pedaler | Hero ved 8 og 9, lille i hjørne ved 14 og 17 | 8, 9, 14, 17 |
| B | Bænk | Ét fælles element | Flad pap | Bred nok til S1 og S2 | Tilbudskort | 24–32 |
| P1–P4 | 3 skyer, regnstriber, sol, måne | Samme ujævne kant | Separate PNG-lag med alfa | Bag figuren | Hero | 2–5 |

Eksisterende stående udklip bruges uændret til green-jacket (1, 6, 7), curls (10, 11, 13), turtleneck (5, 12, 22), football (2, 19), blue-coat og stripes side om side (18) og små udklip i række (21).

### Senere pakke, efter første måling

| # | Variant | Dækker |
|---|---|---|
| L1 | puffer med tomt glas | 29 beer |
| L2 | blue-coat med tomt glas | 29 cocktail |
| L3 | puffer og blue-coat med hævet glas | 30 |
| L4 | football tommel op | 19, 21 |
| L5 | turtleneck med skilt "AFLYST" | 22 |
| L6 | green-jacket skuldertræk | 6 |
| L7 | curls peger på kort | 13, 14 |
| L8 | ny drik | kun hvis serveren får en ny `offer.kind` |

## 6. Sprog DA/EN/SV og tone

### Mekanik (A under U4)

Synlig native vælger med Dansk / English / Svenska i relevante sidehoveder og åbne dialoger. Valget gemmes i en valideret cookie, så første render rammer rigtigt. Den eksisterende fælles ordbog udvides med situationsnøgler; parallel lagring og en ny indstillingsside er ikke nødvendig. Datoer og tider går gennem Intl med da-DK, en-GB og sv-SE. Beløb formateres med Intl som valuta DKK: symbolvisning på dansk, anbefalet kodevisning på engelsk og svensk, med op til to decimaler så partnerens faktiske pris bevares. Rækkefølgen af tal og valuta accepteres som Intl leverer den. Anbefalingen til næste etape er at "DKK" står synligt i EN og SV, så en svensk læser ikke læser SEK. Delingstekster genereres i afsenderens sprog. Modtagerens side følger modtagerens valg. Afsenderens egen besked bevares som skrevet. Nuværende blandede svensk/dansk ryddes i samme ombæring.

### Tone (U5)

Tørt, voksent, let pinligt. Vejret er en modstander med egen vilje. Brugerens selvhøjtidelighed får et lille skub. Figuren siger det man tænker. Fejltilstande giver én udvej i samme åndedrag. Ingen udråbstegn, ingen emoji. Tal og tider kommer fra datafelter. Vitsen står ved siden af og ændrer aldrig tallet. Ingen påstande om glasstørrelse, medmindre partneren har angivet den.

### 10 eksempler

| # | Situation | DA | EN | SV |
|---|---|---|---|---|
| 1 | Overskyet (#3) | Overskyet. Himlen har trukket gardinet for og lader som om den ikke er hjemme. Prøv et senere tidspunkt. | Overcast. The sky has drawn the curtains and is pretending it isn't home. Try a later time. | Mulet. Himlen har dragit för gardinen och låtsas inte vara hemma. Prova en senare tid. |
| 2 | Sol (#2) | Sol over {placeName}. Du scroller stadig. Folk kan se det. | Sun over {placeName}. You're still scrolling. People can see you. | Sol över {placeName}. Du scrollar fortfarande. Folk ser dig. |
| 3 | Golden Hour øl (#24) | {drinkTitle} til {price} hos {partner} indtil {until}. Hun har sat sig for længst og holder ikke en plads. | {drinkTitle} for {price} at {partner} until {until}. She sat down ages ago and isn't saving you a seat. | {drinkTitle} för {price} på {partner} till {until}. Hon satte sig för länge sedan och håller ingen plats. |
| 4 | Golden Hour cocktail (#25) | {drinkTitle} til {price} hos {partner} indtil {until}. Hun kigger ikke op fra glasset, før du står der. | {drinkTitle} for {price} at {partner} until {until}. She won't look up from the glass until you're standing there. | {drinkTitle} för {price} på {partner} till {until}. Hon tittar inte upp från glaset förrän du står där. |
| 5 | Ingen match (#10) | Ingen steder matcher dine valg lige nu. Slå en type mere til, eller flyt tidspunktet. Solen forhandler ikke. | No places match your choices right now. Turn on another type or move the time. The sun doesn't negotiate. | Inga platser matchar dina val just nu. Slå på en typ till eller flytta tiden. Solen förhandlar inte. |
| 6 | Position nægtet (#13) | Du sagde nej til at dele position. Helt i orden. Vælg et område på kortet. Så lader vi som om, det var planen. | You said no to sharing your location. Perfectly fine. Pick an area on the map. We'll pretend that was the plan. | Du sa nej till att dela plats. Helt okej. Välj ett område på kartan. Så låtsas vi att det var planen. |
| 7 | Udenfor område (#14) | Du er uden for København. Vi dækker ikke resten endnu. Vælg et område i byen. | You're outside Copenhagen. We don't cover the rest yet. Pick an area in the city. | Du är utanför Köpenhamn. Vi täcker inte resten ännu. Välj ett område i stan. |
| 8 | Kupon udløbet (#29) | Udløbet {expiresAt}. {drinkTitle} var klar. Du var vigtig et andet sted. | Expired {expiresAt}. The {drinkTitle} was ready. You were important somewhere else. | Gick ut {expiresAt}. {drinkTitle} var klar. Du var viktig någon annanstans. |
| 9 | Invitation (#19) | {hostName} vil have dig ud i solen kl. {time} ved {placeName}. Svar ja, nej eller måske. Et måske tæller som måske, hvor tyndt det end lyder. | {hostName} wants you in the sun at {time} at {placeName}. Reply yes, no or maybe. A maybe counts as a maybe, however thin it sounds. | {hostName} vill ha ut dig i solen kl. {time} vid {placeName}. Svara ja, nej eller kanske. Ett kanske räknas som kanske, hur tunt det än låter. |
| 10 | Aflysning (#22) | Aflyst. Invitationen er opdateret, og alle ser det næste gang de åbner den. Ingen behøver finde på en forkølelse. | Cancelled. The invitation is updated, and everyone sees it next time they open it. Nobody has to invent a cold. | Inställt. Inbjudan är uppdaterad och alla ser det nästa gång de öppnar den. Ingen behöver hitta på en förkylning. |

## 7. Leveringsrækkefølge og acceptkriterier

### Rækkefølge

Sprogskiftet i punkt 3 er allerede bygget; de øvrige trin er næste implementeringsetape.

Ingen deployment, merge eller notifikationer indgår. Push om kommende sol (drøftet, ikke et bekræftet Jurnie-krav) og "foreslå anden tid" på invitation (#20) er senere arbejde og kræver funktioner der ikke findes.

1. Fire valgfunktioner og opslagstabeller med én tabeltest pr. nøgle. Eksisterende udklip bruges midlertidigt.
2. Startpakken bestilles samme dag som punkt 1 starter.
3. Sprogordbog DA/EN/SV for alle nøgler, vælger, lagring, Intl-format og delingstekster. Blandet svensk/dansk fjernes.
4. Hero og tomme tilstande (#1–14) med S3, S4, S5 og prop-lag når de lander.
5. Tilbudskort og kupon (#23–32) med S1 og S2. Det lokale demo-partnerflow og eksemplets separate, ugyldige prøvekupon bevares.
6. Invitation (#18–22).
7. Senere pakke efter første brugertest.

### Acceptkriterier

| Krav | Kriterium | Måling |
|---|---|---|
| J2 | Typer lægges sammen | Test: park og bar aktive, sted med kun park vises. Alle typer fra giver tomt udvalg og tekst #11. Ingen automatisk "alle". |
| U2 | Vejrtilstand cloud giver blue-shirt uanset bygningssol | Test: alle steder bygningssol=sun og vejrtilstand cloud giver blue-shirt. 0 afvigelser. |
| U2, J1 | football kun med alle fire betingelser: available og ikke stale, vejrtilstand sun, solhøjde over horisont, ≥1 sted bygningssol=sun | 4 tests, én pr. manglende betingelse. 0 fejl. |
| Datastatus | Unknown, missing og stale giver aldrig blue-shirt eller football | 3 tests. 0 fejl. |
| Nat | Solhøjde under horisont og `available=false` giver turtleneck og synlig datastatus-linje | 1 test. |
| U3 | `offer.kind` beer giver puffer, cocktail giver blue-coat, andet giver ingen figur | Fixture-test på alle demo- og partnertilbud. 0 afvigelser. |
| Kupon | Kuponkort uændret når hero skifter | Snapshot: samme kupon ved alle hero-tilstande giver identiske kupondata. |
| Afvisning | Afvist claim viser serverens grund | Test: hver kendt grundkode giver sin tekst. Ukendt kode giver "Serveren sagde nej." |
| Determinisme | Rene funktioner, én tabeltest pr. nøgle | 32 tilfælde, ét pr. række. Grep: samme eksplicitte input giver samme valg; aktuel tid leveres som input hvor den behøves. |
| Invitation | Aflysning opdaterer invitationen og sender intet | Test: aflys, modtager genindlæser, ser #22. 0 send-kald. |
| RSVP | Tre tal svarer til listen | Test: 2 ja, 1 måske, 1 nej giver "2 ja. 1 måske. 1 nej." Måske tæller aldrig som nej. |
| Demo | Lokal demo beholder testclaim og demokupon; simuleret eksempel beholder lokal prøveknap uden rigtigt claim | 2 tests, to forskellige mærker. |
| U4 | Sprogvalg overlever reload og gælder alle sider | E2E: vælg SV, reload, alle appens egne labels, fejl og hjælpetekster følger SV på forside, resultater, sted, tilbud, kupon og invitation. Egennavne, brugernes tekst og partnerens produktnavne bevares. Lint: 0 manglende nøgler i tre sprog. |
| U4 | Tider og beløb via Intl | Samme faktiske klokkeslæt i alle tre sprog, med lokal formattering. Beløb via Intl med valuta DKK. EN- og SV-output indeholder "DKK". DA-output indeholder "kr.". Ingen test af tegnrækkefølge. |
| A | Hver figur i tilstandsflade har nøgle | 0 figurer uden nøgle uden for galleri og kategorimarkører. |
| Mobil | Hero, hovedknap og første resultat uden scroll | 360×640, alle 9 hero-tilstande. |
| U6 | Nye varianter består identitetstjekket | `scripts/verify-visual-identity.mjs` grønt på startpakken. |
| J8 | Standard skjuler shade/unknown og ubekræftet åbent | Test: default-filtre giver 0 af dem i udvalget. |
