# SunSpot — dukketeater ved åbning

Opdateret med Astra (`gpt-6-astra`), 28. oktober 2026. Denne leverance erstatter den tidligere animation af figurer på mange flader. Kun åbningsscenen bruger produktfigurer; det eksisterende galleri er et valgfrit arkiv.

## Tre situationer

1. **Sol:** fodboldtrøjen og en sol i snore.
2. **Ingen bekræftet sol:** en figur og en vejrrekvisit, der følger de faktiske data. Skyer/nedbør får den tilsvarende rekvisit, nat får måne. Manglende/usikre data må ikke opfinde skyer eller sol.
3. **Sol og Golden Hour:** siddende puffer med øl eller blå frakke med cocktail, valgt ud fra partnerens aktuelle tilbud, sammen med solen i snore.

`selectOpeningScene` genbruger den eksisterende vejr-/solklassifikation. Golden Hour kræver `weather.sun`, et claimable tilbud med kendt beer/cocktail-type og et sted blandt de beregnede solsteder. Ingen tilbudskilde må tilsidesætte skyer, regn, nat, manglende data eller usikker sol. Uafklarede data giver en tom, reserveret scene, mens appens normale kontroller fortsat virker.

## Bevægelse og snore

`OpeningTheatre.jsx`, `opening-theatre.css` og `openingMotion.js` bruger de eksisterende PNG'er og native SVG-/CSS-snore. Figurens hele udklip hænger i fire synlige snore ved skuldre/hænder; vejrrekvisitten hænger i to. Snorene klippes ved scenens øvre bjælke. Atlasbilledets beskæring og tegnede lemmer ændres ikke.

Figuren starter helt over scenen ved translateY(-210px) og rotate(-3deg). Den falder ned over 780 ms, når 5 px under slutpositionen og svajer 1,2° kort, går via -2 px/-0,6° og falder til ro. Vejrrekvisitten starter ved -160 px/+4°, følger 90 ms efter og bruger 720 ms med et mindre udsving på 3 px. Alt står stille efter 810 ms; ingen idleloops. Der bruges kun native transform-keyframes, uden nye afhængigheder.

Scenen er 112 px høj med en 70 px bred figur. Finderen er kompakt med foldede søgefelter på både desktop og mobil; indstillinger og søgeknap deler én række under scenen. Kortet dæmpes med en mørk baggrund under panelet, så åbningsscenen træder frem. Første søgning eller åbning af indstillinger forbruger introen og fjerner mørkningen; den vender ikke tilbage ved ændring af søgning eller nulstilling. Fuld genindlæsning er en ny åbning.

Samme scene genafspilles ikke ved sprogskift, polling eller midlertidig solberegning. Pending skjuler scenen og afbryder motion, men bevarer sidste identitet, så samme resultat vender statisk tilbage. En anden reel variant kan få en ny indgang. Reacts udviklingsprobe genbruger håndtag; ægte unmount og ændrede inputs afbryder den gamle bevægelse.

Reduceret bevægelse viser slutpositionen straks. Skjult dokument, offscreen og overliggende dialog stopper bevægelsen uden genstart ved retur. Scenen er dekorativ med aria-hidden og pointer-events:none. Tekst og kontroller opdateres straks; animationen flytter ikke fokus, kodefelter, kuponur eller kort.

## Rolige funktionelle flader

Filtre, stedkort, søgeresultater, invitationer, RSVP-valg, tilbud, kuponer, partnerportal, solvarsler og det simulerede tilbudseksempel har ingen figurer. De tidligere animationskvitteringer og deres engangsmarkører er fjernet. Serverens claim-/indløsningsregler, monotont resync af kuponur og fokus i koden er bevaret.

Tilbud hentes gennem én hoistet `useGoldenHourOffers`-kilde i hovedappen; intro og tilbudsknap deler den. Galleriet kan åbnes via en tekstknap uden figurpreview og beholder de ni godkendte identiteter og fem scener.

## Verifikation

Native tests kontrollerer de tre scener, begge drikketyper, ukendt/manglende/stale/nat/nedbør, tilbudsafgrænsning og de endelige drop-keyframes. Browserchecks kontrollerer faktiske native animationer, synlige snore, klipning over scenen, reduceret bevægelse, ingen genafspilning og fravær af figurer på funktionelle flader. Mobilkontrol bevarer synlig søgeknap og brugbart kort. Eksisterende tests for invitationer, kuponer, åbningstider, soldata, sprog og formularer bevares.
