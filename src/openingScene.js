import { selectOfferMoment } from "./offerExperience.js";

export function selectOpeningScene({ weatherMoment, offers = [], sunnyPlaceIds = [], loading = false }) {
  if (loading || !weatherMoment || weatherMoment.id === "weather.loading") return null;
  if (weatherMoment.id !== "weather.sun") {
    const weather = ["cloud", "rain", "moon"].includes(weatherMoment.weather) ? weatherMoment.weather : undefined;
    return { id: "opening.no-sun", character: weather ? weatherMoment.character : "green-jacket", pose: weather ? weatherMoment.pose : undefined, weather };
  }
  const offer = offers.find((candidate) => candidate.claimable === true
    && ["beer", "cocktail"].includes(candidate.kind)
    && sunnyPlaceIds.includes(candidate.placeId));
  if (offer) return { ...selectOfferMoment({ offer }), id: "opening.golden-hour", weather: "sun", offer };
  return { id: "opening.sun", character: "football", weather: "sun" };
}
