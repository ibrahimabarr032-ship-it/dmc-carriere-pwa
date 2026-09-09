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
 * Initialise les données locales par défaut (utilisateurs, catalogue de camions et taxes)
 * si la base de données IndexedDB locale est vierge (premier lancement de l'application ou nouvel appareil).
 * 
 * @returns {Promise<void>}
 */
export async function seedDefaultLocalData(): Promise<void> {
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkPut([
      {
        id: 'admin_1',
        fullName: 'Bella',
        role: 'ADMINISTRATEUR',
        pinCode: '0000',
        avatarColor: '#3b82f6',
        siteName: 'DMC Carrière',
        isActive: true
      }
    ]);
  }

  const truckCount = await db.truckModels.count();
  if (truckCount === 0) {
    await db.truckModels.bulkPut([
      {
        id: 'trk_6_roues',
        name: '6 Roues Standard',
        defaultPriceGNF: 250000,
        axleCount: 2,
        iconType: 'small',
        isActive: true,
        displayOrder: 1,
        taxes: []
      },
      {
        id: 'trk_10_roues_howo',
        name: '10 Roues Sinotruk Howo',
        defaultPriceGNF: 450000,
        axleCount: 3,
        iconType: 'medium',
        isActive: true,
        displayOrder: 2,
        taxes: []
      },
      {
        id: 'trk_12_roues_eu',
        name: '12 Roues Heavy European',
        defaultPriceGNF: 600000,
        axleCount: 4,
        iconType: 'heavy',
        isActive: true,
        displayOrder: 3,
        taxes: []
      },
      {
        id: 'trk_1788542725523',
        name: '14 Roues Semi-Remorque',
        defaultPriceGNF: 750000,
        axleCount: 4,
        iconType: 'heavy',
        isActive: true,
        displayOrder: 4,
        taxes: []
      },
      {
        id: 'trk_1788545286363_dj2',
        name: 'Benne Semi-Remorque 16 Roues',
        defaultPriceGNF: 850000,
        axleCount: 5,
        iconType: 'heavy',
        isActive: true,
        displayOrder: 5,
        taxes: []
      }
    ]);
  }

  const taxCount = await db.taxConfigs.count();
  if (taxCount === 0) {
    await db.taxConfigs.bulkPut([
      {
        id: 'tax_commune',
        name: 'Taxe Extraction Boussoura',
        amountGNF: 15000,
        taxType: 'PER_TRUCK',
        isActive: true
      }
    ]);
  }
}

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
