export type UserRole = 'AGENT_TERRAIN' | 'ADMINISTRATEUR' | 'PROPRIETAIRE';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';

export type ExpenseCategory = 'FUEL' | 'MAINTENANCE' | 'FOOD' | 'SITE_FEES' | 'OTHER';

export interface UserAccount {
  id: string;
  fullName: string;
  role: UserRole;
  pinCode: string; // Hash ou PIN 4 chiffres
  avatarColor: string;
  isActive: boolean;
  phone?: string;
  siteName: string;
}

export interface TruckModel {
  id: string; // UUID v4
  name: string; // ex: "10 Roues Howo", "6 Roues", "12 Roues EU"
  axleCount: number;
  defaultPriceGNF: number;
  defaultTaxGNF?: number;
  taxes?: { id: string; name: string; amountGNF: number }[];
  iconType: 'small' | 'medium' | 'heavy' | 'extra_heavy';
  isActive: boolean;
  displayOrder: number;
}

export interface TaxConfig {
  id: string;
  name: string; // ex: "Taxe Communautaire / Extraction"
  taxType: 'PER_TRUCK' | 'FIXED_DAILY';
  amountGNF: number;
  isActive: boolean;
}

export interface LoadingRecord {
  id: string; // UUID v4
  truckModelId: string;
  truckModelName: string;
  quantity: number;
  unitPriceGNF: number;
  totalPriceGNF: number;
  taxAmountGNF: number;
  taxBreakdown?: { name: string; amountGNF: number }[];
  clientName?: string;
  truckPlate?: string;
  loadingTime: string; // ISO 8601
  isDeferred: boolean;
  deferredReason?: string;
  createdByUserId: string;
  createdByName: string;
  syncStatus: SyncStatus;
  syncedAt?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string; // UUID v4
  category: ExpenseCategory;
  description: string;
  fuelLiters?: number;
  fuelPricePerLiterGNF?: number;
  totalAmountGNF: number;
  receiptPhotoBase64?: string; // Image compressée WebP pour justificatif
  createdByUserId: string;
  createdByName: string;
  expenseTime: string;
  syncStatus: SyncStatus;
  syncedAt?: string;
  createdAt: string;
}

export interface DailyClosure {
  id: string; // UUID v4
  closureDate: string; // Format YYYY-MM-DD
  totalTrucks: number;
  grossRevenueGNF: number; // CAB
  totalTaxesGNF: number;
  totalFuelGNF: number;
  totalOpexGNF: number;
  netProfitGNF: number;
  truckBreakdown: Record<string, { count: number; subtotalGNF: number }>;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  closedByUserId: string;
  closedByName: string;
  closedAt: string;
  syncStatus: SyncStatus;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'CREATE_LOADING' | 'CREATE_EXPENSE' | 'DAILY_CLOSURE' | 'PRICE_UPDATE' | 'TAX_UPDATE' | 'USER_LOGIN' | 'CREATE_USER' | 'CREATE_TRUCK' | 'UPDATE_TRUCK' | 'DELETE_TRUCK';
  entityName: string;
  entityId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface SyncQueueItem {
  id: string;
  entityTable: 'loadings' | 'expenses' | 'closures' | 'audit_logs';
  entityId: string;
  action: 'UPSERT' | 'DELETE';
  payload: Record<string, unknown>;
  retryCount: number;
  lastAttempt?: string;
  error?: string;
}

export interface DailyReportPhoto {
  id: string;
  base64: string;       // WebP compressé
  takenAt: string;      // ISO — moment de la prise
  takenBy: string;      // userId
  takenByName: string;  // Nom lisible
}

export interface DailyReport {
  id: string;
  reportDate: string;           // YYYY-MM-DD
  photos: DailyReportPhoto[];   // Plusieurs photos possibles
  notes?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}
