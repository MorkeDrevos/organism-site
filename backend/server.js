// backend/server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;

// Replace this with the coin you want to test (BULL, NYX, etc.)
const TOKEN_MINT = "So11111111111111111111111111111111111111112"; // Example: SOL

// Simple endpoint to get token data from Birdeye
app.get("/health", async (req, res) => {
  try {
    const url = `https://public-api.birdeye.so/public/price?address=${TOKEN_MINT}`;
    const response = await fetch(url, {
      headers: { "x-chain": "solana" }
    });
    const data = await response.json();
    res.json({
      status: "alive",
      price: data.data?.value || 0,
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch token data", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
