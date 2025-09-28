import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// === SET YOUR TOKEN MINT HERE (final once you launch) ===
const TOKEN_MINT = "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// --- helpers
const now = () => Date.now();

// ------------------------ PRICE (health driver) ------------------------
app.get("/health", async (_req, res) => {
  try {
    const url = `https://lite-api.jup.ag/price/v3?ids=${TOKEN_MINT}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    const j = await r.json();
    const price = j?.[TOKEN_MINT]?.usdPrice ?? 0;
    res.json({ status: "alive", price, timestamp: now() });
  } catch (err) {
    console.error("Jupiter fetch error:", err.message);
    res.status(200).json({ status: "alive", price: 0, timestamp: now(), note: "Jupiter fetch error" });
  }
});

// ------------------------ TRADES (buys/sells) -------------------------
// Tries Birdeye public trades. If it fails (DNS, rate limit, not indexed),
// we return a small simulated tape so the UI still animates.

async function fetchBirdeyeTrades(mint) {
  // Birdeye public trades endpoint (works for most SPL tokens).
  // If this 404s for a brand new token, they usually index within minutes.
  const url =
    `https://public-api.birdeye.so/defi/trades?address=${mint}&offset=0&limit=20`;

  const r = await fetch(url, {
    headers: {
      "x-chain": "solana",
      accept: "application/json",
    },
  });

  if (!r.ok) throw new Error(`Birdeye trades ${r.status}`);
  const j = await r.json();

  // Normalize to a compact schema expected by the frontend.
  // We expect items with side ("buy"/"sell"), priceUsd, amount, and ts.
  const rows = (j?.data?.items || j?.data || []).map((t) => ({
    side: (t.side || t.type || "").toLowerCase().includes("sell") ? "sell" : "buy",
    price: Number(t.priceUsd ?? t.price ?? 0),
    amount: Number(t.amount ?? t.size ?? t.qty ?? 0),
    ts: Number(t.blockTime ?? t.ts ?? t.time ?? now()),
    wallet: t.maker || t.taker || t.trader || "",
    tx: t.txHash || t.signature || "",
  }));

  // Filter invalids and order newest first
  return rows
    .filter((r) => r.price > 0 && r.amount > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20);
}

// Simple simulator if Birdeye is not reachable.
// Generates pseudo-random buys/sells around the last price.
function simulateTrades(basePrice) {
  const out = [];
  const n = 12 + Math.floor(Math.random() * 6);
  let p = basePrice || 0.01;

  for (let i = 0; i < n; i++) {
    const isBuy = Math.random() > 0.45;
    const drift = (Math.random() - 0.5) * 0.002; // small drift
    p = Math.max(0.000001, p * (1 + drift + (isBuy ? 0.001 : -0.001)));
    out.push({
      side: isBuy ? "buy" : "sell",
      price: Number(p.toFixed(6)),
      amount: Number((Math.random() * 5000 + 500).toFixed(0)), // “token” amount
      ts: now() - i * 25_000, // spread ~25s
      wallet: "",
      tx: "",
    });
  }

  return out;
}

app.get("/trades", async (_req, res) => {
  try {
    // pull a price to anchor the simulator if needed
    let price = 0.0;
    try {
      const pr = await fetch(`https://lite-api.jup.ag/price/v3?ids=${TOKEN_MINT}`);
      const pj = await pr.json();
      price = pj?.[TOKEN_MINT]?.usdPrice ?? 0;
    } catch {}

    try {
      const trades = await fetchBirdeyeTrades(TOKEN_MINT);
      return res.json({ ok: true, mint: TOKEN_MINT, source: "birdeye", trades, ts: now() });
    } catch (e) {
      console.warn("Birdeye trades failed, using simulator:", e.message);
      const trades = simulateTrades(price);
      return res.json({ ok: true, mint: TOKEN_MINT, source: "sim", trades, ts: now() });
    }
  } catch (err) {
    console.error("Trades endpoint error:", err);
    res.status(200).json({ ok: false, mint: TOKEN_MINT, trades: [], ts: now() });
  }
});

// ---------------------------------------------------------------------
app.get("/", (_req, res) => {
  res.type("text").send("Organism backend: /health (price), /trades (buys/sells).");
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on :${PORT}`);
});
