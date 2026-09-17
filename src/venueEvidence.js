import { openingAt } from "./openingHours.js";

// Public-source review, 2026-09-17. No entry verifies a physical seating point.
// Preserve the imported OSM snapshot; review overrides are independently maintained.
export const venueEvidence = {
  brus: {
    url: "https://tapperietbrus.dk/contact/",
    hours: "Su-Th 12:00-24:00; Fr-Sa 12:00-02:00",
    note: "Barens öppettider kontrollerade. Uteserveringens läge är inte verifierat.",
  },
  "osm-24958713": {
    url: "https://oelbaren.dk/",
    hours:
      "Mo-We 16:00-24:00; Th 16:00-01:00; Fr-Sa 15:00-02:00; Su 16:00-21:00",
    note: "Besöksadressen är Elmegade 2. Postadressen är en annan adress.",
  },
  "osm-24971137": {
    url: "https://restaurantjuma.dk/",
    hours: "Mo-Su 17:00-24:00",
    note: "Ordinarie öppettider kontrollerade på restaurangens webbplats.",
  },
  "osm-335962972": {
    url: "https://cafestefanshus.dk/",
    hours: "Su-Th 11:00-24:00; Fr-Sa 11:00-02:00",
    note: "Öppettiderna på webbplatsen skiljer sig från OSM.",
  },
  "osm-1118919064": {
    note: "Uteservering enligt OSM. Inte oberoende bekräftad.",
  },
  "osm-1775489880": {
    note: "Webbkällan kunde inte läsas. OSM-tider utan stängningstid behandlas som okända.",
  },
  "osm-1830057767": {
    url: "https://www.bindia.dk/",
    hours: "Mo-Su 16:00-21:00",
    note: "Elmegade 6 och öppettider kontrollerade för Nørrebro-filialen.",
  },
  "osm-2229062918": {
    url: "https://www.mikkeller.com/locations/mikkeller-and-friends",
    note: "Stefansgade 35 bekräftas av stället. Uteservering endast enligt OSM.",
  },
  "osm-3656367927": {
    note: "Uteservering enligt OSM. Inte oberoende bekräftad.",
  },
  "osm-3659148934": {
    url: "https://www.baest.dk/",
    hours: "Mo-Su 17:00-22:00; Sa-Su 12:00-14:30",
    note: "Lunch på helgen och kvällstider kontrollerade; skiljer sig från OSM.",
  },
  "osm-5786719592": {
    note: "Webbkällan svarade inte. Uteservering endast enligt OSM.",
  },
  "osm-5873205715": {
    url: "https://mf-pizza.dk/",
    note: "Webbplatsen gav inget läsbart underlag om uteserveringen.",
  },
  "osm-6029934580": {
    note: "Uteservering enligt OSM. Inte oberoende bekräftad.",
  },
  "osm-6700526583": {
    url: "https://gethooked.dk/",
    note: "Kedjans webbplats kontrollerad; uteserveringen på denna filial inte bekräftad.",
  },
  "osm-7098162233": {
    note: "Uteservering enligt OSM. Inte oberoende bekräftad.",
  },
  "osm-7179414878": {
    note: "Uteservering enligt OSM. Inte oberoende bekräftad.",
  },
  "osm-8582838546": {
    url: "https://www.visitcopenhagen.com/copenhagen/planning/silberbauers-bistro-gdk1126548",
    sourceName: "VisitCopenhagen",
    note: "Adressen på Jægersborggade bekräftas. Uteservering endast enligt OSM.",
  },
  "osm-8706595479": {
    note: "Webbadressen i OSM leder till ett IT-företag och används inte som källa för baren.",
  },
  "osm-9760524892": {
    url: "https://www.toooldtodieyoung.dk/ravnsborggade/",
    outdoorConfirmed: true,
    hours: "Mo-Th 16:00-24:00; Fr-Sa 14:00-02:00; Su 16:00-22:00",
    note: "Stället beskriver sittplatser utomhus. Barens tider gäller; köket är stängt söndagar.",
  },
  "osm-12897927507": {
    note: "Uteservering enligt OSM. Inte oberoende bekräftad.",
  },
};
export const evidenceReviewedAt = "2026-09-17";
export function placeOpening(place, instant, duration = 0) {
  const evidence = venueEvidence[place.id];
  // A dated source review must not stay authoritative indefinitely.
  const age =
    (Number(new Date(instant)) -
      Date.parse(`${evidenceReviewedAt}T00:00:00Z`)) /
    86400000;
  if (evidence?.hours && age > 90)
    return {
      state: "unknown",
      label: "Öppettider behöver kontrolleras",
      sourceUrl: evidence.url,
      checkedAt: evidenceReviewedAt,
    };
  if (evidence?.hours && age >= 0 && age <= 90) {
    const result = openingAt(evidence.hours, instant, duration);
    return {
      ...result,
      label: result.label.replace("enligt OSM", "enligt stället"),
      sourceUrl: evidence.url,
      checkedAt: evidenceReviewedAt,
    };
  }
  return openingAt(place.openingHours, instant, duration);
}
export function terraceLabel(place) {
  if (venueEvidence[place.id]?.outdoorConfirmed)
    return "Uteservering beskriven av stället";
  return place.outdoor === "yes"
    ? "Uteservering enligt OSM"
    : place.outdoor === "no"
      ? "Ingen uteservering enligt OSM"
      : "Uteservering inte bekräftad";
}
