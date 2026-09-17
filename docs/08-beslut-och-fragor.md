# Beslut och öppna frågor

Senast uppdaterad: 2026-09-16.

## Bekräftat från uppdraget

- Produkten ska kombinera stadens väder, sol vid olika platser och tider samt barer, restauranger och parker.
- Användaren ska kunna planera olika dagar och se när och hur länge solen når en plats.
- Social planering och inbjudningar till vänner är en del av idén.
- Arbetet börjar med dokumentation i ett nytt separat repo.
- Produktidén får konkretiseras och förfinas med självständiga förslag.
- Köpenhamn är vald pilotstad. Exakt pilotområde är ännu inte fastställt.
- Användarens anteckningar pekar ut Yr, aktivitetsbaserade träffar, en kartupplevelse inspirerad av Google Maps och möjlig återanvändning av SunCalc/ShadeMap. Se [anteckningarna](09-produktanteckningar.md); det är produktönskemål, inte färdigvaliderade integrationer.
- Användaren har därefter valt namnet SunSpot och bett om fortsatt arbete tills en enkel version går att visa.

## Arbetsbeslut för första utkastet

| ID | Beslut | Motiv | Status |
| --- | --- | --- | --- |
| B1 | SunSpot som namn | Användarens namnval. | Bekräftat; repo och gränssnitt omdöpta. |
| B2 | Köpenhamn som pilotstad, med ett mindre område för första testet | Användaren har valt Köpenhamn; DHM är första geodatakandidat att undersöka. | Stad bekräftad av användaren; områdesgräns återstår. |
| B3 | Mobilanpassad webb först | Underlättar länkdelning och test utan installation. | Rekommenderad riktning. |
| B4 | 30–50 kontrollerade platser | Gör det möjligt att granska rätt vistelseytor och upptäcka dataproblem. | Föreslagen pilotstorlek. |
| B5 | Idag plus sex dagar | Ger användbar vardags- och helgplanering med hanterlig omfattning. | Produktval; faktisk vädertäckning kontrolleras. |
| B6 | Separera geometrisk sol och väder | Undviker att en beräkning av skugga framstår som en vädergaranti. | Grundprincip. |
| B7 | Länkinbjudan och gästsvar utan konto | Testar social nytta med få steg. | Rekommenderad MVP. |
| B8 | Prova ShadeMap SDK/export före beslut om egen skuggmotor | Undersöker användarens idé om att återanvända befintlig lösning. | Återanvändning prioriteras; integration och rättigheter återstår. |
| B9 | Dokumentation först, därefter en enkel körbar version | Användaren utökade uppdraget till implementation. | Lokal version 0.1 byggd; se versionsstatusen. |
| B10 | Yr via MET Norway som primärt väderspår | Användarens önskade väderkälla. | Önskemål dokumenterat; API-prov återstår. |
| B11 | Aktivitet före plats: promenad, bar, restaurang | ”Sun guides your decision”. | Produktinriktning från anteckningar; promenadens första omfattning är ett arbetsförslag. |
| B12 | Bekant karta med sökfält, platskort och skugglager | Användarens referens till Google Maps. | Designriktning; kartleverantör inte vald. |

Arbetsbeslut är inte bevis för teknisk genomförbarhet. När ett beslut ändras ska den nya riktningen uppdateras i berörda dokument och motivet antecknas här.

## Frågor att förfina först

| Fråga | Nuvarande förslag | När svaret behövs |
| --- | --- | --- |
| Vilket område i Köpenhamn börjar vi med? | Ett mindre sammanhängande område med både uteserveringar och parkytor; väljs utifrån datatäckning och möjlighet till platskontroll. | Före insamling av pilotdata. |
| Vilken situation ska dominera startsidan? | Spontan träff senare idag, med helgplanering ett tryck bort. | Före flödesprototyp. |
| Är bar/restaurang eller park viktigast? | Alla tre, men bara med kontrollerbara vistelseytor. | Vid urvalet av de första tio platserna. |
| Ska konton behövas på sikt? | Gäster utan konto i MVP; bedöm behov av återställning och vänner efter test. | Före eventuell utökning av sociala funktioner. |
| Hur stor drift- och databudget är rimlig? | Ingen budget beslutad och inga betaltjänster beställda. | Före köp eller publik drift. |
| Hur bra måste modellen vara i praktiken? | De föreslagna kvalitetsmålen i solmodellen, följda av lokal pilot. | Prövas i datatestet. |
| Hur mycket ska promenadfunktionen göra? | Park och mötespunkt först; soloptimerad rutt därefter. | Före slutlig MVP-avgränsning. |

## Frågor som kan vänta

Domän, fortsatt grafisk formgivning, native-appar, fler städer, monetisering, bordsreservation och automatiska påminnelser. Namnet SunSpot och färgpaletten är valda. Att planera och ”boka” träffar med vänner ingår i produktens riktning.

## Ändringslogg

### 2026-09-16 — Användarens färgpalett

De fem färgerna i **Sunspot Color palette.pdf** används nu i gränssnitt, inbjudningar, favicon och kartlager. Gult markerar sol och huvudåtgärder, grönt Touchgrass och blått väder/skuggor. Mörka texttoner kompletterar paletten för läsbarhet. Sittpunkten byter från orange till blå. [Färgkoder och användning](12-fargpalett.md).

### 2026-09-16 — Beräknade byggnadsskuggor, version 0.2

Användaren godkände nästa steg med ett skugglager. ShadeMap kräver en API-nyckel som projektet saknar; ingen tjänst beställdes. Ett eget Leaflet-lager beräknar därför skuggor från OSM-konturer och SunCalc. Höjder är till stor del uppskattade; träd, terräng och fältvalidering återstår. Lager och platskort hålls uttryckligen åtskilda tills verkliga vistelseytor kan beräknas. [Aktuell omfattning](10-prototypstatus.md).


### 2026-09-16 — SunSpot och lokal prototyp

Användaren valde SunSpot och bad om en enkel version. Repo och dokumentation omdöpta. En lokal prototyp med OSM-karta, MET-väder, SunCalc-soltider för dagen och beständiga träffar/gästsvar är byggd och webbläsartestad. Platsers solfönster är fortfarande uttryckliga demodata. [Aktuell omfattning](10-prototypstatus.md).

### 2026-09-16 — Aktiviteter, Yr och återanvändning

Användarens anteckningar bevarade och omsatta i produkt- och teknikförslag. Yr/MET ersätter Open-Meteo som primärt väderspår. ShadeMap SDK och publicerade exportexempel är nu dokumentationsverifierade; lagring, lokal kvalitet och integration återstår att pröva. Promenad, barbesök och restaurangbesök knyts till träffarna, och kartupplevelsen får en tydligare riktning.

### 2026-09-16 — Köpenhamn bekräftad

Användaren valde Köpenhamn och ersatte därmed det tidigare arbetsantagandet om Stockholm. Pilotbeskrivning, datakällor, beräkningsspår, tidszon och backlogg har uppdaterats. DHM och kommunens dataingång är dokumentationskontrollerade kandidater; ingen dataimport eller fältvalidering är gjord.

### 2026-09-16 — Första dokumentationsversionen

Produktförslag, MVP, användarflöden, källöversikt, solmodell, arkitekturskiss och genomförandeplan skapade. Externa dokumentationskällor har kontrollerats. Ingen dataimport, fältvalidering, leverantörsbeställning eller produktimplementation har utförts.

### 2026-09-16 — Solstyrt urval och nästa stopp, version 0.3

Användaren preciserade att platser ska filtreras när skuggan når dem, medan delvis soliga parker ska behållas. En bevakad sittplats ska varna cirka tio minuter före skugga och föreslå nästa soliga ställe med hänsyn till förflyttning. Lokal implementation kopplar nu urvalet till byggnadsmodellen, lägger till Nørrebro-platser, OSM-tider, valbar sittpunkt och notiser medan appen körs. Google-spåret och bakgrundspush är dokumenterade men inte anslutna. [Fullt beslut och begränsningar](11-solstyrt-urval.md).

### 2026-09-16 — Touchgrass

Användaren valde namnet Touchgrass som ersättare för parkvalet och bad om tydligt fokus på parker. Implementerat som ett kartläge med parkpolygoner, nedtonad omgivning och bibehållna byggnadsskuggor. `greenSpace` härleds från OSM:s `leisure=park`; torget Ofelia Plads inkluderas därför inte i detta läge. Den interna aktiviteten `walk` behålls för befintliga träffar.

### 2026-09-16 — Parker hämtas över kommunerna

Användaren upptäckte att Fælledparken saknades. Det tidigare tvåparksurvalet ersätts med en reproducerbar OSM-import för Köpenhamns och Frederiksbergs kommuner: 139 namngivna parkytor med kompletta gränser. Flerdelade parker, inre hål och vattenytor bevaras. Byggnadsskuggornas mindre täckningsområde ändras inte; parker utanför det visas med okänt solläge. Kartval zoomar till vald park och sökningen accepterar alternativa skandinaviska stavningar.

### 2026-09-16 — Kartfokus för barer och restauranger samt full återställning

Användaren bad om motsvarande parkfilter för barer/restauranger och möjlighet att se allt. Kategorierna filtrerar nu lista och markörer samt tonar ned omgivande karta. Bar-/restaurangfokus visar cirka 80 meters kontext runt stället, inte en faktisk serveringsyta. Alla och Visa allt återställer samtliga platsfilter, inklusive fritext, sol och öppettider. Vald dag/tid, besökslängd, skugglagrets på/av-läge och eventuell solbevakning behålls.

### 2026-09-16 — Karta som huvudvy och tidsstyrda event

Användaren önskade mindre synlig information på mobil, karta i centrum och tidsreglage längst ner. Gränssnittet visar därför detaljer, filter, listor och väder först vid behov. Ett sammanhängande reglage täcker sju dagar, med daggenvägar och exakt tidsinmatning. Event använder samma markörform som platser och visas endast under sitt start-/slutintervall. I väntan på val av källa används uttryckligt märkta demo-event, utan verkliga arrangörer, bokning eller publicering.


### 2026-09-17 — Renare karta för Bar och Mat

De cirkulära utsnitten runt barer och restauranger togs bort efter mobilfeedback. Bar och Mat filtrerar fortfarande markörer och lista, men kartan visas utan nedtoningslager eller cirkulära fokusytor. Byggnadsskuggor och val av sittpunkt fungerar som tidigare. Touchgrass behåller parkernas verkliga ytor och sitt fokuslager.
