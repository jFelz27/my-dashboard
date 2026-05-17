import { useState, useEffect, useMemo } from 'react';
import { Ticker, StockStats, OptionData } from './types';
import { getStockData } from './services/dataService';
import { GaugeChart } from './components/GaugeChart';
import { SentimentSummary } from './components/SentimentSummary';
import { PriceBox, CapacityStats } from './components/StatBoxes';
import { PriceChart, InstitutionalChart, OptionsRatioChart } from './components/MainCharts';
import { OptionsExplorer } from './components/OptionsExplorer';
import { ChevronDown, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TICKERS: Ticker[] = ['IREN', 'CIFR', 'NBIS', 'CRWV', 'SLNH', 'DGXX', 'GREE', 'APLD'];

const AnimatedLightning = () => (
  <div className="bg-yellow-400/10 p-2 rounded-lg border border-yellow-400/20 flex items-center justify-center overflow-hidden">
    <svg width="24" height="24" viewBox="0 0 24 24" className="relative overflow-visible">
      {/* Glow Effect Layer */}
      <motion.g
        animate={{
          opacity: [0, 0, 1, 1, 0],
          filter: [
            'blur(2px) brightness(1)',
            'blur(4px) brightness(1.5)',
            'blur(2px) brightness(1)'
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          times: [0, 0.25, 0.5, 0.75, 1],
          ease: "easeInOut"
        }}
      >
        <polygon 
          points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" 
          fill="#facc15" 
          className="opacity-40"
        />
      </motion.g>

      {/* Ghost Outline (Always slightly visible) */}
      <polygon 
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" 
        fill="none" 
        stroke="#facc15" 
        strokeWidth="1.5" 
        strokeOpacity="0.2"
        strokeLinejoin="round" 
      />

      {/* Mask for the sweep animation */}
      <defs>
        <mask id="charge-mask">
          <motion.rect
            x="0"
            y="-24"
            width="24"
            height="24"
            fill="white"
            animate={{ 
              y: [-24, -24, 0, 0, 24] 
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              times: [0, 0.25, 0.5, 0.75, 1],
              ease: "linear"
            }}
          />
        </mask>
      </defs>

      {/* Animated Core */}
      <motion.g 
        mask="url(#charge-mask)"
        animate={{
          x: [0, -0.5, 0.5, 0],
        }}
        transition={{
          duration: 0.1,
          repeat: Infinity,
          repeatType: "mirror",
          // Only vibrate when "charged" (between 0.5s and 0.75s of the 2s cycle)
          repeatDelay: 1.75 
        }}
      >
        <polygon 
          points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" 
          fill="#facc15" 
        />
      </motion.g>

      {/* Sharp Border (Always solid) */}
      <polygon 
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" 
        fill="none" 
        stroke="#facc15" 
        strokeWidth="1.5" 
        strokeLinejoin="round" 
      />
    </svg>
  </div>
);

export default function App() {
  const [selectedTicker, setSelectedTicker] = useState<Ticker>('IREN');
  const [data, setData] = useState<StockStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  // Date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    async function loadData(isInitial = false) {
      if (isInitial) setLoading(true);
      const stockData = await getStockData(selectedTicker);
      setData(stockData);
      setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (isInitial) setLoading(false);
    }
    
    loadData(true);

    const interval = setInterval(() => loadData(false), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedTicker]);

  // Derived filtered data
  const filteredHistory = useMemo(() => {
    if (!data) return [];
    return data.history.filter(d => d.date >= startDate && d.date <= endDate);
  }, [data, startDate, endDate]);

  const filteredOptionsData = useMemo(() => {
    if (!data) return {};
    const filtered: Record<string, OptionData[]> = {};
    Object.entries(data.options.data).forEach(([key, values]) => {
      filtered[key] = (values as OptionData[]).filter(v => v.date >= startDate && v.date <= endDate);
    });
    return filtered;
  }, [data, startDate, endDate]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header & Ticker Selection - Sticky */}
      <header className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A2B2F] bg-[#0A0A0B]/90 backdrop-blur-md p-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <AnimatedLightning />
            <div>
              <h1 id="main-dashboard-title" className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-yellow-400 bg-clip-text text-transparent whitespace-nowrap">AI/HPC Infrastructure Buildout Dashboard</h1>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Real-Time Data Center Stock Analytics</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="relative group">
              <select 
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value as Ticker)}
                className="bg-[#151619] border border-[#2A2B2F] text-white font-mono text-xs px-3 py-1.5 rounded-lg appearance-none pr-8 cursor-pointer outline-none focus:border-orange-500 transition-colors shadow-lg"
              >
                {TICKERS.map(t => <option key={t} value={t}>${t}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-orange-500 transition-colors" />
            </div>
          </div>

          <div className="flex flex-col justify-center px-3 h-[32px] bg-[#1C1D21] border border-[#2A2B2F] rounded-lg min-w-[100px]">
            <span className="data-label text-[7px] leading-tight text-gray-500 uppercase">Last Sync</span>
            <span className="font-mono text-[10px] text-orange-500 font-bold leading-tight">{lastUpdate || '--:--:--'}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#1C1D21] border border-[#2A2B2F] rounded-lg px-3 py-1">
            <div className="flex flex-col">
              <span className="data-label text-[7px] leading-tight text-gray-500 uppercase">Start Date</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-[10px] text-gray-300 font-mono outline-none border-none [color-scheme:dark]"
              />
            </div>
            <div className="w-[1px] h-4 bg-[#2A2B2F] mx-1" />
            <div className="flex flex-col">
              <span className="data-label text-[7px] leading-tight text-gray-500 uppercase">End Date</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-[10px] text-gray-300 font-mono outline-none border-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-6 items-center">
          <div className="text-right">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-tight">System Status: <span className="text-blue-400">Nominal</span></p>
            <p className={`text-[10px] font-mono ${data?.isReal ? 'text-green-500' : 'text-orange-500'} uppercase tracking-widest leading-tight`}>
              Data Feed: {data?.isReal ? 'Live (15-min delay)' : 'Simulated'}
            </p>
          </div>
          <div className="hidden lg:block h-8 w-[1px] bg-[#2A2B2F]" />
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] font-mono text-gray-600 uppercase tracking-tighter">Latency: 24ms</span>
            <span className="text-[10px] font-mono text-gray-600 uppercase tracking-tighter">Grid: Stable</span>
          </div>
        </div>
      </header>
      
      <div className="p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <AnimatePresence mode="wait">
        {loading || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="font-mono text-xs text-gray-500 uppercase animate-pulse">Syncing Network Data...</p>
          </div>
        ) : (
          <motion.main 
            key={selectedTicker}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            {/* Top Row: Cards with specific proportions */}
            <div className="grid grid-cols-1 md:grid-cols-24 gap-4">
              <div className="md:col-span-5">
                <PriceBox 
                  ticker={selectedTicker}
                  price={data.currentPrice} 
                  change={data.percentChange} 
                  marketCap={data.marketCap}
                  volume={data.volume}
                  avgVolume={data.avgVolume30Day}
                  isReal={data.isReal}
                />
              </div>
              <div className="md:col-span-4 dashboard-card relative flex items-center justify-center">
                <GaugeChart value={data.sentimentScore} label="Fear & Greed Index" isReal={data.isReal} />
              </div>
              <div className="md:col-span-12">
                <SentimentSummary ticker={selectedTicker} isReal={data.isReal} />
              </div>
              <div className="md:col-span-3">
                <CapacityStats deployed={data.deployedGW} pipeline={data.pipelineGW} isReal={data.isReal} />
              </div>
            </div>

            {/* Middle Section: Price, Flow, and Ratio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Price (Large) + Institutional (Small) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="h-[320px]">
                  <PriceChart 
                    data={data.history} 
                    ticker={selectedTicker} 
                    initialStartDate={startDate}
                    initialEndDate={endDate}
                    isReal={data.isReal}
                  />
                </div>
                <div className="h-[150px]">
                  <InstitutionalChart data={filteredHistory} ticker={selectedTicker} isReal={data.isReal} />
                </div>
              </div>
              
              {/* Right Column: Put/Call Ratio (Full Height) */}
              <div className="lg:col-span-4 h-full">
                <OptionsRatioChart data={filteredHistory} ticker={selectedTicker} isReal={data.isReal} />
              </div>
            </div>

            {/* Bottom Row: Options Explorer */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Options Flow Data</h2>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-[#2A2B2F] to-transparent" />
              </div>
              <OptionsExplorer 
                ticker={selectedTicker}
                expirations={data.options.expirations}
                strikes={data.options.strikes}
                optionsData={filteredOptionsData}
              />
            </div>
          </motion.main>
        )}
        </AnimatePresence>

        <footer className="mt-auto pt-8 border-t border-[#2A2B2F] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-mono tracking-widest uppercase opacity-50 text-white">Custom Window Date Range Analysis</p>
          
          <a 
            href="https://x.com/jfelz27" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 group transition-all opacity-50 hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3 h-3 fill-white group-hover:fill-[#facc15] transition-colors">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-[10px] font-mono italic tracking-tight text-white group-hover:text-[#facc15] transition-colors">
              @jFelz27 May 2026
            </span>
          </a>

          <div className="flex gap-4 opacity-50">
            <span className="text-[10px] font-mono uppercase text-white">Status: Connected</span>
            <span className="text-[10px] font-mono uppercase text-white">Region: Global</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
