import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import { db, clearLocalDatabase } from '../../services/db/localDb';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { TruckModel, UserAccount, UserRole } from '../../types/domain';
import { formatGNF } from '../../services/pdf/pdfGenerator';
import {
  Truck,
  Users,
  UserPlus,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronRight
} from 'lucide-react';

export const AdminManagementView: React.FC = () => {
  const { currentUser } = useAuth();
  const { triggerHaptic } = useHaptic();

  // Sub-tabs: 'trucks' | 'users'
  const [activeTab, setActiveTab] = useState<'trucks' | 'users'>('trucks');

  // Queries
  const allUsers = useLiveQuery(() => db.users.toArray()) ?? [];
  const truckModels = useLiveQuery(async () => {
    let list = await db.truckModels.toArray();
    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  }) ?? [];

  // ==================== TRUCK CRUD STATE ====================
  const [isTruckModalOpen, setIsTruckModalOpen] = useState<boolean>(false);
  const [editingTruck, setEditingTruck] = useState<TruckModel | null>(null);
  const [truckName, setTruckName] = useState<string>('');
  const [truckPrice, setTruckPrice] = useState<string>('');
  const [truckTaxes, setTruckTaxes] = useState<{ id: string; name: string; amountGNF: number }[]>([
    { id: 't_' + Date.now(), name: 'Taxe Standard', amountGNF: 15000 }
  ]);
  const [truckAxles, setTruckAxles] = useState<number>(3);

  // ==================== USER MANAGEMENT STATE ====================
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('AGENT_TERRAIN');

  const [userCreatedMsg, setUserCreatedMsg] = useState<string>('');

  // ----------------------------------------------------
  // TRUCK CRUD HANDLERS
  // ----------------------------------------------------
  const handleOpenAddTruck = () => {
    triggerHaptic('tap');
    setEditingTruck(null);
    setTruckName('');
    setTruckPrice('');
    setTruckTaxes([{ id: 't_' + Date.now(), name: 'Taxe Standard', amountGNF: 15000 }]);
    setTruckAxles(3);
    setIsTruckModalOpen(true);
  };

  const handleOpenEditTruck = (truck: TruckModel) => {
    triggerHaptic('tap');
    setEditingTruck(truck);
    setTruckName(truck.name);
    setTruckPrice(truck.defaultPriceGNF.toString());
    setTruckTaxes(
      truck.taxes && truck.taxes.length > 0 
        ? truck.taxes.map(t => ({ ...t }))
        : (truck.defaultTaxGNF ? [{ id: 't_' + Date.now(), name: 'Taxe Standard', amountGNF: truck.defaultTaxGNF }] : [])
    );
    setTruckAxles(truck.axleCount || 3);
    setIsTruckModalOpen(true);
  };

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(truckPrice);
    const totalTaxNum = truckTaxes.reduce((sum, t) => sum + (Number(t.amountGNF) || 0), 0);
    if (!truckName.trim() || isNaN(priceNum) || priceNum <= 0) return;

    triggerHaptic('success');

    if (editingTruck) {
      await db.truckModels.update(editingTruck.id, {
        name: truckName.trim(),
        defaultPriceGNF: priceNum,
        defaultTaxGNF: totalTaxNum,
        taxes: truckTaxes,
        axleCount: truckAxles
      });

      await db.auditLogs.add({
        id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
        userId: currentUser?.id || 'admin',
        userName: currentUser?.fullName || 'Super-Admin',
        userRole: 'ADMINISTRATEUR',
        action: 'UPDATE_TRUCK',
        entityName: 'truckModels',
        entityId: editingTruck.id,
        details: { name: truckName.trim(), price: priceNum, axles: truckAxles },
        timestamp: new Date().toISOString()
      });
    } else {
      const newTruck: TruckModel = {
        id: 'trk_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
        name: truckName.trim(),
        defaultPriceGNF: priceNum,
        defaultTaxGNF: totalTaxNum,
        taxes: truckTaxes,
        axleCount: truckAxles,
        iconType: truckAxles >= 4 ? 'heavy' : truckAxles === 3 ? 'medium' : 'small',
        isActive: true,
        displayOrder: truckModels.length + 1
      };

      await db.truckModels.add(newTruck);

      await db.auditLogs.add({
        id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
        userId: currentUser?.id || 'admin',
        userName: currentUser?.fullName || 'Super-Admin',
        userRole: 'ADMINISTRATEUR',
        action: 'CREATE_TRUCK',
        entityName: 'truckModels',
        entityId: newTruck.id,
        details: { name: newTruck.name, price: priceNum, axles: truckAxles },
        timestamp: new Date().toISOString()
      });

      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#10b981', '#059669', '#34d399']
      });
    }

    setIsTruckModalOpen(false);
  };

  const handleDeleteTruck = async (truck: TruckModel) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le modèle "${truck.name}" ?`)) {
      triggerHaptic('warning');
      await db.truckModels.delete(truck.id);

      await db.auditLogs.add({
        id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
        userId: currentUser?.id || 'admin',
        userName: currentUser?.fullName || 'Super-Admin',
        userRole: 'ADMINISTRATEUR',
        action: 'DELETE_TRUCK',
        entityName: 'truckModels',
        entityId: truck.id,
        details: { name: truck.name },
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleToggleTruckActive = async (truck: TruckModel) => {
    triggerHaptic('tap');
    await db.truckModels.update(truck.id, { isActive: !truck.isActive });
  };

  // ----------------------------------------------------
  // USER CREATION (Image 5 style)
  // ----------------------------------------------------
  const handleCreateUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    triggerHaptic('success');

    const newUser: UserAccount = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      fullName: newUserName.trim(),
      role: newUserRole,
      pinCode: '0000',
      avatarColor: newUserRole === 'ADMINISTRATEUR' ? '#10b981' : newUserRole === 'PROPRIETAIRE' ? '#0284c7' : '#059669',
      isActive: true,
      phone: undefined,
      siteName: 'DMC Carrière'
    };

    await db.users.add(newUser);

    await db.auditLogs.add({
      id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
      userId: currentUser?.id || 'admin',
      userName: currentUser?.fullName || 'Administrateur Principal',
      userRole: 'ADMINISTRATEUR',
      action: 'CREATE_USER',
      entityName: 'users',
      entityId: newUser.id,
      details: { createdUser: newUser.fullName, roleAssigned: newUser.role },
      timestamp: new Date().toISOString()
    });

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#10b981', '#059669', '#7c3aed']
    });

    setUserCreatedMsg(`Compte créé avec succès pour ${newUser.fullName}. Veuillez lui transmettre le mot de passe par défaut : 0000.`);
    setTimeout(() => setUserCreatedMsg(''), 6000);

    setNewUserName('');
  };





  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.75rem 1.25rem 3.5rem' }}>
      
      {/* 1. Header (CAARUD RDS Style) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
          Administration & Direction
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.2rem' }}>
          Configuration globale du catalogue des camions et gestion des intervenants de l'équipe.
        </p>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        backgroundColor: '#ffffff',
        padding: '0.4rem',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        width: 'fit-content',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'trucks', label: 'Catalogue Camions', icon: Truck },
          { id: 'users', label: "Gestion de l'Équipe", icon: Users }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('tap');
                setActiveTab(tab.id as typeof activeTab);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor: isActive ? '#ecfdf5' : 'transparent',
                color: isActive ? '#047857' : '#64748b',
                fontSize: '0.88rem',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease'
              }}
            >
              <Icon size={17} color={isActive ? '#059669' : '#94a3b8'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CATALOGUE DES MODÈLES DE CAMIONS */}
      {activeTab === 'trucks' && (
        <div className="clean-card" style={{ padding: '1.75rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Catalogue & Grille Tarifaire des Camions
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Définissez les modèles de camions autorisés et leurs tarifs unitaires en Franc Guinéen (GNF).
              </p>
            </div>

            {currentUser?.role !== 'PROPRIETAIRE' && (
              <button
                onClick={handleOpenAddTruck}
                className="btn-primary"
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 'var(--radius-lg)',
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem'
                }}
              >
                <Plus size={16} />
                <span>+ Ajouter un modèle de camion</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {truckModels.map(truck => (
              <div
                key={truck.id}
                className="clean-card clean-card-hover"
                style={{
                  padding: '1.15rem 1.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-xl)',
                  gap: '1rem',
                  border: truck.isActive ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
                  opacity: truck.isActive ? 1 : 0.65
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: truck.isActive ? '#ecfdf5' : '#f1f5f9',
                    color: truck.isActive ? '#059669' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Truck size={24} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {truck.name}
                      </span>
                      {!truck.isActive && <span className="badge badge-red">Inactif</span>}
                    </div>

                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#047857' }}>
                      {formatGNF(truck.defaultPriceGNF)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Tarif unitaire TTC</div>
                  </div>

                  {currentUser?.role !== 'PROPRIETAIRE' && (
                    <div style={{ display: 'flex', gap: '0.45rem' }}>
                      <button
                        onClick={() => handleOpenEditTruck(truck)}
                        className="btn-outline"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}
                      >
                        <Edit2 size={15} />
                        <span>Modifier</span>
                      </button>

                      <button
                        onClick={() => handleToggleTruckActive(truck)}
                        className="btn-outline"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}
                      >
                        {truck.isActive ? 'Désactiver' : 'Activer'}
                      </button>

                      <button
                        type="button"
                        aria-label={`Supprimer le modèle ${truck.name}`}
                        onClick={() => handleDeleteTruck(truck)}
                        className="btn-outline"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#dc2626', borderColor: '#fecaca' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: GESTION DE L'ÉQUIPE (Image 5 Style) */}
      {activeTab === 'users' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          alignItems: 'start'
        }}>
          
          {/* Left Panel: Formulaire Ajouter un Intervenant */}
          {currentUser?.role !== 'PROPRIETAIRE' && (
            <div className="clean-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <UserPlus size={20} color="#059669" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Ajouter un intervenant
                </h2>
              </div>

              {userCreatedMsg && (
                <div style={{
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  marginBottom: '1.25rem'
                }}>
                  {userCreatedMsg}
                </div>
              )}

              <form onSubmit={handleCreateUserAccount}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="newUserName" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                    Identifiant (Nom & Prénom)
                  </label>
                  <input
                    id="newUserName"
                    type="text"
                    placeholder="Ex: Mamadou Diallo"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                {/* Rôles Métier */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                    Rôle & Permissions Métier
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { role: 'AGENT_TERRAIN' as UserRole, label: 'Pointeur Chantier (Saisie 2 clics)', color: '#059669' },
                      { role: 'PROPRIETAIRE' as UserRole, label: 'Propriétaire / Direction (Consultation & Rapports)', color: '#0284c7' },
                      { role: 'ADMINISTRATEUR' as UserRole, label: 'Administrateur Principal (Plein Pouvoir)', color: '#7c3aed' }
                    ].map(r => (
                      <div
                        key={r.role}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: newUserRole === r.role ? `2px solid ${r.color}` : '1px solid #e2e8f0',
                          backgroundColor: newUserRole === r.role ? '#f8fafc' : '#ffffff',
                          fontSize: '0.88rem',
                          fontWeight: newUserRole === r.role ? 700 : 500
                        }}
                      >
                        <input
                          id={`role-${r.role}`}
                          type="radio"
                          name="userRole"
                          checked={newUserRole === r.role}
                          onChange={() => setNewUserRole(r.role)}
                          style={{ accentColor: r.color }}
                        />
                        <label htmlFor={`role-${r.role}`} style={{ color: '#334155', cursor: 'pointer' }}>{r.label}</label>
                      </div>
                    ))}
                  </div>
                </div>



                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.9rem',
                    backgroundColor: '#10b981',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <span>Créer le compte</span>
                  <ChevronRight size={18} />
                </button>
              </form>
            </div>
          )}

          {/* Right Panel: Liste des Collaborateurs */}
          <div className="clean-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <Users size={20} color="#059669" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Personnel Enregistré ({allUsers.length})
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {allUsers.map(user => (
                <div
                  key={user.id}
                  className="clean-card"
                  style={{
                    padding: '0.9rem 1.15rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900
                    }}>
                      {user.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        {user.fullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        PIN : **** • {user.phone || 'Non renseigné'}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${user.role === 'ADMINISTRATEUR' ? 'badge-purple' : user.role === 'PROPRIETAIRE' ? 'badge-blue' : 'badge-mint'}`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}





      {/* TAB 5: AUDIT LOGS */}


      {/* CREATE / EDIT TRUCK MODAL */}
      {isTruckModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '460px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                {editingTruck ? 'Modifier le Modèle' : 'Nouveau Modèle de Camion'}
              </h3>
              <button
                type="button"
                aria-label="Fermer la boîte de dialogue"
                onClick={() => setIsTruckModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTruck}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="truckName" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Nom du Modèle
                </label>
                <input
                  id="truckName"
                  type="text"
                  placeholder="Ex: Benne Shacman 8 Roues"
                  value={truckName}
                  onChange={(e) => setTruckName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="truckPrice" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Tarif Unitaire TTC (Franc Guinéen GNF)
                </label>
                <input
                  id="truckPrice"
                  type="number"
                  step="5000"
                  placeholder="Ex: 500000"
                  value={truckPrice}
                  onChange={(e) => setTruckPrice(e.target.value)}
                  className="input-field font-mono"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="truckAxles" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Nombre d'essieux ({truckAxles} essieux)
                </label>
                <select
                  id="truckAxles"
                  value={truckAxles}
                  onChange={(e) => setTruckAxles(Number(e.target.value) || 3)}
                  className="input-field"
                >
                  <option value={2}>2 essieux (Petit porteur / 6 Roues)</option>
                  <option value={3}>3 essieux (10 Roues standard Howo)</option>
                  <option value={4}>4 essieux (12 Roues européen lourd)</option>
                  <option value={5}>5 essieux (Semi-remorque 40t+)</option>
                  <option value={6}>6+ essieux (Convoi exceptionnel)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    Taxes Applicables
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setTruckTaxes([...truckTaxes, { id: 't_' + Date.now(), name: '', amountGNF: 0 }]);
                    }}
                    style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>
                {truckTaxes.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem' }}>
                    Aucune taxe configurée pour ce modèle.
                  </div>
                )}
                {truckTaxes.map((tax, index) => (
                  <div key={tax.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      id={`taxName-${index}`}
                      aria-label="Nom de la taxe"
                      type="text"
                      placeholder="Nom (ex: Syndicat)"
                      value={tax.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTruckTaxes(prev => prev.map((t, i) => i === index ? { ...t, name: val } : t));
                      }}
                      className="input-field"
                      style={{ flex: 1 }}
                      required
                    />
                    <input
                      id={`taxAmount-${index}`}
                      aria-label="Montant de la taxe"
                      type="number"
                      step="500"
                      placeholder="Montant (GNF)"
                      value={tax.amountGNF || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setTruckTaxes(prev => prev.map((t, i) => i === index ? { ...t, amountGNF: val } : t));
                      }}
                      className="input-field font-mono"
                      style={{ width: '130px' }}
                      required
                    />
                    <button
                      type="button"
                      aria-label="Supprimer cette taxe"
                      onClick={() => {
                        triggerHaptic('tap');
                        setTruckTaxes(truckTaxes.filter(t => t.id !== tax.id));
                      }}
                      style={{ background: '#fee2e2', border: 'none', color: '#ef4444', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>


              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', backgroundColor: '#10b981', borderRadius: 'var(--radius-md)' }}
              >
                <Save size={18} />
                <span>{editingTruck ? 'Mettre à jour le tarif' : 'Ajouter au catalogue'}</span>
              </button>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};
