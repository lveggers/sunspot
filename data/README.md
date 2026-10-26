# Platsdata och källor

`osm-places-source.json` är ett begränsat OpenStreetMap-utdrag via Overpass, hämtat 2026-09-16. Namn och koordinater för dessa sju platser används i `src/places.js`. Redaktionella kategorier, mötestexter och demofönster är tillagda av SunSpot och är inte verifierade av OSM.

Kart- och platsdata: © OpenStreetMap contributors, tillgängliga enligt [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). Utdraget återdistribueras med samma datalicens. Varje plats har länk till sitt OSM-objekt i gränssnittet.

Sökningens avgränsning var `55.66,12.54,55.71,12.64` och namnen Kayak Bar, Høst, La Banchina, Kongens Have, Ørstedsparken, Broens Street Food, Ofelia Plads och BRUS. Sju objekt hittades; Broens Street Food ingår därför inte i den körbara listan.

Väder hämtas separat från [MET Norway Locationforecast](https://docs.api.met.no/doc/locationforecast/HowTO.html) under [CC BY 4.0 och MET:s datapolicy](https://docs.api.met.no/doc/License.html). Klienten väljer prognosintervall, avrundar visade temperatur-/vindvärden och översätter vädersymboler. Ingen prognosdata committas till repot.

## Byggnadsskuggor i version 0.2

`public/data/copenhagen-buildings.json` är ett bearbetat OSM-utdrag hämtat 2026-09-16 via Overpass. Det distribueras under **ODbL-1.0**, med attribution © OpenStreetMap contributors. Källtid, hämttid, licens, bounds och statistik finns i filen. Reproducerbar import: `npm run data:buildings`. Importören är en utvecklingsdependency och ingår inte i klientpaketet.

Utdraget omfattar 12.530–12.632° öst, 55.662–55.711° nord. Av 19 523 byggnader har 271 angiven `height`, 4 066 uppskattas via `building:levels × 3 m` plus eventuell `roof:height`, och 15 186 saknar användbar höjd och antas vara 12 m. `heightSource` anger metod per objekt. Höjder är inte fältvaliderade. 293 objekt utan användbar byggnadsgeometri eller med exkluderade egenskaper uteslöts. Importen utesluter bland annat underjordiska/upphöjda byggnader, byggnadsdelar och fristående tak.

Geometrin behåller multipolygoner och hål. Rendereraren projicerar vertikala prismor från solens position på plan mark; detaljerade tak, träd och terräng modelleras inte. Ett konservativt band innanför utdragets gräns markeras som utanför täckning. Det fångar inte luckor inne i OSM-underlaget. Platsers solfönster beräknas ännu inte från detta dataset.

Höjdtolkning: [OSM height](https://wiki.openstreetmap.org/wiki/Key:height), [OSM building:levels](https://wiki.openstreetmap.org/wiki/Key:building:levels). Våningshöjden 3 m och standardhöjden 12 m är SunSpots antaganden. SunCalc 2 använder grader och azimut medurs från norr.

## Platser och parkytor i version 0.3

`osm-venue-areas-source.json` innehåller de tre befintliga parkernas fulla OSM-gränser och OSM-objekt med `amenity=bar|pub|restaurant`, namn och `outdoor_seating=yes` i Nørrebro-rutan 55.684–55.703° N, 12.543–12.566° E, hämtat 2026-09-16. De 19 nodobjekten används som ytterligare platser; ett träffat way-objekt har inte lagts till. `osm-park-water-source.json` innehåller tio vattenytor i rutan 55.677–55.688° N, 12.560–12.590° E. Slutna geometrier används för att utesluta vatten ur parkernas provpunkter. Båda utdragen återdistribueras enligt ODbL med © OpenStreetMap contributors.

`npm run data:venues` bygger `src/places.js` och `src/venueAreas.js` från de lokala platsfilerna och det utökade park-/vattenutdraget nedan. Inget nätanrop görs av kommandot. `scripts/import-venue-areas.mjs` dokumenterar och kan upprepa Overpass-anropet för platser/parkgränser. Vattenfrågan är `[out:json][timeout:30];way["natural"="water"](55.677,12.560,55.688,12.590);out body geom;`.

OSM:s `opening_hours` och `outdoor_seating` behålls med ursprung. De är inte leverantörsbekräftade liveuppgifter. Ingen data i denna version kommer från Google. Version 0.2:s beskrivning av fristående demotider är historisk: i 0.3 analyseras platser med byggnadsmodellen, se [produktmodellen](../docs/11-solstyrt-urval.md).


## Utökat parkurval

`osm-city-parks-source.json` hämtades 2026-09-16 från Overpass. Den innehåller namngivna `leisure=park`-objekt samt `natural=water` inom eller över gränsen till Københavns Kommune och Frederiksberg Kommune. Geometrier som korsar kommungränsen behålls hela; vissa parker sträcker sig därför in i grannkommuner. Exakt fråga, hämtningstid, källans tidsstämpel och licens finns i filen. © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), **ODbL-1.0**.

Utdraget ger 139 parkytor och 412 vattenpolygoner efter konvertering. Sex namngivna parknoder saknar ytgeometri och hoppas över. `access=no|private|customers|members` utesluts. Andra typer av grönytor, namnlösa parker och objekt utan komplett geometri ingår inte. Saknad tillträdesinformation betyder inte verifierat offentligt tillträde. Detta är en OSM-snapshot, inte en fullständig kommunal parkförteckning.

`npm run data:parks` hämtar ett nytt utdrag och kör det lokala bygget. `npm run data:venues` återskapar platsdata utan nätanrop. OSM-ID används som stabil identitet; ursprungliga plats-ID:n behålls för befintliga inbjudningar. Importen bevarar multipolygoners separata delar och hål, utesluter vatten från beräkningspunkter och avbryter vid ett ofullständigt API-svar. Parker kan sträcka sig utanför byggnadsmodellen och ska då visa okänt solläge.

[Overpass områdesfrågor](https://wiki.openstreetmap.org/wiki/Overpass_API/Areas) beskriver kommunavgränsningen. Fælledparkens kommunala informationssida finns hos [Københavns Kommune](https://www.kk.dk/brug-byen/natur-og-groenne-omraader/parker/faelledparken).
