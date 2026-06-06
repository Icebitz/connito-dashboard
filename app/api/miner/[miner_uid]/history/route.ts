import { NextResponse } from "next/server";

const SOURCE_BASE_URL = "https://dashboard-api.connito.ai/api/v2/miner";
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    miner_uid: string;
  }>;
};

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store"
  };
}

async function parseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "application/json";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function getMinerUid(value: string) {
  const decoded = decodeURIComponent(value).trim();
  return /^\d+$/.test(decoded) ? decoded : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { miner_uid: rawMinerUid } = await context.params;
  const minerUid = getMinerUid(rawMinerUid);

  if (!minerUid) {
    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        ok: false,
        error: "Invalid miner UID."
      },
      {
        status: 400,
        headers: noStoreHeaders()
      }
    );
  }

  const source = `${SOURCE_BASE_URL}/${encodeURIComponent(minerUid)}/history`;
  let lastError = "Unknown miner history fetch error.";
  let lastStatus = 504;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fetchedAt = new Date().toISOString();

    try {
      const response = await fetch(source, {
        cache: "no-store",
        headers: {
          accept: "application/json"
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });
      const body = await parseBody(response);

      if (!response.ok) {
        lastStatus = response.status;
        lastError = `Miner history API returned HTTP ${response.status}.`;
        break;
      }

      return NextResponse.json(
        {
          fetchedAt,
          ok: true,
          source,
          data: body
        },
        {
          headers: noStoreHeaders()
        }
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown miner history fetch error.";
    }
  }

  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      ok: false,
      source,
      error: lastError
    },
    {
      status: lastStatus,
      headers: noStoreHeaders()
    }
  );
}
