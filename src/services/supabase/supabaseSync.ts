import { db } from '../db/localDb';
import { getSupabaseClient, getSupabaseConfig, saveSupabaseConfig } from './supabaseClient';
import { TruckModel, UserAccount } from '../../types/domain';

export interface SyncStats {
  pushedLoadings: number;
  pushedExpenses: number;
  pushedClosures: number;
  pushedReports: number;
  pulledTrucks: number;
  pulledUsers: number;
  pulledTaxes: number;
  timestamp: string;
}

export const syncAllDataWithSupabase = async (): Promise<{ success: boolean; stats: SyncStats; error?: string }> => {
  const client = getSupabaseClient();

  const stats: SyncStats = {
    pushedLoadings: 0,
    pushedExpenses: 0,
    pushedClosures: 0,
    pushedReports: 0,
    pulledTrucks: 0,
    pulledUsers: 0,
    pulledTaxes: 0,
    timestamp: new Date().toISOString()
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
    if (localLoadings.length > 0) {
      const payload = localLoadings.map(l => ({
        id: l.id,
        "truckModelId": l.truckModelId,
        "truckPlateNumber": l.truckPlate || null,
        "driverName": null, // local model doesn't have it
        "companyName": l.clientName || null,
        "loadingTime": l.loadingTime,
        "departureTime": null, // Not used locally yet
        "ticketNumber": null, // Not used locally yet
        "priceGNF": l.totalPriceGNF,
        "taxesGNF": l.taxAmountGNF,
        "taxBreakdown": l.taxBreakdown ? structuredClone(l.taxBreakdown) : null,
        "netMarginGNF": l.totalPriceGNF - l.taxAmountGNF,
        "recordedBy": l.createdByUserId,
        "syncStatus": 'SYNCED',
        "createdAt": l.createdAt
      }));

      const { error } = await client.from('loadings').upsert(payload, { onConflict: 'id' });
      if (!error) {
        stats.pushedLoadings = payload.length;
      }
    }

    // 2. Push Local Expenses
    const localExpenses = await db.expenses.toArray();
    if (localExpenses.length > 0) {
      const payload = localExpenses.map(e => ({
        id: e.id,
        category: e.category,
        amount: e.totalAmountGNF,
        description: e.description || null,
        "expenseTime": e.expenseTime,
        "recordedBy": e.createdByUserId,
        "syncStatus": 'SYNCED',
        "createdAt": e.createdAt
      }));

      const { error } = await client.from('expenses').upsert(payload, { onConflict: 'id' });
      if (!error) {
        stats.pushedExpenses = payload.length;
      }
    }

    // 3. Push Local Closures
    const localClosures = await db.dailyClosures.toArray();
    if (localClosures.length > 0) {
      const payload = localClosures.map(c => ({
        id: c.id,
        "closureDate": c.closureDate,
        "totalLoadings": c.totalTrucks,
        "totalRevenue": c.grossRevenueGNF,
        "totalTaxes": c.totalTaxesGNF,
        "totalExpenses": c.totalFuelGNF + c.totalOpexGNF,
        "netMargin": c.netProfitGNF,
        "closedBy": c.closedByUserId,
        status: c.status,
        "createdAt": c.closedAt
      }));

      const { error } = await client.from('daily_closures').upsert(payload, { onConflict: 'id' });
      if (!error) {
        stats.pushedClosures = payload.length;
      }
    }

    // 3.5. Push Local Daily Reports
    const localReports = await db.dailyReports.toArray();
    if (localReports.length > 0) {
      const payload = localReports.map(r => ({
        id: r.id,
        reportDate: r.reportDate,
        photos: r.photos ? structuredClone(r.photos) : [],
        notes: r.notes || null,
        syncStatus: 'SYNCED',
        createdAt: r.createdAt
      }));

      const { error } = await client.from('daily_reports').upsert(payload, { onConflict: 'id' });
      if (!error) {
        stats.pushedReports = payload.length;
      }
    }

    // 4. Push/Pull Truck Models (Master data)
    const localTrucks = await db.truckModels.toArray();
    if (localTrucks.length > 0) {
      const payload = localTrucks.map(t => ({
        id: t.id,
        name: t.name,
        "axleCount": t.axleCount,
        "defaultPriceGNF": t.defaultPriceGNF,
        "iconType": t.iconType,
        "isActive": t.isActive,
        "displayOrder": t.displayOrder,
        "taxes": t.taxes ? structuredClone(t.taxes) : null
      }));
      await client.from('truck_models').upsert(payload, { onConflict: 'id' });
    }

    // Fetch latest truck models from Supabase into local db
    const { data: remoteTrucks } = await client.from('truck_models').select('*');
    if (remoteTrucks && remoteTrucks.length > 0) {
      const localTrucksToPut: TruckModel[] = remoteTrucks.map(rt => ({
        id: rt.id,
        name: rt.name,
        defaultPriceGNF: Number(rt.defaultPriceGNF),
        axleCount: rt.axleCount,
        iconType: rt.iconType,
        isActive: rt.isActive,
        displayOrder: rt.displayOrder,
        taxes: rt.taxes ? structuredClone(rt.taxes) : []
      }));
      await db.truckModels.bulkPut(localTrucksToPut);
      stats.pulledTrucks = remoteTrucks.length;
    }

    // 5. Pull User Accounts
    const { data: remoteUsers } = await client.from('users').select('*');
    if (remoteUsers && remoteUsers.length > 0) {
      const localUsersToPut: UserAccount[] = remoteUsers.map(ru => ({
        id: ru.id,
        fullName: ru.fullName,
        role: ru.role,
        pinCode: ru.pinCode,
        avatarColor: ru.avatarColor,
        phone: ru.phone,
        siteName: ru.siteName,
        isActive: ru.isActive
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
      stats
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
