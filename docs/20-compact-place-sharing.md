# Kompakt platskort och snabb delning

2026-09-20. När en markör öppnas visas namn, typ/område, en kort soluppskattning och en primär handling. I live-läge heter den **Jag sitter här – kom!**. Vid en planerad tid heter den **Ses här – dela platsen**. Mer info innehåller väder, källor, öppettider, sittpunktsval, solbevakning och det befintliga mötesformuläret.

Knappen öppnar enhetens delningsmeny. Användaren väljer själv mottagare och skickar. Meddelandet innehåller platsnamn, område, datum och tid i Köpenhamn, soluppskattning och en Google Maps-länk till platsens registrerade koordinater. Mottagaren behöver inget SunSpot- eller Vercel-konto. Varken besökarens GPS-position, Vercel-delningstoken eller värdens inbjudningsnycklar följer med.

Soltid är en ögonblicksbild, inte en nedräkning i mottagarens chatt. Därför innehåller meddelandet beräkningstid och en klockslagssatt solhorisont. Pågående beräkning och okänt solläge delar ingen gammal varaktighet. Skugga anges uttryckligen. För parker delas att delar av ytan har sol, utan att utlova en viss soltid vid ett visst bord eller en viss bänk. Byggnadssol säger inget säkert om moln.

Saknas systemdelning kopieras meddelandet. Nekad urklippsåtkomst ger ett markerbart textfält. Avbruten delning kopierar eller skickar ingenting, och vi påstår inte att mottagaren fått ett meddelande när delningsmenyn stängts. Delningen behöver ingen databas. Det äldre mötesflödet med gästsvar kräver fortfarande beständig delad lagring på Vercel.

Alla nya texter finns på svenska, danska och engelska. `test:share` kontrollerar kompakt mobilvy, riktig klickaktivering med mockad systemdelning, delningsinnehåll, avbryt, fel och urklippsreserv, framtida tid, Mer info och de tre språken. Systemets faktiska delningsmeny och leverans i iMessage/WhatsApp behöver sluttestas på en fysisk mobil.

Tekniska källor: [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
