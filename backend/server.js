import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const TOKEN_MINT = process.env.TOKEN_MINT || "7W4geAJy7huXPESMMBaW8Zi14MbhVN9uvt6BJ2SEpAV"; 
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || "3ca3e0f00c7147e593ef54bc25e94700";

// cache
let lastPrice = { ts: 0, price: 0 };
let lastTrades = { ts: 0, trades: [] };
const CACHE_MS = 5000;

async function fetchPrice() {
  const url = `https://public-api.birdeye.so/defi/price?address=${TOKEN_MINT}`;
  const res = await fetch(url, {
    headers: { "x-chain": "solana", "X-API-KEY": BIRDEYE_API_KEY }
  });
  const j = await res.json();
  if (!j?.data?.value) throw new Error("No price data");
  return { ts: Date.now(), price: j.data.value };
}

async function fetchTrades() {
  const url = `https://public-api.birdeye.so/defi/txs/token?address=${TOKEN_MINT}&limit=10`;
  const res = await fetch(url, {
    headers: { "x-chain": "solana", "X-API-KEY": BIRDEYE_API_KEY }
  });
  const j = await res.json();
  const trades = (j?.data?.items || []).map(t => ({
    time: new Date(t.blockUnixTime * 1000).toISOString(),
    type: t.txType === "buy" ? "Feed" : "Starve",
    valueUsd: t.amountInUsd?.toFixed(2) || 0,
    priceUsd: t.priceUsd?.toFixed(6) || 0
  }));
  return { ts: Date.now(), trades };
}

// endpoints
app.get("/health", async (_, res) => {
  try {
    if (Date.now() - lastPrice.ts > CACHE_MS) lastPrice = await fetchPrice();
    res.json({ status: "alive", price: lastPrice.price, timestamp: lastPrice.ts });
  } catch (e) {
    res.json({ status: "error", price: 0, note: e.message });
  }
});

app.get("/trades", async (_, res) => {
  try {
    if (Date.now() - lastTrades.ts > CACHE_MS) lastTrades = await fetchTrades();
    res.json(lastTrades.trades);
  } catch (e) {
    res.json([]);
  }
});

app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
