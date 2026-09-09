import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db/localDb';
import { useAuth } from '../../context/AuthContext';
import { useCalculations } from '../../hooks/useCalculations';
import { formatGNF, generateDailyReportPDF } from '../../services/pdf/pdfGenerator';
import { exportFinancialDataToExcel } from '../../services/excel/excelExporter';
import { DailyReport, DailyReportPhoto } from '../../types/domain';
import { ReportPhotoCapture } from '../shared/ReportPhotoCapture';
import {
  Calendar, ChevronRight, FileText, Camera,
  Truck, Receipt, Fuel, TrendingUp, X, Download, FileSpreadsheet,
  Banknote, AlertTriangle
} from 'lucide-react';

// ─── Day Detail Modal ──────────────────────────────────────────────────────────
interface DayDetailModalProps {
  dateStr: string;
  onClose: () => void;
  canEditPhotos: boolean;
  currentUser: any;
}

const DayDetailModal: React.FC<DayDetailModalProps> = ({
  dateStr, onClose, canEditPhotos, currentUser
}) => {
  const { summary } = useCalculations(dateStr);
  const loadings = useLiveQuery(async () => {
    const all = await db.loadings.orderBy('loadingTime').toArray();
    return all.filter(l => l.loadingTime.substring(0, 10) === dateStr);
  }, [dateStr]) ?? [];

  const expenses = useLiveQuery(async () => {
    const all = await db.expenses.orderBy('expenseTime').toArray();
    return all.filter(e => e.expenseTime.substring(0, 10) === dateStr);
  }, [dateStr]) ?? [];

  const dailyReport = useLiveQuery(async () => {
    const reports = await db.dailyReports.toArray();
    return reports.find(r => r.reportDate === dateStr) || null;
  }, [dateStr]);

  const totals = {
    revenue: summary.grossRevenueGNF,
    taxes: summary.totalTaxesGNF,
    fuel: summary.fuelOpexGNF,
    net: summary.netProfitGNF,
    trucks: summary.totalTrucks
  };

  const formattedDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const handleAddPhoto = async (photo: DailyReportPhoto) => {
    const existing = await db.dailyReports.where('reportDate').equals(dateStr).first();
    if (existing) {
      await db.dailyReports.update(existing.id, {
        photos: [...existing.photos, photo],
        updatedAt: new Date().toISOString(),
        syncStatus: 'PENDING'
      });
    } else {
      await db.dailyReports.add({
        id: 'rpt_' + Date.now(),
        reportDate: dateStr,
        photos: [photo],
        syncStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    const existing = await db.dailyReports.where('reportDate').equals(dateStr).first();
    if (!existing) return;
    await db.dailyReports.update(existing.id, {
      photos: existing.photos.filter(p => p.id !== photoId),
      updatedAt: new Date().toISOString(),
      syncStatus: 'PENDING'
    });
  };

  const handleDownloadPDF = async () => {
    try {
      if (!currentUser) return;
      await generateDailyReportPDF(dateStr, summary, loadings, expenses, currentUser, dailyReport?.photos);
    } catch (e) {
      console.error('PDF error:', e);
    }
  };

  const handleDownloadExcel = () => {
    try {
      exportFinancialDataToExcel(dateStr, summary, loadings, expenses);
    } catch (e) {
      console.error('Excel error:', e);
    }
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        backgroundColor: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '1.5rem 1rem', overflowY: 'auto'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: '20px',
        width: '100%', maxWidth: '760px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={20} color="#34d399" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Journal de la journée
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{formattedDate}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleDownloadExcel}
                className="btn-secondary"
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.82rem',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={16} />
                <span>Excel</span>
              </button>
              <button
                onClick={handleDownloadPDF}
                className="btn-primary"
                style={{
                  backgroundColor: '#dc2626', color: '#fff',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.85rem',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', cursor: 'pointer'
                }}
              >
                <FileText size={16} />
                <span>Télécharger le PDF</span>
              </button>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{
              backgroundColor: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: '10px', padding: '0.5rem', cursor: 'pointer', display: 'flex'
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: <Truck size={16} />, label: 'Camions', value: totals.trucks.toString(), color: '#059669', bg: '#ecfdf5' },
              { icon: <TrendingUp size={16} />, label: 'Recette', value: formatGNF(totals.revenue), color: '#1d4ed8', bg: '#eff6ff' },
              { icon: <Receipt size={16} />, label: 'Taxes', value: formatGNF(totals.taxes), color: '#d97706', bg: '#fef3c7' },
              { icon: <Fuel size={16} />, label: 'Carburant', value: formatGNF(totals.fuel), color: '#059669', bg: '#ecfdf5' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                backgroundColor: kpi.bg, borderRadius: '12px',
                padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: kpi.color }}>
                  {kpi.icon}
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Photos du rapport */}
          <ReportPhotoCapture
            reportDate={dateStr}
            photos={dailyReport?.photos ?? []}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            currentUserId={currentUser?.id || ''}
            currentUserName={currentUser?.fullName || ''}
            readOnly={!canEditPhotos}
          />

          {/* Chargements */}
          {loadings.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem' }}>
                🚛 Chargements ({loadings.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {loadings.map(l => (
                  <div key={l.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc',
                    borderRadius: '10px', fontSize: '0.83rem'
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{l.truckModelName}</span>
                      {l.quantity > 1 && <span style={{ color: '#64748b' }}> ×{l.quantity}</span>}
                      <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                        {new Date(l.loadingTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {l.taxAmountGNF > 0 && (
                        <span style={{ color: '#d97706', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                          • Taxe: {formatGNF(l.taxAmountGNF)}
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 800, color: '#059669' }}>+{formatGNF(l.totalPriceGNF)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dépenses */}
          {expenses.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem' }}>
                ⛽ Dépenses ({expenses.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {expenses.map(e => (
                  <div key={e.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.65rem 0.85rem', backgroundColor: '#fff7ed',
                    borderRadius: '10px', fontSize: '0.83rem'
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.description}</span>
                      <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                        {new Date(e.expenseTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, color: '#dc2626' }}>-{formatGNF(e.totalAmountGNF)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadings.length === 0 && expenses.length === 0 && (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '1rem' }}>
              Aucune activité enregistrée pour cette journée.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Daily Journal View ────────────────────────────────────────────────────────
export const DailyJournalView: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const canEditPhotos = currentUser?.role === 'AGENT_TERRAIN' || currentUser?.role === 'ADMINISTRATEUR';

  // Get all distinct dates that have activity
  const allLoadings = useLiveQuery(() => db.loadings.toArray()) ?? [];
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) ?? [];
  const allReports = useLiveQuery(() => db.dailyReports.toArray()) ?? [];

  const journalDays = useMemo(() => {
    const dateSet = new Set<string>();
    allLoadings.forEach(l => dateSet.add(l.loadingTime.substring(0, 10)));
    allExpenses.forEach(e => dateSet.add(e.expenseTime.substring(0, 10)));
    allReports.forEach(r => { if ((r.photos?.length ?? 0) > 0) dateSet.add(r.reportDate); });

    return Array.from(dateSet).sort((a, b) => b.localeCompare(a)).map(date => {
      const dayLoadings = allLoadings.filter(l => l.loadingTime.substring(0, 10) === date);
      const dayExpenses = allExpenses.filter(e => e.expenseTime.substring(0, 10) === date);
      const report = allReports.find(r => r.reportDate === date);

      const revenue = dayLoadings.reduce((s, l) => s + l.totalPriceGNF, 0);
      const trucks = dayLoadings.reduce((s, l) => s + l.quantity, 0);

      return {
        date,
        trucks,
        revenue,
        loadingCount: dayLoadings.length,
        expenseCount: dayExpenses.length,
        photoCount: report?.photos?.length ?? 0,
        hasReport: (report?.photos?.length ?? 0) > 0
      };
    });
  }, [allLoadings, allExpenses, allReports]);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
          Historique de l'Activité
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}>
          Consultez l'historique complet par journée. Cliquez sur une journée pour voir le détail et exporter les documents (PDF/Excel).
        </p>
      </div>

      {journalDays.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          backgroundColor: '#f8fafc', borderRadius: '16px',
          border: '1px dashed #cbd5e1'
        }}>
          <Calendar size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 700, color: '#475569' }}>Aucune activité enregistrée</p>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Les journées apparaîtront ici dès que des chargements seront saisies.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {journalDays.map(day => {
          const formattedDate = new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
          const isToday = day.date === new Date().toISOString().split('T')[0];

          return (
            <div
              key={day.date}
              className="clean-card"
              style={{ padding: '1.1rem 1.35rem', transition: 'box-shadow 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                {/* Left: date + summary */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <Calendar size={15} color="#64748b" />
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>
                      {formattedDate}
                    </span>
                    {isToday && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#10b981',
                        color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '999px'
                      }}>
                        Aujourd'hui
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Truck size={14} color="#0f172a" />
                      <strong>{day.trucks}</strong> camion{day.trucks > 1 ? 's' : ''}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669' }}>
                      <Banknote size={14} />
                      <strong>{formatGNF(day.revenue)}</strong>
                    </span>
                    {day.expenseCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Fuel size={14} color="#dc2626" />
                        <strong>{day.expenseCount}</strong> dépense{day.expenseCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {day.hasReport ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669' }}>
                        <Camera size={14} />
                        <strong>{day.photoCount}</strong> photo{day.photoCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b' }}>
                        <AlertTriangle size={14} />
                        Aucune photo
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedDate(day.date)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      backgroundColor: '#0f172a', color: '#fff', border: 'none',
                      borderRadius: '10px', padding: '0.5rem 1rem',
                      fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Consulter <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <DayDetailModal
          dateStr={selectedDate}
          onClose={() => setSelectedDate(null)}
          canEditPhotos={canEditPhotos}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
