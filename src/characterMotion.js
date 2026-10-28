const out = "cubic-bezier(0.22, 1, 0.36, 1)";
const fade = (duration) => ({ target: "figure", keyframes: [{ opacity: 0.75 }, { opacity: 1 }], options: { duration, easing: "linear" } });
const entrance = () => ({ target: "figure", keyframes: [{ transform: "translateY(4px)", opacity: 0.75 }, { transform: "translateY(0)", opacity: 1 }], options: { duration: 220, easing: out } });

// Only the primary scene calls this; confirmation is an explicit completed action.
export function characterMotion({ id, weather, initial, confirmed = false }) {
  if (["offer.checking", "voucher.expired", "example.expired", "invite-cancelled"].includes(id)) return null;
  if (confirmed) {
    if (id === "invite-created") return entrance();
    return fade(id?.startsWith("invite-") ? 180 : 220);
  }
  if (id?.startsWith("voucher.") || ["invite-created", "example.voucher"].includes(id)) return null;
  if (id === "weather.loading") return {
    target: "figure",
    keyframes: [{ opacity: 1 }, { opacity: 0.72 }, { opacity: 1 }],
    options: { duration: 1200, iterations: 3, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
  };
  if (!initial) return fade(160);
  if (["offer.beer", "offer.cocktail", "offer.demo", "example.offer"].includes(id)) return fade(220);
  if (id === "weather.night") return { target: "weather", keyframes: [{ opacity: 0.65 }, { opacity: 1 }], options: { duration: 300, easing: "linear" } };
  if (["weather.cloud", "weather.rain", "planned.grey"].includes(id)) return {
    target: "weather",
    keyframes: [{ transform: `${weather === "rain" ? "translateY(-2px)" : "translateX(3px)"} rotate(-8deg)` }, { transform: "rotate(-8deg)" }],
    options: { duration: weather === "rain" ? 320 : 360, easing: out },
  };
  return ["weather.sun", "planned.sun"].includes(id) ? entrance() : fade(160);
}
