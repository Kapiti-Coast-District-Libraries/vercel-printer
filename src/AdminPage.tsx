import React, { useEffect, useState, useRef } from 'react';
import { supabase } from "./supabase";
import { BarChart3, ArrowLeft, Clock, Zap, List, Calendar, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PrintLog {
  created_at: string;
  timeLabel: string;
}

interface AdminStats {
  totalUnique: number;
  peakDay: { date: string; count: number };
  avgPerDay: number;
  todayTotal: number;
  hourlyStats: number[];
  todayLogs: PrintLog[];
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalUnique: 0,
    peakDay: { date: '-', count: 0 },
    avgPerDay: 0,
    todayTotal: 0,
    hourlyStats: new Array(24).fill(0),
    todayLogs: []
  });
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchStats = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('print_logs')
      .select('created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const now = new Date();
      const todayStr = now.toLocaleDateString();
      
      // 1. Deduplicate (5s threshold)
      const uniqueLogs = data.reduce((acc: any[], current: any) => {
        if (acc.length === 0) return [current];
        const lastTime = new Date(acc[acc.length - 1].created_at).getTime();
        const currTime = new Date(current.created_at).getTime();
        if (Math.abs(lastTime - currTime) > 5000) acc.push(current);
        return acc;
      }, []);

      // 2. Process Statistics
      const dailyCounts: Record<string, number> = {};
      const todayHourly = new Array(24).fill(0);
      const todayLogsList: PrintLog[] = [];

      uniqueLogs.forEach((log) => {
        const d = new Date(log.created_at);
        const dateKey = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        
        // General Daily Logging
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;

        // Specific "Today" Logging
        if (d.toLocaleDateString() === todayStr) {
          todayHourly[d.getHours()]++;
          todayLogsList.push({
            created_at: log.created_at,
            timeLabel: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        }
      });

      const peakEntry = Object.entries(dailyCounts).reduce((a, b) => (a[1] > b[1] ? a : b), ['-', 0]);

      setStats({
        totalUnique: uniqueLogs.length,
        peakDay: { date: peakEntry[0], count: peakEntry[1] as number },
        avgPerDay: Math.round(uniqueLogs.length / (Object.keys(dailyCounts).length || 1)),
        todayTotal: todayLogsList.length,
        hourlyStats: todayHourly,
        todayLogs: todayLogsList
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!hasFetched.current) {
      fetchStats();
      hasFetched.current = true;
    }
  }, []);

  const maxHourValue = Math.max(...stats.hourlyStats, 1);

  return (
    <div className="min-h-screen bg-[#0D0E10] text-white p-6 font-sans">
      <header className="max-w-6xl mx-auto mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-[#8E9299] text-xs font-mono uppercase tracking-[0.2em] mt-1">System Health & Usage Metrics</p>
        </div>
        <Link to="/" className="flex items-center gap-2 text-xs text-[#8E9299] hover:text-white transition-all border border-white/10 px-4 py-2 rounded-full hover:bg-white/5 font-mono">
          <ArrowLeft className="w-3 h-3" /> BACK_TO_ROOT
        </Link>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        
        {/* ROW 1: SYSTEM OVERVIEW (Macro Stats) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#131417] border border-white/5 p-6 rounded-2xl">
            <div className="flex items-center gap-2 text-blue-400 mb-4 font-mono text-[10px] uppercase tracking-widest">
              <BarChart3 className="w-4 h-4" /> Total Volume
            </div>
            <div className="text-4xl font-black">{loading ? "..." : stats.totalUnique}</div>
            <p className="text-[#4A4B50] text-[10px] mt-2 font-mono uppercase">Unique prints logged</p>
          </div>

          <div className="bg-[#131417] border border-white/5 p-6 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-400 mb-4 font-mono text-[10px] uppercase tracking-widest">
              <Calendar className="w-4 h-4" /> Busiest Day
            </div>
            <div className="text-4xl font-black">{loading ? "..." : stats.peakDay.count}</div>
            <p className="text-[#4A4B50] text-[10px] mt-2 font-mono uppercase italic">{stats.peakDay.date}</p>
          </div>

          <div className="bg-[#131417] border border-white/5 p-6 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-400 mb-4 font-mono text-[10px] uppercase tracking-widest">
              <Activity className="w-4 h-4" /> Daily Average
            </div>
            <div className="text-4xl font-black">{loading ? "..." : stats.avgPerDay}</div>
            <p className="text-[#4A4B50] text-[10px] mt-2 font-mono uppercase">Prints per day</p>
          </div>
        </div>

        {/* ROW 2: TODAY'S FOCUS (Micro Stats) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Today's Hourly Graph */}
          <div className="lg:col-span-2 bg-[#131417] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-mono uppercase tracking-widest text-[#8E9299]">Today's Activity</h2>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold block">{stats.todayTotal}</span>
                <span className="text-[9px] font-mono text-[#4A4B50] uppercase">Total Today</span>
              </div>
            </div>
            
            <div className="flex items-end justify-between gap-1 h-40 px-2">
              {stats.hourlyStats.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div 
                    className="w-full bg-blue-500/20 group-hover:bg-blue-500/50 transition-all rounded-t-sm relative"
                    style={{ height: `${(count / maxHourValue) * 100}%`, minHeight: count > 0 ? '4px' : '1px' }}
                  >
                    {count > 0 && (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {count} items
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-[#333] hidden md:block">
                    {i % 4 === 0 ? `${i}h` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Log Feed */}
          <div className="bg-[#131417] border border-white/5 rounded-2xl flex flex-col h-[320px] lg:h-auto">
            <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-white/[0.02]">
              <List className="w-3 h-3 text-[#8E9299]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8E9299]">Today's Live Feed</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono scrollbar-hide">
              {loading ? (
                <div className="text-[#4A4B50] text-[10px]">FETCHING...</div>
              ) : stats.todayLogs.length === 0 ? (
                <div className="text-[#4A4B50] text-[10px] h-full flex items-center justify-center italic">No activity yet today</div>
              ) : (
                stats.todayLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] border-b border-white/[0.02] pb-2">
                    <span className="text-blue-500/80">[{log.timeLabel}]</span>
                    <span className="text-[#8E9299] text-[9px]">COMPLETED</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Status */}
        <div className="bg-[#131417] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-mono tracking-[0.2em] text-[#8E9299]">SYSTEM_OPERATIONAL // NO_ERRORS_DETECTED</span>
           </div>
           <span className="text-[10px] font-mono text-[#333] uppercase">Refresh on page load</span>
        </div>
      </main>
    </div>
  );
}
