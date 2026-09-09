import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db/localDb';
import { LoadingRecord, ExpenseRecord } from '../types/domain';

/**
 * Structure agrégée des indicateurs financiers et statistiques d'exploitation.
 */
export interface FinancialSummary {
  totalTrucks: number;
  grossRevenueGNF: number; // CAB
  totalTaxesGNF: number;
  fuelOpexGNF: number;
  fuelLitersTotal: number;
  maintenanceOpexGNF: number;
  foodOpexGNF: number;
  siteFeesOpexGNF: number;
  otherOpexGNF: number;
  totalOpexGNF: number;
  netProfitGNF: number;
  netMarginPercent: number;
  truckBreakdown: {
    modelId: string;
    modelName: string;
    count: number;
    subtotalGNF: number;
    taxSubtotalGNF: number;
    percentage: number;
  }[];
  waterfallData: {
    name: string;
    amount: number;
    fill: string;
    isNet?: boolean;
  }[];
  timeSeriesData: {
    date: string;
    revenue: number;
    expenses: number;
  }[];
  filteredLoadings: LoadingRecord[];
  filteredExpenses: ExpenseRecord[];
}

/**
 * Hook React personnalisé pour calculer dynamiquement tous les flux financiers et KPIs d'exploitation
 * en temps réel à partir de la base locale IndexedDB (via requêtes Dexie `useLiveQuery`).
 * 
 * @param {string | ((date: string) => boolean)} [dateFilter] Filtre de date optionnel (date exacte YYYY-MM-DD ou prédicat).
 * @returns {FinancialSummary} Les statistiques et agrégations financières pour la période sélectionnée.
 */
export function useCalculations(dateFilter?: string | ((date: string) => boolean)) {
  // Query all loadings and expenses
  const allLoadings = useLiveQuery(() => db.loadings.toArray()) ?? [];
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) ?? [];
  const truckModels = useLiveQuery(() => db.truckModels.toArray()) ?? [];

  const summary = useMemo<FinancialSummary>(() => {
    // Filter by date if specified
    const checkDate = (isoString: string) => {
      if (!dateFilter) return true;
      if (typeof dateFilter === 'function') return dateFilter(isoString);
      return isoString.startsWith(dateFilter); // string fallback
    };

    const filteredLoadings = allLoadings.filter(l => checkDate(l.loadingTime));
    const filteredExpenses = allExpenses.filter(e => checkDate(e.expenseTime));

    // 1. Calculate Gross Revenue (CAB) & Taxes & Truck Breakdown
    let totalTrucks = 0;
    let grossRevenueGNF = 0;
    let totalTaxesGNF = 0;

    const modelMap: Record<string, { count: number; subtotal: number; tax: number; name: string }> = {};

    // Initialize map from truck models
    truckModels.forEach(m => {
      modelMap[m.id] = { count: 0, subtotal: 0, tax: 0, name: m.name };
    });

    filteredLoadings.forEach((load: LoadingRecord) => {
      totalTrucks += load.quantity;
      grossRevenueGNF += load.totalPriceGNF;
      totalTaxesGNF += load.taxAmountGNF;

      if (!modelMap[load.truckModelId]) {
        modelMap[load.truckModelId] = {
          count: 0,
          subtotal: 0,
          tax: 0,
          name: load.truckModelName || 'Modèle Inconnu'
        };
      }
      modelMap[load.truckModelId].count += load.quantity;
      modelMap[load.truckModelId].subtotal += load.totalPriceGNF;
      modelMap[load.truckModelId].tax += load.taxAmountGNF;
    });

    // 2. Calculate OPEX (Expenses breakdown)
    let fuelOpexGNF = 0;
    let fuelLitersTotal = 0;
    let maintenanceOpexGNF = 0;
    let foodOpexGNF = 0;
    let siteFeesOpexGNF = 0;
    let otherOpexGNF = 0;

    filteredExpenses.forEach((exp: ExpenseRecord) => {
      switch (exp.category) {
        case 'FUEL':
          fuelOpexGNF += exp.totalAmountGNF;
          fuelLitersTotal += exp.fuelLiters || 0;
          break;
        case 'MAINTENANCE':
          maintenanceOpexGNF += exp.totalAmountGNF;
          break;
        case 'FOOD':
          foodOpexGNF += exp.totalAmountGNF;
          break;
        case 'SITE_FEES':
          siteFeesOpexGNF += exp.totalAmountGNF;
          break;
        default:
          otherOpexGNF += exp.totalAmountGNF;
          break;
      }
    });

    const totalOpexGNF = fuelOpexGNF + maintenanceOpexGNF + foodOpexGNF + siteFeesOpexGNF + otherOpexGNF;
    const netProfitGNF = grossRevenueGNF - (totalTaxesGNF + totalOpexGNF);
    const netMarginPercent = grossRevenueGNF > 0 ? (netProfitGNF / grossRevenueGNF) * 100 : 0;

    // 3. Format Breakdown for Donut Charts
    const truckBreakdown = Object.entries(modelMap).reduce<{
      modelId: string;
      modelName: string;
      count: number;
      subtotalGNF: number;
      taxSubtotalGNF: number;
      percentage: number;
    }[]>((acc, [modelId, data]) => {
      if (data.count > 0 || truckModels.some(tm => tm.id === modelId)) {
        acc.push({
          modelId,
          modelName: data.name,
          count: data.count,
          subtotalGNF: data.subtotal,
          taxSubtotalGNF: data.tax,
          percentage: totalTrucks > 0 ? Math.round((data.count / totalTrucks) * 100) : 0
        });
      }
      return acc;
    }, []);

    // 4. Format Waterfall Data
    const waterfallData = [
      { name: 'CAB (Chiffre Brut)', amount: grossRevenueGNF, fill: '#F59E0B' },
      { name: 'Taxes Déduites', amount: totalTaxesGNF, fill: '#EF4444' },
      { name: 'Carburant', amount: fuelOpexGNF, fill: '#F97316' },
      { name: 'Autres OPEX', amount: maintenanceOpexGNF + foodOpexGNF + siteFeesOpexGNF + otherOpexGNF, fill: '#EAB308' },
      { name: 'Marge Nette', amount: netProfitGNF, fill: '#10B981', isNet: true }
    ];

    // 5. Format Time Series Data
    const timeSeriesMap: Record<string, { revenue: number; expenses: number }> = {};
    
    filteredLoadings.forEach(l => {
      const day = l.loadingTime.substring(0, 10);
      if (!timeSeriesMap[day]) timeSeriesMap[day] = { revenue: 0, expenses: 0 };
      timeSeriesMap[day].revenue += l.totalPriceGNF;
      timeSeriesMap[day].expenses += l.taxAmountGNF;
    });

    filteredExpenses.forEach(e => {
      const day = e.expenseTime.substring(0, 10);
      if (!timeSeriesMap[day]) timeSeriesMap[day] = { revenue: 0, expenses: 0 };
      timeSeriesMap[day].expenses += e.totalAmountGNF;
    });

    const timeSeriesData = Object.entries(timeSeriesMap)
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        expenses: data.expenses
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalTrucks,
      grossRevenueGNF,
      totalTaxesGNF,
      fuelOpexGNF,
      fuelLitersTotal,
      maintenanceOpexGNF,
      foodOpexGNF,
      siteFeesOpexGNF,
      otherOpexGNF,
      totalOpexGNF,
      netProfitGNF,
      netMarginPercent,
      truckBreakdown,
      waterfallData,
      timeSeriesData,
      filteredLoadings,
      filteredExpenses
    };
  }, [allLoadings, allExpenses, truckModels, dateFilter]);

  return useMemo(() => ({ 
    summary, 
    rawLoadings: summary.filteredLoadings, 
    rawExpenses: summary.filteredExpenses 
  }), [summary]);
}
