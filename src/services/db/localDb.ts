import Dexie, { type Table } from 'dexie';
import {
  UserAccount,
  TruckModel,
  TaxConfig,
  LoadingRecord,
  ExpenseRecord,
  DailyClosure,
  DailyReport,
  AuditLogEntry,
  SyncQueueItem
} from '../../types/domain';

/**
 * Base de données locale IndexedDB (via Dexie) pour la PWA DMC Carrière.
 * Assure le stockage hors-ligne exhaustif des flux de données métier :
 * chargements, dépenses, clôtures journalières, rapports photos, audit et file de sync.
 */
export class DMCLocalDatabase extends Dexie {
  users!: Table<UserAccount, string>;
  truckModels!: Table<TruckModel, string>;
  taxConfigs!: Table<TaxConfig, string>;
  loadings!: Table<LoadingRecord, string>;
  expenses!: Table<ExpenseRecord, string>;
  dailyClosures!: Table<DailyClosure, string>;
  dailyReports!: Table<DailyReport, string>;
  auditLogs!: Table<AuditLogEntry, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('DMCDatabase_v2');
    this.version(1).stores({
      users: 'id, role, fullName',
      truckModels: 'id, name, displayOrder',
      taxConfigs: 'id, name, taxType',
      loadings: 'id, truckModelId, loadingTime, syncStatus, createdAt',
      expenses: 'id, category, expenseTime, syncStatus, createdAt',
      dailyClosures: 'id, closureDate, status',
      auditLogs: 'id, userId, action, entityName, timestamp',
      syncQueue: 'id, entityTable, entityId, retryCount'
    });
    // Version 2: add dailyReports table
    this.version(2).stores({
      users: 'id, role, fullName',
      truckModels: 'id, name, displayOrder',
      taxConfigs: 'id, name, taxType',
      loadings: 'id, truckModelId, loadingTime, syncStatus, createdAt',
      expenses: 'id, category, expenseTime, syncStatus, createdAt',
      dailyClosures: 'id, closureDate, status',
      dailyReports: 'id, reportDate, syncStatus',
      auditLogs: 'id, userId, action, entityName, timestamp',
      syncQueue: 'id, entityTable, entityId, retryCount'
    });
  }
}

export const db = new DMCLocalDatabase();

/**
 * Purge l'intégralité des tables de la base de données locale IndexedDB (y compris photos et journaux)
 * puis recharge la page pour forcer une réinitialisation propre et resynchronisation avec Supabase.
 * 
 * @returns {Promise<void>}
 */
export async function clearLocalDatabase(): Promise<void> {
  await Promise.all([
    db.users.clear(),
    db.truckModels.clear(),
    db.taxConfigs.clear(),
    db.loadings.clear(),
    db.expenses.clear(),
    db.dailyClosures.clear(),
    db.dailyReports.clear(),
    db.auditLogs.clear(),
    db.syncQueue.clear()
  ]);
  
  // Reload the page to force state reset and re-sync from Supabase
  window.location.reload();
}
