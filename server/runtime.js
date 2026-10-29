import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createApi } from "./api.js";
import { weatherService } from "./weather.js";
import { createSunEligibility } from "./sun-eligibility.js";

const key = Symbol.for("sunspot.api");
const weatherKey = Symbol.for("sunspot.weather");

function getWeather() {
  if (!globalThis[weatherKey]) {
    // Weather is a replaceable cache; invitations are not. Serverless previews
    // can cache forecasts in /tmp without claiming durable invitation storage.
    const directory = process.env.VERCEL
      ? resolve(tmpdir(), "sunspot-weather")
      : resolve(
          /* turbopackIgnore: true */ process.env.SUNSPOT_DATA_DIR || ".data",
        );
    globalThis[weatherKey] = weatherService(directory);
  }
  return globalThis[weatherKey]();
}

export async function handleWeather() {
  return Response.json(await getWeather(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export function handleApi(request) {
  // Do not silently put invitations in an ephemeral serverless filesystem.
  if (process.env.VERCEL) {
    return Response.json(
      {
        error:
          "Träffar och Golden Hour behöver en beständig databas innan de kan användas i denna miljö.",
        code: "error.persistentStorage",
        params: {},
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!globalThis[key]) {
    const directory = resolve(
      /* turbopackIgnore: true */ process.env.SUNSPOT_DATA_DIR || ".data",
    );
    mkdirSync(directory, { recursive: true });
    // Next dev normalizes Request.url to its bind host (0.0.0.0 in Docker).
    const port = new URL(request.url).port;
    const localOrigins =
      process.env.NODE_ENV === "development"
        ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
        : undefined;
    globalThis[key] = createApi({
      database: resolve(directory, "sunspot.sqlite"),
      getWeather,
      getSunEligibility: createSunEligibility(getWeather),
      development: process.env.NODE_ENV === "development",
      origin: process.env.SUNSPOT_PUBLIC_ORIGIN || localOrigins,
    });
  }
  return globalThis[key].handle(request);
}
