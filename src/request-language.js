import { cookies } from "next/headers";
import { normalizeLanguage } from "./i18n.js";

export async function requestLanguage() {
  return normalizeLanguage((await cookies()).get("sunspot-language")?.value);
}
