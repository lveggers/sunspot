import { auth, googleEnabled } from "@/auth";
import { createAccountApi } from "../../../../server/account.js";
import { profileStore } from "../../../../server/hang-store.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = createAccountApi({
  getSession: auth,
  getStore: profileStore,
  enabled: googleEnabled,
});
export const GET = handle;
export const PUT = handle;
