import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import { db } from '../../services/db/localDb';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { useCalculations } from '../../hooks/useCalculations';
import { TruckModel, LoadingRecord, DailyReport, DailyReportPhoto } from '../../types/domain';
import { formatGNF } from '../../services/pdf/pdfGenerator';
import { ExpenseModal } from './ExpenseModal';
import { DateTimePicker } from '../shared/DateTimePicker';
import { ReportPhotoCapture } from '../shared/ReportPhotoCapture';
import {
  Truck,
  CheckCircle2,
  Fuel,
  Plus,
  Minus,
  Receipt,
  Layers,
  ChevronRight,
  AlertCircle,
  Search
} from 'lucide-react';

export const FieldEntryView: React.FC = () => {
  const { currentUser } = useAuth();
  const { triggerHaptic } = useHaptic();

  // Query active truck models
  const truckModels = useLiveQuery(async () => {
    let list = await db.truckModels.toArray();
    return list.filter(m => m.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder);
  }) ?? [];

  const defaultTax = useLiveQuery(async () => {
    const taxes = await db.taxConfigs.toArray();
    return taxes.find(t => t.taxType === 'PER_TRUCK' && t.isActive !== false) || { amountGNF: 15000 };
  });

  // Manual date/time — defaults to now, can be changed for retroactive entries
  const [manualDateTime, setManualDateTime] = useState<string>(() => new Date().toISOString());
  const entryDateStr = useMemo(() => manualDateTime.substring(0, 10), [manualDateTime]);

  // Stats for the chosen entry date
  const { summary } = useCalculations(entryDateStr);

  const todayLoadings = useLiveQuery(async () => {
    const all = await db.loadings.orderBy('loadingTime').reverse().toArray();
    return all.filter(l => l.loadingTime.substring(0, 10) === entryDateStr);
  }, [entryDateStr]) ?? [];

  // Daily report for the chosen entry date
  const dailyReport = useLiveQuery(async () => {
    const reports = await db.dailyReports.toArray();
    return reports.find(r => r.reportDate === entryDateStr) || null;
  }, [entryDateStr]);

  // Form State
  const [selectedTruck, setSelectedTruck] = useState<TruckModel | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);

  // Auto-select truck
  useEffect(() => {
    if (truckModels.length > 0) {
      setSelectedTruck(prev => {
        if (!prev || !truckModels.some(m => m.id === prev.id)) {
          return truckModels[0];
        }
        return prev;
      });
    }
  }, [truckModels, setSelectedTruck]);

  const unitPrice = selectedTruck ? selectedTruck.defaultPriceGNF : 0;
  const totalPrice = unitPrice * quantity;
  
  let taxAmount = 0;
  let taxBreakdown: { name: string; amountGNF: number }[] | undefined = undefined;
  
  if (selectedTruck?.taxes && selectedTruck.taxes.length > 0) {
    taxAmount = selectedTruck.taxes.reduce((sum, t) => sum + (t.amountGNF * quantity), 0);
    taxBreakdown = selectedTruck.taxes.map(t => ({ name: t.name, amountGNF: t.amountGNF * quantity }));
  } else {
    taxAmount = ((selectedTruck?.defaultTaxGNF !== undefined ? selectedTruck.defaultTaxGNF : defaultTax?.amountGNF) || 15000) * quantity;
  }

  const handleSelectTruck = (truck: TruckModel) => {
    triggerHaptic('tap');
    setSelectedTruck(truck);
  };

  const handleQuantityAdjust = (delta: number) => {
    triggerHaptic('tap');
    setQuantity(prev => Math.max(1, Math.min(20, prev + delta)));
  };

  const handleValidateLoading = async () => {
    if (!selectedTruck) return;

    triggerHaptic('success');

    const newRecord: LoadingRecord = {
      id: 'load_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      truckModelId: selectedTruck.id,
      truckModelName: selectedTruck.name,
      quantity,
      unitPriceGNF: unitPrice,
      totalPriceGNF: totalPrice,
      taxAmountGNF: taxAmount,
      taxBreakdown,
      loadingTime: manualDateTime, // Use manual date/time
      isDeferred: false,
      createdByUserId: currentUser?.id || 'usr_agent_01',
      createdByName: currentUser?.fullName || 'Agent Terrain',
      syncStatus: 'PENDING',
      createdAt: new Date().toISOString()
    };

    try {
      await db.transaction('rw', db.loadings, db.auditLogs, async () => {
        await db.loadings.add(newRecord);

        await db.auditLogs.add({
          id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
          userId: currentUser?.id || 'usr_agent_01',
          userName: currentUser?.fullName || 'Agent Terrain',
          userRole: currentUser?.role || 'AGENT_TERRAIN',
          action: 'CREATE_LOADING',
          entityName: 'loadings',
          entityId: newRecord.id,
          details: {
            truck: newRecord.truckModelName,
            qty: newRecord.quantity,
            total: newRecord.totalPriceGNF
          },
          timestamp: new Date().toISOString()
        });
      });

      confetti({
        particleCount: 40,
        spread: 55,
        origin: { y: 0.85 },
        colors: ['#10b981', '#059669', '#34d399']
      });

      // Reset fields
      setQuantity(1);
    } catch (err) {
      console.error('Erreur enregistrement chargement:', err);
      alert("Une erreur est survenue lors de l'enregistrement du chargement. Veuillez réessayer.");
    }
  };

  // Filtered loadings for recent list
  const filteredLoadings = todayLoadings.filter(l => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      l.truckModelName.toLowerCase().includes(term) ||
      (l.createdByName && l.createdByName.toLowerCase().includes(term))
    );
  });

  // ── Photo report management ────────────────────────────────────
  const handleAddPhoto = async (photo: DailyReportPhoto) => {
    const existing = await db.dailyReports.where('reportDate').equals(entryDateStr).first();
    if (existing) {
      await db.dailyReports.update(existing.id, {
        photos: [...existing.photos, photo],
        updatedAt: new Date().toISOString(),
        syncStatus: 'PENDING'
      });
    } else {
      const newReport: DailyReport = {
        id: 'rpt_' + Date.now(),
        reportDate: entryDateStr,
        photos: [photo],
        syncStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.dailyReports.add(newReport);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    const existing = await db.dailyReports.where('reportDate').equals(entryDateStr).first();
    if (!existing) return;
    const updated = existing.photos.filter(p => p.id !== photoId);
    await db.dailyReports.update(existing.id, {
      photos: updated,
      updatedAt: new Date().toISOString(),
      syncStatus: 'PENDING'
    });
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.75rem 1.25rem 3rem' }}>
      
      {/* 1. Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
            Saisie des Chargements
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.2rem' }}>
            Gérez les passages de camions et enregistrez les dépenses carburant/OPEX.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Bouton photo rapport — en haut, permanent */}
          {currentUser?.role !== 'PROPRIETAIRE' && (
            <button
              type="button"
              onClick={() => {
                // Trigger file input via the ReportPhotoCapture ref
                const input = document.getElementById('report-photo-input') as HTMLInputElement;
                input?.click();
              }}
              className="btn-primary"
              style={{
                backgroundColor: '#7c3aed',
                borderRadius: 'var(--radius-full)',
                padding: '0.65rem 1.25rem',
                fontSize: '0.88rem'
              }}
            >
              📷 <span>Photo rapport</span>
            </button>
          )}

          {/* + Dépense Carburant */}
          {currentUser?.role !== 'PROPRIETAIRE' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                setIsExpenseModalOpen(true);
              }}
              className="btn-primary"
              style={{
                backgroundColor: '#059669',
                borderRadius: 'var(--radius-full)',
                padding: '0.65rem 1.25rem',
                fontSize: '0.88rem'
              }}
            >
              <Fuel size={17} />
              <span>+ Dépense Carburant / OPEX</span>
            </button>
          )}
        </div>
      </div>

      {/* Photo Rapport — toujours visible en haut */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ReportPhotoCapture
          reportDate={entryDateStr}
          photos={dailyReport?.photos ?? []}
          onAddPhoto={handleAddPhoto}
          onRemovePhoto={handleRemovePhoto}
          currentUserId={currentUser?.id || ''}
          currentUserName={currentUser?.fullName || ''}
          readOnly={currentUser?.role === 'PROPRIETAIRE'}
        />
      </div>

      {/* 2. Top Metric Cards (CAARUD RDS Style) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        {/* KPI 1: Rotations */}
        <div className="clean-card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669'
            }}>
              <Truck size={22} />
            </div>
            <span className="badge badge-mint">Aujourd'hui</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {summary.totalTrucks}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
            Camions sortis de carrière
          </div>
        </div>

        {/* KPI 2: Chiffre d'Affaires Brut (CAB) */}
        <div className="clean-card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
            <span className="badge badge-amber">Recette GNF</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {formatGNF(summary.grossRevenueGNF)}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
            Chiffre d'affaires brut estimé
          </div>
        </div>

        {/* KPI 3: Taxes */}
        <div className="clean-card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              backgroundColor: '#fef3c7', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#d97706'
            }}>
              <Receipt size={22} />
            </div>
            <span className="badge badge-amber">Taxes</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706', lineHeight: 1.1 }}>
            {summary.totalTaxesGNF > 0 ? formatGNF(summary.totalTaxesGNF) : '0 GNF'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
            Total taxes prélevées
          </div>
        </div>

        {/* KPI 4: Carburant */}
        <div className="clean-card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              backgroundColor: '#ecfdf5', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#059669'
            }}>
              <Fuel size={22} />
            </div>
            <span className="badge badge-mint">Carburant</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {summary.fuelOpexGNF > 0 ? formatGNF(summary.fuelOpexGNF) : '0 GNF'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
            {summary.fuelLitersTotal > 0
              ? `${summary.fuelLitersTotal.toLocaleString('fr-FR')} L consommés`
              : 'Aucun carburant enregistré'}
          </div>
        </div>

      </div>

      {/* 3. Main Workspace: Left = Saisie Rapide 2-Clics | Right = Historique Récent */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Formulaire de Saisie */}
        <div className="clean-card" style={{ padding: '1.75rem' }}>
          
          {/* Date/Time picker — for retroactive entries */}
          <DateTimePicker
            value={manualDateTime}
            onChange={setManualDateTime}
            label="Date & Heure du passage"
          />

          <div style={{ marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              1. Sélectionner le Camion
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Touchez le modèle de camion qui quitte la carrière
            </p>
          </div>

          {/* Truck Selection Grid */}
          {truckModels.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed #cbd5e1',
              marginBottom: '1.5rem'
            }}>
              <AlertCircle size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontWeight: 700, color: '#0f172a' }}>Chargement des camions...</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.5rem',
              maxHeight: '400px',
              overflowY: 'auto',
              paddingRight: '0.5rem' // to avoid scrollbar overlapping content
            }}>
              {truckModels.map(truck => {
                const isSelected = selectedTruck?.id === truck.id;
                return (
                  <button
                    key={truck.id}
                    type="button"
                    onClick={() => handleSelectTruck(truck)}
                    style={{
                      padding: '1.25rem 0.85rem',
                      borderRadius: 'var(--radius-xl)',
                      border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      textAlign: 'center',
                      minHeight: '120px',
                      boxShadow: isSelected ? '0 4px 14px rgba(16, 185, 129, 0.2)' : 'var(--shadow-sm)',
                      transform: isSelected ? 'translateY(-2px)' : 'none',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease'
                    }}
                  >
                    <Truck size={32} color={isSelected ? '#059669' : '#64748b'} />
                    <div>
                      <div style={{
                        fontSize: '0.98rem',
                        fontWeight: 800,
                        color: isSelected ? '#047857' : '#0f172a',
                        lineHeight: 1.2
                      }}>
                        {truck.name}
                      </div>
                    </div>
                    <span className="badge badge-mint" style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                      {formatGNF(truck.defaultPriceGNF)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quantity Stepper */}
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '1rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #e2e8f0',
            marginBottom: '1.25rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                Quantité de Camions
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                aria-label="Diminuer la quantité de camions"
                onClick={() => handleQuantityAdjust(-1)}
                disabled={quantity <= 1}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                  opacity: quantity <= 1 ? 0.5 : 1
                }}
              >
                <Minus size={18} />
              </button>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', minWidth: '40px', textAlign: 'center' }}>
                {quantity}
              </div>
              <button
                type="button"
                aria-label="Augmenter la quantité de camions"
                onClick={() => handleQuantityAdjust(1)}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>





          {/* Price Summary & Submit Button */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#ecfdf5',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #a7f3d0',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>
                TOTAL À PERCEVOIR (x{quantity})
              </div>
              <div style={{ fontSize: '0.72rem', color: '#059669' }}>
                Taxe extraction déduite : {formatGNF(taxAmount)}
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#047857' }}>
              {formatGNF(totalPrice)}
            </div>
          </div>

          {currentUser?.role !== 'PROPRIETAIRE' && (
            <button
              type="button"
              onClick={handleValidateLoading}
              disabled={!selectedTruck}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.05rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: '#10b981',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
              }}
            >
              <CheckCircle2 size={22} />
              <span>VALIDER LE CHARGEMENT</span>
            </button>
          )}
        </div>

        {/* Right Column: Registre des Passages Récents (Style Liste CAARUD RDS) */}
        <div className="clean-card" style={{ padding: '1.75rem' }}>
          
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              Registre des Passages du Jour
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              {filteredLoadings.length} rotation(s) enregistrée(s) aujourd'hui
            </p>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <input
              type="text"
              aria-label="Rechercher un modèle de camion ou un pointeur"
              placeholder="Rechercher un modèle de camion, un pointeur..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="input-field input-pill"
              style={{ paddingLeft: '2.5rem', backgroundColor: '#f8fafc' }}
            />
            <Search size={17} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* List of Loading Rows */}
          {filteredLoadings.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed #cbd5e1'
            }}>
              <Truck size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontWeight: 700, color: '#0f172a' }}>Aucun chargement pour l'instant</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Les camions validés apparaîtront ici en temps réel.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {filteredLoadings.map(load => {
                const loadDate = new Date(load.loadingTime);
                const timeStr = loadDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={load.id}
                    className="clean-card clean-card-hover"
                    style={{
                      padding: '0.9rem 1.15rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-xl)',
                      gap: '0.75rem'
                    }}
                  >
                    {/* Left: Avatar Letter circle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        {load.truckModelName.charAt(0)}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                            {load.truckModelName}
                          </span>
                          {load.quantity > 1 && (
                            <span className="badge badge-amber">x{load.quantity}</span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {timeStr} • Pointeur : {load.createdByName || 'Agent'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount in GNF */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#047857' }}>
                        {formatGNF(load.totalPriceGNF)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Taxe: {formatGNF(load.taxAmountGNF)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />
    </div>
  );
};
