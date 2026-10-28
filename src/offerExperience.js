import { localeFor } from "./i18n.js";

const drinkCharacters = {
  beer: { character: "puffer", pose: "beer-seated" },
  cocktail: { character: "blue-coat", pose: "cocktail-seated" },
};

const drinkMoment = (id, kind) => ({
  id,
  ...(Object.hasOwn(drinkCharacters, kind)
    ? drinkCharacters[kind]
    : { character: null }),
});

export function selectOfferMoment({ offer, busy = false, rejected = false } = {}) {
  if (rejected)
    return { id: "offer.rejected", character: "blue-shirt", pose: "cloud-angry" };
  if (!offer) return { id: "offer.none", character: null };
  if (busy) return drinkMoment("offer.checking", offer.kind);
  if (!offer.claimable) return { id: "offer.unavailable", character: null };
  if (offer.demo) return drinkMoment("offer.demo", offer.kind);
  return drinkMoment(
    Object.hasOwn(drinkCharacters, offer.kind) ? `offer.${offer.kind}` : "offer.other",
    offer.kind,
  );
}

// The caller supplies the existing server-anchored, monotonic countdown.
export function selectVoucherMoment({ voucher, remaining }) {
  const state = voucher.redeemedAt ? "redeemed" : remaining <= 0 ? "expired" : "valid";
  return drinkMoment(`voucher.${state}`, voucher.kind);
}

export function redeemedVoucherConfirmation(previous, next) {
  return previous?.id === next.id && !previous.redeemedAt && next.redeemedAt
    ? `redeemed:${next.id}:${next.redeemedAt}`
    : undefined;
}

export function selectExampleMoment({ sunny = true, started = false, remaining = 1 } = {}) {
  const state = started
    ? remaining <= 0 ? "expired" : "voucher"
    : sunny ? "offer" : "blocked";
  return drinkMoment(`example.${state}`, "beer");
}

export function formatOfferPrice(value, language) {
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency: "DKK",
    currencyDisplay: language === "da" ? "symbol" : "code",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
