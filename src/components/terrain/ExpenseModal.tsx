import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { db } from '../../services/db/localDb';
import { ExpenseCategory, ExpenseRecord } from '../../types/domain';
import { formatGNF } from '../../services/pdf/pdfGenerator';
import {
  Fuel,
  Camera,
  X,
  CheckCircle2,
  Trash2
} from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const { triggerHaptic } = useHaptic();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<ExpenseCategory>('FUEL');
  const [description, setDescription] = useState<string>('');
  
  // Fuel specifics
  const [fuelLiters, setFuelLiters] = useState<string>('100');
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<string>('12000');
  const [isFuelByAmountDirect, setIsFuelByAmountDirect] = useState<boolean>(false);
  const [directAmountGNF, setDirectAmountGNF] = useState<string>('1200000');

  // Photo
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Compute calculated amount
  const computedAmount = category === 'FUEL' && !isFuelByAmountDirect
    ? (parseFloat(fuelLiters) || 0) * (parseFloat(fuelPricePerLiter) || 0)
    : (parseFloat(directAmountGNF) || 0);

  // Compress photo in client memory
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    triggerHaptic('tap');

    const reader = new FileReader();
    reader.onerror = () => setIsCompressingPhoto(false);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => setIsCompressingPhoto(false);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/webp', 0.75);
        setPhotoBase64(compressedDataUrl);
        setIsCompressingPhoto(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (computedAmount <= 0) return;

    setIsSubmitting(true);
    triggerHaptic('success');

    try {
      const expenseId = 'exp_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2));
      const newExpense: ExpenseRecord = {
        id: expenseId,
        category,
        description: description.trim() || (category === 'FUEL' ? `Carburant ${fuelLiters}L engin carrière` : 'Dépense de fonctionnement'),
        fuelLiters: category === 'FUEL' && !isFuelByAmountDirect ? parseFloat(fuelLiters) || undefined : undefined,
        fuelPricePerLiterGNF: category === 'FUEL' && !isFuelByAmountDirect ? parseFloat(fuelPricePerLiter) || undefined : undefined,
        totalAmountGNF: computedAmount,
        receiptPhotoBase64: photoBase64 || undefined,
        createdByUserId: currentUser?.id || 'usr_agent_01',
        createdByName: currentUser?.fullName || 'Agent Terrain',
        expenseTime: new Date().toISOString(),
        syncStatus: 'PENDING',
        createdAt: new Date().toISOString()
      };

      await db.expenses.add(newExpense);

      await db.auditLogs.add({
        id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
        userId: currentUser?.id || 'usr_agent_01',
        userName: currentUser?.fullName || 'Agent',
        userRole: currentUser?.role || 'AGENT_TERRAIN',
        action: 'CREATE_EXPENSE',
        entityName: 'expenses',
        entityId: newExpense.id,
        details: { category, amount: computedAmount, hasPhoto: !!photoBase64 },
        timestamp: new Date().toISOString()
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to save expense', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content animate-slide-up" style={{ padding: '1.75rem' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <Fuel size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Saisie Carburant & Dépenses
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Enregistrement OPEX carrière déductible de la marge
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer la boîte de dialogue"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.4rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Category Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Catégorie de Dépense
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.4rem' }}>
              {[
                { id: 'FUEL', label: 'Carburant' },
                { id: 'MAINTENANCE', label: 'Entretien' },
                { id: 'FOOD', label: 'Repas' },
                { id: 'SITE_FEES', label: 'Frais Site' },
                { id: 'OTHER', label: 'Autre' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    setCategory(cat.id as ExpenseCategory);
                  }}
                  style={{
                    padding: '0.5rem 0.3rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid',
                    borderColor: category === cat.id ? '#10b981' : '#e2e8f0',
                    backgroundColor: category === cat.id ? '#ecfdf5' : '#ffffff',
                    color: category === cat.id ? '#047857' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: category === cat.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* If Fuel Category */}
          {category === 'FUEL' && (
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid #e2e8f0',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
                  Calcul Automatique Carburant
                </span>
                <button
                  type="button"
                  onClick={() => setIsFuelByAmountDirect(!isFuelByAmountDirect)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {isFuelByAmountDirect ? 'Passer au calcul par Litres' : 'Passer au montant direct'}
                </button>
              </div>

              {!isFuelByAmountDirect ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label htmlFor="expense-fuel-liters" style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Litres de Gazole
                    </label>
                    <input
                      id="expense-fuel-liters"
                      aria-label="Litres de Gazole"
                      type="number"
                      value={fuelLiters}
                      onChange={(e) => setFuelLiters(e.target.value)}
                      className="input-field font-mono"
                      placeholder="ex: 120"
                    />
                  </div>
                  <div>
                    <label htmlFor="expense-fuel-price" style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Prix / Litre (GNF)
                    </label>
                    <input
                      id="expense-fuel-price"
                      aria-label="Prix du litre en GNF"
                      type="number"
                      value={fuelPricePerLiter}
                      onChange={(e) => setFuelPricePerLiter(e.target.value)}
                      className="input-field font-mono"
                      placeholder="12000"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="expense-fuel-direct" style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 700 }}>
                    Montant Global Carburant (GNF)
                  </label>
                  <input
                    id="expense-fuel-direct"
                    aria-label="Montant global carburant en GNF"
                    type="number"
                    value={directAmountGNF}
                    onChange={(e) => setDirectAmountGNF(e.target.value)}
                    className="input-field font-mono"
                    placeholder="Montant en GNF"
                  />
                </div>
              )}
            </div>
          )}

          {category !== 'FUEL' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="expense-direct-amount" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Montant de la Dépense (GNF)
              </label>
              <input
                id="expense-direct-amount"
                aria-label="Montant de la dépense en GNF"
                type="number"
                value={directAmountGNF}
                onChange={(e) => setDirectAmountGNF(e.target.value)}
                className="input-field font-mono"
                style={{ fontSize: '1.2rem', fontWeight: 800 }}
                placeholder="ex: 150000"
              />
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="expense-description" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Motif / Description
            </label>
            <input
              id="expense-description"
              aria-label="Motif ou description de la dépense"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="ex: Révision filtre Poclain, Restauration midi..."
            />
          </div>

          {/* Photo Capture */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Photo du Reçu / Facturette (Optionnel)
            </span>
            
            <input
              aria-label="Sélectionner ou prendre la photo du reçu"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />

            {!photoBase64 ? (
              <button
                type="button"
                aria-label="Prendre une photo du ticket ou facture"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressingPhoto}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              >
                <Camera size={20} color="#059669" />
                <span>{isCompressingPhoto ? 'Compression...' : 'Prendre une photo du ticket'}</span>
              </button>
            ) : (
              <div style={{
                position: 'relative',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid #10b981'
              }}>
                <img
                  src={photoBase64}
                  alt="Ticket Reçu"
                  style={{ width: '100%', maxHeight: '140px', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  aria-label="Supprimer la photo du ticket"
                  onClick={() => {
                    triggerHaptic('tap');
                    setPhotoBase64(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    padding: '0.35rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Live Total Display */}
          <div style={{
            backgroundColor: '#ecfdf5',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #a7f3d0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>Total à déduire :</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#047857' }}>
              {formatGNF(computedAmount)}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || computedAmount <= 0}
            className="btn-primary"
            style={{ width: '100%', padding: '0.9rem', backgroundColor: '#10b981', borderRadius: 'var(--radius-md)' }}
          >
            <CheckCircle2 size={18} />
            <span>ENREGISTRER LA DÉPENSE</span>
          </button>
        </form>
      </div>
    </div>
  );
};
