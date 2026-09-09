import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDefaultLocalData } from '../services/db/localDb';
import {
  syncAllDataWithSupabase,
  syncUserPinToSupabase,
  resetUserPinInSupabase,
  deleteUserAccountFromSupabase
} from '../services/supabase/supabaseSync';
import { UserAccount, UserRole } from '../types/domain';

/**
 * Interface du contexte d'authentification et gestion de session locale.
 */
interface AuthContextType {
  currentUser: UserAccount | null;
  users: UserAccount[];
  isLoading: boolean;
  loginWithPin: (userId: string, pin: string) => Promise<boolean>;
  updateUserPin: (userId: string, newPin: string) => Promise<boolean>;
  resetUserPin: (userId: string) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  switchUserRole: (role: UserRole) => void;
  logout: () => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fournisseur de contexte d'authentification par code PIN pour l'application DMC Carrière.
 * Gère l'utilisateur connecté, la persistance locale dans IndexedDB et la synchronisation des comptes.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('AGENT_TERRAIN');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load all active users from Dexie
  const allUsers = useLiveQuery(async () => {
    const list = await db.users.toArray();
    return list.filter(u => u.isActive !== false);
  }) ?? [];

  useEffect(() => {
    async function init() {
      // 1. Initialise immédiatement les profils locaux par défaut si premier lancement
      await seedDefaultLocalData();
      // 2. Tente de synchroniser avec Supabase pour récupérer les utilisateurs et tarifs distants
      await syncAllDataWithSupabase();
      setIsLoading(false);
    }
    init();

    // Synchronisation périodique automatique en arrière-plan toutes les 15 secondes
    const interval = setInterval(() => {
      syncAllDataWithSupabase();
    }, 15000);

    // Synchronisation immédiate quand l'onglet redevient actif ou revient en ligne
    const handleFocus = () => syncAllDataWithSupabase();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, []);

  const loginWithPin = useCallback(async (userId: string, pin: string): Promise<boolean> => {
    const user = await db.users.get(userId);
    if (user && user.pinCode === pin) {
      setCurrentUser(user);
      setActiveRole(user.role);

      // Record audit entry
      await db.auditLogs.add({
        id: 'log_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)),
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: 'USER_LOGIN',
        entityName: 'users',
        entityId: user.id,
        details: { site: user.siteName, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });

      return true;
    }
    return false;
  }, [setCurrentUser, setActiveRole]);

  const updateUserPin = useCallback(async (userId: string, newPin: string): Promise<boolean> => {
    try {
      const ok = await syncUserPinToSupabase(userId, newPin);
      if (ok) {
        setCurrentUser(prev => (prev && prev.id === userId ? { ...prev, pinCode: newPin } : prev));
      }
      return ok;
    } catch (err) {
      console.error('Erreur lors de la mise à jour du PIN:', err);
      return false;
    }
  }, []);

  const resetUserPin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const ok = await resetUserPinInSupabase(userId);
      if (ok) {
        setCurrentUser(prev => (prev && prev.id === userId ? { ...prev, pinCode: '0000' } : prev));
      }
      return ok;
    } catch (err) {
      console.error('Erreur lors de la réinitialisation du PIN:', err);
      return false;
    }
  }, []);

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const ok = await deleteUserAccountFromSupabase(userId);
      if (ok && currentUser?.id === userId) {
        setCurrentUser(null);
      }
      return ok;
    } catch (err) {
      console.error('Erreur lors de la suppression du compte:', err);
      return false;
    }
  }, [currentUser]);

  const switchUserRole = useCallback((role: UserRole) => {
    setActiveRole(role);
    const matchedUser = allUsers.find(u => u.role === role);
    if (matchedUser) {
      setCurrentUser(matchedUser);
    }
  }, [allUsers, setActiveRole, setCurrentUser]);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, [setCurrentUser]);

  const contextValue = useMemo(() => ({
    currentUser,
    users: allUsers,
    isLoading,
    loginWithPin,
    updateUserPin,
    resetUserPin,
    deleteUser,
    switchUserRole,
    logout,
    activeRole,
    setActiveRole
  }), [currentUser, allUsers, isLoading, loginWithPin, updateUserPin, resetUserPin, deleteUser, switchUserRole, logout, activeRole, setActiveRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook React personnalisé permettant d'accéder au contexte d'authentification active.
 * 
 * @throws {Error} Si invoqué en dehors d'un AuthProvider.
 * @returns {AuthContextType} Les informations de session et méthodes d'authentification.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
