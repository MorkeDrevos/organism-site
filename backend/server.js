// backend/server.js — Jupiter-only, with diagnostics & retries
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const TOKEN_MINT =
  process.env.TOKEN_MINT ||
  "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Tiny cache so we don't hammer Jupiter
const CACHE_MS = Number(process.env.CACHE_MS || 5000);
let last = { ts: 0, price: 0 };

const jupUrl = (ids) => `https://price.jup.ag/v6/price?ids=${encodeURIComponent(ids)}`;

async function jupPriceOnce(id) {
  const r = await fetch(jupUrl(id), { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const p = j?.data?.[id]?.price;
  if (typeof p !== "number") throw new Error("No price in Jupiter response");
  return { price: p, raw: j };
}

async function withRetries(fn, tries = 3, delayMs = 400) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delayMs)); }
  }
  throw lastErr;
}

// Root
app.get("/", (_req, res) => {
  res
    .type("text")
    .send(`THE ORGANISM API (Jupiter-only)
- /health        -> status + price
- /debug/jupiter -> diagnostics (checks SOL then mint)
TOKEN_MINT=${TOKEN_MINT}`);
});

// Diagnostics (like we did for the bot)
app.get("/debug/jupiter", async (_req, res) => {
  const out = { ok: false, steps: [] };

  // Step 1: prove DNS/network by fetching SOL (always indexed)
  try {
    const sol = await withRetries(() => jupPriceOnce("SOL"));
    out.steps.push({ step: "SOL fetch", ok: true, price: sol.price });
  } catch (e) {
    out.steps.push({ step: "SOL fetch", ok: false, error: String(e) });
    return res.status(200).json({ ok: false, note: "DNS/network or Jupiter down", ...out });
  }

  // Step 2: fetch your mint
  try {
    const tok = await withRetries(() => jupPriceOnce(TOKEN_MINT));
    out.steps.push({ step: "MINT fetch", ok: true, price: tok.price });
    out.ok = true;
    return res.json(out);
  } catch (e) {
    out.steps.push({ step: "MINT fetch", ok: false, error: String(e) });
    return res.status(200).json({ ok: false, note: "Mint not indexed or other error", ...out });
  }
});

// Health for the frontend
app.get("/health", async (_req, res) => {
  const now = Date.now();
  if (now - last.ts < CACHE_MS) {
    return res.json({ status: "alive", price: last.price, timestamp: now });
  }
  try {
    const { price } = await withRetries(() => jupPriceOnce(TOKEN_MINT));
    last = { ts: now, price };
    res.json({ status: "alive", price, timestamp: now });
  } catch (err) {
    console.error("Jupiter fetch error:", err?.message || err);
    res.status(200).json({
      status: "alive",
      price: last.price || 0,
      timestamp: now,
      note: "Jupiter fetch error; serving cached/zero price.",
      hint: "Open /debug/jupiter for diagnostics."
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend (Jupiter-only, diagnostics) on :${PORT} | TOKEN_MINT=${TOKEN_MINT}`);
});
