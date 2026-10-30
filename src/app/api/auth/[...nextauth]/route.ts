import type { NextRequest } from "next/server";
import { handlers, googleEnabled } from "@/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!googleEnabled())
    return Response.json(
      { error: "Google sign-in is not configured" },
      { status: 503 },
    );
  return handlers.GET(request);
}
export async function POST(request: NextRequest) {
  if (!googleEnabled())
    return Response.json(
      { error: "Google sign-in is not configured" },
      { status: 503 },
    );
  return handlers.POST(request);
}
