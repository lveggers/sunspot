# SunSpot — karakterer ved åbning

Seneste brugerretning, 28. oktober 2026: figurer var overbrugt. Den tidligere situationsmatrix på tværs af hele appen er derfor erstattet af én åbningsscene med tre udfald: sol, ingen bekræftet sol og sol med Golden Hour. [Animationsspecifikationen](character-animation-plan.md) beskriver den implementerede dukketeaterbevægelse og snorene.

Karakteridentiteter, papir-/blækstil, fem poseillustrationer og det ni-personers galleri er bevaret. Galleriet er frivilligt; appens filtre, kort, stedvisninger, invitationer, tilbud og kuponer er fri for figurer.

Den aktuelle scene vælges efter frisk vejrprognose, dagslys og beregnet sol ved stederne. Golden Hour kræver et aktuelt claimable partnersted blandt de bekræftede solsteder. Beer/cocktail styrer drikkefiguren. Skyer, regn, nat og usikre data må ikke få en positiv sol-/tilbudsscene. Manglende data vises nøgternt i teksten uden opdigtet vejr.

Introen ses i et lille panel over en mørkt dæmpet kortbaggrund. Søgefelterne er foldet sammen på både desktop og mobil. Første meningsfulde søgehandling forbruger introen og fjerner mørkningen. Den starter ikke igen ved sprogskift, polling, ændringssøgning eller reset. Det øvrige flow er fortsat område/nær mig + tid + uafhængige park/bar/mad-filtre → udvalgte steder → gårute eller invitation. Skygge/usikker sol og ikke-bekræftet åbent er skjult som standard.

Al apptekst er kort, neutral og hjælpsom på dansk, engelsk og svensk. Stednavne, partnerens tilbudstekst og brugerens besked bevares som skrevet. Sprogvalg gemmes i cookie; datoer, København-tid, priser og maskinværdier bevares korrekt.

Kortets grå basis og normale farver omkring bekræftede solsteder er bevaret. Farvevinduer er kontekst omkring beregningspunkter, ikke opmålte fysiske solgrænser. Skyer, nedbør, stale/missing/unknown, nat og ventende beregning undertrykker fremhævningen.

Tilbud og invitationer bruger fortsat deres faktiske serverdata. Kampagnens sluttid, solgrænsen og kuponens udløb er forskellige. Gentaget claim forlænger ikke kuponen, serveren afgør indløsning, og kuponuret resyncer uden at remounte kodefeltet. Ja/måske/nej tælles separat. Aflysning opdaterer invitationen uden at love udsendte beskeder. Eksempler og lokale testtilbud er tydeligt mærket.

[Krav fra Jurnie og direkte brugerinstruktioner](jurnie-requirements-2026-10-26.md) er fortsat kildegrundlaget. Flere byer, nye drikketyper, push og forslag til anden invitationstid er ikke del af denne ændring.
