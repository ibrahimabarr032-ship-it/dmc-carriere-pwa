import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import {
  Users, Shield, Lock, Eye, EyeOff, ArrowRight,
  AlertCircle, Pickaxe, Truck, Fuel
} from 'lucide-react';

import { db } from '../../services/db/localDb';
export const LoginPage: React.FC = () => {
  const { users, loginWithPin } = useAuth();
  const { triggerHaptic } = useHaptic();

  const [activeTab, setActiveTab] = useState<'EQUIPE' | 'DIRECTION'>('EQUIPE');
  const filteredUsers = users.filter(u =>
    activeTab === 'EQUIPE' ? u.role === 'AGENT_TERRAIN' : u.role === 'ADMINISTRATEUR' || u.role === 'PROPRIETAIRE'
  );

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // States for forced PIN change
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmNewPin, setConfirmNewPin] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);

  useEffect(() => {
    const list = users.filter(u =>
      activeTab === 'EQUIPE' ? u.role === 'AGENT_TERRAIN' : (u.role === 'PROPRIETAIRE' || u.role === 'ADMINISTRATEUR')
    );
    if (list.length > 0) setSelectedUserId(list[0].id);
    setErrorMsg('');
  }, [activeTab, users]);

  const handleTabChange = (tab: 'EQUIPE' | 'DIRECTION') => {
    triggerHaptic('tap');
    setActiveTab(tab);
    setPin('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !pin) {
      setErrorMsg('Sélectionnez un profil et saisissez votre code PIN.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Intercept default PIN "0000" for forced change
      if (pin === '0000') {
        const user = await db.users.get(selectedUserId);
        if (user && user.pinCode === '0000') {
          setShowChangePinModal(true);
          return;
        }
      }

      const success = await loginWithPin(selectedUserId, pin);
      if (success) {
        triggerHaptic('success');
      } else {
        triggerHaptic('error');
        setErrorMsg('Code PIN incorrect. Vérifiez vos identifiants.');
        setPin('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || confirmNewPin.length !== 4) {
      setErrorMsg('Le code PIN doit contenir exactement 4 chiffres.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setErrorMsg('Les codes PIN ne correspondent pas.');
      return;
    }
    if (newPin === '0000') {
      setErrorMsg('Veuillez choisir un code PIN différent de 0000.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await db.users.update(selectedUserId, { pinCode: newPin });
      const success = await loginWithPin(selectedUserId, newPin);
      
      if (success) {
        triggerHaptic('success');
        setShowChangePinModal(false);
      } else {
        triggerHaptic('error');
        setErrorMsg('Erreur inattendue lors de la connexion.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bg-animated-mesh"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem'
      }}>
      
      {/* Decorative Orbs */}
      <div className="animate-float" style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div className="animate-float-delayed" style={{
        position: 'absolute', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      {/* Main Layout Grid */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '1100px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4rem',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        

        {/* ── RIGHT PANEL (Glassmorphism Login Form) ─────────── */}
        <div className="glass-panel" style={{
          flex: '0 1 420px',
          width: '100%',
          borderRadius: '24px',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          
          {/* Top label inside glass */}

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Accéder à mon espace
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Sélectionnez votre profil et saisissez votre code PIN.
          </p>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: '0.5rem', marginBottom: '1.25rem',
            background: 'rgba(0,0,0,0.04)', borderRadius: '14px', padding: '6px'
          }}>
            {(['EQUIPE', 'DIRECTION'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                style={{
                  flex: 1, padding: '0.7rem 0.5rem', border: 'none', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: activeTab === tab ? '#ffffff' : 'transparent',
                  color: activeTab === tab ? '#059669' : '#64748b',
                  boxShadow: activeTab === tab ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {tab === 'EQUIPE'
                  ? <Users size={16} color={activeTab === tab ? '#059669' : '#94a3b8'} />
                  : <Shield size={16} color={activeTab === tab ? '#059669' : '#94a3b8'} />}
                {tab === 'EQUIPE' ? 'Équipe' : 'Direction'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* User select */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="selectedUserId" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                INTERVENANT
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  id="selectedUserId"
                  value={selectedUserId}
                  onChange={(e) => { triggerHaptic('tap'); setSelectedUserId(e.target.value); }}
                  className="input-field"
                  style={{ 
                    paddingLeft: '2.75rem', fontWeight: 600, cursor: 'pointer', 
                    background: 'rgba(255,255,255,0.7)', 
                    borderColor: 'rgba(0,0,0,0.1)',
                    backdropFilter: 'blur(4px)',
                    height: '3rem',
                    fontSize: '0.95rem'
                  }}
                >
                  {filteredUsers.length === 0
                    ? <option value="">Aucun utilisateur disponible</option>
                    : filteredUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}{u.role === 'ADMINISTRATEUR' ? ' (Admin)' : u.role === 'PROPRIETAIRE' ? ' (Propriétaire)' : ''}
                        </option>
                      ))
                  }
                </select>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
                  <Users size={18} />
                </div>
              </div>
            </div>

            {/* PIN */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="pinInput" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                CODE PIN
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pinInput"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••"
                  className="input-field"
                  style={{
                    paddingLeft: '2.75rem', paddingRight: '3rem',
                    fontSize: '1.2rem', letterSpacing: showPin ? 'normal' : '0.25em',
                    background: 'rgba(255,255,255,0.7)', 
                    borderColor: 'rgba(0,0,0,0.1)',
                    backdropFilter: 'blur(4px)',
                    height: '3rem'
                  }}
                />
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
                  <Lock size={18} />
                </div>
                <button
                  type="button"
                  aria-label="Afficher/Masquer le code PIN"
                  onClick={() => setShowPin(!showPin)}
                  style={{ 
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', 
                    background: 'rgba(0,0,0,0.03)', border: 'none', color: '#64748b', 
                    cursor: 'pointer', padding: '0.4rem', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: 'rgba(254,226,226,0.8)', color: '#dc2626', border: '1px solid rgba(254,202,202,0.9)',
                padding: '0.85rem 1rem', borderRadius: '12px', fontSize: '0.85rem',
                marginBottom: '1.5rem', fontWeight: 600, backdropFilter: 'blur(4px)'
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || filteredUsers.length === 0}
              style={{
                width: '100%', padding: '1.1rem 1.5rem', border: 'none',
                borderRadius: '16px',
                background: isSubmitting ? '#059669' : 'linear-gradient(135deg, #10b981, #047857)',
                color: '#ffffff', fontSize: '1.05rem', fontWeight: 800,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                boxShadow: '0 8px 25px rgba(16,185,129,0.3)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
                letterSpacing: '0.02em'
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && filteredUsers.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(16,185,129,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting && filteredUsers.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(16,185,129,0.3)';
                }
              }}
            >
              {isSubmitting ? (
                <span>Vérification…</span>
              ) : (
                <>
                  <span>Accéder à mon espace</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      {/* Forced PIN Change Modal */}
      {showChangePinModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Lock size={28} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>Sécurité requise</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                Il s'agit de votre première connexion. Vous devez obligatoirement modifier votre code PIN avant d'accéder à l'interface.
              </p>
            </div>

            <form onSubmit={handleChangePinSubmit}>
              {errorMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '12px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="newPin" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>NOUVEAU CODE PIN</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newPin"
                    type={showNewPin ? 'text' : 'password'}
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="input-field"
                    placeholder="••••"
                    style={{ letterSpacing: '0.5em', fontSize: '1.25rem', textAlign: 'center', height: '3.5rem', paddingRight: '3rem' }}
                    required
                  />
                  <button
                    type="button"
                    aria-label="Afficher/Masquer le nouveau code PIN"
                    onClick={() => setShowNewPin(!showNewPin)}
                    style={{
                      position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                    }}
                  >
                    {showNewPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="confirmNewPin" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>CONFIRMER LE CODE PIN</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirmNewPin"
                    type={showNewPin ? 'text' : 'password'}
                    maxLength={4}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    className="input-field"
                    placeholder="••••"
                    style={{ letterSpacing: '0.5em', fontSize: '1.25rem', textAlign: 'center', height: '3.5rem', paddingRight: '3rem' }}
                    required
                  />
                  <button
                    type="button"
                    aria-label="Afficher/Masquer la confirmation du code PIN"
                    onClick={() => setShowNewPin(!showNewPin)}
                    style={{
                      position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                    }}
                  >
                    {showNewPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinModal(false);
                    setPin('');
                    setNewPin('');
                    setConfirmNewPin('');
                    setErrorMsg('');
                  }}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.85rem' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.85rem' }}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
