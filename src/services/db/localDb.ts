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

export async function clearLocalDatabase(): Promise<void> {
  await Promise.all([
    db.users.clear(),
    db.truckModels.clear(),
    db.taxConfigs.clear(),
    db.loadings.clear(),
    db.expenses.clear(),
    db.dailyClosures.clear(),
    db.auditLogs.clear(),
    db.syncQueue.clear()
  ]);
  
  // Reload the page to force state reset and re-sync from Supabase
  window.location.reload();
}
