import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useHaptic } from '../../hooks/useHaptic';
import {
  Layers,
  BarChart3,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  KeyRound,
  User,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'terrain' | 'owner' | 'admin';
  setActiveTab: (tab: 'terrain' | 'owner' | 'admin') => void;
}

// ── Account dropdown menu ────────────────────────────────────────────────
interface AccountMenuProps {
  onClose: () => void;
}

const getInitials = (name?: string) => {
  if (!name) return 'DM';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AccountMenu: React.FC<AccountMenuProps> = ({ onClose }) => {
  const { currentUser, logout, updateUserPin } = useAuth();
  const { triggerHaptic } = useHaptic();
  const [showChangePinForm, setShowChangePinForm] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [showPinVisibility, setShowPinVisibility] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handleLogout = () => {
    triggerHaptic('tap');
    logout();
    onClose();
  };

  const handleSavePin = async () => {
    setPinError('');
    setPinSuccess('');
    if (!currentUser) return;
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setPinError('Le code PIN doit contenir exactement 4 chiffres.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Les codes PIN ne correspondent pas.');
      return;
    }
    if (newPin === '0000') {
      setPinError('Veuillez choisir un code PIN différent de 0000.');
      return;
    }

    setIsSavingPin(true);
    try {
      const ok = await updateUserPin(currentUser.id, newPin);
      if (ok) {
        triggerHaptic('success');
        setPinSuccess('Code PIN mis à jour avec succès !');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          setPinSuccess('');
          setShowChangePinForm(false);
        }, 2000);
      } else {
        triggerHaptic('error');
        setPinError('Erreur lors de la mise à jour du code PIN.');
      }
    } catch (err) {
      console.error(err);
      triggerHaptic('error');
      setPinError('Erreur lors de la mise à jour du code PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const roleLabel = currentUser?.role === 'ADMINISTRATEUR' ? 'Administrateur'
    : currentUser?.role === 'PROPRIETAIRE' ? 'Propriétaire'
    : 'Pointeur Terrain';

  const roleColor = currentUser?.role === 'PROPRIETAIRE' ? '#7c3aed'
    : currentUser?.role === 'ADMINISTRATEUR' ? '#2563eb'
    : '#059669';

  const roleBg = currentUser?.role === 'PROPRIETAIRE' ? '#f5f3ff'
    : currentUser?.role === 'ADMINISTRATEUR' ? '#eff6ff'
    : '#ecfdf5';

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
      width: '300px',
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)',
      zIndex: 200,
      overflow: 'hidden'
    }}>
      {/* User info header */}
      <div style={{
        padding: '1.25rem 1.25rem 1rem',
        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${roleColor}, ${roleColor}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '1rem', fontWeight: 900,
            flexShrink: 0
          }}>
            {currentUser?.fullName ? currentUser.fullName.substring(0, 2).toUpperCase() : 'DM'}
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {currentUser?.fullName}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              marginTop: '0.35rem', padding: '0.2rem 0.6rem',
              borderRadius: '999px', background: roleBg,
              border: `1px solid ${roleColor}33`,
              fontSize: '0.72rem', fontWeight: 700, color: roleColor
            }}>
              <User size={11} />
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div style={{ padding: '0.5rem' }}>

        {/* Change PIN */}
        <button
          onClick={() => {
            triggerHaptic('tap');
            setShowChangePinForm(!showChangePinForm);
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', border: 'none', background: 'transparent',
            borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem',
            fontWeight: 600, color: '#334155', transition: 'background 0.15s ease',
            textAlign: 'left'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <KeyRound size={16} color="#2563eb" />
          </div>
          <span style={{ flex: 1 }}>Changer mon code PIN</span>
          <ChevronDown
            size={15}
            color="#94a3b8"
            style={{ transform: showChangePinForm ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          />
        </button>

        {/* Inline PIN change form */}
        {showChangePinForm && (
          <div style={{
            margin: '0 0.5rem 0.5rem', padding: '1rem',
            background: '#f8fafc', borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <input
                aria-label="Nouveau code PIN"
                type={showPinVisibility ? "text" : "password"}
                placeholder="Nouveau code PIN"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.88rem', paddingRight: '2.5rem' }}
                maxLength={4}
              />
              <button
                type="button"
                aria-label="Afficher/Masquer le nouveau code PIN"
                onClick={() => setShowPinVisibility(!showPinVisibility)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                }}
              >
                {showPinVisibility ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input
                aria-label="Confirmer le code PIN"
                type={showPinVisibility ? "text" : "password"}
                placeholder="Confirmer le code PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.88rem', paddingRight: '2.5rem' }}
                maxLength={4}
              />
              <button
                type="button"
                aria-label="Afficher/Masquer la confirmation du code PIN"
                onClick={() => setShowPinVisibility(!showPinVisibility)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                }}
              >
                {showPinVisibility ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pinError && (
              <p style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: '0.5rem', fontWeight: 600 }}>
                {pinError}
              </p>
            )}
            {pinSuccess && (
              <p style={{ fontSize: '0.78rem', color: '#059669', marginBottom: '0.5rem', fontWeight: 600 }}>
                {pinSuccess}
              </p>
            )}
            <button
              onClick={handleSavePin}
              style={{
                width: '100%', padding: '0.6rem', borderRadius: '8px',
                background: '#2563eb', color: '#fff', border: 'none',
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Enregistrer
            </button>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: '#f1f5f9', margin: '0.25rem 0.5rem' }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', border: 'none', background: 'transparent',
            borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem',
            fontWeight: 600, color: '#dc2626', transition: 'background 0.15s ease',
            textAlign: 'left'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <LogOut size={16} color="#dc2626" />
          </div>
          <span>Se déconnecter</span>
        </button>
      </div>

      {/* Bottom label */}
      <div style={{
        padding: '0.6rem 1.25rem',
        borderTop: '1px solid #f1f5f9',
        background: '#f8fafc'
      }}>
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>
          {currentUser?.siteName || 'Guinée'}
        </p>
      </div>
    </div>
  );
};


// ── Main Header ──────────────────────────────────────────────────────────
export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser } = useAuth();
  const { isOnline, isSyncing, totalPending, syncNow } = useNetworkStatus();
  const { triggerHaptic } = useHaptic();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountMenuOpen]);

  const handleTabClick = (tab: 'terrain' | 'owner' | 'admin') => {
    triggerHaptic('tap');
    setActiveTab(tab);
  };

  const handleManualSync = async () => {
    triggerHaptic('tap');
    await syncNow();
  };

  const avatarColor = currentUser?.role === 'PROPRIETAIRE' ? '#7c3aed'
    : currentUser?.role === 'ADMINISTRATEUR' ? '#2563eb'
    : '#15803d';
  const avatarBg = currentUser?.role === 'PROPRIETAIRE' ? '#f5f3ff'
    : currentUser?.role === 'ADMINISTRATEUR' ? '#eff6ff'
    : '#dcfce7';
  const avatarBorder = currentUser?.role === 'PROPRIETAIRE' ? '#c4b5fd'
    : currentUser?.role === 'ADMINISTRATEUR' ? '#93c5fd'
    : '#86efac';

  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '64px',
        gap: '1rem'
      }}>

        {/* 1. Left: Brand */}
        <button
          onClick={() => handleTabClick('terrain')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            cursor: 'pointer', userSelect: 'none', background: 'none', border: 'none', padding: 0
          }}
        >
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669'
          }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{
              fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.02em',
              lineHeight: 1.1, color: '#0f172a'
            }}>
              DMC <span style={{ color: '#10b981' }}>CARRIÈRE</span>
            </div>
          </div>
        </button>

        {/* 2. Center: Nav Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', height: '64px' }}>
          {[
            { id: 'terrain' as const, label: 'Saisie Terrain', Icon: Layers },
            { id: 'owner' as const, label: 'Rapports & Stats', Icon: BarChart3 },
            { id: 'admin' as const, label: 'Administration', Icon: Settings },
          ].filter(tab => {
            if (currentUser?.role === 'AGENT_TERRAIN' && tab.id !== 'terrain') return false;
            return true;
          }).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                height: '64px', padding: '0 1.15rem', border: 'none', background: 'transparent',
                fontSize: '0.92rem',
                fontWeight: activeTab === id ? 800 : 600,
                color: activeTab === id ? '#0f172a' : '#64748b',
                borderBottom: activeTab === id ? '3px solid #10b981' : '3px solid transparent',
                cursor: 'pointer', transition: 'border-bottom 0.15s ease, color 0.15s ease, font-weight 0.15s ease'
              }}
            >
              <Icon size={18} color={activeTab === id ? '#10b981' : '#94a3b8'} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* 3. Right: Sync Pill + Account Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

          {/* Cloud Sync Pill */}
          <button
            onClick={handleManualSync}
            title={isOnline ? 'Connecté au Cloud (cliquer pour synchroniser)' : 'Mode Hors-ligne'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)',
              backgroundColor: isOnline ? '#f0fdf4' : '#fffbeb',
              border: isOnline ? '1px solid #bbf7d0' : '1px solid #fde68a',
              color: isOnline ? '#15803d' : '#b45309',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease'
            }}
          >
            {isOnline ? (
              <>
                <Cloud size={15} color="#16a34a" />
                <span>
                  {isSyncing ? 'Sync...' : totalPending > 0 ? `${totalPending} en attente` : 'En ligne'}
                </span>
                {totalPending > 0 && <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />}
              </>
            ) : (
              <>
                <CloudOff size={15} color="#d97706" />
                <span>Hors-ligne</span>
              </>
            )}
          </button>

          {/* Avatar + Account Dropdown */}
          <div ref={accountMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                triggerHaptic('tap');
                setIsAccountMenuOpen(prev => !prev);
              }}
              title={`${currentUser?.fullName} — Gérer mon compte`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.3rem 0.6rem 0.3rem 0.3rem',
                borderRadius: '999px',
                backgroundColor: avatarBg,
                border: `1.5px solid ${avatarBorder}`,
                cursor: 'pointer', transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}bb)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 900, color: '#fff'
              }}>
                {getInitials(currentUser?.fullName)}
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: avatarColor, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.fullName?.split(' ')[0]}
              </span>
              <ChevronDown size={14} color={avatarColor} style={{ transform: isAccountMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>

            {isAccountMenuOpen && (
              <AccountMenu onClose={() => setIsAccountMenuOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
