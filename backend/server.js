import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// SIMPLE /health ENDPOINT
// Replace TOKEN_MINT + Birdeye call later if you want live price,
// for now this returns a placeholder price 0 (and still proves the roundtrip).
app.get("/health", async (_req, res) => {
  try {
    // Example: you could fetch a price here and return it
    // const r = await fetch("https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112", { headers: { "x-chain": "solana" }});
    // const j = await r.json();
    // const price = j?.data?.value ?? 0;

    res.json({
      status: "alive",
      price: 0,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch", details: err.message });
  }
});

// Optional root message
app.get("/", (_req, res) => res.type("text").send("THE ORGANISM API — use /health"));

app.listen(PORT, () => console.log(`✅ Backend running on :${PORT}`));
