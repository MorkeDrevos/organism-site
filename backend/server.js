// backend/server.js — Jupiter-only price backend (full file)

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// === Config ===
// Default to your test mint; can override in Render -> Environment -> TOKEN_MINT
const TOKEN_MINT =
  process.env.TOKEN_MINT ||
  "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Small cache so we don’t hammer Jupiter unnecessarily
const CACHE_MS = Number(process.env.CACHE_MS || 5000);
let last = { ts: 0, price: 0 };

async function fetchJupiterPrice(mint) {
  const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(mint)}`;
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`Jupiter HTTP ${r.status}`);
  const j = await r.json();
  const p = j?.data?.[mint]?.price;
  if (typeof p !== "number") throw new Error("Jupiter response missing price");
  return p;
}

// root hint
app.get("/", (_req, res) => {
  res
    .type("text")
    .send(
      "THE ORGANISM API (Jupiter) — use /health. Set TOKEN_MINT env to change token."
    );
});

// Returns { status, price, timestamp }
app.get("/health", async (_req, res) => {
  const now = Date.now();

  // serve cached if still fresh
  if (now - last.ts < CACHE_MS) {
    return res.json({ status: "alive", price: last.price, timestamp: now });
  }

  try {
    const price = await fetchJupiterPrice(TOKEN_MINT);
    last = { ts: now, price };
    res.json({ status: "alive", price, timestamp: now });
  } catch (err) {
    // do NOT fall back to other providers per your request.
    // Return last known price (may be 0 initially) so the frontend stays responsive.
    console.error("Jupiter price error:", err.message);
    res.status(200).json({
      status: "alive",
      price: last.price || 0,
      timestamp: now,
      note: "Jupiter fetch error; serving cached/zero price.",
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `✅ Backend (Jupiter-only) running on :${PORT} | TOKEN_MINT=${TOKEN_MINT} | CACHE_MS=${CACHE_MS}`
  );
});
