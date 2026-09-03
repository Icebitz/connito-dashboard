import type { NextApiRequest, NextApiResponse } from "next";

const UPSTREAM_BASE_URL = "https://dashboard-api-v2.connito.ai/api/v2/miner";
const UPSTREAM_TIMEOUT_MS = 20_000;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const uid = Array.isArray(request.query.uid) ? request.query.uid[0] : request.query.uid;
  if (!uid || !/^\d+$/.test(uid)) return response.status(400).json({ error: "A numeric miner UID is required." });

  try {
    const upstream = await fetch(`${UPSTREAM_BASE_URL}/${uid}/history`, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = contentType.includes("application/json") ? await upstream.json() : await upstream.text();
    response.setHeader("Cache-Control", "no-store");
    return response.status(upstream.status).json(body);
  } catch (error) {
    console.error("Miner history request failed", error);
    return response.status(502).json({ error: "Miner history is temporarily unavailable." });
  }
}
