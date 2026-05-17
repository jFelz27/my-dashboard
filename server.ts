import express, { Request, Response, NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";

const app = express();

// Required for rate limiting behind Vercel proxy
app.set("trust proxy", 1);
app.use(express.json());

// Helper to mask keys for diagnostics
const maskKey = (key?: string) => {
  if (!key) return "MISSING";
  if (key.length < 8) return "TOO_SHORT";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)} (${key.length} chars)`;
};

// --- PROXY ROUTES ---

// Root API debug
app.get("/api", (req, res) => {
  res.json({ message: "Alpha Stock API is online", timestamp: new Date().toISOString() });
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    deployment: "Vercel",
    nodeVersion: process.version,
    keys: {
      polygon: maskKey(process.env.POLYGON_API_KEY),
      gemini: maskKey(process.env.GEMINI_API_KEY),
      marketData: maskKey(process.env.MARKETDATA_API_KEY)
    }
  });
});

// Polygon History Proxy
app.get("/api/market/history/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "POLYGON_API_KEY missing" });

  try {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "History fetch failed" });
  }
});

// Polygon Snapshot Proxy
app.get("/api/market/latest/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "POLYGON_API_KEY missing" });

  try {
    const response = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Snapshot fetch failed" });
  }
});

// Polygon Options Metadata Proxy
app.get("/api/market/options-metadata/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "POLYGON_API_KEY missing" });

  try {
    const response = await fetch(
      `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=1000&apiKey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Metadata fetch failed" });
  }
});

// Options Flow Proxy (Supports MarketData.app and Polygon)
app.get("/api/market/options-flow/:underlying/:optionTicker", async (req, res) => {
  const { underlying, optionTicker } = req.params;
  const polygonKey = process.env.POLYGON_API_KEY;
  const marketDataKey = process.env.MARKETDATA_API_KEY;

  try {
    if (marketDataKey && marketDataKey.length > 5) {
      const resp = await fetch(`https://api.marketdata.app/v1/options/candles/daily/${optionTicker}/?token=${marketDataKey}`);
      const data = await resp.json();
      if (data.s === "ok") return res.json({ source: "marketdata", data });
    }

    if (polygonKey && polygonKey.length > 5) {
      const to = new Date().toISOString().split("T")[0];
      const from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const [aggResp, snapResp] = await Promise.all([
        fetch(`https://api.polygon.io/v2/aggs/ticker/${optionTicker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${polygonKey}`),
        fetch(`https://api.polygon.io/v3/snapshot/options/${underlying}/${optionTicker}?apiKey=${polygonKey}`)
      ]);
      const aggData = await aggResp.json();
      const snapData = await snapResp.json();
      return res.json({ source: "polygon", aggData, snapData });
    }
    res.status(404).json({ error: "No API keys configured" });
  } catch (error) {
    res.status(500).json({ error: "Flow fetch failed" });
  }
});

// Sentiment Analysis Proxy (Gemini)
interface CacheEntry { summary: string; expiry: number; }
const sentimentCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000;

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/sentiment", apiLimiter, async (req: Request, res: Response) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: "Ticker required" });

  const now = Date.now();
  const cached = sentimentCache.get(ticker);
  if (cached && cached.expiry > now) return res.json({ summary: cached.summary, cached: true });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY missing" });

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const prompt = `Provide a realistic 4-5 sentence summary of current investor sentiment for the stock $${ticker} based on recent market trends. Focus on AI data center infrastructure trends, GPU capacity, and power availability. Format as a single paragraph. No markdown.`;
    const result = await genAI.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    const summary = result.text;

    sentimentCache.set(ticker, { summary, expiry: now + CACHE_DURATION });
    res.json({ summary, cached: false });
  } catch (error: any) {
    res.status(500).json({ error: "Sentiment analysis failed" });
  }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Vercel Function Error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

export default app;
