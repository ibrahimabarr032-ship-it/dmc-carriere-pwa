import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialSummary } from '../../hooks/useCalculations';
import { LoadingRecord, ExpenseRecord, UserAccount, DailyReportPhoto } from '../../types/domain';

const gnfNumberFormat = new Intl.NumberFormat('fr-GN', {
  style: 'decimal',
  maximumFractionDigits: 0
});

export function formatGNF(amount: number): string {
  const formatted = gnfNumberFormat.format(amount);
  // Remplacer les espaces insécables par des espaces normaux pour jsPDF
  return formatted.replace(/[\u202F\u00A0]/g, ' ') + ' GNF';
}

export function generateDailyReportPDF(
  dateStr: string,
  summary: FinancialSummary,
  loadings: LoadingRecord[],
  expenses: ExpenseRecord[],
  currentUser: UserAccount,
  photos?: DailyReportPhoto[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Header Banner & Logo styling
  doc.setFillColor(13, 25, 20); // Dark Green DMC
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFillColor(245, 158, 11); // Gold Line
  doc.rect(0, 35, pageWidth, 2, 'F');

  // DMC Brand Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('DYNASTY MINING COMPANY (DMC)', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(245, 158, 11);
  doc.text('EXPLOITATION DE CARRIÈRE DE SABLE', 14, 22);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text('Système Officiel de Traçabilité des Flux & Clôture Journalière', 14, 28);

  // Date & Reference Badge (Top Right)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`DATE : ${dateStr}`, pageWidth - 14, 15, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`RÉF : DMC-BOUSS-${dateStr.replace(/-/g, '')}`, pageWidth - 14, 22, { align: 'right' });
  doc.text(`GÉNÉRÉ PAR : ${currentUser.fullName}`, pageWidth - 14, 28, { align: 'right' });

  let currentY = 46;

  // 2. Executive KPIs Box
  doc.setFillColor(245, 247, 246);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 3, 3, 'F');
  doc.setDrawColor(220, 225, 222);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 3, 3, 'S');

  // 4 mini summary columns
  const colWidth = (pageWidth - 28) / 4;
  
  // Col 1: Total Camions
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7.5);
  doc.text('TOTAL ROTATIONS', 14 + colWidth * 0.5, currentY + 7, { align: 'center' });
  doc.setTextColor(13, 25, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${summary.totalTrucks} camions`, 14 + colWidth * 0.5, currentY + 16, { align: 'center' });

  // Col 2: Chiffre d'Affaires Brut (CAB)
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('C.A. BRUT (CAB)', 14 + colWidth * 1.5, currentY + 7, { align: 'center' });
  doc.setTextColor(180, 83, 9); // Gold-Brown
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatGNF(summary.grossRevenueGNF), 14 + colWidth * 1.5, currentY + 16, { align: 'center' });

  // Col 3: Dépenses & Taxes
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('TAXES & CHARGES (OPEX)', 14 + colWidth * 2.5, currentY + 7, { align: 'center' });
  doc.setTextColor(185, 28, 28); // Red
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatGNF(summary.totalTaxesGNF + summary.totalOpexGNF), 14 + colWidth * 2.5, currentY + 16, { align: 'center' });

  // Col 4: Résultat Net d'Exploitation
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('RÉSULTAT NET (MARGE)', 14 + colWidth * 3.5, currentY + 7, { align: 'center' });
  doc.setTextColor(4, 120, 87); // Emerald
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatGNF(summary.netProfitGNF), 14 + colWidth * 3.5, currentY + 16, { align: 'center' });

  currentY += 30;

  // 3. Section Title: Rotation des Camions
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 25, 20);
  doc.text('1. RÉCAPITULATIF DES CHARGEMENTS PAR MODÈLE DE CAMION', 14, currentY);

  const truckTableRows = summary.truckBreakdown.map(item => [
    item.modelName,
    item.count.toString(),
    formatGNF(item.subtotalGNF / (item.count || 1)),
    formatGNF(item.subtotalGNF),
    formatGNF(item.taxSubtotalGNF),
    `${item.percentage}%`
  ]);

  // Total row
  truckTableRows.push([
    'TOTAL GÉNÉRAL DU JOUR',
    summary.totalTrucks.toString(),
    '-',
    formatGNF(summary.grossRevenueGNF),
    formatGNF(summary.totalTaxesGNF),
    '100%'
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['MODÈLE DE CAMION', 'QUANTITÉ', 'PRIX UNITAIRE', 'TOTAL BRUT (GNF)', 'TAXES DÉDUITES', 'PART (%)']],
    body: truckTableRows,
    theme: 'grid',
    headStyles: { fillColor: [13, 25, 20], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 250, 249] },
    styles: { cellPadding: 2.5 }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 4. Section Title: Charges Opérationnelles (OPEX) & Carburant
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 25, 20);
  doc.text('2. VENTILATION DU CARBURANT & DÉPENSES D\'EXPLOITATION', 14, currentY);

  const expenseTableRows = expenses.length > 0
    ? expenses.map(e => [
        new Date(e.expenseTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        e.category === 'FUEL' ? `Carburant (${e.fuelLiters || 0} L)` : e.category,
        e.description,
        e.createdByName,
        formatGNF(e.totalAmountGNF)
      ])
    : [['-', 'Aucune dépense enregistrée aujourd\'hui', '-', '-', '0 GNF']];

  expenseTableRows.push([
    '-',
    'TOTAL OPEX DU JOUR',
    '-',
    '-',
    formatGNF(summary.totalOpexGNF)
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['HEURE', 'CATÉGORIE', 'DESCRIPTION / MOTIF', 'SAISI PAR', 'MONTANT (GNF)']],
    body: expenseTableRows,
    theme: 'grid',
    headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    styles: { cellPadding: 2.5 }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Check if we need a new page for signature block
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  // 5. Official Signatures Block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 25, 20);
  doc.text('3. VISAS ET SIGNATURES OFFICIELLES DMC', 14, currentY);

  currentY += 5;
  const sigBoxWidth = (pageWidth - 28) / 3;

  // Box 1: Pointeur Terrain
  doc.setDrawColor(200, 200, 200);
  doc.rect(14, currentY, sigBoxWidth - 4, 28);
  doc.setFontSize(8);
  doc.text('POINTEUR / CAISSE TERRAIN', 16, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Nom : ' + currentUser.fullName, 16, currentY + 12);
  doc.text('Date & Signature :', 16, currentY + 24);

  // Box 2: Superviseur d'Exploitation
  doc.rect(14 + sigBoxWidth, currentY, sigBoxWidth - 4, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SUPERVISEUR D\'EXPLOITATION', 16 + sigBoxWidth, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Mention : "Vérifié et Conforme"', 16 + sigBoxWidth, currentY + 12);
  doc.text('Date & Signature :', 16 + sigBoxWidth, currentY + 24);

  // Box 3: Direction Générale DMC
  doc.rect(14 + sigBoxWidth * 2, currentY, sigBoxWidth - 4, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DIRECTION GÉNÉRALE DMC', 16 + sigBoxWidth * 2, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Approbation Financière', 16 + sigBoxWidth * 2, currentY + 12);
  doc.text('Cachet Officiel & Signature :', 16 + sigBoxWidth * 2, currentY + 24);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Dynasty Mining Company (DMC) SARL — Gestion de Carrière — Document généré le ${new Date().toLocaleString('fr-FR')}`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  // 4. Append Photos (if any)
  if (photos && photos.length > 0) {
    photos.forEach((photo, index) => {
      doc.addPage();
      
      // Page header for photos
      doc.setFillColor(13, 25, 20); // Dark Green DMC
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`Annexe Photo ${index + 1} / ${photos.length}`, 14, 16);
      
      const margin = 14;
      try {
        const maxW = pageWidth - margin * 2;
        const maxH = 297 - 35 - 20; // Leave space for header and footer

        let drawW = maxW;
        let drawH = maxH;
        try {
          const props = doc.getImageProperties(photo.base64);
          if (props && props.width && props.height) {
            const ratio = Math.min(maxW / props.width, maxH / props.height);
            drawW = props.width * ratio;
            drawH = props.height * ratio;
          }
        } catch {
          // Fallback if properties extraction fails
        }

        const drawX = margin + (maxW - drawW) / 2;
        doc.addImage(photo.base64, 'WEBP', drawX, 35, drawW, drawH, `photo_${index}`, 'FAST');
        
        // Subtitle
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Prise le: ${new Date(photo.takenAt).toLocaleString('fr-FR')} par ${photo.takenByName}`, margin, 297 - 10);
      } catch (err) {
        console.error("Failed to add image to PDF", err);
        doc.setTextColor(255, 0, 0);
        doc.setFontSize(12);
        doc.text("Erreur lors de l'intégration de la photo (format non supporté).", margin, 40);
      }
    });
  }

  // Save the PDF
  doc.save(`Rapport_DMC_Carriere_${dateStr}.pdf`);
}
