import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// ---- Config ----
// Default token = your test mint. You can override with env TOKEN_MINT.
const TOKEN_MINT =
  process.env.TOKEN_MINT ||
  "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Simple in-memory cache so we don’t spam the price API
const CACHE_MS = Number(process.env.CACHE_MS || 5000);
let last = { ts: 0, price: 0 };

// Fetch price from Jupiter (v6), fall back to v4 if needed.
async function fetchJupiterPrice(mint) {
  // v6 (preferred)
  try {
    const urlV6 = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(
      mint
    )}`;
    const r = await fetch(urlV6, { headers: { "accept": "application/json" } });
    if (!r.ok) throw new Error(`Jupiter v6 HTTP ${r.status}`);
    const j = await r.json();
    const p = j?.data?.[mint]?.price;
    if (typeof p === "number") return p;
  } catch (_) { /* fall through to v4 */ }

  // v4 (fallback)
  const urlV4 = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(mint)}`;
  const r2 = await fetch(urlV4, { headers: { "accept": "application/json" } });
  if (!r2.ok) throw new Error(`Jupiter v4 HTTP ${r2.status}`);
  const j2 = await r2.json();
  const p2 = j2?.data?.[mint]?.price;
  if (typeof p2 === "number") return p2;

  throw new Error("Price not found in Jupiter response");
}

// Root hint
app.get("/", (_req, res) => {
  res
    .type("text")
    .send("THE ORGANISM API — use /health (reads price from Jupiter).");
});

// Health endpoint → returns { status, price, timestamp }
app.get("/health", async (_req, res) => {
  const now = Date.now();

  // serve cached if fresh
  if (now - last.ts < CACHE_MS) {
    return res.json({ status: "alive", price: last.price, timestamp: now });
  }

  try {
    const price = await fetchJupiterPrice(TOKEN_MINT);
    last = { ts: now, price };
    res.json({ status: "alive", price, timestamp: now });
  } catch (err) {
    // on error, don’t block UI—return last known (may be 0 initially)
    res.status(200).json({
      status: "alive",
      price: last.price || 0,
      timestamp: now,
      note: `Jupiter error: ${err.message}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend (Jupiter) running on :${PORT} | TOKEN_MINT=${TOKEN_MINT}`);
});
