import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Cell,
  Scatter,
  ReferenceLine,
  Label
} from 'recharts';
import { Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { DailyData } from '../types';

interface ChartProps {
  data: DailyData[];
  ticker: string;
  initialStartDate?: string;
  initialEndDate?: string;
  isReal?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1C1D21] border border-[#2A2B2F] p-2 rounded shadow-xl font-mono text-[10px]">
        <p className="text-gray-400 mb-1">{label || 'Future'}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? 
              (p.name.includes('Flow') ? `$${(p.value / 1e6).toFixed(2)}M` : p.value.toFixed(2)) 
              : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Candlestick = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || !payload.openClose) return null;
  const { open, close, high, low } = payload;
  const isUp = close > open;
  const color = isUp ? '#10B981' : '#EF4444';

  const absHeight = Math.abs(height);
  const priceDiff = Math.abs(close - open);
  const ratio = priceDiff === 0 ? 0 : absHeight / priceDiff;

  return (
    <g>
      <line
        x1={x + width / 2}
        y1={y - (high - Math.max(open, close)) * ratio}
        x2={x + width / 2}
        y2={y + (Math.min(open, close) - low) * ratio}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(absHeight, 1)}
        fill={color}
      />
    </g>
  );
};

export function PriceChart({ data, ticker, initialStartDate, initialEndDate, isReal }: ChartProps) {
  const [activePrice, setActivePrice] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Interaction State (for Full Screen)
  const [viewStart, setViewStart] = useState(0); // Index in data
  const [viewEnd, setViewEnd] = useState(data.length - 1);
  const [yScaleFactor, setYScaleFactor] = useState(1.0);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanX, setLastPanX] = useState(0);

  // Initialize view bounds based on dashboard window or default
  useEffect(() => {
    if (initialStartDate && initialEndDate) {
      const startIndex = data.findIndex(d => d.date >= initialStartDate);
      let endIndex = -1;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].date <= initialEndDate) {
          endIndex = i;
          break;
        }
      }
      
      setViewStart(startIndex !== -1 ? startIndex : Math.max(0, data.length - 60));
      setViewEnd(endIndex !== -1 ? endIndex : data.length - 1);
    } else {
      setViewStart(Math.max(0, data.length - 60));
      setViewEnd(data.length - 1);
    }
  }, [data, initialStartDate, initialEndDate, isFullScreen]);

  // Augment data with internal chart coordinates
  const richData = useMemo(() => data.map((d) => ({
    ...d,
    openClose: [d.open, d.close],
  })), [data]);

  const visibleData = useMemo(() => {
    // We Slice based on the viewStart/viewEnd
    // If not full screen, we actually use the filtered range strictly if provided, 
    // but the component is designed such that 'data' IS the filtered range in non-fullscreen usually.
    // However, since we now pass full history, we MUST slice it here too.
    
    if (!isFullScreen) {
      if (initialStartDate && initialEndDate) {
        return richData.filter(d => d.date >= initialStartDate && d.date <= initialEndDate);
      }
      return richData.slice(Math.max(0, richData.length - 60));
    }
    
    // In full screen, we allow the indices to go slightly beyond if we want, 
    // but for now let's stick to the bounds
    return richData.slice(Math.max(0, Math.floor(viewStart)), Math.min(richData.length, Math.ceil(viewEnd) + 1));
  }, [richData, isFullScreen, viewStart, viewEnd, initialStartDate, initialEndDate]);

  // Calculate Y Domain dynamically
  const yDomain = useMemo(() => {
    if (!visibleData.length) return ['auto', 'auto'];
    const validData = visibleData.filter(d => d.low !== undefined);
    if (!validData.length) return ['auto', 'auto'];
    
    const minLow = Math.min(...validData.map(d => d.low));
    const maxHigh = Math.max(...validData.map(d => d.high));
    const range = maxHigh - minLow;
    
    const padding = (range * 0.05) * yScaleFactor;
    return [Math.max(0, minLow - padding), maxHigh + padding];
  }, [visibleData, yScaleFactor]);

  // Use a native listener for wheel to ensure preventDefault() blocks browser zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isFullScreen) return;

    const handleWheelNative = (e: WheelEvent) => {
      // ALWAYS prevent default in full screen to stop browser zoom/navigation
      e.preventDefault();

      const scrollAmount = e.deltaY;

      if (e.shiftKey) {
        // Y-axis Scale Adjustment
        setYScaleFactor(prev => Math.max(0.01, prev * (scrollAmount > 0 ? 1.1 : 0.9)));
      } else {
        // X-axis Zoom
        const dataLength = data.length;
        const zoomSpeed = 0.15;
        const direction = scrollAmount > 0 ? 1 : -1;
        
        const currentSize = viewEnd - viewStart;
        const zoomDelta = currentSize * zoomSpeed * direction;
        
        const newStart = Math.max(0, viewStart - zoomDelta / 2);
        const newEnd = Math.min(dataLength - 1, viewEnd + zoomDelta / 2);
        
        if (newEnd - newStart > 5) {
          setViewStart(newStart);
          setViewEnd(newEnd);
        }
      }
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [isFullScreen, viewStart, viewEnd, data.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isFullScreen) return;
    setIsPanning(true);
    setLastPanX(e.clientX);
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !isFullScreen) return;

    const dx = e.clientX - lastPanX;
    if (Math.abs(dx) < 2) return;

    const dataLength = data.length;
    const currentSize = viewEnd - viewStart;
    
    // Calculate pixels per data point roughly
    // We don't have the chart width perfectly here, but we can estimate
    const sensitivity = (currentSize / 1500) * dx; // Arbitrary scaler for smooth pan
    
    let newStart = viewStart - sensitivity;
    let newEnd = viewEnd - sensitivity;

    // Boundary constraints
    if (newStart < 0) {
      newEnd -= newStart;
      newStart = 0;
    }
    if (newEnd > dataLength - 1) {
      newStart -= (newEnd - (dataLength - 1));
      newEnd = dataLength - 1;
    }

    if (newStart >= 0 && newEnd < dataLength) {
      setViewStart(newStart);
      setViewEnd(newEnd);
      setLastPanX(e.clientX);
    }
  }, [isPanning, isFullScreen, lastPanX, viewStart, viewEnd, data.length]);

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    if (isFullScreen) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFullScreen, handleGlobalMouseMove]);

  const handleMouseMove = (e: any) => {
    if (e.activePayload && e.activePayload.length > 0) {
      const priceData = e.activePayload[0].payload;
      setActivePrice(priceData.close);
    } else {
      setActivePrice(null);
    }
  };

  const ChartContent = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart 
        data={visibleData}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setActivePrice(null)}
        barGap="-100%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2F" vertical={false} strokeOpacity={0.5} />
        <XAxis 
          dataKey="date" 
          hide={!isFullScreen} 
          interval={isFullScreen ? 'preserveStartEnd' : 0}
          stroke="#525252"
          fontSize={8}
          tick={{ fill: '#525252' }}
        />
        <YAxis 
          domain={isFullScreen ? yDomain : ['auto', 'auto']}
          orientation="right"
          stroke="#525252"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          allowDataOverflow={true}
        />
        <YAxis 
          yAxisId="volume"
          orientation="left"
          hide
          domain={[0, (dataMax: number) => dataMax * 5]}
        />
        <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
        
        {activePrice && (
          <ReferenceLine 
            y={activePrice} 
            stroke="#4ade80" 
            strokeDasharray="3 3" 
            strokeOpacity={0.8}
            isFront={true}
          >
            <Label
              position="right"
              fill="#4ade80"
              fontSize={10}
              fontWeight="bold"
              value={activePrice.toFixed(2)}
              className="font-mono"
              offset={10}
            />
          </ReferenceLine>
        )}

        <Bar
          yAxisId="volume"
          name="Volume"
          dataKey="volume"
          isAnimationActive={false}
        >
          {visibleData.map((entry, index) => (
            <Cell 
              key={`vol-cell-${index}`} 
              fill={entry.close > entry.open ? '#10B981' : '#EF4444'} 
              fillOpacity={0.25}
            />
          ))}
        </Bar>

        <Bar
          name="Price"
          dataKey="openClose"
          shape={<Candlestick />}
          isAnimationActive={false}
        />

        <Line
          name="SMA 50"
          type="monotone"
          dataKey="sma50"
          stroke="#60A5FA"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        
        <Line
          name="SMA 200"
          type="monotone"
          dataKey="sma200"
          stroke="#FBBF24"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '??/??/??';
    try {
      const [year, month, day] = dateStr.split('-');
      return `${month}/${day}/${year.slice(2)}`;
    } catch {
      return '??/??/??';
    }
  };

  const headerText = `Price Action for ${ticker} over ${formatDate(initialStartDate)} to ${formatDate(initialEndDate)}`;

  return (
    <>
      <div className="dashboard-card h-full flex flex-col group relative">
        <div className="p-4 border-b border-[#2A2B2F] flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="data-label">{headerText}</span>
              <span className={cn(
                "text-[7px] font-mono px-1 rounded border",
                isReal ? "text-green-500 border-green-500/30 bg-green-500/5 animate-pulse" : "text-orange-500 border-orange-500/30 bg-orange-500/5"
              )}>
                {isReal ? 'LIVE' : 'SIMULATED'}
              </span>
            </div>
            <div className="flex gap-4 mt-1">
              <span className="text-[8px] font-mono text-blue-400 uppercase">SMA 50</span>
              <span className="text-[8px] font-mono text-yellow-500 uppercase">SMA 200</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsFullScreen(true)}
              className="p-1.5 hover:bg-white/5 rounded-md text-gray-500 hover:text-white transition-colors"
              title="Full Screen Analysis"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 w-full p-4 overflow-hidden">
          {ChartContent}
        </div>
      </div>

      <AnimatePresence>
        {isFullScreen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-[#0A0A0B] flex flex-col p-6 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white tracking-tight">{headerText}</h2>
                    <span className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded border",
                      isReal ? "text-green-500 border-green-500/30 bg-green-500/5 animate-pulse" : "text-orange-500 border-orange-500/30 bg-orange-500/5"
                    )}>
                      {isReal ? 'LIVE FEED' : 'SIMULATED DATA'}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] font-mono text-blue-400 uppercase">SMA 50</span>
                    <span className="text-[10px] font-mono text-yellow-500 uppercase">SMA 200</span>
                  </div>
                </div>
                <div className="hidden md:flex flex-col text-[10px] text-gray-500 font-mono">
                  <p>DRAG: PAN X</p>
                  <p>SCROLL: ZOOM X</p>
                  <p>SHIFT+SCROLL: SCALE Y</p>
                </div>
              </div>
              <button 
                onClick={() => setIsFullScreen(false)}
                className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-all flex items-center gap-2 font-mono text-xs uppercase"
              >
                <Minimize2 size={18} />
                <span>Exit Terminal</span>
              </button>
            </div>
            
            <div 
              ref={containerRef}
              className={`flex-1 w-full bg-[#0E0E0F] border border-[#2A2B2F] rounded-2xl p-4 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              onMouseDown={handleMouseDown}
            >
              {ChartContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function InstitutionalChart({ data, isReal }: ChartProps) {
  return (
    <div className="dashboard-card h-full flex flex-col">
      <div className="p-3 border-b border-[#2A2B2F] flex items-center gap-2">
        <span className="data-label text-[9px]">Institutional Accumulation Flow</span>
        <span className={cn(
          "text-[7px] font-mono px-1 rounded border",
          isReal ? "text-green-500 border-green-500/30 bg-green-500/5 animate-pulse" : "text-orange-500 border-orange-500/30 bg-orange-500/5"
        )}>
          {isReal ? 'LIVE' : 'SIM'}
        </span>
      </div>
      <div className="flex-1 w-full px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Bar name="Net Flow" dataKey="institutionalFlow">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.institutionalFlow > 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function OptionsRatioChart({ data, isReal }: ChartProps) {
  const latestRatio = data[data.length - 1].putCallRatio.toFixed(2);

  const trendData = useMemo(() => {
    if (data.length < 2) return { points: data, rSquared: '0.0000' };
    
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i].putCallRatio;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    let ssRes = 0;
    let ssTot = 0;

    const points = data.map((d, i) => {
      const forecast = slope * i + intercept;
      ssRes += Math.pow(d.putCallRatio - forecast, 2);
      ssTot += Math.pow(d.putCallRatio - yMean, 2);
      return {
        ...d,
        trendline: forecast
      };
    });

    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    return {
      points,
      rSquared: rSquared.toFixed(4)
    };
  }, [data]);
  
  return (
    <div className="dashboard-card h-full flex flex-col relative">
      <div className="p-4 border-b border-[#2A2B2F] flex justify-between items-start">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="data-label">Put / Call Ratio Flow</span>
            <span className={cn(
              "text-[7px] font-mono px-1 rounded border",
              isReal ? "text-green-500 border-green-500/30 bg-green-500/5 animate-pulse" : "text-orange-500 border-orange-500/30 bg-orange-500/5"
            )}>
              {isReal ? 'LIVE' : 'SIM'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-500 uppercase mt-1">Linear Trendline</span>
        </div>
      </div>
      
      {/* Big Value Display - matching image top right of chart */}
      <div className="absolute top-12 right-6 flex flex-col items-end">
        <span className="text-4xl font-mono font-bold text-yellow-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
          {latestRatio}
        </span>
        <span className="data-label text-yellow-500/50">Current Ratio</span>
      </div>

      <div className="flex-1 w-full p-4 pt-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData.points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2F" vertical={false} strokeOpacity={0.5} />
            <XAxis dataKey="date" hide />
            <YAxis 
              orientation="right"
              stroke="#525252"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              name="Ratio"
              type="monotone" 
              dataKey="putCallRatio" 
              stroke="#F59E0B" 
              dot={false}
              strokeWidth={3}
              strokeDasharray="4 4" // Dotted line matching the "arc" feel in image
            />
            <Line
              name="Trend (Linear)"
              type="linear"
              dataKey="trendline"
              stroke="#6B7280"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              dot={false}
              strokeDasharray="2 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
