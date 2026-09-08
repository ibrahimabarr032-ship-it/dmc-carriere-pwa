import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { LoginPage } from './components/auth/LoginPage';
import { FieldEntryView } from './components/terrain/FieldEntryView';
import { OwnerDashboardView } from './components/owner/OwnerDashboardView';
import { AdminManagementView } from './components/admin/AdminManagementView';

function AppContent() {
  const { currentUser, isLoading } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'terrain' | 'owner' | 'admin'>('terrain');

  React.useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'AGENT_TERRAIN') {
        setActiveTab('terrain');
      } else if (currentUser.role === 'PROPRIETAIRE') {
        setActiveTab('owner');
      } else {
        setActiveTab('terrain');
      }
    }
  }, [currentUser]);

  // Loading screen while DB is being seeded
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-app-gradient)'
      }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            border: '3px solid #e2e8f0', borderTopColor: '#10b981',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
          }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Initialisation…</p>
        </div>
      </div>
    );
  }

  // ── NOT AUTHENTICATED → show Login Page ──────────────────────────────
  if (!currentUser) {
    return <LoginPage />;
  }

  // ── AUTHENTICATED → show Main App ────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-app-gradient)' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main style={{ flex: 1 }}>
        {activeTab === 'terrain' && <FieldEntryView />}
        {activeTab === 'owner' && <OwnerDashboardView />}
        {activeTab === 'admin' && <AdminManagementView />}
      </main>

      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '1.25rem 1rem',
        fontSize: '0.8rem',
        color: '#64748b'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <strong>DYNASTY MINING COMPANY (DMC)</strong> • Gestion de Carrière
          </div>
          <div>
            Système de Traçabilité &amp; Gestion • Devise : <strong>Franc Guinéen (GNF)</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
