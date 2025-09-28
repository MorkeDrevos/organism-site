// backend/server.js — Jupiter v6 only (fixed)
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// Your test mint (default) — override via Render env var TOKEN_MINT if needed
const TOKEN_MINT =
  process.env.TOKEN_MINT ||
  "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Cache so we don’t spam Jupiter
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

// Root check
app.get("/", (_req, res) => {
  res
    .type("text")
    .send("THE ORGANISM API (Jupiter v6) — use /health. Mint = " + TOKEN_MINT);
});

// Health endpoint
app.get("/health", async (_req, res) => {
  const now = Date.now();

  // Serve cached if fresh
  if (now - last.ts < CACHE_MS) {
    return res.json({ status: "alive", price: last.price, timestamp: now });
  }

  try {
    const price = await fetchJupiterPrice(TOKEN_MINT);
    last = { ts: now, price };
    res.json({ status: "alive", price, timestamp: now });
  } catch (err) {
    console.error("Jupiter fetch error:", err.message);
    res.status(200).json({
      status: "alive",
      price: last.price || 0,
      timestamp: now,
      note: "Jupiter error: " + err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on :${PORT} (Jupiter v6 only)`);
});
