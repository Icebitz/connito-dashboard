import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      ok: true,
      source: null,
      data: {},
      empty: true,
      warning: "Cycle API calls are disabled because the leaderboard response includes phase data."
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
