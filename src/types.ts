export type Ticker = 'IREN' | 'CIFR' | 'NBIS' | 'CRWV' | 'SLNH' | 'DGXX' | 'GREE' | 'APLD';

export interface DailyData {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  institutionalFlow: number; // Positive = accumulation, Negative = distribution
  putCallRatio: number;
  sma50?: number | null;
  sma200?: number | null;
}

export interface OptionData {
  date: string;
  premiumOpen: number;
  premiumClose: number;
  openInterest: number;
  volume: number;
  ivOpen: number;
  ivClose: number;
  gamma: number;
  delta: number;
}

export interface StockStats {
  ticker: Ticker;
  name: string;
  currentPrice: number;
  percentChange: number;
  marketCap: number;
  volume: number;
  avgVolume30Day: number;
  sentimentScore: number; // 0-100
  deployedGW: number;
  pipelineGW: number;
  history: DailyData[];
  isReal: boolean;
  options: {
    expirations: string[];
    strikes: number[];
    data: Record<string, OptionData[]>; // key like "2024-06-21-150-C"
  };
}
