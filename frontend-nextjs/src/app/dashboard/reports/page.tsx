'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  FileText,
  Download,
  Calendar,
  Eye,
  CheckCircle,
  AlertTriangle,
  Play,
  TrendingUp,
  Settings,
  Database
} from 'lucide-react';

interface ReportTable {
  head: string[];
  rows: string[][];
  title: string;
}

export default function ReportsPage() {
  const { showSuccess, showError, showInfo } = useToast();

  const [type, setType] = useState('finance');
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Results states
  const [reportResultHtml, setReportResultHtml] = useState<React.ReactNode | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [lastTable, setLastTable] = useState<ReportTable | null>(null);

  // Import states
  const [importType, setImportType] = useState('payments');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResultText, setImportResultText] = useState<string | null>(null);

  const getRange = useCallback(() => {
    const now = new Date();
    let start: Date;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (period === 'custom' && from && to) {
      return { start: new Date(from), end: new Date(to + 'T23:59:59') };
    }

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    return { start, end };
  }, [period, from, to]);

  const inRange = useCallback((dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const { start, end } = getRange();
    return d >= start && d <= end;
  }, [getRange]);

  const getPeriodLabel = useCallback(() => {
    const { start, end } = getRange();
    return `${Helpers.formatDate(start.toISOString())} → ${Helpers.formatDate(end.toISOString())}`;
  }, [getRange]);

  // FINANCE REPORT GENERATION
  const generateFinanceReport = useCallback(async () => {
    const [pays, exps] = await Promise.all([
      API.get('/payments'),
      API.get('/expenses')
    ]);
    const payments = (pays.data || []).filter((p: any) => inRange(p.payment_date));
    const expenses = (exps.data || []).filter((e: any) => inRange(e.created_at));

    const revenue = payments
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

    const unpaid = payments
      .filter((p: any) => ['pending', 'failed'].includes(p.status))
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

    const spent = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.total_price || 0), 0);

    const rows = [
      ['Revenus encaissés', Helpers.formatMoney(revenue)],
      ['Impayés / en attente', Helpers.formatMoney(unpaid)],
      ['Dépenses', Helpers.formatMoney(spent)],
      ['Solde net', Helpers.formatMoney(revenue - spent)],
    ];

    setLastTable({ head: ['Indicateur', 'Montant'], rows, title: 'Rapport financier' });

    setReportResultHtml(
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 flex items-center gap-3">
            <span className="text-xl">💰</span>
            <div>
              <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(revenue)}</p>
              <p className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Revenus</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 flex items-center gap-3">
            <span className="text-xl text-red-500">🔴</span>
            <div>
              <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(unpaid)}</p>
              <p className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Impayés</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 flex items-center gap-3">
            <span className="text-xl">🧾</span>
            <div>
              <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(spent)}</p>
              <p className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Dépenses</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 flex items-center gap-3">
            <span className="text-xl">📈</span>
            <div>
              <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(revenue - spent)}</p>
              <p className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Solde net</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-text-muted font-semibold italic">
          💡 {payments.length} paiement(s) · {expenses.length} dépense(s) détectés sur la période.
        </p>
      </div>
    );
  }, [inRange]);

  // MAINTENANCE REPORT GENERATION
  const generateMaintenanceReport = useCallback(async () => {
    const [maint, exps] = await Promise.all([
      API.get('/maintenance'),
      API.get('/expenses')
    ]);
    const items = (maint.data || []).filter((m: any) => inRange(m.created_at));
    const byStatus = (s: string) => items.filter((m: any) => m.status === s).length;
    const cost = (exps.data || []).filter((e: any) => inRange(e.created_at)).reduce((sum: number, e: any) => sum + parseFloat(e.total_price || 0), 0);

    const rows = [
      ['Total interventions', String(items.length)],
      ['Signalées', String(byStatus('reported'))],
      ['En cours', String(byStatus('in_progress'))],
      ['Terminées', String(byStatus('completed'))],
      ['Coût matériaux', Helpers.formatMoney(cost)],
    ];

    setLastTable({ head: ['Indicateur', 'Valeur'], rows, title: 'Rapport maintenance' });

    setReportResultHtml(
      <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
        <table className="w-full text-left border-collapse text-xs font-semibold">
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b last:border-0 border-border-custom hover:bg-bg-hover/50">
                <td className="px-5 py-3.5 text-text-primary font-extrabold">{r[0]}</td>
                <td className="px-5 py-3.5 text-text-secondary">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [inRange]);

  // REAL ESTATE REPORT GENERATION
  const generateRealEstateReport = useCallback(async () => {
    const [apts, tenants] = await Promise.all([
      API.get('/apartments'),
      API.get('/tenants')
    ]);
    const total = apts.data?.length || 0;
    const occupied = (apts.data || []).filter((a: any) => a.status === 'occupied').length;
    const free = (apts.data || []).filter((a: any) => a.status === 'free').length;
    const rate = total ? Math.round((occupied / total) * 100) : 0;
    const newTenants = (tenants.data || []).filter((t: any) => inRange(t.created_at)).length;

    const rows = [
      ['Logements total', String(total)],
      ['Occupés', String(occupied)],
      ['Libres', String(free)],
      ["Taux d'occupation", rate + '%'],
      ['Nouveaux locataires (période)', String(newTenants)],
    ];

    setLastTable({ head: ['Indicateur', 'Valeur'], rows, title: 'Rapport immobilier' });

    setReportResultHtml(
      <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
        <table className="w-full text-left border-collapse text-xs font-semibold">
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b last:border-0 border-border-custom hover:bg-bg-hover/50">
                <td className="px-5 py-3.5 text-text-primary font-extrabold">{r[0]}</td>
                <td className="px-5 py-3.5 text-text-secondary">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [inRange]);

  const handleGenerate = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      if (type === 'finance') {
        await generateFinanceReport();
      } else if (type === 'maintenance') {
        await generateMaintenanceReport();
      } else {
        await generateRealEstateReport();
      }
    } catch (e: any) {
      setReportResultHtml(
        <div className="text-center py-6 text-red-500 font-bold">
          ⚠️ {e.message || 'Impossible de générer le rapport.'}
        </div>
      );
    } finally {
      setIsLoadingReport(false);
    }
  }, [type, generateFinanceReport, generateMaintenanceReport, generateRealEstateReport]);

  useEffect(() => {
    handleGenerate();
  }, [type, period, handleGenerate]);

  // EXPORT PDF
  const handleExportPDF = () => {
    if (!lastTable) return;
    const t = lastTable;
    const doc = new jsPDF();
    const SKY = [14, 165, 233] as [number, number, number];

    // Header drawing
    doc.setFillColor(...SKY);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); 
    doc.setFont('helvetica', 'bold');
    doc.text('SMG IMMOBILIER', 14, 13);
    doc.setFontSize(10); 
    doc.setFont('helvetica', 'normal');
    doc.text('Gestion immobilière — Douala, Cameroun', 14, 20);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13); 
    doc.setFont('helvetica', 'bold'); 
    doc.text(t.title, 14, 40);

    doc.setFontSize(10); 
    doc.setFont('helvetica', 'normal'); 
    doc.text('Période : ' + getPeriodLabel(), 14, 47);

    // AutoTable call
    (doc as any).autoTable({
      startY: 52,
      head: [t.head],
      body: t.rows,
      theme: 'grid',
      headStyles: { fillColor: SKY }
    });

    // Footer drawing
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...SKY); 
    doc.setLineWidth(0.5); 
    doc.line(14, h - 20, 196, h - 20);
    doc.setFontSize(8); 
    doc.setTextColor(100, 116, 139);
    doc.text('SMG IMMOBILIER • contact@smg-immobilier.com • +237 6 00 00 00 00', 14, h - 14);
    doc.text('Document généré le ' + new Date().toLocaleDateString('fr-FR'), 14, h - 9);

    doc.save(t.title.replace(/\s+/g, '_') + '.pdf');
    showSuccess('PDF exporté avec succès.');
  };

  // EXPORT EXCEL
  const handleExportExcel = () => {
    if (!lastTable) return;
    const t = lastTable;
    const ws = XLSX.utils.aoa_to_sheet([t.head, ...t.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, t.title.replace(/\s+/g, '_') + '.xlsx');
    showSuccess('Excel exporté avec succès.');
  };

  // EXPORT CSV
  const handleExportCSV = () => {
    if (!lastTable) return;
    const t = lastTable;
    const csvContent = [t.head, ...t.rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${t.title.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV exporté avec succès.');
  };

  // EXCEL / CSV IMPORTS
  const TEMPLATES: Record<string, string[]> = {
    payments: ['tenant_id', 'apartment_id', 'amount', 'payment_method', 'payment_date', 'status'],
    expenses: ['maintenance_id', 'item_name', 'category', 'quantity', 'unit_price', 'supplier'],
    tenants: ['full_name', 'email', 'phone', 'cni', 'profession'],
  };

  const handleDownloadTemplate = () => {
    const cols = TEMPLATES[importType];
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modele');
    XLSX.writeFile(wb, `modele_${importType}.xlsx`);
    showSuccess('Modèle de tableau téléchargé.');
  };

  const handlePreviewImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) {
          showError('Le fichier est vide.');
          return;
        }

        // De-duplicate rows for preview safety
        const seen = new Set();
        const deduped = rows.filter((r) => {
          const k = JSON.stringify(r);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        setParsedRows(deduped);
        setImportResultText(null);
        showSuccess(`${deduped.length} ligne(s) détectée(s) dans le fichier.`);
      } catch (err: any) {
        showError('Erreur de lecture : ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    const endpoint = {
      payments: '/payments',
      expenses: '/expenses',
      tenants: '/tenants'
    }[importType] || '/payments';

    setIsImporting(true);
    setImportResultText("Import en cours...");
    showInfo("Lancement de l'import groupé...");

    let ok = 0;
    let fail = 0;

    for (const row of parsedRows) {
      try {
        await API.post(endpoint, row);
        ok++;
      } catch (_) {
        fail++;
      }
    }

    setIsImporting(false);
    setImportResultText(`Importation complétée : ${ok} ligne(s) importée(s), ${fail} échec(s)`);
    showSuccess(`Importation terminée ! Réussis : ${ok}, Échecs : ${fail}`);
    setParsedRows([]);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">📊 Rapports & Analyses</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Générez des synthèses d'activité et importez des listes de données par fichiers
          </p>
        </div>
      </div>

      {/* FILTER CONTROLS CARD */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Filtres du rapport</h3>
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="flex flex-col gap-1 w-full max-w-[200px]">
            <label className="text-[10px] uppercase font-bold text-text-muted">Type de rapport</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 border border-border-custom bg-bg-surface rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
            >
              <option value="finance">📊 Financier</option>
              <option value="maintenance">🔧 Maintenance</option>
              <option value="realestate">🏢 Immobilier</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full max-w-[180px]">
            <label className="text-[10px] uppercase font-bold text-text-muted">Période</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-border-custom bg-bg-surface rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois</option>
              <option value="quarter">Ce trimestre</option>
              <option value="year">Cette année</option>
              <option value="custom">Personnalisée</option>
            </select>
          </div>

          {period === 'custom' && (
            <div className="flex items-end gap-2 animate-slide-in">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-text-muted">Du</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-text-muted">Au</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-end self-end">
            <button
              onClick={handleGenerate}
              className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover shadow-sm font-bold cursor-pointer transition-colors"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* REPORT RESULT CARD */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-border-custom gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              {lastTable?.title || 'Rapport'}
            </h3>
            <span className="text-[10px] text-text-muted mt-1 inline-block font-semibold">
              Période : {getPeriodLabel()}
            </span>
          </div>

          {/* Export bar */}
          {lastTable && (
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 border border-border-custom rounded-xl hover:bg-bg-hover text-xs font-bold text-text-secondary cursor-pointer shadow-sm transition-all"
              >
                📄 PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 border border-border-custom rounded-xl hover:bg-bg-hover text-xs font-bold text-text-secondary cursor-pointer shadow-sm transition-all"
              >
                📊 Excel
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 border border-border-custom rounded-xl hover:bg-bg-hover text-xs font-bold text-text-secondary cursor-pointer shadow-sm transition-all"
              >
                📑 CSV
              </button>
            </div>
          )}
        </div>

        {isLoadingReport ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs text-text-muted font-bold">Calcul des indicateurs...</span>
          </div>
        ) : (
          reportResultHtml
        )}
      </div>

      {/* IMPORT SECTION */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-text-primary flex items-center gap-1.5 pb-2 border-b border-border-custom">
            <Database className="w-4.5 h-4.5 text-primary" /> Importation de données (Excel ou CSV)
          </h3>
          <p className="text-xs text-text-muted mt-1 font-semibold uppercase tracking-wider">
            Prévisualisez et validez vos importations de masse
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="flex flex-col gap-1 w-full max-w-[200px]">
            <label className="text-[10px] uppercase font-bold text-text-muted">Type d'import</label>
            <select
              value={importType}
              onChange={(e) => {
                setImportType(e.target.value);
                setParsedRows([]);
                setImportResultText(null);
              }}
              className="px-3 py-2 border border-border-custom bg-bg-surface rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
            >
              <option value="payments">💳 Paiements</option>
              <option value="expenses">🔧 Dépenses (matériaux)</option>
              <option value="tenants">👤 Locataires</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full max-w-[260px]">
            <label className="text-[10px] uppercase font-bold text-text-muted">Fichier (.xlsx, .xls, .csv)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handlePreviewImport}
              className="px-3.5 py-1.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs text-text-secondary cursor-pointer"
            />
          </div>

          <div className="flex items-end self-end gap-2.5">
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 border border-border-custom rounded-xl hover:bg-bg-hover text-xs font-bold text-text-secondary cursor-pointer shadow-sm"
              title="Télécharger le modèle Excel vierge"
            >
              ⬇ Télécharger le Modèle
            </button>
          </div>
        </div>

        {/* Import Preview Rendering */}
        {(parsedRows.length > 0 || importResultText) && (
          <div className="border border-dashed border-border-custom rounded-xl p-4 bg-bg-surface-2/40 animate-slide-in space-y-4">
            {importResultText ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-bold">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{importResultText}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="text-xs text-text-primary font-extrabold">
                    {parsedRows.length} ligne(s) prêtes pour l'importation
                  </span>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? "Importation en cours..." : "✅ Valider l'importation"}
                  </button>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
                  <table className="w-full text-left border-collapse text-[11px] font-semibold">
                    <thead>
                      <tr className="border-b border-border-custom bg-bg-surface text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none">
                        {Object.keys(parsedRows[0] || {}).map((col) => (
                          <th key={col} className="px-4 py-2.5">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-custom bg-bg-surface text-text-secondary">
                      {parsedRows.slice(0, 10).map((r, idx) => (
                        <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                          {Object.keys(parsedRows[0] || {}).map((col) => (
                            <td key={col} className="px-4 py-2.5 max-w-[150px] truncate">
                              {String(r[col] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 10 && (
                  <p className="text-[10px] text-text-muted font-bold italic">
                    * Aperçu limité aux 10 premières lignes du fichier
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
