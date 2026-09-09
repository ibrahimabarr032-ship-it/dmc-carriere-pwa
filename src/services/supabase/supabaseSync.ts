import { getSupabaseClient, saveSupabaseConfig } from './supabaseClient';
import { db } from '../db/localDb';
import { TruckModel, UserAccount } from '../../types/domain';

/**
 * Statistiques résumées des opérations de synchronisation montantes et descendantes.
 */
export interface SyncStats {
  pushedLoadings: number;
  pushedExpenses: number;
  pushedClosures: number;
  pushedReports: number;
  pulledTrucks: number;
  pulledUsers: number;
}

/**
 * Résultat détaillé d'une opération de synchronisation bidirectionnelle Supabase.
 */
export interface SyncResult {
  success: boolean;
  stats: SyncStats;
  syncedIds?: {
    loadings: string[];
    expenses: string[];
    closures: string[];
  };
  error?: string;
}

/**
 * Synchronise immédiatement la modification du code PIN d'un utilisateur vers IndexedDB et Supabase.
 */
export const syncUserPinToSupabase = async (userId: string, newPin: string): Promise<void> => {
  // 1. Mise à jour IndexedDB locale
  await db.users.update(userId, { pinCode: newPin });

  // 2. Mise à jour distante Supabase si connecté
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error: err1 } = await client
        .from('users')
        .update({ pinCode: newPin, pin_code: newPin })
        .eq('id', userId);

      if (err1) {
        await client
          .from('user_accounts')
          .update({ pin_code: newPin, pinCode: newPin })
          .eq('id', userId);
      }
    } catch (err) {
      console.warn('Avertissement mise à jour PIN Supabase:', err);
    }
  }
};

/**
 * Synchronise un compte utilisateur créé ou modifié vers Supabase.
 */
export const syncUserAccountToSupabase = async (user: UserAccount): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const payload = {
      id: user.id,
      fullName: user.fullName,
      full_name: user.fullName,
      role: user.role,
      pinCode: user.pinCode,
      pin_code: user.pinCode,
      avatarColor: user.avatarColor || '#10b981',
      avatar_color: user.avatarColor || '#10b981',
      isActive: user.isActive !== undefined ? user.isActive : true,
      is_active: user.isActive !== undefined ? user.isActive : true,
      phone: user.phone || null,
      siteName: user.siteName || 'DMC Carrière',
      site_name: user.siteName || 'DMC Carrière'
    };
    const { error } = await client.from('users').upsert([payload], { onConflict: 'id' });
    if (error) {
      await client.from('user_accounts').upsert([payload], { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('Avertissement sync utilisateur Supabase:', err);
  }
};

/**
 * Synchronise un modèle de camion vers Supabase.
 */
export const syncTruckModelToSupabase = async (truck: TruckModel): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const payload = {
      id: truck.id,
      name: truck.name,
      axleCount: truck.axleCount || 3,
      axle_count: truck.axleCount || 3,
      defaultPriceGNF: Number(truck.defaultPriceGNF || 0),
      default_price_gnf: Number(truck.defaultPriceGNF || 0),
      iconType: truck.iconType || 'medium',
      icon_type: truck.iconType || 'medium',
      isActive: truck.isActive !== undefined ? truck.isActive : true,
      is_active: truck.isActive !== undefined ? truck.isActive : true,
      displayOrder: truck.displayOrder || 1,
      display_order: truck.displayOrder || 1,
      taxes: truck.taxes || []
    };
    await client.from('truck_models').upsert([payload], { onConflict: 'id' });
  } catch (err) {
    console.warn('Avertissement sync camion Supabase:', err);
  }
};

/**
 * Supprime un modèle de camion dans Supabase.
 */
export const deleteTruckModelFromSupabase = async (truckId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('truck_models').delete().eq('id', truckId);
  } catch (err) {
    console.warn('Avertissement suppression camion Supabase:', err);
  }
};

/**
 * Exécute la synchronisation bidirectionnelle complète entre la base locale Dexie (IndexedDB)
 * et la base distante Supabase (PostgreSQL).
 * 
 * - Envoie les chargements (loadings), dépenses (expenses) et clôtures (dailyClosures) en attente (`PENDING`).
 * - Met à jour le catalogue de camions (`truck_models`) et les comptes utilisateurs (`user_accounts`).
 * - Retourne les identifiants confirmés pour sécuriser le marquage `SYNCED`.
 * 
 * @returns {Promise<SyncResult>} Le bilan détaillé de la synchronisation.
 */
export const syncAllDataWithSupabase = async (): Promise<SyncResult> => {
  const client = getSupabaseClient();
  const stats: SyncStats = {
    pushedLoadings: 0,
    pushedExpenses: 0,
    pushedClosures: 0,
    pushedReports: 0,
    pulledTrucks: 0,
    pulledUsers: 0
  };

  const syncedIds = {
    loadings: [] as string[],
    expenses: [] as string[],
    closures: [] as string[]
  };

  if (!client) {
    return {
      success: false,
      stats,
      error: "Supabase n'est pas encore configuré avec une clé API valide."
    };
  }

  try {
    // 1. PULL USERS EN PRIORITÉ DEPUIS SUPABASE (Source de vérité pour les PIN modifiés)
    let remoteUsers: any[] | null = null;
    let usersErr = null;
    const resUsers = await client.from('users').select('*');
    if (resUsers.error) {
      const resAccounts = await client.from('user_accounts').select('*');
      if (!resAccounts.error && resAccounts.data) {
        remoteUsers = resAccounts.data;
      } else {
        usersErr = resUsers.error;
      }
    } else {
      remoteUsers = resUsers.data;
    }

    if (!usersErr && remoteUsers && remoteUsers.length > 0) {
      const usersToPut: UserAccount[] = remoteUsers.map(ru => ({
        id: ru.id,
        fullName: ru.fullName || ru.full_name,
        role: ru.role === 'POINTEUR' ? 'AGENT_TERRAIN' : ru.role,
        pinCode: ru.pinCode || ru.pin_code,
        avatarColor: ru.avatarColor || ru.avatar_color || '#10b981',
        phone: ru.phone,
        siteName: ru.siteName || ru.site_name || 'DMC Carrière',
        isActive: ru.isActive !== undefined ? ru.isActive : (ru.is_active !== undefined ? ru.is_active : true)
      }));
      await db.users.bulkPut(usersToPut);
      stats.pulledUsers = remoteUsers.length;
    } else if (!usersErr && (!remoteUsers || remoteUsers.length === 0)) {
      // Si la table distante est vierge, on envoie les utilisateurs locaux par défaut
      const localUsers = await db.users.toArray();
      if (localUsers.length > 0) {
        const userPayload = localUsers.map(u => ({
          id: u.id,
          fullName: u.fullName,
          role: u.role,
          pinCode: u.pinCode,
          avatarColor: u.avatarColor || '#10b981',
          isActive: u.isActive !== undefined ? u.isActive : true,
          phone: u.phone || null,
          siteName: u.siteName || 'DMC Carrière'
        }));
        await client.from('users').upsert(userPayload, { onConflict: 'id' });
      }
    }

    // 2. PULL TRUCK MODELS EN PRIORITÉ DEPUIS SUPABASE
    const { data: remoteTrucks, error: trucksErr } = await client.from('truck_models').select('*');
    if (!trucksErr && remoteTrucks && remoteTrucks.length > 0) {
      const trucksToPut: TruckModel[] = remoteTrucks.map(rt => ({
        id: rt.id,
        name: rt.name,
        defaultPriceGNF: Number(rt.defaultPriceGNF ?? rt.default_price_gnf ?? 0),
        axleCount: rt.axleCount ?? rt.axle_count ?? 3,
        iconType: rt.iconType ?? rt.icon_type ?? 'medium',
        isActive: rt.isActive !== undefined ? rt.isActive : (rt.is_active !== undefined ? rt.is_active : true),
        displayOrder: rt.displayOrder ?? rt.display_order ?? 1,
        taxes: rt.taxes || []
      }));
      await db.truckModels.bulkPut(trucksToPut);
      stats.pulledTrucks = remoteTrucks.length;
    } else if (!trucksErr && (!remoteTrucks || remoteTrucks.length === 0)) {
      // Si la table camions distante est vierge, on envoie les camions locaux
      const localTrucks = await db.truckModels.toArray();
      if (localTrucks.length > 0) {
        const truckPayload = localTrucks.map(t => ({
          id: t.id,
          name: t.name,
          axleCount: t.axleCount || 3,
          defaultPriceGNF: Number(t.defaultPriceGNF || 0),
          iconType: t.iconType || 'medium',
          isActive: t.isActive !== undefined ? t.isActive : true,
          displayOrder: t.displayOrder || 1,
          taxes: t.taxes || []
        }));
        await client.from('truck_models').upsert(truckPayload, { onConflict: 'id' });
      }
    }

    // 3. PUSH LOCAL LOADINGS TO SUPABASE (Table 'loadings')
    const localLoadings = await db.loadings.toArray();
    const pendingLoadings = localLoadings.filter(l => l.syncStatus === 'PENDING' || !l.syncStatus);
    if (pendingLoadings.length > 0) {
      const payload = pendingLoadings.map(l => ({
        id: l.id,
        truckModelId: l.truckModelId,
        truckPlateNumber: l.truckPlate || null,
        driverName: null,
        companyName: l.clientName || null,
        loadingTime: l.loadingTime,
        priceGNF: l.totalPriceGNF,
        taxesGNF: l.taxAmountGNF || 0,
        netMarginGNF: (l.totalPriceGNF || 0) - (l.taxAmountGNF || 0),
        recordedBy: l.createdByName || l.createdByUserId,
        syncStatus: 'SYNCED',
        createdAt: l.createdAt,
        taxBreakdown: l.taxBreakdown || []
      }));

      const { error } = await client.from('loadings').upsert(payload, { onConflict: 'id' });
      if (error) {
        return { success: false, stats, error: `Échec synchronisation chargements: ${error.message}` };
      }
      stats.pushedLoadings = payload.length;
      syncedIds.loadings.push(...pendingLoadings.map(l => l.id));
    }

    // 4. PUSH LOCAL EXPENSES TO SUPABASE (Table 'expenses')
    const localExpenses = await db.expenses.toArray();
    const pendingExpenses = localExpenses.filter(e => e.syncStatus === 'PENDING' || !e.syncStatus);
    if (pendingExpenses.length > 0) {
      const payload = pendingExpenses.map(e => ({
        id: e.id,
        category: e.category,
        amount: e.totalAmountGNF,
        description: e.description || '',
        expenseTime: e.expenseTime,
        recordedBy: e.createdByName || e.createdByUserId,
        syncStatus: 'SYNCED',
        createdAt: e.createdAt
      }));

      const { error } = await client.from('expenses').upsert(payload, { onConflict: 'id' });
      if (error) {
        return { success: false, stats, error: `Échec synchronisation dépenses: ${error.message}` };
      }
      stats.pushedExpenses = payload.length;
      syncedIds.expenses.push(...pendingExpenses.map(e => e.id));
    }

    // 5. PUSH LOCAL DAILY REPORTS / PHOTOS (Table 'daily_reports')
    const localReports = await db.dailyReports.toArray();
    const pendingReports = localReports.filter(r => r.syncStatus === 'PENDING' || !r.syncStatus);
    if (pendingReports.length > 0) {
      const payload = pendingReports.map(r => ({
        id: r.id,
        reportDate: r.reportDate,
        photos: r.photos || [],
        notes: r.notes || '',
        syncStatus: 'SYNCED',
        createdAt: r.createdAt
      }));
      const { error: repErr } = await client.from('daily_reports').upsert(payload, { onConflict: 'id' });
      if (!repErr) {
        stats.pushedReports = payload.length;
      }
    }

    // 6. PUSH LOCAL CLOSURES (Table 'daily_closures')
    const localClosures = await db.dailyClosures.toArray();
    const pendingClosures = localClosures.filter(c => c.syncStatus === 'PENDING' || !c.syncStatus);
    if (pendingClosures.length > 0) {
      const payload = pendingClosures.map(c => ({
        id: c.id,
        closureDate: c.closureDate,
        totalTrucks: c.totalTrucks,
        grossRevenueGNF: c.grossRevenueGNF,
        totalTaxesGNF: c.totalTaxesGNF,
        fuelOpexGNF: c.totalFuelGNF,
        totalOpexGNF: c.totalOpexGNF,
        netProfitGNF: c.netProfitGNF,
        truckBreakdown: c.truckBreakdown || {},
        status: c.status,
        notes: c.notes || null,
        closedByUserId: c.closedByUserId,
        closedByName: c.closedByName,
        closedAt: c.closedAt,
        syncStatus: 'SYNCED'
      }));

      const { error } = await client.from('daily_closures').upsert(payload, { onConflict: 'id' });
      if (!error) {
        stats.pushedClosures = payload.length;
        syncedIds.closures.push(...pendingClosures.map(c => c.id));
      }
    }

    // Update config with last sync time
    saveSupabaseConfig({
      isConnected: true,
      lastSyncedAt: new Date().toISOString()
    });

    return {
      success: true,
      stats,
      syncedIds
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      stats,
      error: `Erreur lors de la synchronisation Supabase: ${message}`
    };
  }
};

