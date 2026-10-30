# Sol nära mig, dagreglage och platsunderlag

2026-09-17. Tre förbättringar efter den privata mobilversionen.

## Start och tid

Appen startar på dagens klockslag i Europe/Copenhagen och följer klockan. En tydlig Nu-knapp återgår omedelbart till aktuellt klockslag och förnyar dagarna vid midnatt. Välj dag med de sju dagknapparna. Reglaget omfattar endast vald dag, 00:00–23:59, med minutprecision. Att dra reglaget eller välja en annan dag stänger av klockföljningen. Event fortsätter följa sina faktiska start- och sluttider.

## Sol nära mig

En knapp på kartan öppnar en dialog med högst tre förslag. Platsbegäran görs först efter tryck på ”Använd min position & tid nu”. Positionen används enbart i webbläsarens minne; den sparas inte och skickas inte till SunSpots API. Positioner med mer än 500 meters osäkerhet eller utanför byggnadsmodellens kartområde avvisas med möjlighet att välja Nørrebro eller Indre By manuellt. Områdesval räknar från uttryckligt märkt områdesmitt, inte från en påstådd användarposition, och behåller vald planeringstid.

Förslagen respekterar kategori, sökning och öppetfilter. De ligger inom 1,5 km fågelvägen och måste ha modellerad byggnadssol vid ankomst och under hela det valda besöket (30, 60 eller 90 minuter). Gångtid är fågelavstånd × 1,3 vid 75 meter/minut, inte en kontrollerad gångväg. Parkers femminutersprov inkluderar intervallet före beräknad ankomst; okänd täckning får aldrig bli utlovad sol. Stängda platser och platser som stänger innan besöket är slut tas bort. Kända öppettider prioriteras före okända, sedan kortare gångtid. Inga resultat ersätts med påhittade platser.

Moln och temperatur visas som prognos, skilda från beräknad byggnadssol. En solig provpunkt garanterar inte molnfritt väder, lediga bord, uteöppet eller skuggfrihet från träd/parasoller.

## Nørrebro: 20 poster med tydligt underlag

`src/venueEvidence.js` håller granskningen separat från den reproducerbara OSM-importen. **Detta är en genomgång av 20 befintliga platsers underlag, inte 20 fältverifierade uteserveringar.** En av dem, Too Old To Die Young, beskriver uttryckligen utomhussittplatser på sin egen sida. Övriga uteserveringar är bara OSM-uppgifter, eller okända (BRUS). Alla sittpunkter är fortfarande uppskattade eller valda av användaren; inga koordinater har fältverifierats.

Ordinarie tider från sju officiella källor används i platskort, solurval och rekommendationer. De är daterade 2026-09-17, inte en liveintegration. Efter 90 dagar behandlas dessa granskade tider som okända tills de granskas igen; vi återgår inte automatiskt till den äldre, ibland motstridiga OSM-uppgiften. Tider före granskningsdatum använder det tidigare OSM-underlaget. Högtidsundantag och tillfälliga ändringar kan saknas. För barer med kök gäller barens tider.

| Plats | Kontroll / ändring | Källa |
| --- | --- | --- |
| BRUS | Ordinarie bartider tillagda; sittplats ej bekräftad | [BRUS kontakt](https://tapperietbrus.dk/contact/) |
| Ølbaren | Tider stämmer; besöksadress Elmegade 2, annan postadress | [Ølbaren](https://oelbaren.dk/) |
| Juma | Ordinarie kvällstider tillagda | [Juma](https://restaurantjuma.dk/) |
| Café Stefanshus | Korrigerade tider från stället | [Stefanshus](https://cafestefanshus.dk/) |
| Cafe Runddelen | OSM; uteservering ej oberoende bekräftad | [OSM](https://www.openstreetmap.org/node/1118919064) |
| Kung Fu II | Webbkälla oläsbar; öppet slut i OSM är okänt | [OSM](https://www.openstreetmap.org/node/1775489880) |
| Bindia Elmegade | Rätt filial och tider kontrollerade | [Bindia](https://www.bindia.dk/) |
| Mikkeller & Friends | Adress bekräftad; uteservering bara OSM | [Mikkeller](https://www.mikkeller.com/locations/mikkeller-and-friends) |
| Klør Dame | OSM; ej oberoende bekräftad | [OSM](https://www.openstreetmap.org/node/3656367927) |
| Bæst | Helglunch och kvällstider rättade | [Bæst](https://www.baest.dk/) |
| Escobar | Webbkällan svarade inte; OSM kvar | [OSM](https://www.openstreetmap.org/node/5786719592) |
| Manifesto Pizza | Webbplats saknar läsbart underlag om uteservering | [Manifesto](https://mf-pizza.dk/) |
| Skovbar | OSM; ej oberoende bekräftad | [OSM](https://www.openstreetmap.org/node/6029934580) |
| Hooked | Kedjans sida räcker inte för att bekräfta uteplatser på filialen | [Hooked](https://gethooked.dk/) |
| Klovnens Bodega | OSM; ej oberoende bekräftad | [OSM](https://www.openstreetmap.org/node/7098162233) |
| CC Restaurant | OSM; ej oberoende bekräftad | [OSM](https://www.openstreetmap.org/node/7179414878) |
| Silberbauers Bistro | Adress bekräftad, uteservering bara OSM | [VisitCopenhagen](https://www.visitcopenhagen.com/copenhagen/planning/silberbauers-bistro-gdk1126548) |
| Bar Vivant | OSM:s webbdomän leder till IT-företag; används inte som barkälla | [OSM](https://www.openstreetmap.org/node/8706595479) |
| Too Old To Die Young | Utomhussittplatser beskrivs; rättade bartider, söndagsköket stängt | [Ravnsborggade](https://www.toooldtodieyoung.dk/ravnsborggade/) |
| Under Træet | OSM; ej oberoende bekräftad | [OSM](https://www.openstreetmap.org/node/12897927507) |

Ingen generell Google Places-koppling eller ny extern datatjänst tillkommer. Nästa steg för platsnoggrannheten är fältkontroll med verklig sittpunkt, riktning och foto, samt jämförelse av beräknad/observerad skuggankomst.

## Verifiering

`npm test` innehåller ankomst, hela vistelsen, luckor i soldata, parkernas provintervall, natt/okända lägen, öppettider, rangordning, GPS-gränser och källornas omfattning. `npm run test:nearby` provar dagens start, dag-/tidsseparation, Nu, platsbegäran efter användartryck, nekad behörighet, manuellt område, tre förslag, val av plats, källa/sittpunktsstatus, midnatt och liten mobilvy. Befintliga browser-, sol-, event- och kartsviter har uppdaterats för dagens reglage. Fysisk iPhone/GPS och verkliga gångvägar är inte verifierade av dessa skrivbordstester.
