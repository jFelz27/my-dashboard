import { Ticker, StockStats, DailyData, OptionData } from '../types';

const TICKERS_INFO: Record<Ticker, { name: string; basePrice: number; deployed: number; pipeline: number; shares: number }> = {
  IREN: { name: 'Iris Energy', basePrice: 8.5, deployed: 0.8, pipeline: 2.2, shares: 156000000 },
  CIFR: { name: 'Cipher Mining', basePrice: 4.2, deployed: 0.6, pipeline: 1.5, shares: 310000000 },
  NBIS: { name: 'Nebius Group', basePrice: 18.0, deployed: 0.3, pipeline: 1.2, shares: 198000000 },
  CRWV: { name: 'Coreweave (Proxy)', basePrice: 45.0, deployed: 1.2, pipeline: 4.0, shares: 1000000000 },
  SLNH: { name: 'Soluna Holdings', basePrice: 2.1, deployed: 0.1, pipeline: 0.5, shares: 42000000 },
  DGXX: { name: 'DigitalX', basePrice: 3.5, deployed: 0.05, pipeline: 0.2, shares: 18000000 },
  GREE: { name: 'Greenidge Generation', basePrice: 1.8, deployed: 0.2, pipeline: 0.4, shares: 15000000 },
  APLD: { name: 'Applied Digital', basePrice: 6.5, deployed: 0.9, pipeline: 3.5, shares: 125000000 },
};

const POLYGON_API_KEY = import.meta.env.VITE_POLYGON_API_KEY;
const MARKETDATA_API_KEY = import.meta.env.VITE_MARKETDATA_API_KEY;

async function fetchRealHistory(ticker: string): Promise<DailyData[] | null> {
  if (!POLYGON_API_KEY || POLYGON_API_KEY.length < 5) return null;
  
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${POLYGON_API_KEY}`
    );
    
    if (response.status === 429) {
      console.warn('Polygon API Rate Limit hit (history)');
      return null;
    }

    const data = await response.json();
    
    if (data.results) {
      return data.results.map((r: any) => ({
        date: new Date(r.t).toISOString().split('T')[0],
        price: r.c,
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v,
        institutionalFlow: (Math.random() - 0.45) * 5000000,
        putCallRatio: 0.5 + Math.random() * 1.5,
      }));
    }
  } catch (e) {
    console.error('Polygon History Fetch Error:', e);
  }
  return null;
}

async function fetchRealLatest(ticker: string): Promise<any | null> {
  if (!POLYGON_API_KEY || POLYGON_API_KEY.length < 5) return null;
  try {
    const response = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`
    );

    if (response.status === 429) {
      console.warn('Polygon API Rate Limit hit (latest)');
      return null;
    }

    const data = await response.json();
    if (data.ticker) {
      return data.ticker;
    }
  } catch (e) {
    console.error('Polygon Latest Fetch Error:', e);
  }
  return null;
}

function generateHistory(basePrice: number, shares: number): DailyData[] {
  const history: DailyData[] = [];
  let currentPrice = basePrice;
  const now = new Date();

  // Generate 730 days (2 years) to support 200-day SMA across custom ranges
  for (let i = 729; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const volatility = basePrice * 0.03;
    const open = currentPrice + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.48) * volatility; // Slight upward bias
    const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
    
    currentPrice = close;
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: close,
      open,
      high,
      low,
      close,
      volume: Math.floor(shares * 0.01 * (0.5 + Math.random())),
      institutionalFlow: (Math.random() - 0.45) * 5000000, 
      putCallRatio: 0.5 + Math.random() * 1.5,
    });
  }
  return history;
}

function generateOptionsData(basePrice: number, strikes: number[]): Record<string, OptionData[]> {
  const data: Record<string, OptionData[]> = {};
  const expirations = ['2026-06-19', '2026-07-17', '2026-09-18']; 
  const types = ['C', 'P'];

  expirations.forEach(exp => {
    strikes.forEach(strike => {
      types.forEach(type => {
        const key = `${exp}-${strike}-${type}`;
        const days: OptionData[] = [];
        const now = new Date();
        
        for (let i = 90; i >= 0; i--) { // 90 days of history for options
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          
          days.push({
            date: date.toISOString().split('T')[0],
            premiumOpen: basePrice * (0.05 + Math.random() * 0.1),
            premiumClose: basePrice * (0.05 + Math.random() * 0.1),
            openInterest: Math.floor(Math.random() * 5000),
            volume: Math.floor(Math.random() * 1000),
            ivOpen: 0.5 + Math.random() * 0.5,
            ivClose: 0.5 + Math.random() * 0.5,
            gamma: Math.random() * 0.05,
            delta: type === 'C' ? Math.random() : -Math.random(),
          });
        }
        data[key] = days;
      });
    });
  });

  return data;
}

function calculateSMAs(data: DailyData[]) {
  const calculate = (period: number) => {
    return data.map((_, index) => {
      if (index < period - 1) return null;
      const subset = data.slice(index - period + 1, index + 1);
      const sum = subset.reduce((acc, curr) => acc + curr.close, 0);
      return sum / period;
    });
  };

  const sma50 = calculate(50);
  const sma200 = calculate(200);

  return data.map((d, i) => ({
    ...d,
    sma50: sma50[i],
    sma200: sma200[i]
  }));
}

async function fetchRealOptionsMetadata(ticker: string): Promise<{ strikes: number[]; expirations: string[] } | null> {
  if (!POLYGON_API_KEY || POLYGON_API_KEY.length < 5) return null;
  try {
    const response = await fetch(
      `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=1000&apiKey=${POLYGON_API_KEY}`
    );
    
    if (response.status === 429) {
      console.warn('Polygon API Rate Limit hit (metadata)');
      return null;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const strikes = Array.from(new Set(data.results.map((r: any) => r.strike_price)))
        .sort((a: any, b: any) => a - b) as number[];
      const expirations = Array.from(new Set(data.results.map((r: any) => r.expiration_date)))
        .sort() as string[];
      
      return {
        strikes,
        expirations,
      };
    }
  } catch (e) {
    console.error('Polygon Options Metadata Fetch Error:', e);
  }
  return null;
}

export function buildOptionTicker(underlying: string, expiration: string, strike: number, type: 'C' | 'P'): string {
  // Format: O:UNDERLYINGYYMMDD[C/P]SSSSSSSS
  const datePart = expiration.replace(/-/g, '').substring(2); // YYMMDD
  const typePart = type;
  const strikeInt = Math.round(strike * 1000);
  const strikePart = strikeInt.toString().padStart(8, '0');
  return `O:${underlying}${datePart}${typePart}${strikePart}`;
}

export async function fetchOptionAggregates(underlying: string, optionTicker: string): Promise<OptionData[]> {
  // If MarketData.app key is available, use it for historical OI
  if (MARKETDATA_API_KEY && MARKETDATA_API_KEY.length > 5) {
    try {
      const resp = await fetch(
        `https://api.marketdata.app/v1/options/candles/daily/${optionTicker}/?token=${MARKETDATA_API_KEY}`
      );
      const data = await resp.json();
      if (data.s === 'ok') {
        const results: OptionData[] = [];
        for (let i = 0; i < data.t.length; i++) {
          results.push({
            date: new Date(data.t[i] * 1000).toISOString().split('T')[0],
            premiumOpen: data.o[i],
            premiumClose: data.c[i],
            openInterest: data.oi ? data.oi[i] : 0,
            volume: data.v[i],
            ivOpen: 0,
            ivClose: 0,
            gamma: 0,
            delta: 0,
          });
        }
        return results;
      }
    } catch (e) {
      console.error(`MarketData.app Options Fetch Error (${optionTicker}):`, e);
    }
  }

  if (!POLYGON_API_KEY || POLYGON_API_KEY.length < 5) return [];
  
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Parallel fetch: Aggregates (price/volume history) + Snapshot (latest OI/IV/Greeks)
    const [aggResp, snapResp] = await Promise.all([
      fetch(`https://api.polygon.io/v2/aggs/ticker/${optionTicker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${POLYGON_API_KEY}`),
      fetch(`https://api.polygon.io/v3/snapshot/options/${underlying}/${optionTicker}?apiKey=${POLYGON_API_KEY}`)
    ]);

    if (aggResp.status === 429 || snapResp.status === 429) {
      console.warn('Polygon API Rate Limit hit (option flow)');
      return [];
    }

    const aggData = await aggResp.json();
    const snapData = await snapResp.json();
    
    const latestSnapshot = snapData.results;
    
    if (aggData.results) {
      return aggData.results.map((r: any, idx: number) => {
        const isLatest = idx === aggData.results.length - 1;
        return {
          date: new Date(r.t).toISOString().split('T')[0],
          premiumOpen: r.o,
          premiumClose: r.c,
          // Snapshot usually has the most up-to-date OI
          openInterest: isLatest && latestSnapshot ? latestSnapshot.open_interest : 0, 
          volume: r.v,
          ivOpen: isLatest && latestSnapshot ? latestSnapshot.implied_volatility : 0,
          ivClose: isLatest && latestSnapshot ? latestSnapshot.implied_volatility : 0,
          gamma: isLatest && latestSnapshot?.greeks ? latestSnapshot.greeks.gamma : 0,
          delta: isLatest && latestSnapshot?.greeks ? latestSnapshot.greeks.delta : 0,
        };
      });
    }
  } catch (e) {
    console.error(`Polygon Options Aggregates Fetch Error (${optionTicker}):`, e);
  }
  return [];
}

export async function getStockData(ticker: Ticker): Promise<StockStats> {
  const info = TICKERS_INFO[ticker];
  
  // Try real data if key exists
  const [realHistory, realLatest, realOptions] = await Promise.all([
    fetchRealHistory(ticker),
    fetchRealLatest(ticker),
    fetchRealOptionsMetadata(ticker)
  ]);

  const isReal = !!(realHistory && realHistory.length > 0);
  
  if (!isReal) {
    console.info(`Using simulated data for ${ticker}. (Polygon key missing or rate limited)`);
  }

  let history = realHistory || generateHistory(info.basePrice, info.shares);
  history = calculateSMAs(history);
  
  const latest = history[history.length - 1];
  
  const currentPrice = realLatest?.day?.c || latest.price;
  const prevPrice = realLatest?.prevDay?.c || history[history.length - 2].price;
  const percentChange = realLatest?.todaysChangePerc !== undefined 
    ? realLatest.todaysChangePerc 
    : ((currentPrice - prevPrice) / prevPrice) * 100;

  const last30Days = history.slice(-30);
  const avgVolume30Day = last30Days.reduce((acc, curr) => acc + curr.volume, 0) / 30;

  // Final options setup
  const strikes = realOptions?.strikes || (() => {
    const interval = info.basePrice > 50 ? 5 : info.basePrice > 10 ? 2.5 : 1;
    const s: number[] = [];
    const startStrike = Math.floor((info.basePrice * 0.5) / interval) * interval;
    for (let i = 0; i < 15; i++) {
      s.push(startStrike + i * interval);
    }
    return s;
  })();

  const expirations = realOptions?.expirations || ['2026-06-19', '2026-07-17', '2026-09-18', '2026-12-18', '2027-01-15'];

  return {
    ticker,
    name: info.name,
    currentPrice,
    percentChange,
    marketCap: realLatest?.market_cap || (currentPrice * info.shares),
    volume: realLatest?.day?.v || latest.volume,
    avgVolume30Day,
    sentimentScore: 30 + Math.random() * 50,
    deployedGW: info.deployed,
    pipelineGW: info.pipeline,
    history,
    isReal,
    options: {
      expirations,
      strikes,
      data: generateOptionsData(info.basePrice, strikes),
    },
  };
}
