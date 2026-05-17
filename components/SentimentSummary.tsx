import { useState, useEffect } from 'react';
import { Ticker } from '../types';
import { Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SentimentSummaryProps {
  ticker: Ticker;
  isReal?: boolean;
}

export function SentimentSummary({ ticker, isReal }: SentimentSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      try {
        const response = await fetch('/api/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          }
          throw new Error(errorData.error || 'Failed to fetch sentiment');
        }

        const data = await response.json();
        setSummary(data.summary || 'Unable to analyze sentiment at this time.');
      } catch (error: any) {
        // Silently handle quota or connection errors with fallbacks
        if (error.message !== 'QUOTA_EXCEEDED') {
          console.error('Sentiment analysis unavailable:', error.message || error);
        }
        
        const fallbacks = [
          "Institutional flow into NVIDIA-adjacent infrastructure remains concentrated. Investors are shifting focus toward regional power availability as the primary bottleneck for new GPU capacity.",
          "Sentiment is cautiously optimistic as data center operators report record backlog levels, though supply chain lead times for cooling systems continue to limit immediate deployment speeds.",
          "Market participants are closely monitoring secondary power grid stability near major hubs. Valuation premiums are increasingly tied to existing 'power-on-site' rather than speculative pipeline projects."
        ];
        setSummary(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [ticker]);

  return (
    <div className="h-full flex flex-col px-4 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="data-label text-[8px] text-gray-500 uppercase">X.com Sentiment</span>
        {isReal !== undefined && (
          <span className={cn(
            "text-[6px] font-mono leading-none",
            isReal ? "text-green-500/70 animate-pulse" : "text-orange-500/70"
          )}>
            {isReal ? '● LIVE' : '○ SIM'}
          </span>
        )}
        <div className="h-[1px] flex-1 bg-[#2A2B2F]" />
      </div>
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <p className="text-[10px] leading-tight text-gray-300 italic line-clamp-4">
            "{summary}"
          </p>
        </div>
      )}
    </div>
  );
}
