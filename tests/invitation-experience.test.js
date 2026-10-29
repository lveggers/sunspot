import test from "node:test";
import assert from "node:assert/strict";
import { invitationCounts, selectInvitationMoment } from "../src/invitationExperience.js";

const invitation = Object.freeze({
  id: "invitation-fixture",
  startsAt: "2026-10-29T13:00:00Z",
  isHost: false,
  cancelled: false,
  counts: Object.freeze({ yes: 0, maybe: 0, no: 0 }),
});
const forecast = (symbol = "clearsky_day") => ({
  available: true,
  stale: false,
  timeseries: [{
    time: invitation.startsAt,
    data: {
      instant: { details: { cloud_area_fraction: symbol === "cloudy" ? 100 : 5 } },
      next_1_hours: {
        summary: { symbol_code: symbol },
        details: { precipitation_amount: symbol === "rain" ? 1 : 0 },
      },
    },
  }],
});

test("invitation moments select created, forecast, responses and cancellation from explicit data", () => {
  for (const [input, id, character, weather] of [
    [{ invitation: { ...invitation, isHost: true } }, "invite-created", "blue-coat"],
    [{ invitation, weather: forecast() }, "invite-sun", "football", "sun"],
    [{ invitation, weather: forecast("cloudy") }, "invite-grey", "blue-shirt", "cloud"],
    [{ invitation, weather: forecast("rain") }, "invite-grey", "blue-shirt", "rain"],
    [{ invitation, weather: forecast(), loading: true }, "invite-unknown", "green-jacket"],
    [{ invitation }, "invite-unknown", "green-jacket"],
    [{ invitation, weather: { ...forecast(), available: false } }, "invite-unknown", "green-jacket"],
    [{ invitation, weather: { ...forecast(), stale: true } }, "invite-unknown", "green-jacket"],
    [{ invitation, weather: forecast("clearsky_night") }, "invite-unknown", "green-jacket"],
    [{ invitation, weather: forecast(), responded: true }, "invite-responses", "blue-coat"],
    [{ invitation: { ...invitation, isHost: true, counts: { yes: 2, maybe: 1, no: 1 } } }, "invite-responses", "blue-coat"],
    [{ invitation: { ...invitation, cancelled: true, isHost: true, counts: { yes: 2, maybe: 1, no: 1 } }, weather: forecast(), responded: true }, "invite-cancelled", "turtleneck"],
    [{}, "invite-unknown", "green-jacket"],
  ]) {
    const before = JSON.stringify(input);
    const actual = selectInvitationMoment(input);
    assert.equal(actual.id, id);
    assert.equal(actual.character, character);
    assert.equal(actual.weather, weather);
    assert.deepEqual(selectInvitationMoment(input), actual, `${id} is deterministic`);
    assert.equal(JSON.stringify(input), before, `${id} does not mutate its input`);
  }
});

test("invitation weather belongs to its actual start time, and uncovered times remain unknown", () => {
  const weather = forecast("cloudy");
  weather.timeseries.unshift({ ...forecast().timeseries[0], time: "2026-10-29T12:00:00Z" });
  assert.equal(selectInvitationMoment({ invitation, weather }).id, "invite-grey");
  assert.equal(selectInvitationMoment({ invitation: { ...invitation, startsAt: "2026-10-29T12:00:00Z" }, weather }).id, "invite-sun");
  for (const startsAt of ["2026-10-29T11:59:00Z", "2026-10-29T14:00:00Z", "2026-11-12T13:00:00Z"]) {
    const moment = selectInvitationMoment({ invitation: { ...invitation, startsAt }, weather });
    assert.equal(moment.id, "invite-unknown");
    assert.equal(moment.weather, undefined);
  }
});

test("RSVP yes, maybe and no remain separate counts with zero defaults", () => {
  assert.deepEqual(invitationCounts({ counts: { yes: 2, maybe: 1, no: 1 } }), { yes: 2, maybe: 1, no: 1 });
  assert.deepEqual(invitationCounts({ counts: { maybe: 4 } }), { yes: 0, maybe: 4, no: 0 });
  assert.deepEqual(invitationCounts(), { yes: 0, maybe: 0, no: 0 });
  assert.deepEqual(invitationCounts({ counts: { yes: -1, maybe: "2", no: 1.5 } }), { yes: 0, maybe: 0, no: 0 });
});
