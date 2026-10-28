import { sunshineWeather } from "./lib.js";

const characters = {
  created: "blue-coat",
  sun: "football",
  grey: "blue-shirt",
  unknown: "green-jacket",
  responses: "blue-coat",
  cancelled: "turtleneck",
};

export function invitationCounts(invitation) {
  return Object.fromEntries(["yes", "maybe", "no"].map((answer) => {
    const count = invitation?.counts?.[answer];
    return [answer, Number.isInteger(count) && count >= 0 ? count : 0];
  }));
}

export function selectInvitationMoment({ invitation, weather, loading = false, responded = false } = {}) {
  const counts = invitationCounts(invitation);
  let state = "unknown";
  let condition;
  if (invitation?.cancelled) state = "cancelled";
  else if (invitation && (responded || (invitation.isHost && Object.values(counts).some((count) => count > 0)))) state = "responses";
  else if (invitation?.isHost) state = "created";
  else if (invitation && !loading) {
    condition = sunshineWeather(weather, invitation.startsAt).state;
    if (condition === "sun") state = "sun";
    else if (condition === "cloud" || condition === "rain") state = "grey";
  }
  const moment = { id: `invite-${state}`, character: characters[state] };
  if (state === "sun") moment.weather = "sun";
  if (state === "grey") {
    moment.pose = "cloud-angry";
    moment.weather = condition;
  }
  return moment;
}
