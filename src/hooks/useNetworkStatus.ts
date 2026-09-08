import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db/localDb';
import { syncAllDataWithSupabase } from '../services/supabase/supabaseSync';

export function useNetworkStatus() {
  const [isRealOnline, setIsRealOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Watch pending offline items in Dexie
  const pendingLoadings = useLiveQuery(() => 
    db.loadings.where('syncStatus').equals('PENDING').count()
  ) ?? 0;

  const pendingExpenses = useLiveQuery(() => 
    db.expenses.where('syncStatus').equals('PENDING').count()
  ) ?? 0;

  const totalPending = pendingLoadings + pendingExpenses;

  useEffect(() => {
    const handleOnline = () => setIsRealOnline(true);
    const handleOffline = () => setIsRealOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOnline = isRealOnline && !isSimulatedOffline;

  const toggleSimulateOffline = () => {
    setIsSimulatedOffline(prev => !prev);
  };

  // Trigger manual sync of all pending records
  const syncNow = useCallback(async () => {
    if (!isOnline) return { success: false, message: 'Appareil hors-ligne' };
    
    setIsSyncing(true);
    try {
      const result = await syncAllDataWithSupabase();
      
      if (result.success) {
        const nowIso = new Date().toISOString();
        await db.loadings.where('syncStatus').equals('PENDING').modify({
          syncStatus: 'SYNCED',
          syncedAt: nowIso
        });
        await db.expenses.where('syncStatus').equals('PENDING').modify({
          syncStatus: 'SYNCED',
          syncedAt: nowIso
        });
        // You might also want to mark closures as synced if needed.
        return { success: true, count: totalPending, stats: result.stats };
      } else {
        return { success: false, error: result.error || "Erreur de synchronisation inconnue" };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, totalPending]);

  // Auto-sync effect: when online and there are pending items, sync automatically
  useEffect(() => {
    if (isOnline && totalPending > 0 && !isSyncing) {
      // Small delay to batch rapid sequential saves
      const timer = setTimeout(() => {
        syncNow();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, totalPending, isSyncing, syncNow]);

  return {
    isOnline,
    isRealOnline,
    isSimulatedOffline,
    isSyncing,
    totalPending,
    toggleSimulateOffline,
    syncNow
  };
}
