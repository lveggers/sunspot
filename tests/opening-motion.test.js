import test from "node:test";
import assert from "node:assert/strict";
import { openingMotion } from "../src/openingMotion.js";

test("puppet drops from fully above the stage, settles once, and preserves the image crop", () => {
  const { keyframes, options } = openingMotion();
  assert.match(keyframes[0].transform, /translateY\(-210px\)/);
  assert.equal(options.duration, 780);
  assert.equal(options.delay, 0);
  assert.equal(keyframes.at(-1).transform, "translateY(0) rotate(0deg)");
  assert.ok(keyframes.some(({ transform }) => transform.includes("translateY(5px)")));
  assert.ok(keyframes.some(({ transform }) => transform.includes("translateY(-2px)")));
  for (const frame of keyframes) assert.deepEqual(Object.keys(frame).filter((key) => !["offset", "easing"].includes(key)), ["transform"]);
});

test("weather prop hangs offstage until its short stagger and settles within 1.2 seconds", () => {
  const { keyframes, options } = openingMotion(true);
  assert.match(keyframes[0].transform, /translateY\(-160px\)/);
  assert.equal(options.fill, "backwards");
  assert.ok(options.delay > 0 && options.delay <= 120);
  assert.ok(options.duration + options.delay < 1200);
  assert.equal(options.iterations, undefined);
  assert.equal(keyframes.at(-1).transform, "translateY(0) rotate(0deg)");
});
