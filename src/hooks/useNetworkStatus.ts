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
      
      if (result.success && result.syncedIds) {
        const nowIso = new Date().toISOString();
        if (result.syncedIds.loadings.length > 0) {
          await db.loadings.where('id').anyOf(result.syncedIds.loadings).modify({
            syncStatus: 'SYNCED',
            syncedAt: nowIso
          });
        }
        if (result.syncedIds.expenses.length > 0) {
          await db.expenses.where('id').anyOf(result.syncedIds.expenses).modify({
            syncStatus: 'SYNCED',
            syncedAt: nowIso
          });
        }
        if (result.syncedIds.closures.length > 0) {
          await db.dailyClosures.where('id').anyOf(result.syncedIds.closures).modify({
            syncStatus: 'SYNCED'
          });
        }
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
