BEACHFRONT RETREATS SL// backend/server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// ---- Config ----
const DEFAULT_MINT =
  process.env.TOKEN_MINT ||
  "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV"; // test mint
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || "";
const CACHE_MS = 5000;

let lastPrice = { ts: 0, price: 0 };
let lastTrades = { ts: 0, data: [] };

// ---- helpers ----
const now = () => Date.now();
const fmtISO = (ms) => new Date(ms).toISOString();

async function fetchJupPrice(mint) {
  // Jupiter v3 lite price
  const url = `https://lite-api.jup.ag/v3/price?ids=${encodeURIComponent(
    mint
  )}`;
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`Jupiter HTTP ${r.status}`);
  const j = await r.json();
  const p = j?.data?.[mint]?.price;
  if (typeof p !== "number") throw new Error("Jupiter price not found");
  return p;
}

async function fetchBirdeyeTrades(mint, limit = 12) {
  if (!BIRDEYE_API_KEY) throw new Error("Missing BIRDEYE_API_KEY");

  // Birdeye “trades by token” (v1) – free tier
  const url = `https://public-api.birdeye.so/defi/txs/token?address=${encodeURIComponent(
    mint
  )}&limit=${limit}`;

  const r = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-chain": "solana",
      "X-API-KEY": BIRDEYE_API_KEY,
    },
  });

  if (!r.ok) throw new Error(`Birdeye HTTP ${r.status}`);
  const j = await r.json();
  // Expected shape: { success: true, data: { items: [ ... ] } }
  const items = j?.data?.items || [];

  // Normalize → [ { time, type, valueUsd, priceUsd } ]
  // Birdeye fields vary by endpoint; we map sensibly:
  const out = items.map((it) => {
    // Try common fields with fallbacks
    const side = (it?.side || it?.txType || "").toString().toLowerCase();
    const type = side === "buy" ? "feed" : side === "sell" ? "starve" : "feed";
    const priceUsd =
      Number(it?.price) ||
      Number(it?.usdPrice) ||
      Number(it?.priceUsd) ||
      Number(it?.price_usd) ||
      0;
    const valueUsd =
      Number(it?.value) ||
      Number(it?.valueUsd) ||
      Number(it?.value_usd) ||
      Number(it?.usdValue) ||
      0;
    // time could be it.blockUnixTime, it.blockTime, it.ts, it.updateUnixTime…
    const t =
      Number(it?.blockUnixTime) ||
      Number(it?.blockTime) ||
      Number(it?.ts) ||
      Number(it?.updateUnixTime) ||
      now();

    return {
      time: fmtISO(t * (t < 2e10 ? 1000 : 1)), // seconds→ms if needed
      type,
      valueUsd,
      priceUsd,
    };
  });

  return out;
}

// Sim trades if Birdeye not available
function simulateTrades(price, n = 8) {
  const out = [];
  let p = price || 0.0069;
  let t = now();
  for (let i = 0; i < n; i++) {
    const isBuy = Math.random() > 0.45;
    const val = +(Math.random() * 40 + 4).toFixed(2);
    const dp = (Math.random() - 0.5) * 0.00002;
    p = Math.max(0, p + (isBuy ? Math.abs(dp) : -Math.abs(dp)));
    t -= Math.floor(Math.random() * 50 + 15) * 1000;
    out.push({
      time: fmtISO(t),
      type: isBuy ? "feed" : "starve",
      valueUsd: val,
      priceUsd: +p.toFixed(6),
    });
  }
  return out.sort((a, b) => (a.time < b.time ? 1 : -1));
}

// ---- endpoints ----

// Root
app.get("/", (_req, res) => {
  res.type("text").send("Organism backend (Jupiter price + Birdeye trades).");
});

// Price/health
app.get("/health", async (req, res) => {
  try {
    const mint = (req.query.mint || DEFAULT_MINT).toString();
    const t = now();
    if (t - lastPrice.ts < CACHE_MS) {
      return res.json({
        status: "alive",
        price: lastPrice.price,
        timestamp: t,
      });
    }
    const price = await fetchJupPrice(mint);
    lastPrice = { ts: now(), price };
    res.json({ status: "alive", price, timestamp: now() });
  } catch (err) {
    console.error("health error:", err?.message || err);
    // keep serving the last known price if we have it
    res.json({
      status: "alive",
      price: lastPrice.price || 0,
      timestamp: now(),
      note: "health fallback",
    });
  }
});

// Trades
app.get("/trades", async (req, res) => {
  try {
    const mint = (req.query.mint || DEFAULT_MINT).toString();
    const t = now();
    if (t - lastTrades.ts < CACHE_MS && lastTrades.data.length) {
      return res.json(lastTrades.data);
    }

    let trades = [];
    try {
      trades = await fetchBirdeyeTrades(mint, 12);
    } catch (be) {
      console.error("Birdeye trades error:", be?.message || be);
      // fall back to simulated trades, anchored to lastPrice
      trades = simulateTrades(lastPrice.price, 10);
    }

    lastTrades = { ts: now(), data: trades };
    res.json(trades);
  } catch (err) {
    console.error("trades error:", err?.message || err);
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on :${PORT}`);
});
