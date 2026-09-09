import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { useCalculations } from '../../hooks/useCalculations';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { formatGNF } from '../../services/pdf/pdfGenerator';
import {
  TrendingUp,
  Truck,
  Fuel,
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  BarChart2,
  Receipt,
  Droplet,
  Search,
  ArrowUpDown,
  History
} from 'lucide-react';

const PIE_PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

type StatsPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL' | 'CUSTOM';

import { DailyJournalView } from './DailyJournalView';

export const OwnerDashboardView: React.FC = () => {
  const { currentUser } = useAuth();
  const { triggerHaptic } = useHaptic();

  // Sub-tabs: 'STATS' | 'DOWNLOADS'
  const [subTab, setSubTab] = useState<'STATS' | 'DOWNLOADS'>('STATS');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const weekAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  // Stats view date
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('TODAY');
  const [statsCustomDate, setStatsCustomDate] = useState<string>(todayStr);

  const derivedDateFilter = useMemo(() => {
    if (statsPeriod === 'TODAY') return todayStr;
    if (statsPeriod === 'MONTH') return todayStr.substring(0, 7);
    if (statsPeriod === 'YEAR') return todayStr.substring(0, 4);
    if (statsPeriod === 'ALL') return '';
    if (statsPeriod === 'CUSTOM') return statsCustomDate;
    
    if (statsPeriod === 'WEEK') {
      return (dateIso: string) => {
        const d = dateIso.substring(0, 10);
        return d >= weekAgoStr && d <= todayStr;
      };
    }
    
    if (statsPeriod === 'QUARTER') {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const qStartMonth = Math.floor(currentMonth / 3) * 3;
      // Start of current quarter
      const qStartDate = new Date(currentYear, qStartMonth, 1);
      // Format as YYYY-MM-DD local logic to avoid timezone issues
      const qStartStr = `${currentYear}-${String(qStartMonth + 1).padStart(2, '0')}-01`;
      return (dateIso: string) => {
        const d = dateIso.substring(0, 10);
        return d >= qStartStr && d <= todayStr;
      };
    }
    return todayStr;
  }, [statsPeriod, statsCustomDate, todayStr, weekAgoStr]);

  const { summary } = useCalculations(derivedDateFilter);
  
  // Waterfall Chart Data
  const waterfallData = [
    { name: 'CAB (Brut)', amount: summary.grossRevenueGNF, fill: '#3b82f6' },
    { name: 'Taxes Mines', amount: -summary.totalTaxesGNF, fill: '#ef4444' },
    { name: 'Carburant', amount: -summary.fuelOpexGNF, fill: '#f97316' },
    { name: 'OPEX Chantier', amount: -(summary.totalOpexGNF - summary.fuelOpexGNF), fill: '#94a3b8' },
    { name: 'Marge Nette', amount: summary.netProfitGNF, fill: '#10b981' }
  ];

  // Pie Data from truck breakdown
  const pieData = summary.truckBreakdown.map(b => ({
    name: b.modelName,
    value: b.count
  }));

  const getTruckCount = (modelNameQuery: string) => {
    const item = summary.truckBreakdown.find(b => b.modelName.toLowerCase().includes(modelNameQuery.toLowerCase()));
    return item ? item.count : 0;
  };

  return (
    <div className="page-container">
      
      {/* 1. Page Header (CAARUD RDS Style) */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
          Rapports &amp; Statistiques
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
          Analysez l'activité de la carrière, consultez l'historique de l'équipe et exportez vos documents officiels.
        </p>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        backgroundColor: '#ffffff',
        padding: '0.35rem',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        width: '100%',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={() => {
            triggerHaptic('tap');
            setSubTab('STATS');
          }}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            padding: '0.6rem 0.85rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            backgroundColor: subTab === 'STATS' ? '#ecfdf5' : 'transparent',
            color: subTab === 'STATS' ? '#047857' : '#64748b',
            fontSize: '0.85rem',
            fontWeight: subTab === 'STATS' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <BarChart2 size={16} color={subTab === 'STATS' ? '#059669' : '#94a3b8'} />
          <span>Statistiques</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('tap');
            setSubTab('DOWNLOADS');
          }}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            padding: '0.6rem 0.85rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            backgroundColor: subTab === 'DOWNLOADS' ? '#ecfdf5' : 'transparent',
            color: subTab === 'DOWNLOADS' ? '#047857' : '#64748b',
            fontSize: '0.85rem',
            fontWeight: subTab === 'DOWNLOADS' ? 800 : 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <History size={16} color={subTab === 'DOWNLOADS' ? '#059669' : '#94a3b8'} />
          <span>Historique &amp; Téléchargements</span>
        </button>
      </div>

      {subTab === 'STATS' ? (
        <>
          {/* STATS VIEW */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Vue d'ensemble
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: '100%', maxWidth: 'fit-content' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#ffffff',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #e2e8f0',
                width: '100%'
              }}>
                <Calendar size={15} color="#059669" />
                <select
                  aria-label="Période des statistiques"
                  value={statsPeriod}
                  onChange={(e) => {
                    triggerHaptic('tap');
                    setStatsPeriod(e.target.value as StatsPeriod);
                  }}
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    cursor: 'pointer',
                    appearance: 'auto',
                    paddingRight: '0.25rem',
                    flex: 1
                  }}
                >
                  <option value="TODAY">Aujourd'hui</option>
                  <option value="WEEK">Cette Semaine</option>
                  <option value="MONTH">Ce Mois</option>
                  <option value="QUARTER">Ce Trimestre</option>
                  <option value="YEAR">Cette Année</option>
                  <option value="ALL">Tout l'historique</option>
                  <option value="CUSTOM">Date Précise</option>
                </select>

                {statsPeriod === 'CUSTOM' && (
                  <input
                    type="date"
                    aria-label="Date personnalisée"
                    value={statsCustomDate}
                    onChange={(e) => setStatsCustomDate(e.target.value)}
                    style={{
                      border: 'none',
                      borderLeft: '1px solid #e2e8f0',
                      paddingLeft: '0.4rem',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Top 4 KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: '0.85rem',
            marginBottom: '1.5rem',
            width: '100%'
          }}>
            {/* KPI 1: Chiffre d'Affaires Brut */}
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-title">Chiffre d'Affaires Brut (CAB)</span>
              </div>
              <div className="kpi-value" style={{ color: '#059669' }}>
                {formatGNF(summary.grossRevenueGNF)}
              </div>
              <span className="kpi-subtitle">Total perçu en caisse</span>
            </div>

            {/* KPI 2: Marge Nette */}
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-title">Marge Nette Réalisée</span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TrendingUp size={17} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: '#16a34a' }}>
                {formatGNF(summary.netProfitGNF)}
              </div>
              <span className="kpi-subtitle">Après taxes et dépenses OPEX</span>
            </div>

            {/* KPI 3: Total Camions Sortis */}
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-title">Total Camions Sortis</span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f0f9ff',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Truck size={17} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: '#0284c7' }}>
                {summary.totalTrucks}
              </div>
              <span className="kpi-subtitle">Rotations de bennes</span>
            </div>

            {/* KPI 4: Dépenses & Carburant */}
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-title">Dépenses &amp; Carburant</span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Fuel size={17} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: '#d97706' }}>
                {formatGNF(summary.totalOpexGNF)}
              </div>
              <span className="kpi-subtitle">{summary.fuelLitersTotal} L de gasoil consommés</span>
            </div>
          </div>

          {/* Metric Tiles Grid */}
          <div style={{ marginBottom: '1.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#334155', marginBottom: '0.75rem' }}>
              Détail des Rotations par Modèle &amp; Frais
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '0.65rem',
              width: '100%'
            }}>
              <div className="clean-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', marginBottom: '0.35rem' }}>
                  <Truck size={15} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>6 Roues Standard</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                  {getTruckCount('6 Roues')}
                </div>
              </div>

              <div className="clean-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7', marginBottom: '0.35rem' }}>
                  <Truck size={15} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>10 Roues Howo</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                  {getTruckCount('10 Roues')}
                </div>
              </div>

              <div className="clean-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#7c3aed', marginBottom: '0.35rem' }}>
                  <Truck size={15} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>12 Roues Heavy</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                  {getTruckCount('12 Roues')}
                </div>
              </div>

              <div className="clean-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ec4899', marginBottom: '0.35rem' }}>
                  <Truck size={15} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Semi-Remorque</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                  {getTruckCount('Semi') || getTruckCount('Remorque') || getTruckCount('14 Roues')}
                </div>
              </div>

              <div className="clean-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d97706', marginBottom: '0.35rem' }}>
                  <Droplet size={15} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Carburant (Litres)</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                  {summary.fuelLitersTotal} L
                </div>
              </div>

              <div className="clean-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', marginBottom: '0.35rem' }}>
                  <Receipt size={15} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Taxes Extractions</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                  {formatGNF(summary.totalTaxesGNF)}
                </div>
              </div>

            </div>
          </div>

          {/* Financial Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: '1.25rem',
            marginBottom: '1.75rem',
            width: '100%'
          }}>
            <div className="clean-card" style={{ padding: '1.25rem', width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                Cascade Financière &amp; Rentabilité (GNF)
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                Décomposition du Chiffre d'Affaires Brut vers la Marge Nette
              </p>

              <div style={{ width: '100%', height: 240, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} interval={0} />
                    <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      formatter={(val: number) => formatGNF(Math.abs(val))}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {waterfallData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="clean-card" style={{ padding: '1.25rem', width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                Répartition Volumétrique des Modèles
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                Proportion des types de camions sortis de carrière
              </p>

              {pieData.length === 0 ? (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Aucune rotation pour cette date
                </div>
              ) : (
                <div style={{ width: '100%', height: 240, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={75}
                        innerRadius={42}
                        paddingAngle={3}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [`${v} camions`, name]} />
                      <Legend 
                        iconType="circle" 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            
            {/* Histogramme temporel */}
            <div className="clean-card" style={{ padding: '1.25rem', gridColumn: '1 / -1', width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                Évolution Temporelle (Recettes vs Dépenses)
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                Comparaison journalière du Chiffre d'Affaires Brut et des Dépenses Totales (Taxes + OPEX)
              </p>

              {summary.timeSeriesData.length === 0 ? (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Aucune donnée temporelle pour cette période
                </div>
              ) : (
                <div style={{ width: '100%', height: 260, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.timeSeriesData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} 
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                        }}
                      />
                      <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip
                        labelFormatter={(str) => new Date(str).toLocaleDateString('fr-FR')}
                        formatter={(val: number, name: string) => [formatGNF(val), name === 'revenue' ? 'Recettes (CAB)' : 'Dépenses (Total)']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend 
                        iconType="circle" 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }}
                        formatter={(value) => value === 'revenue' ? 'Recettes (CAB)' : 'Dépenses (Total)'}
                      />
                      <Area type="monotone" name="revenue" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" activeDot={{ r: 5 }} />
                      <Area type="monotone" name="expenses" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExp)" activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* DOWNLOADS / JOURNALS VIEW */}
          <DailyJournalView />
        </>
      )}
    </div>
  );
};
