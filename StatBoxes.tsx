import React from 'react';
import { Ticker } from '../types';
import { TrendingUp, TrendingDown, Server, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatBoxProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
  isReal?: boolean;
}

function StatBox({ label, value, subValue, trend, icon, className, isReal }: StatBoxProps) {
  return (
    <div className={cn("dashboard-card px-3 py-2 h-full flex flex-col justify-between", className)}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="data-label text-[9px]">{label}</span>
          {isReal !== undefined && (
            <span className={cn(
              "text-[6px] font-mono leading-none mt-0.5",
              isReal ? "text-green-500/70 animate-pulse" : "text-orange-500/70"
            )}>
              {isReal ? '● LIVE' : '○ SIM'}
            </span>
          )}
        </div>
        {icon && <div className="text-gray-500 opacity-50">{icon}</div>}
      </div>
      <div className="flex flex-col">
        <span className="data-value text-xl leading-none">{value}</span>
        {subValue && (
          <span className={cn(
            "text-[9px] font-mono font-medium mt-1 uppercase",
            trend === 'up' ? "text-green-500" : trend === 'down' ? "text-red-500" : "text-gray-400"
          )}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

function formatNumber(num: number) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toLocaleString();
}

const COMPANY_DOMAINS: Record<string, string> = {
  IREN: 'iren.energy',
  CIFR: 'ciphermining.com',
  NBIS: 'northerndata.de',
  CRWV: 'coreweave.com',
  SLNH: 'soluna.io',
  DGXX: 'digitalbridge.com',
  GREE: 'greenidge.com',
  APLD: 'applieddigital.com',
};

const CUSTOM_LOGOS: Record<string, string> = {
  IREN: 'https://companieslogo.com/img/orig/IREN-77085a86.png?t=1716386866',
};

const IRENLogoFallback = ({ className }: { className?: string }) => (
  <div 
    id="iren-logo-fallback"
    className={cn("bg-[#0b344f] flex items-center justify-center relative overflow-hidden rounded-md border border-white/5", className)}
    title="IREN Logo"
  >
     <svg viewBox="0 0 100 100" className="w-[85%] h-[85%]">
       {/* 
         The 6-sided bar:
         M 15 45 (Top-left notch start)
         L 15 75 (Left vertical edge)
         L 35 75 (Bottom notch return)
         L 85 55 (Slanted bottom edge)
         L 85 25 (Right vertical edge)
         L 65 25 (Top notch return)
         Z (Slanted top edge back to start)
       */}
       <path 
         d="M15 45 L15 75 L35 75 L85 55 L85 25 L65 25 Z" 
         fill="#71da80" 
       />
       {/* Stepped letters to match the bar's slant */}
       <text x="18" y="66" fill="#0b344f" fontSize="14" fontWeight="900" style={{fontFamily: 'Inter, system-ui, sans-serif'}}>I</text>
       <text x="32" y="61" fill="#0b344f" fontSize="14" fontWeight="900" style={{fontFamily: 'Inter, system-ui, sans-serif'}}>R</text>
       <text x="48" y="56" fill="#0b344f" fontSize="14" fontWeight="900" style={{fontFamily: 'Inter, system-ui, sans-serif'}}>E</text>
       <text x="64" y="51" fill="#0b344f" fontSize="14" fontWeight="900" style={{fontFamily: 'Inter, system-ui, sans-serif'}}>N</text>
     </svg>
  </div>
);

export function PriceBox({ 
  ticker,
  price, 
  change, 
  marketCap, 
  volume, 
  avgVolume,
  isReal
}: { 
  ticker: Ticker;
  price: number; 
  change: number; 
  marketCap: number; 
  volume: number; 
  avgVolume: number;
  isReal?: boolean;
}) {
  const domain = COMPANY_DOMAINS[ticker];
  
  const getInitialSrc = (t: Ticker) => {
    // Force CSS fallback for IREN to avoid generic smiley faces
    if (t === 'IREN') return null;
    if (CUSTOM_LOGOS[t]) return CUSTOM_LOGOS[t];
    const d = COMPANY_DOMAINS[t];
    if (!d) return `https://api.dicebear.com/7.x/initials/svg?seed=${t}&backgroundColor=2A2B2F&fontFamily=monospace`;
    return `https://logo.clearbit.com/${d}`;
  };

  // State for image source with improved fallback sequence
  const [imgSrc, setImgSrc] = React.useState<string | null>(getInitialSrc(ticker));
  const [showIRENFallback, setShowIRENFallback] = React.useState(ticker === 'IREN');

  React.useEffect(() => {
    const initial = getInitialSrc(ticker);
    setImgSrc(initial);
    setShowIRENFallback(ticker === 'IREN');
  }, [ticker]);

  const handleImageError = () => {
    const currentDomain = COMPANY_DOMAINS[ticker];
    
    // Detailed fallback sequence for IREN to avoid generic icons
    if (ticker === 'IREN') {
      if (imgSrc?.includes('companieslogo')) {
        // Try twitter/unavatar next
        setImgSrc('https://unavatar.io/twitter/IREN_Energy');
        return;
      }
      if (imgSrc?.includes('unavatar')) {
        // Try clearbit next with old domain
        setImgSrc('https://logo.clearbit.com/irisenergy.co');
        return;
      }
      if (imgSrc?.includes('clearbit') || imgSrc?.includes('irisenergy.co') || imgSrc?.includes('favicons')) {
        // Final fallback to the CSS component
        setShowIRENFallback(true);
        return;
      }
      // Catch-all for IREN
      setShowIRENFallback(true);
      return;
    }

    if (!currentDomain) {
      if (!imgSrc?.includes('dicebear')) {
         setImgSrc(`https://api.dicebear.com/7.x/initials/svg?seed=${ticker}&backgroundColor=2A2B2F&fontFamily=monospace`);
      }
      return;
    }

    if (imgSrc?.includes('clearbit')) {
      setImgSrc(`https://www.google.com/s2/favicons?domain=${currentDomain}&sz=128`);
    } else if (imgSrc?.includes('favicons')) {
      setImgSrc(`https://unavatar.io/${currentDomain}`);
    } else if (!imgSrc?.includes('dicebear')) {
      setImgSrc(`https://api.dicebear.com/7.x/initials/svg?seed=${ticker}&backgroundColor=2A2B2F&fontFamily=monospace`);
    }
  };
  
  return (
    <div className="dashboard-card px-3 py-2 h-full flex flex-col justify-between border-l-4 border-l-green-500 overflow-hidden @container">
      <div className="flex items-center justify-between gap-2 flex-1 min-h-0">
        <div className="h-full max-h-24 aspect-square flex-shrink-0 flex items-center justify-center">
          {ticker === 'IREN' && showIRENFallback ? (
            <IRENLogoFallback className="w-full h-full" />
          ) : imgSrc ? (
            <img 
              src={imgSrc} 
              alt={`${ticker} logo`}
              className="max-h-full max-w-full object-contain opacity-100 transition-all duration-300"
              onError={handleImageError}
              referrerPolicy="no-referrer"
            />
          ) : ticker === 'IREN' ? (
            <IRENLogoFallback className="w-full h-full" />
          ) : null}
        </div>
        <div className="flex flex-col items-end text-right justify-center h-full min-w-0">
          <div className="flex items-center gap-2 justify-end">
            {isReal !== undefined && (
              <span className={cn(
                "text-[7px] font-mono px-1 rounded border",
                isReal ? "text-green-500 border-green-500/30 bg-green-500/5 animate-pulse" : "text-orange-500 border-orange-500/30 bg-orange-500/5"
              )}>
                {isReal ? 'LIVE' : 'SIM'}
              </span>
            )}
            <span className="text-[clamp(0.6rem,4cqw,0.8rem)] font-black text-gray-500 tracking-widest opacity-70 truncate">$ {ticker}</span>
          </div>
          <span className="data-value text-[clamp(1.2rem,14cqw,2rem)] leading-none font-bold tabular-nums whitespace-nowrap">${price.toFixed(2)}</span>
          <span className={cn(
            "text-[clamp(0.6rem,4cqw,0.75rem)] font-mono font-medium mt-2 uppercase flex items-center gap-1 whitespace-nowrap",
            change >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="flex gap-4 mt-2 pt-2 border-t border-[#2A2B2F] overflow-hidden shrink-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[7px] text-gray-500 uppercase font-mono tracking-tighter">MCap</span>
          <span className="text-[9px] font-mono text-gray-300 font-bold whitespace-nowrap">{formatNumber(marketCap)}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[7px] text-gray-500 uppercase font-mono tracking-tighter">Vol</span>
          <span className="text-[9px] font-mono text-gray-300 font-bold whitespace-nowrap">{formatNumber(volume)}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[7px] text-gray-500 uppercase font-mono tracking-tighter">Avg30D</span>
          <span className="text-[9px] font-mono text-gray-300 font-bold whitespace-nowrap">{formatNumber(avgVolume)}</span>
        </div>
      </div>
    </div>
  );
}

export function CapacityStats({ deployed, pipeline, isReal }: { deployed: number; pipeline: number; isReal?: boolean }) {
  const total = (deployed + pipeline).toFixed(1);
  return (
    <StatBox 
      label="Capacity (GW):"
      value={`${deployed} / ${total}`}
      subValue="Deployed / Pipeline"
      trend="neutral"
      icon={<Zap className="w-4 h-4 text-orange-400" />}
      isReal={isReal}
    />
  );
}
