import { motion } from "motion/react";

interface GaugeChartProps {
  value: number; // 0-100
  label: string;
  isReal?: boolean;
}

export function GaugeChart({ value, label, isReal }: GaugeChartProps) {
  // Map value (0-100) to rotation (-90 to 90 deg)
  const rotation = (value / 100) * 180 - 90;
  
  return (
    <div className="flex flex-col items-center justify-center h-full pt-1">
      <div className="relative w-24 h-12 overflow-hidden">
        {/* Gauge Track */}
        <div className="absolute top-0 left-0 w-24 h-24 border-[8px] border-[#2A2B2F] rounded-full" />
        
        {/* Gradient Progress */}
        <div 
          className="absolute top-0 left-0 w-24 h-24 border-[8px] border-transparent rounded-full"
          style={{
            background: `conic-gradient(from 270deg, #EF4444 0deg, #F59E0B 90deg, #10B981 180deg)`,
            maskImage: `radial-gradient(transparent 58%, black 60%)`,
            WebkitMaskImage: `radial-gradient(transparent 58%, black 60%)`,
          }}
        />
        
        {/* Needle */}
        <motion.div 
          className="absolute bottom-0 left-1/2 w-0.5 h-10 bg-white origin-bottom -translate-x-1/2 z-10 rounded-full"
          initial={{ rotate: -90 }}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 50 }}
        />
        
        {/* Center hub */}
        <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-white rounded-full -translate-x-1/2 translate-y-1/2 z-20" />
      </div>
      
      <div className="mt-1 text-center flex flex-col items-center">
        <div className="flex items-center gap-1">
          <span className="text-sm font-mono font-bold leading-none">{Math.round(value)}</span>
          {isReal !== undefined && (
            <span className={`text-[6px] font-mono leading-none ${isReal ? 'text-green-500/70 animate-pulse' : 'text-orange-500/70'}`}>
              {isReal ? '●' : '○'}
            </span>
          )}
        </div>
        <p className="data-label text-[8px] uppercase tracking-tighter leading-none">{label}</p>
      </div>
    </div>
  );
}
