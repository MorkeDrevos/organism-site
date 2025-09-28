// backend/server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const TOKEN_MINT =
  process.env.TOKEN_MINT ||
  "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV"; // default test
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || "";

const PRICE_CACHE_MS = 5_000;   // 5s
const TRADES_CACHE_MS = 6_000;  // 6s

let lastPrice = { ts: 0, price: 0 };
let lastTrades = { ts: 0, mint: "", items: [] };

// ---------- Helpers
function headers() {
  return {
    accept: "application/json",
    "x-chain": "solana",
    ...(BIRDEYE_API_KEY ? { "X-API-KEY": BIRDEYE_API_KEY } : {})
  };
}

async function fetchPriceBirdeye(mint) {
  const url = `https://public-api.birdeye.so/defi/price?address=${mint}`;
  const res = await fetch(url, { headers: headers() });
  const j = await res.json();
  const price = Number(j?.data?.value);
  if (!Number.isFinite(price)) throw new Error("Birdeye price missing");
  return price;
}

async function fetchTradesBirdeye(mint) {
  const url = `https://public-api.birdeye.so/defi/txs/pair?address=${mint}&limit=20`;
  const res = await fetch(url, { headers: headers() });
  const j = await res.json();
  const rows = j?.data?.items || [];
  // Map to UI-friendly shape & order (time, type, valueUsd, priceUsd)
  return rows.map(tx => ({
    time: new Date((tx.blockUnixTime || tx.timestamp) * 1000).toISOString(),
    type: (tx.side || "").toLowerCase() === "buy" ? "Feed" : "Starve",
    valueUsd: Number(tx.valueUsd ?? 0),
    priceUsd: Number(tx.priceUsd ?? 0)
  }));
}

// ---------- Routes
app.get("/", (_req, res) => {
  res
    .type("text")
    .send("THE ORGANISM API — try /health and /trades (optionally ?mint=...).");
});

// health: returns live USD price (cached briefly)
app.get("/health", async (req, res) => {
  const mint = (req.query.mint || TOKEN_MINT).toString();
  const now = Date.now();

  if (now - lastPrice.ts < PRICE_CACHE_MS) {
    return res.json({ status: "alive", price: lastPrice.price, timestamp: now });
  }

  try {
    const price = await fetchPriceBirdeye(mint);
    lastPrice = { ts: now, price };
    return res.json({ status: "alive", price, timestamp: now });
  } catch (err) {
    console.error("Birdeye price error:", err.message);
    return res.status(200).json({
      status: "alive",
      price: lastPrice.price || 0,
      timestamp: now,
      note: "Birdeye price fetch error; served cached/zero."
    });
  }
});

// trades: returns latest 20 trades (Feed/Starve, USD values)
app.get("/trades", async (req, res) => {
  const mint = (req.query.mint || TOKEN_MINT).toString();
  const now = Date.now();

  // serve cache if fresh and same mint
  if (lastTrades.mint === mint && now - lastTrades.ts < TRADES_CACHE_MS) {
    return res.json(lastTrades.items);
  }

  try {
    const items = await fetchTradesBirdeye(mint);
    lastTrades = { ts: now, mint, items };
    return res.json(items);
  } catch (err) {
    console.error("Birdeye trades error:", err.message);
    return res.status(200).json(lastTrades.items || []);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on :${PORT} (mint ${TOKEN_MINT})`);
});
