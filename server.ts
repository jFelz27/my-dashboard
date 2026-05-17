import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

export default app;

// Health Check for Deployment Verification
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    deployment: "Vercel/Production",
    time: new Date().toISOString(),
    keys: {
      polygon: !!process.env.POLYGON_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

// Diagnostic Logs (Helps verify API keys in Vercel/Cloud Run logs)
console.log("--- Server Boot Sequence ---");
console.log("POLYGON_API_KEY configured:", !!process.env.POLYGON_API_KEY);
console.log("GEMINI_API_KEY configured:", !!process.env.GEMINI_API_KEY);
console.log("MARKETDATA_API_KEY configured:", !!process.env.MARKETDATA_API_KEY);
console.log("----------------------------");

// In-memory cache for sentiment analysis
interface CacheEntry {
  summary: string;
  expiry: number;
}
const sentimentCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Rate limiter: 10 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, 
  message: { error: "Too many requests", message: "10 requests per minute limit reached." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Proxy for Polygon History
app.get("/api/market/history/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const apiKey = process.env.POLYGON_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "POLYGON_API_KEY not configured" });
  }

  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Proxy for Polygon Latest Snapshot
app.get("/api/market/latest/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const apiKey = process.env.POLYGON_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "POLYGON_API_KEY not configured" });
  }

  try {
    const response = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// Proxy for Polygon Options Metadata
app.get("/api/market/options-metadata/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const apiKey = process.env.POLYGON_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "POLYGON_API_KEY not configured" });
  }

  try {
    const response = await fetch(
      `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=1000&apiKey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch options metadata" });
  }
});

// Proxy for Options Aggregates (Flow)
app.get("/api/market/options-flow/:underlying/:optionTicker", async (req, res) => {
  const { underlying, optionTicker } = req.params;
  const polygonKey = process.env.POLYGON_API_KEY;
  const marketDataKey = process.env.MARKETDATA_API_KEY;

  try {
    // Try MarketData.app first if configured
    if (marketDataKey && marketDataKey.length > 5) {
      const resp = await fetch(`https://api.marketdata.app/v1/options/candles/daily/${optionTicker}/?token=${marketDataKey}`);
      const data = await resp.json();
      if (data.s === 'ok') return res.json({ source: 'marketdata', data });
    }

    // Fallback to Polygon
    if (polygonKey && polygonKey.length > 5) {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const [aggResp, snapResp] = await Promise.all([
        fetch(`https://api.polygon.io/v2/aggs/ticker/${optionTicker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${polygonKey}`),
        fetch(`https://api.polygon.io/v3/snapshot/options/${underlying}/${optionTicker}?apiKey=${polygonKey}`)
      ]);

      const aggData = await aggResp.json();
      const snapData = await snapResp.json();
      return res.json({ source: 'polygon', aggData, snapData });
    }

    res.status(404).json({ error: "No API keys configured for options flow" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch options flow" });
  }
});

// API route for Sentiment Analysis using Gemini
app.post("/api/sentiment", apiLimiter, async (req, res) => {
  const { ticker } = req.body;
  
  if (!ticker) {
    return res.status(400).json({ error: "Ticker is required" });
  }

  // Check Cache First
  const now = Date.now();
  const cached = sentimentCache.get(ticker);
  if (cached && cached.expiry > now) {
    console.log(`[Cache Hit] Serving cached sentiment for ${ticker}`);
    return res.json({ summary: cached.summary, cached: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
  }

  try {
    const genAI = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    
    console.log(`[Cache Miss] Fetching new sentiment for ${ticker} from Gemini`);
    const prompt = `Provide a realistic 4-5 sentence summary of current investor sentiment for the stock $${ticker} based on recent market trends. Focus on AI data center infrastructure trends, GPU capacity, and power availability. Format as a single paragraph. No markdown formatting, just plain text.`;
    
    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    const summary = result.text;
    
    // Store in cache
    sentimentCache.set(ticker, {
      summary,
      expiry: now + CACHE_DURATION
    });
    
    res.json({ summary, cached: false });
  } catch (error: any) {
    console.error("Gemini API Error:", error.message || error);
    
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ 
        error: "Quota exceeded", 
        message: "Gemini API quota reached. Using fallback summary." 
      });
    }
    
    res.status(500).json({ error: "Failed to fetch sentiment" });
  }
});

async function startServer() {
  // Only start the listener if we are running the script directly (not via Vercel)
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
