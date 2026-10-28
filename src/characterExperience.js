const moment = (id, character, pose, weather) => ({ id, character, pose, weather });

export function selectWeatherMoment({ loading, night, available, stale, condition, hasSun, planned = false }) {
  if (loading) return moment("weather.loading", "green-jacket");
  if (night) return moment("weather.night", "turtleneck", undefined, "moon");
  if (!available) return moment("weather.missing", "green-jacket");
  if (stale) return moment("weather.stale", "green-jacket");
  if (!["sun", "cloud", "rain"].includes(condition)) return moment("weather.unknown", "green-jacket");
  if (planned && condition !== "sun") return moment("planned.grey", "blue-shirt", "cloud-angry", condition);
  if (condition === "rain") return moment("weather.rain", "stripes", "rain-bag", "rain");
  if (condition === "cloud") return moment("weather.cloud", "blue-shirt", "cloud-angry", "cloud");
  if (!hasSun) return moment("weather.no-spot", "cyclist", "cycling", "sun");
  return planned
    ? moment("planned.sun", "stripes", undefined, "sun")
    : moment("weather.sun", "football", undefined, "sun");
}

export function selectEmptyMoment({ noTypes, outsideCoverage, locationError, unconfirmedOpen, weatherMoment }) {
  if (noTypes) return moment("empty.no-types", "curls");
  if (outsideCoverage) return moment("empty.outside", "cyclist", "cycling");
  if (locationError) return moment("empty.location", "curls");
  if (unconfirmedOpen) return moment("empty.unconfirmed-open", "turtleneck");
  if (weatherMoment && !["weather.sun", "planned.sun"].includes(weatherMoment.id)) return weatherMoment;
  return moment("empty.no-match", "curls");
}
