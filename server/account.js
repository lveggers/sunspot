import { normalizeProfilePhoto } from "./profile-photo.js";
import sharp from "sharp";

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

// Only Google-issued avatars; never fetch a URL submitted through the profile API.
export async function googlePhoto(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !/^lh[3-6]\.googleusercontent\.com$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const res = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/"))
      return null;
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) return null;
      chunks.push(chunk);
    }
    const output = await sharp(Buffer.concat(chunks), {
      limitInputPixels: 16000000,
    })
      .rotate()
      .resize(192, 192, { fit: "cover" })
      .jpeg({ quality: 65 })
      .toBuffer();
    return output.length <= 12288
      ? `data:image/jpeg;base64,${output.toString("base64")}`
      : null;
  } catch {
    return null;
  }
}

async function body(req) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Skicka JSON.");
  const chunks = [];
  let size = 0;
  if (!req.body) fail(400, "Uppgifter saknas.");
  for await (const chunk of req.body) {
    size += chunk.length;
    if (size > 32768) fail(413, "För mycket text.");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    fail(400, "Uppgifterna kunde inte läsas.");
  }
}

export function createAccountApi({
  getSession,
  getStore,
  enabled = () => true,
  photo = googlePhoto,
}) {
  return async function handle(request) {
    const json = (value, status = 200) =>
      Response.json(value, { status, headers });
    try {
      if (!enabled())
        return request.method === "GET"
          ? json({ enabled: false, user: null })
          : json({ error: "Google-inloggning aktiveras snart." }, 503);
      if (!["GET", "PUT"].includes(request.method))
        return json({ error: "Method not allowed" }, 405);
      if (
        request.method === "PUT" &&
        request.headers.get("origin") !== new URL(request.url).origin
      )
        fail(403, "Öppna profilen i SunSpot och försök igen.");
      const session = await getSession();
      const user = session?.user;
      if (!user?.id || !/^[a-f0-9]{64}$/.test(user.id))
        return request.method === "GET"
          ? json({ enabled: true, user: null })
          : json({ error: "Logga in igen för att spara profilen." }, 401);
      const store = await getStore();
      let current = await store.get(user.id);
      let profile;
      if (request.method === "PUT") {
        const input = await body(request);
        if (input.expectedUserId !== user.id)
          fail(409, "Kontot har ändrats. Ladda om profilen och försök igen.");
        const name =
          typeof input.name === "string"
            ? input.name.normalize("NFC").trim().replace(/\s+/g, " ")
            : "";
        if (!name || name.length > 32 || /[\p{C}<>]/u.test(name))
          fail(400, "Använd ett förnamn på högst 32 tecken.");
        if (!["", "beer", "coffee", "food", "hang"].includes(input.activity))
          fail(400, "Välj en aktivitet.");
        const image = await normalizeProfilePhoto(input.photo);
        profile = {
          name,
          photo: image ? `data:image/jpeg;base64,${image}` : null,
          activity: input.activity,
        };
      } else if (current) {
        profile = JSON.parse(current);
      } else {
        const name = (user.name || "")
          .normalize("NFC")
          .replace(/[\p{C}<>]/gu, "")
          .trim()
          .slice(0, 32);
        profile = { name, photo: await photo(user.image), activity: "" };
      }
      if (request.method === "PUT" || !current) {
        const next = JSON.stringify(profile);
        if (!(await store.swap(user.id, current, next, 0))) {
          current = await store.get(user.id);
          if (request.method === "GET" && current)
            profile = JSON.parse(current);
          else
            fail(
              409,
              "Profilen ändrades på en annan enhet. Ladda om och försök igen.",
            );
        }
      }
      return json({
        enabled: true,
        user: { id: user.id, email: user.email },
        profile,
      });
    } catch (error) {
      return json(
        {
          error: error.status
            ? error.message
            : "Profilen kunde inte hämtas. Försök igen.",
        },
        error.status || 503,
      );
    }
  };
}
