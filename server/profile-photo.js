import sharp from "sharp";
export async function normalizeProfilePhoto(value) {
  if (value === undefined || value === null || value === "") return null;
  const invalid = () =>
    Object.assign(new Error("Bilden kunde inte läsas. Välj en annan bild."), {
      status: 400,
    });
  if (
    typeof value !== "string" ||
    value.length > 24000 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw invalid();
  try {
    const bytes = Buffer.from(value.split(",")[1], "base64");
    const image = sharp(bytes, { limitInputPixels: 262144, failOn: "warning" });
    const meta = await image.metadata();
    if (meta.format !== "jpeg" || meta.pages > 1) throw invalid();
    const output = await image
      .rotate()
      .resize(192, 192, { fit: "cover" })
      .jpeg({ quality: 70 })
      .toBuffer();
    if (output.length > 12288) throw invalid();
    return output.toString("base64");
  } catch {
    throw invalid();
  }
}
