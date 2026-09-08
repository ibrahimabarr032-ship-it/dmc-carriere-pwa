import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { UserAccount, UserRole } from '../../types/domain';
import { Users, Shield, Lock, Eye, EyeOff, ArrowRight, X, AlertCircle } from 'lucide-react';

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: UserAccount;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({ isOpen, onClose, targetUser }) => {
  const { users, loginWithPin } = useAuth();
  const { triggerHaptic } = useHaptic();

  // Tab State: 'EQUIPE' (Pointeurs) vs 'DIRECTION' (Admin & Propriétaires)
  const [activeTab, setActiveTab] = useState<'EQUIPE' | 'DIRECTION'>(
    targetUser?.role === 'AGENT_TERRAIN' ? 'EQUIPE' : 'DIRECTION'
  );

  const filteredUsers = users.filter(u =>
    activeTab === 'EQUIPE' ? u.role === 'AGENT_TERRAIN' : u.role === 'ADMINISTRATEUR' || u.role === 'PROPRIETAIRE'
  );

  const [selectedUserId, setSelectedUserId] = useState<string>(
    targetUser?.id || (filteredUsers[0]?.id || users[0]?.id || '')
  );
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !pin) {
      setErrorMsg('Veuillez sélectionner un profil et renseigner le mot de passe / code PIN.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const success = await loginWithPin(selectedUserId, pin);
      
      if (success) {
        triggerHaptic('success');
        setPin('');
        onClose();
      } else {
        triggerHaptic('error');
        setErrorMsg('Mot de passe ou Code PIN incorrect (ex: 0000, 1234, 9999)');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabChange = (tab: 'EQUIPE' | 'DIRECTION') => {
    triggerHaptic('tap');
    setActiveTab(tab);
    setErrorMsg('');
    const newFiltered = users.filter(u =>
      tab === 'EQUIPE' ? u.role === 'AGENT_TERRAIN' : u.role === 'ADMINISTRATEUR' || u.role === 'PROPRIETAIRE'
    );
    if (newFiltered.length > 0) {
      setSelectedUserId(newFiltered[0].id);
    }
  };

  return (
    <div className="modal-backdrop">
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
            DMC <span style={{ color: '#10b981' }}>CARRIÈRE</span>
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.25rem' }}>
            Portail de gestion et de traçabilité de la carrière
          </p>
        </div>

        {/* Clean Login Card */}
        <div className="clean-card animate-slide-up" style={{
          width: '100%',
          padding: '2rem 1.75rem',
          position: 'relative'
        }}>
          {/* Close button */}
          <button
            type="button"
            aria-label="Fermer la boîte de dialogue"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.4rem'
            }}
          >
            <X size={20} />
          </button>

          {/* Segmented Tabs: Équipe vs Direction */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '1.75rem'
          }}>
            <button
              type="button"
              onClick={() => handleTabChange('EQUIPE')}
              style={{
                flex: 1,
                padding: '0.75rem 0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: 'none',
                background: 'transparent',
                fontSize: '0.92rem',
                fontWeight: activeTab === 'EQUIPE' ? 800 : 600,
                color: activeTab === 'EQUIPE' ? '#059669' : '#64748b',
                borderBottom: activeTab === 'EQUIPE' ? '3px solid #10b981' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'border-bottom 0.15s ease, color 0.15s ease'
              }}
            >
              <Users size={18} color={activeTab === 'EQUIPE' ? '#059669' : '#94a3b8'} />
              <span>Équipe</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('DIRECTION')}
              style={{
                flex: 1,
                padding: '0.75rem 0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: 'none',
                background: 'transparent',
                fontSize: '0.92rem',
                fontWeight: activeTab === 'DIRECTION' ? 800 : 600,
                color: activeTab === 'DIRECTION' ? '#059669' : '#64748b',
                borderBottom: activeTab === 'DIRECTION' ? '3px solid #10b981' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'border-bottom 0.15s ease, color 0.15s ease'
              }}
            >
              <Shield size={18} color={activeTab === 'DIRECTION' ? '#059669' : '#94a3b8'} />
              <span>Direction</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Field 1: Identifiant Intervenant */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="modalSelectedUserId" style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '0.45rem'
              }}>
                Identifiant Intervenant
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  id="modalSelectedUserId"
                  value={selectedUserId}
                  onChange={(e) => {
                    triggerHaptic('tap');
                    setSelectedUserId(e.target.value);
                  }}
                  className="input-field"
                  style={{
                    paddingLeft: '2.5rem',
                    appearance: 'auto',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role === 'ADMINISTRATEUR' ? 'Admin' : u.role === 'PROPRIETAIRE' ? 'Propriétaire' : 'Pointeur'})
                    </option>
                  ))}
                </select>
                <div style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#94a3b8'
                }}>
                  <Users size={18} />
                </div>
              </div>
            </div>

            {/* Field 2: Mot de passe / Code PIN */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="modalPinInput" style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '0.45rem'
              }}>
                Mot de passe / Code PIN
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="modalPinInput"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••"
                  className="input-field"
                  style={{
                    paddingLeft: '2.5rem',
                    paddingRight: '2.5rem',
                    fontSize: '1rem',
                    letterSpacing: showPin ? 'normal' : '0.2em'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#94a3b8'
                }}>
                  <Lock size={18} />
                </div>
                <button
                  type="button"
                  aria-label="Afficher/Masquer le code PIN"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.25rem'
                  }}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                marginBottom: '1.25rem',
                fontWeight: 600
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Big Green Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.9rem 1.25rem',
                fontSize: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#10b981',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              <span>Se connecter à l'espace</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Quick PIN Hint */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.76rem', color: '#64748b' }}>
              PINs démo : <strong>0000</strong> (Admin) • <strong>9999</strong> (Propriétaire) • <strong>1234</strong> (Pointeur)
            </p>
          </div>
        </div>

        {/* Clean Footer Text */}
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '1.5rem', lineHeight: 1.4 }}>
          V2.0 - Accès strictement réservé au personnel autorisé.<br />
          Toutes les opérations sont tracées et synchronisées.
        </p>
      </div>
    </div>
  );
};
