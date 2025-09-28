// backend/server.js — Jupiter-only with diagnostics & retries
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const TOKEN_MINT = process.env.TOKEN_MINT || "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Small cache to avoid hammering
const CACHE_MS = Number(process.env.CACHE_MS || 5000);
let last = { ts: 0, price: 0 };

const JUP_URL = (ids) => `https://price.jup.ag/v6/price?ids=${encodeURIComponent(ids)}`;

async function jupPriceOnce(mint) {
  const r = await fetch(JUP_URL(mint), { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const p = j?.data?.[mint]?.price;
  if (typeof p !== "number") throw new Error("No price in Jupiter response");
  return { price: p, raw: j };
}

// simple retry helper
async function withRetries(fn, tries = 3, delayMs = 400) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } 
    catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delayMs)); }
  }
  throw lastErr;
}

app.get("/", (_req, res) => {
  res
    .type("text")
    .send(`THE ORGANISM API (Jupiter-only)
Endpoints:
- /health        -> status + price
- /debug/jupiter -> diagnostic (checks SOL then your mint)
TOKEN_MINT=${TOKEN_MINT}`);
});

// Diagnostic: check DNS/network and indexing
app.get("/debug/jupiter", async (_req, res) => {
  const out = { ok: false, steps: [] };
  try {
    // Step 1: can we reach Jupiter at all? (SOL is always indexed)
    try {
      const sol = await withRetries(() => jupPriceOnce("SOL"));
      out.steps.push({ step: "SOL fetch", ok: true, price: sol.price });
    } catch (e) {
      out.steps.push({ step: "SOL fetch", ok: false, error: String(e) });
      return res.status(200).json({ ok: false, note: "DNS/network or Jupiter down", ...out });
    }

    // Step 2: fetch your token
    try {
      const tok = await withRetries(() => jupPriceOnce(TOKEN_MINT));
      out.steps.push({ step: "MINT fetch", ok: true, price: tok.price });
      out.ok = true;
      return res.json(out);
    } catch (e) {
      out.steps.push({ step: "MINT fetch", ok: false, error: String(e) });
      return res.status(200).json({ ok: false, note: "Mint not indexed or other error", ...out });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, fatal: String(e), ...out });
  }
});

// Health endpoint used by the site
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
      hint: "Open /debug/jupiter for diagnostics.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend (Jupiter-only, diagnostics) on :${PORT} | TOKEN_MINT=${TOKEN_MINT}`);
});
