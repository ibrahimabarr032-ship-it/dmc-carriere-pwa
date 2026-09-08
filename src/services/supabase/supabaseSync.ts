import { getSupabaseClient, saveSupabaseConfig } from './supabaseClient';
import { db } from '../db/localDb';
import { TruckModel, UserAccount } from '../../types/domain';

export interface SyncStats {
  pushedLoadings: number;
  pushedExpenses: number;
  pushedClosures: number;
  pushedReports: number;
  pulledTrucks: number;
  pulledUsers: number;
}

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
    // 1. Push Local Loadings to Supabase
    const localLoadings = await db.loadings.toArray();
    const pendingLoadings = localLoadings.filter(l => l.syncStatus === 'PENDING' || !l.syncStatus);
    if (pendingLoadings.length > 0) {
      const payload = pendingLoadings.map(l => ({
        id: l.id,
        truck_model_id: l.truckModelId,
        truck_model_name: l.truckModelName,
        quantity: l.quantity || 1,
        unit_price_gnf: l.unitPriceGNF,
        total_price_gnf: l.totalPriceGNF,
        tax_amount_gnf: l.taxAmountGNF || 0,
        truck_plate: l.truckPlate || null,
        client_name: l.clientName || null,
        loading_time: l.loadingTime,
        created_by_user_id: l.createdByUserId,
        created_by_user_name: l.createdByName,
        created_at: l.createdAt
      }));

      const { error } = await client.from('loadings').upsert(payload, { onConflict: 'id' });
      if (error) {
        return { success: false, stats, error: `Échec de la synchronisation des chargements: ${error.message}` };
      }
      stats.pushedLoadings = payload.length;
      syncedIds.loadings.push(...pendingLoadings.map(l => l.id));
    }

    // 2. Push Local Expenses
    const localExpenses = await db.expenses.toArray();
    const pendingExpenses = localExpenses.filter(e => e.syncStatus === 'PENDING' || !e.syncStatus);
    if (pendingExpenses.length > 0) {
      const payload = pendingExpenses.map(e => ({
        id: e.id,
        expense_date: e.expenseTime,
        category: e.category,
        amount_gnf: e.totalAmountGNF,
        liters_fuel: e.fuelLiters || null,
        price_per_liter_gnf: e.fuelPricePerLiterGNF || null,
        description: e.description || '',
        receipt_photo_url: e.receiptPhotoBase64 || null,
        created_by_user_id: e.createdByUserId,
        created_by_user_name: e.createdByName,
        created_at: e.createdAt
      }));

      const { error } = await client.from('expenses').upsert(payload, { onConflict: 'id' });
      if (error) {
        return { success: false, stats, error: `Échec de la synchronisation des dépenses: ${error.message}` };
      }
      stats.pushedExpenses = payload.length;
      syncedIds.expenses.push(...pendingExpenses.map(e => e.id));
    }

    // 3. Push Local Closures
    const localClosures = await db.dailyClosures.toArray();
    const pendingClosures = localClosures.filter(c => c.syncStatus === 'PENDING' || !c.syncStatus);
    if (pendingClosures.length > 0) {
      const payload = pendingClosures.map(c => ({
        id: c.id,
        closure_date: c.closureDate,
        total_trucks: c.totalTrucks,
        gross_revenue_gnf: c.grossRevenueGNF,
        total_taxes_gnf: c.totalTaxesGNF,
        fuel_expenses_gnf: c.totalFuelGNF,
        opex_expenses_gnf: c.totalOpexGNF,
        net_margin_gnf: c.netProfitGNF,
        is_locked: c.status === 'CLOSED',
        locked_by_user_id: c.closedByUserId,
        locked_by_user_name: c.closedByName,
        supervisor_notes: c.notes || null,
        created_at: c.closedAt
      }));

      const { error } = await client.from('daily_closures').upsert(payload, { onConflict: 'id' });
      if (error) {
        return { success: false, stats, error: `Échec de la synchronisation des clôtures: ${error.message}` };
      }
      stats.pushedClosures = payload.length;
      syncedIds.closures.push(...pendingClosures.map(c => c.id));
    }

    // 4. Push/Pull Truck Models (Catalogue)
    const localTrucks = await db.truckModels.toArray();
    if (localTrucks.length > 0) {
      const payload = localTrucks.map(t => ({
        id: t.id,
        name: t.name,
        default_price_gnf: t.defaultPriceGNF,
        axle_count: t.axleCount,
        icon_type: t.iconType,
        is_active: t.isActive,
        display_order: t.displayOrder
      }));
      const { error: truckUpsertErr } = await client.from('truck_models').upsert(payload, { onConflict: 'id' });
      if (truckUpsertErr) {
        console.warn('Truck models push warning:', truckUpsertErr.message);
      }
    }

    // Fetch latest truck models from Supabase into local db
    const { data: remoteTrucks } = await client.from('truck_models').select('*');
    if (remoteTrucks && remoteTrucks.length > 0) {
      const localTrucksToPut: TruckModel[] = remoteTrucks.map(rt => ({
        id: rt.id,
        name: rt.name,
        defaultPriceGNF: Number(rt.default_price_gnf || rt.defaultPriceGNF || 0),
        axleCount: rt.axle_count || rt.axleCount || 3,
        iconType: rt.icon_type || rt.iconType || 'medium',
        isActive: rt.is_active !== undefined ? rt.is_active : true,
        displayOrder: rt.display_order || rt.displayOrder || 1
      }));
      await db.truckModels.bulkPut(localTrucksToPut);
      stats.pulledTrucks = remoteTrucks.length;
    }

    // 5. Pull User Accounts from user_accounts
    const { data: remoteUsers, error: userErr } = await client.from('user_accounts').select('*');
    if (!userErr && remoteUsers && remoteUsers.length > 0) {
      const localUsersToPut: UserAccount[] = remoteUsers.map(ru => ({
        id: ru.id,
        fullName: ru.full_name || ru.fullName,
        role: ru.role === 'POINTEUR' ? 'AGENT_TERRAIN' : ru.role,
        pinCode: ru.pin_code || ru.pinCode,
        avatarColor: ru.avatar_color || ru.avatarColor || '#10b981',
        phone: ru.phone,
        siteName: ru.site_name || ru.siteName || 'DMC Carrière',
        isActive: ru.is_active !== undefined ? ru.is_active : true
      }));
      await db.users.bulkPut(localUsersToPut);
      stats.pulledUsers = remoteUsers.length;
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
