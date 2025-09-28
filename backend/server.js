import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// Health endpoint hooked to your test token
app.get("/health", async (_req, res) => {
  try {
    const url = "https://public-api.birdeye.so/public/price?address=7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";
    const response = await fetch(url, {
      headers: { "x-chain": "solana" }
    });
    const data = await response.json();
    const price = data?.data?.value ?? 0;

    res.json({
      status: "alive",
      price,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch price",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
