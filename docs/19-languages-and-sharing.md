# Språk, teståtkomst och platskort

Uppdaterat 2026-09-17.

## Språk

Öppna filterknappen vid sökfältet och välj Svenska, Dansk eller English. Valet sparas i den webbläsaren (`sunspot:language`). Första besöket använder ett av webbläsarens stödda språk; annars engelska. Blockerad lokal lagring hindrar inte språkbyte under besöket.

Knappar, filter, platskort, solbevakning, felmeddelanden, kartans kontrolltexter och datum översätts. Platsnamn, kartans grundkarta och arrangörernas eventtitlar/beskrivningar visas i original. Språkbyte ändrar inte valt datum, klockslag, kategori eller sittpunkt. Prognoser och solberäkningar använder fortsatt Köpenhamnstid.

UI-strängar finns i `src/locales/da.json` och `en.json`, med svenska källtexter som nycklar. `src/Language.jsx` äger språkvalet. API-identifierare och beräkningsdata påverkas inte. Dynamiska meddelanden interpoleras som text; användarskrivet innehåll skickas inte till någon översättningstjänst.

## Dela testversionen mellan tre personer

Projektet `sunspot-private` ligger vid kontrolltillfället på Vercel Hobby. Den planen tillåter en extern namngiven testare åt gången, så två separata väninbjudningar ryms inte i den modellen.

En delningslänk är det enklaste alternativet på befintlig plan:

1. Öppna projektet i Vercel och dess aktuella deployment.
2. Välj **Share → Anyone with the link** och kopiera länken via Share.
3. Skicka länken privat till de två vännerna.

Länken ger åtkomst till alla som har den och kan återkallas genom att välja **Only people with access**. Kopiera inte bara den vanliga adressen: den har fortsatt Vercel-inloggningsskydd. Hobby tillåter en sådan delningslänk per konto. Kontrollera om Share-länken gäller en bestämd version eller den uppdaterade produktionsadressen när nästa version publiceras.

Om båda vännerna ska ha individuell Vercel-åtkomst eller administrera publiceringar behöver ni ett lämpligt teamupplägg. Tillgång till GitHub-repot för kodsamarbete är separat från visningsåtkomst till appen. Inga inbjudningar har skickats och inget åtkomstskydd har ändrats i denna uppdatering.

Källor: [Sharing deployments](https://vercel.com/docs/deployments/sharing-deployments), [Shareable links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links).

## Så läser man platskortet

Tryck på en markör eller en plats i listan. Solraden gäller vald dag och tid, och för en bar/restaurang en uppskattad eller egenvald utomhuspunkt. Det är en byggnadsskuggmodell, inte en garanti för sol på alla bord. För parker används flera provpunkter, så en delvis skuggad park kan fortfarande rekommenderas.

Vädret visas separat: moln och byggnadsskugga är olika saker. **Mer om platsen** visar vad vi vet om uteserveringen, källa och öppettidsstatus. **Välj min sittplats på kartan** låter dig förbättra beräkningspunkten. **Bevaka solen här** visar skuggvarning och soliga alternativ; riktiga notiser kräver vald punkt, live-tid, tillstånd och att appen är öppen. Bakgrundspush finns inte ännu.

**Ses här med vänner** är appens mötesinbjudan, inte Vercels teståtkomst. Den fungerar i lokalversionen; den hostade versionen behöver en gemensam databas innan delade träffar fungerar. Den bokar inget bord.

## Verifiering

`npm test` kontrollerar språkprioritet, språkvarianter, katalogernas nycklar/parametrar, källanteckningar och dynamiska statusmeddelanden. `npm run test:i18n` kontrollerar mobilvyn, språkbyte utan tappad dag/tid/kategori, lagrat val efter omladdning, platskort, områdesval och automatisk danska. Befintliga browserkontroller väljer svenska uttryckligen för reproducerbara tester.
