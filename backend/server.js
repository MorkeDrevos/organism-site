import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// Test token (replace with yours or use query param later)
const TOKEN_MINT = "7W4geAJyy7hxuPXESMMBaW8Zi4MbhVN9uvt6BJ2SEPAV";

// Health endpoint → pulls live price from Jupiter v3
app.get("/health", async (_req, res) => {
  try {
    const url = `https://lite-api.jup.ag/price/v3?ids=${TOKEN_MINT}`;
    const response = await fetch(url, {
      headers: { accept: "application/json" }
    });

    const j = await response.json();
    const price = j?.[TOKEN_MINT]?.usdPrice ?? 0;

    res.json({
      status: "alive",
      price,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Jupiter fetch error:", err);
    res.status(200).json({
      status: "alive",
      price: 0,
      timestamp: Date.now(),
      note: "Jupiter fetch error"
    });
  }
});

// Root endpoint
app.get("/", (_req, res) => {
  res.type("text").send("Organism backend (Jupiter v3). Use /health.");
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
