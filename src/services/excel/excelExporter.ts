import * as XLSX from 'xlsx';
import { FinancialSummary } from '../../hooks/useCalculations';
import { LoadingRecord, ExpenseRecord } from '../../types/domain';

export function exportFinancialDataToExcel(
  dateStr: string,
  summary: FinancialSummary,
  loadings: LoadingRecord[],
  expenses: ExpenseRecord[]
): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Synthèse Financière & Bilan
  const summaryData = [
    ['DYNASTY MINING COMPANY (DMC) - RAPPORT D\'EXPLOITATION'],
    ['Date d\'exploitation :', dateStr],
    ['Devise :', 'GNF (Franc Guinéen)'],
    ['Site :', 'Carrière de Sable'],
    [''],
    ['INDICATEURS CLÉS (KPIS)', 'VALEUR', 'UNITÉ'],
    ['Total Rotations Camions', summary.totalTrucks, 'camions'],
    ['Chiffre d\'Affaires Brut (CAB)', summary.grossRevenueGNF, 'GNF'],
    ['Total Taxes d\'Extraction', summary.totalTaxesGNF, 'GNF'],
    ['Total Dépenses Carburant', summary.fuelOpexGNF, 'GNF'],
    ['Volume Carburant Consommé', summary.fuelLitersTotal, 'Litres'],
    ['Total Autres OPEX (Maintenance, Food, etc.)', summary.totalOpexGNF - summary.fuelOpexGNF, 'GNF'],
    ['Total Charges d\'Exploitation (OPEX)', summary.totalOpexGNF, 'GNF'],
    ['RÉSULTAT NET D\'EXPLOITATION (MARGE)', summary.netProfitGNF, 'GNF'],
    ['Taux de Marge Nette', `${summary.netMarginPercent.toFixed(1)}%`, '%'],
    [''],
    ['VENTILATION PAR TYPE DE CAMION', 'QUANTITÉ', 'TOTAL GNF', 'TAXES GNF', 'PART (%)']
  ];

  summary.truckBreakdown.forEach(item => {
    summaryData.push([
      item.modelName,
      item.count.toString(),
      item.subtotalGNF.toString(),
      item.taxSubtotalGNF.toString(),
      `${item.percentage}%`
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Synthese_Journaliere');

  // 2. Sheet 2: Détail des Chargements
  const loadingRows = [
    ['ID Ticket', 'Heure de Passage', 'Modèle Camion', 'Quantité', 'Prix Unitaire (GNF)', 'Total Brut (GNF)', 'Taxe (GNF)', 'Client / Immat', 'Saisie Différée', 'Pointeur / Agent']
  ];

  loadings.forEach(l => {
    loadingRows.push([
      l.id,
      new Date(l.loadingTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      l.truckModelName,
      l.quantity.toString(),
      l.unitPriceGNF.toString(),
      l.totalPriceGNF.toString(),
      l.taxAmountGNF.toString(),
      l.truckPlate || l.clientName || 'Comptant',
      l.isDeferred ? `Oui (${l.deferredReason || 'Sans motif'})` : 'Non',
      l.createdByName
    ]);
  });

  const wsLoadings = XLSX.utils.aoa_to_sheet(loadingRows);
  XLSX.utils.book_append_sheet(wb, wsLoadings, 'Detail_Chargements');

  // 3. Sheet 3: Dépenses & Carburant
  const expenseRows = [
    ['ID Dépense', 'Heure', 'Catégorie', 'Description / Motif', 'Litres Carburant', 'Prix/Litre GNF', 'Montant Total GNF', 'Saisi Par']
  ];

  expenses.forEach(e => {
    expenseRows.push([
      e.id,
      new Date(e.expenseTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      e.category,
      e.description,
      e.fuelLiters ? e.fuelLiters.toString() : '-',
      e.fuelPricePerLiterGNF ? e.fuelPricePerLiterGNF.toString() : '-',
      e.totalAmountGNF.toString(),
      e.createdByName
    ]);
  });

  const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Depenses_OPEX');

  // Write file
  XLSX.writeFile(wb, `Export_DMC_Carriere_${dateStr}.xlsx`);
}
