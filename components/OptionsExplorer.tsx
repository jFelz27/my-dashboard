import { useState, useMemo, useEffect } from 'react';
import { OptionData, Ticker } from '../types';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { buildOptionTicker, fetchOptionAggregates } from '../services/dataService';

interface OptionsExplorerProps {
  ticker: Ticker;
  expirations: string[];
  strikes: number[];
  optionsData: Record<string, OptionData[]>;
}

export function OptionsExplorer({ ticker, expirations, strikes, optionsData }: OptionsExplorerProps) {
  const [exp, setExp] = useState(expirations[0]);
  const [strike, setStrike] = useState(strikes[0]);
  const [type, setType] = useState<'C' | 'P'>('C');
  const [realData, setRealData] = useState<Record<string, OptionData[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRealOptionData() {
      const key = `${exp}-${strike}-${type}`;
      if (realData[key]) return; // Already cached

      setLoading(true);
      const optionTicker = buildOptionTicker(ticker, exp, strike, type);
      const aggregates = await fetchOptionAggregates(ticker, optionTicker);
      
      if (aggregates.length > 0) {
        setRealData(prev => ({ ...prev, [key]: aggregates }));
      }
      setLoading(false);
    }

    loadRealOptionData();
  }, [ticker, exp, strike, type]);

  const selectedData = useMemo(() => {
    const key = `${exp}-${strike}-${type}`;
    // Prefer real data, fallback to mock if real data fetch returned nothing and we have mock
    return realData[key] || optionsData[key] || [];
  }, [exp, strike, type, realData, optionsData]);

  return (
    <div className="dashboard-card flex flex-col">
      <div className="p-4 border-b border-[#2A2B2F] flex flex-wrap gap-4 items-center bg-[#1C1D21]">
        <div className="flex flex-col gap-1">
          <label className="data-label">Expiration</label>
          <div className="relative">
            <select 
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              className="bg-[#2A2B2F] text-xs font-mono px-3 py-1.5 rounded appearance-none pr-8 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500"
            >
              {expirations.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="data-label">Strike</label>
          <div className="relative">
            <select 
              value={strike}
              onChange={(e) => setStrike(Number(e.target.value))}
              className="bg-[#2A2B2F] text-xs font-mono px-3 py-1.5 rounded appearance-none pr-8 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500"
            >
              {strikes.map(s => <option key={s} value={s}>{s.toFixed(2)}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="data-label">Option Type</label>
          <div className="flex bg-[#2A2B2F] rounded p-0.5">
            <button 
              onClick={() => setType('C')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${type === 'C' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              CALL
            </button>
            <button 
              onClick={() => setType('P')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${type === 'P' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              PUT
            </button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
          <span className="text-[10px] font-mono text-gray-500 uppercase">
            {realData[`${exp}-${strike}-${type}`] ? 'Real Data Loaded' : loading ? 'Fetching...' : 'Simulated Data'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[10px]">
          <thead className="bg-[#1C1D21] border-b border-[#2A2B2F] sticky top-0">
            <tr>
              <th className="px-4 py-3 text-gray-400 font-medium">DATE</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">PREM OPEN</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">PREM CLOSE</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">O.I.</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">VOLUME</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">IV OPEN</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">IV CLOSE</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">GAMMA</th>
              <th className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">DELTA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2B2F]">
            {selectedData.slice().reverse().map((day) => (
              <tr key={day.date} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2 text-gray-300">{day.date}</td>
                <td className="px-4 py-2">${day.premiumOpen.toFixed(2)}</td>
                <td className="px-4 py-2">${day.premiumClose.toFixed(2)}</td>
                <td className="px-4 py-2">{day.openInterest.toLocaleString()}</td>
                <td className="px-4 py-2">{day.volume.toLocaleString()}</td>
                <td className="px-4 py-2">{(day.ivOpen * 100).toFixed(1)}%</td>
                <td className="px-4 py-2">{(day.ivClose * 100).toFixed(1)}%</td>
                <td className="px-4 py-2">{day.gamma.toFixed(4)}</td>
                <td className={`px-4 py-2 ${day.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {day.delta.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
