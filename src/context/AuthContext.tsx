import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db/localDb';
import { syncAllDataWithSupabase } from '../services/supabase/supabaseSync';
import { UserAccount, UserRole } from '../types/domain';

interface AuthContextType {
  currentUser: UserAccount | null;
  users: UserAccount[];
  isLoading: boolean;
  loginWithPin: (userId: string, pin: string) => Promise<boolean>;
  switchUserRole: (role: UserRole) => void;
  logout: () => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      // Sync from Supabase to fetch real users and trucks
      await syncAllDataWithSupabase();
      setIsLoading(false);
    }
    init();
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
    switchUserRole,
    logout,
    activeRole,
    setActiveRole
  }), [currentUser, allUsers, isLoading, loginWithPin, switchUserRole, logout, activeRole, setActiveRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
