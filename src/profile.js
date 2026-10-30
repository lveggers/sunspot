import { readHangLocal, writeHangLocal, hangActivities } from "./hangs.js";
export const profileKey = "sunspot:profile:v1";
export function readProfile() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(profileKey));
  } catch {
    /* Optional browser storage. */
  }
  return {
    name:
      typeof stored?.name === "string"
        ? stored.name
        : readHangLocal("name", ""),
    photo:
      typeof stored?.photo === "string" &&
      /^data:image\/jpeg;base64,/.test(stored.photo) &&
      stored.photo.length < 24000
        ? stored.photo
        : null,
    activity: hangActivities.some((a) => a.id === stored?.activity)
      ? stored.activity
      : "",
  };
}
export function saveProfile(profile) {
  const name = profile.name.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 32 || /[\p{C}<>]/u.test(name))
    throw Error("Använd ett förnamn på högst 32 tecken.");
  const value = {
    name,
    photo: profile.photo || null,
    activity: profile.activity || "",
  };
  try {
    localStorage.setItem(profileKey, JSON.stringify(value));
  } catch {
    throw Error(
      "Profilen kunde inte sparas. Tillåt lokal lagring i webbläsaren.",
    );
  }
  writeHangLocal("name", name);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("sunspot-profile"));
  return value;
}
export function rememberProfileName(name) {
  const current = readProfile();
  try {
    saveProfile({ ...current, name });
  } catch {
    writeHangLocal("name", name);
  }
}
export function profileReturn(value) {
  return typeof value === "string" &&
    (value === "/hangs" || /^\/hang\/[a-f0-9]{32}$/.test(value))
    ? value
    : "/";
}
// Decode locally and send only a small raster thumbnail when the user joins/hosts.
export async function prepareProfilePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Välj en JPG-, PNG- eller WebP-bild.");
  if (file.size > 10 * 1024 * 1024) throw Error("Bilden får vara högst 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 50000000)
      throw Error("Bilden är för stor. Välj en mindre bild.");
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    context.fillStyle = "#fff8cd";
    context.fillRect(0, 0, 192, 192);
    context.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      192,
      192,
    );
    for (const quality of [0.8, 0.65, 0.45]) {
      const photo = canvas.toDataURL("image/jpeg", quality);
      if (photo.length <= 16000) return photo;
    }
    throw Error("Bilden är för detaljerad. Välj en annan bild.");
  } catch (error) {
    if (error.message.startsWith("Bilden")) throw error;
    throw Error("Bilden kunde inte läsas. Välj en annan bild.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
