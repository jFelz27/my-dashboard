import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

startServer();
