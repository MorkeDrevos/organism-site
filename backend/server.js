import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// Replace this with any Solana mint address you want
const TOKEN_MINT = "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Health endpoint that your frontend calls
app.get("/health", async (_req, res) => {
  try {
    const url = `https://public-api.birdeye.so/public/price?address=${TOKEN_MINT}`;
    const response = await fetch(url, {
      headers: {
        "x-chain": "solana",
        accept: "application/json"
      }
    });
    const j = await response.json();
    const price = j?.data?.value ?? 0;

    res.json({
      status: "alive",
      price,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Birdeye fetch error:", err);
    res.status(200).json({
      status: "alive",
      price: 0,
      timestamp: Date.now(),
      note: "Birdeye fetch error"
    });
  }
});

// Root for sanity check
app.get("/", (_req, res) => {
  res.type("text").send("The Organism backend is alive. Use /health.");
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on :${PORT}`);
});
