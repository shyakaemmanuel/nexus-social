import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, TrendingUp, Users, Zap, Play, Pause, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface StatData {
  id: string;
  timestamp: Timestamp;
  value: number;
  label: string;
}

export default function Stats() {
  const [data, setData] = useState<StatData[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'stats'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StatData[];
      
      // Sort ascending for the chart
      setData(stats.reverse());
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stats');
    });

    return () => unsubscribe();
  }, []);

  // Simulation logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(async () => {
        const lastValue = data.length > 0 ? data[data.length - 1].value : 50;
        const change = (Math.random() - 0.5) * 20;
        const newValue = Math.max(0, Math.min(100, lastValue + change));

        try {
          await addDoc(collection(db, 'stats'), {
            value: Number(newValue.toFixed(2)),
            timestamp: serverTimestamp(),
            label: format(new Date(), 'HH:mm:ss')
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'stats');
        }
      }, 3000); // Every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isSimulating, data]);

  const chartData = useMemo(() => {
    return data.map(d => ({
      time: d.label || format(d.timestamp.toDate(), 'HH:mm:ss'),
      value: d.value
    }));
  }, [data]);

  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const previousValue = data.length > 1 ? data[data.length - 2].value : 0;
  const trend = latestValue >= previousValue ? 'up' : 'down';

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Nexus Analytics</h1>
          <p className="text-secondary text-sm mt-1">Real-time platform activity and performance metrics.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
              isSimulating 
                ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' 
                : 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20'
            }`}
          >
            {isSimulating ? <Pause size={18} /> : <Play size={18} />}
            <span>{isSimulating ? 'Stop Simulation' : 'Start Live Feed'}</span>
          </button>
          
          <div className="flex items-center space-x-2 px-4 py-2 bg-surface border border-border rounded-full text-xs font-medium text-secondary">
            <div className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span>{isSimulating ? 'Live' : 'Paused'}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background p-6 rounded-3xl border border-border shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-accent/10 rounded-2xl text-accent">
              <Activity size={24} />
            </div>
            <div className={`flex items-center space-x-1 text-xs font-bold ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
              {trend === 'up' ? <TrendingUp size={14} /> : <TrendingUp size={14} className="rotate-180" />}
              <span>{Math.abs(latestValue - previousValue).toFixed(1)}%</span>
            </div>
          </div>
          <h3 className="text-secondary text-sm font-medium">Active Load</h3>
          <p className="text-3xl font-bold mt-1">{latestValue.toFixed(1)}%</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-background p-6 rounded-3xl border border-border shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-500">
              <Users size={24} />
            </div>
            <span className="text-xs font-bold text-green-500">+12%</span>
          </div>
          <h3 className="text-secondary text-sm font-medium">Concurrent Users</h3>
          <p className="text-3xl font-bold mt-1">1,284</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-background p-6 rounded-3xl border border-border shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 rounded-2xl text-yellow-500">
              <Zap size={24} />
            </div>
            <span className="text-xs font-bold text-blue-500">Stable</span>
          </div>
          <h3 className="text-secondary text-sm font-medium">Response Time</h3>
          <p className="text-3xl font-bold mt-1">42ms</p>
        </motion.div>
      </div>

      {/* Main Chart */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-background p-8 rounded-[2rem] border border-border shadow-xl shadow-black/5"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">Activity Stream</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-xs font-medium text-secondary">System Load</span>
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <RefreshCw className="animate-spin text-accent" size={32} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  minTickGap={30}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: 'var(--color-accent)', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--color-accent)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  );
}
