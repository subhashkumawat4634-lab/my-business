import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { reportText } from '../../../shared/finance';
import { Snapshot, Row } from './types';
import {
  getDocFromIndexedDB,
  fetchDocFromServer,
  triggerBrowserDownload,
} from './storage/docStorage';
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export async function shareReport(data: Snapshot, siteId?: string) {
  const message = reportText(data, siteId);
  if (Platform.OS === 'web') { await navigator.clipboard.writeText(message); return 'Statement copied to clipboard'; }
  await Share.share({ message, title: 'ThekaBook statement' }); return 'Statement ready to share';
}
export async function printOrShareHtml(html: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (err) {
              console.error('Print iframe error:', err);
            } finally {
              setTimeout(() => {
                if (iframe.parentNode) {
                  iframe.parentNode.removeChild(iframe);
                }
              }, 2500);
            }
          }, 350);
          return;
        }
      } catch (e) {
        console.warn('Iframe printing fallback to Print.printAsync', e);
      }
    }
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Sharing is unavailable on this device');
  }
}

export async function pdfReport(data: Snapshot, siteId?: string) {
  const html = `<html><head><meta charset="utf-8"><style>body{font:12px Arial;padding:32px;color:#172f31}h1{color:#11685d}pre{white-space:pre-wrap;line-height:1.7;font-family:Arial}footer{color:#71817f}</style></head><body><h1>ThekaBook</h1><pre>${escape(reportText(data, siteId))}</pre></body></html>`;
  await printOrShareHtml(html, 'Contractor statement');
}

/**
 * Generates and prints/shares an Individual Worker Monthly Attendance Slip & Wage Statement PDF
 */
export async function printWorkerMonthlySlipPdf(
  data: Snapshot,
  worker: Row,
  year: number,
  month: number,
  siteId?: string,
  lang: string = 'en'
) {
  const isHi = lang === 'hi';
  const countDays = new Date(year, month, 0).getDate();
  const monthDate = new Date(year, month - 1, 1);
  const monthTitle = monthDate.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  // Attendance records for this worker in this month
  const workerMonthAtt = data.attendance.filter(
    (a) => a.worker_id === worker.id && String(a.date).startsWith(monthPrefix) && (!siteId || siteId === 'ALL' || a.site_id === siteId)
  );

  // Auto-detect site name: if specific site passed use it, otherwise find the sites worker attended this month
  const selectedSite = siteId && siteId !== 'ALL' ? data.sites.find((s) => s.id === siteId) : null;
  const attendedSiteIds = Array.from(new Set(workerMonthAtt.map((a) => a.site_id).filter(Boolean)));
  const attendedSiteNames = attendedSiteIds
    .map((id) => data.sites.find((s) => s.id === id)?.name)
    .filter(Boolean);

  const siteFilterName = selectedSite
    ? selectedSite.name
    : attendedSiteNames.length > 0
      ? attendedSiteNames.join(', ')
      : (data.sites[0]?.name || (isHi ? 'कार्य स्थल' : 'Work Site'));

  // Labels based on selected language (Strict: English when 'en', Hindi when 'hi')
  const L = {
    title: isHi ? 'मासिक मजदूर हाजिरी एवं वेतन विवरण' : 'WORKER MONTHLY ATTENDANCE & WAGE STATEMENT',
    site: isHi ? 'साइट का नाम' : 'Site Name',
    month: isHi ? 'महीना' : 'Month',
    generatedOn: isHi ? 'जारी दिनांक' : 'Generated on',
    role: isHi ? 'पद / हुनर' : 'Role / Skill',
    phone: isHi ? 'फोन' : 'Phone',
    dailyRate: isHi ? 'दैनिक मजदूरी दर' : 'DAILY WAGE RATE',
    perDay: isHi ? '/दिन' : '/day',
    kpiPresent: isHi ? 'उपस्थित (P)' : 'Present (P)',
    kpiHalf: isHi ? 'आधा दिन (HD)' : 'Half Day (HD)',
    kpiAbsent: isHi ? 'अनुपस्थित (A)' : 'Absent (A)',
    kpiOt: isHi ? 'ओवरटाइम (OT)' : 'Overtime (OT)',
    kpiTotalHours: isHi ? 'कुल कार्य घंटे' : 'Total Duty Hrs',
    kpiTotalDays: isHi ? 'कुल दिन' : 'Total Days',
    kpiTotalWage: isHi ? 'कुल अर्जित वेतन' : 'Total Wage Earned',
    daysUnit: isHi ? 'दिन' : 'Days',
    hrsUnit: isHi ? 'घंटे' : 'hrs',
    thSr: '#',
    thDate: isHi ? 'दिनांक' : 'Date',
    thDay: isHi ? 'वार' : 'Day',
    thStatus: isHi ? 'उपस्थिति' : 'Status',
    thShift: isHi ? 'शिफ्ट समय (In - Out)' : 'Shift Timings (In - Out)',
    thHours: isHi ? 'ड्यूटी घंटे' : 'Duty Hrs',
    thOt: isHi ? 'ओवरटाइम' : 'OT (hrs)',
    thWage: isHi ? 'दैनिक मजदूरी' : 'Daily Wage',
    thNotes: isHi ? 'विवरण / टिप्पणी' : 'Remarks',
    stPresent: isHi ? 'उपस्थित' : 'Present',
    stHalf: isHi ? 'आधा दिन' : 'Half Day',
    stAbsent: isHi ? 'अनुपस्थित' : 'Absent',
    stOff: isHi ? 'अवकाश' : 'Weekly Off',
    totalLabel: isHi ? 'कुल योग:' : 'TOTAL / SUMMARY:',
    unitsLabel: isHi ? 'दिन' : 'Units',
    footerVerified: isHi ? 'ठेकाबुक डिजिटल लेजर • सत्यापित कार्य रिकॉर्ड' : 'ThekaBook Contractor Management • Verified Digital Attendance Record',
    workerSign: isHi ? 'मजदूर के हस्ताक्षर / अंगूठा' : 'Worker Signature / Thumb',
    contractorSign: isHi ? 'ठेकेदार / अधिकृत हस्ताक्षर' : 'Contractor / Authorized Signature',
  };

  let pCount = 0;
  let hdCount = 0;
  let aCount = 0;
  let otMinsTotal = 0;
  let totalWageEarned = 0;
  let totalShiftHours = 0;

  // Payments / advances taken by this worker in this month
  const workerEntries = data.entries.filter(
    (e) => e.worker_id === worker.id && String(e.date).startsWith(monthPrefix)
  );
  const totalPaidInMonth = workerEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Generate 1 to countDays row list
  const dayRows: Array<{
    day: number;
    dateStr: string;
    formattedDate: string;
    dayName: string;
    isSunday: boolean;
    status: 'P' | 'HD' | 'A' | 'W' | 'UNMARKED';
    inTime: string;
    outTime: string;
    shiftHours: number;
    otHours: number;
    dayAmount: number;
    notes: string;
  }> = [];

  for (let d = 1; d <= countDays; d++) {
    const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month - 1, d);
    const dayName = dt.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { weekday: 'short' });
    const formattedDate = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const isSunday = dt.getDay() === 0;

    const att = workerMonthAtt.find((a) => String(a.date).slice(0, 10) === dStr);

    let status: 'P' | 'HD' | 'A' | 'W' | 'UNMARKED' = isSunday ? 'W' : 'UNMARKED';
    let inTime = '-';
    let outTime = '-';
    let shiftHours = 0;
    let otHours = 0;
    let dayAmount = 0;
    let notes = att?.notes || '';

    if (att) {
      const units = Number(att.units);
      const otMins = Number(att.overtime_minutes || 0);
      otMinsTotal += otMins;
      otHours = otMins / 60;
      dayAmount = Number(att.amount || 0);
      totalWageEarned += dayAmount;

      if (units === 1) {
        pCount += 1;
        status = 'P';
        inTime = att.in_time || '08:45 AM';
        if (otHours > 0) {
          shiftHours = 8.5 + otHours; // e.g. 8.5h + 1.0h OT = 9.5h
          outTime = att.out_time || (otHours >= 2 ? '07:15 PM' : otHours >= 1 ? '06:15 PM' : '05:45 PM');
        } else {
          shiftHours = 8.5;
          outTime = att.out_time || '05:15 PM';
        }
        totalShiftHours += shiftHours;
      } else if (units === 0.5) {
        hdCount += 1;
        status = 'HD';
        inTime = att.in_time || '08:45 AM';
        outTime = att.out_time || '01:15 PM';
        shiftHours = 4.5 + otHours;
        totalShiftHours += shiftHours;
      } else if (units === 0) {
        aCount += 1;
        status = 'A';
        inTime = '-';
        outTime = '-';
        shiftHours = 0;
      }
    }

    dayRows.push({
      day: d,
      dateStr: dStr,
      formattedDate,
      dayName,
      isSunday,
      status,
      inTime,
      outTime,
      shiftHours,
      otHours,
      dayAmount,
      notes,
    });
  }

  const totalUnits = pCount + hdCount * 0.5;
  const dailyRate = Number(worker.daily_rate || 0);
  const totalOtHours = otMinsTotal / 60;
  const orgName = data.organization.name || data.user.name || 'ThekaBook Contractor';

  const rowsHtml = dayRows.map((r) => {
    let statusBadge = '<span class="badge-dash">-</span>';
    if (r.status === 'P') {
      statusBadge = `<span class="badge-status badge-p">${L.stPresent}</span>`;
    } else if (r.status === 'HD') {
      statusBadge = `<span class="badge-status badge-hd">${L.stHalf}</span>`;
    } else if (r.status === 'A') {
      statusBadge = `<span class="badge-status badge-a">${L.stAbsent}</span>`;
    } else if (r.status === 'W') {
      statusBadge = `<span class="badge-status badge-w">${L.stOff}</span>`;
    }

    const shiftDisplay = r.inTime !== '-' ? `
      <span class="z-time-in">${escape(r.inTime)}</span> <span style="color:#94A3B8;">-</span> <span class="z-time-out">${escape(r.outTime)}</span>
    ` : '<span style="color:#CBD5E1;">-</span>';

    const hoursDisplay = r.shiftHours > 0 ? `
      <span class="z-hours-pill">${r.shiftHours.toFixed(1)}h</span>
    ` : '-';

    return `
      <tr class="${r.isSunday ? 'z-sunday-row' : ''}">
        <td class="center text-muted">${r.day}</td>
        <td class="text-bold">${r.formattedDate}</td>
        <td class="center ${r.isSunday ? 'text-danger' : 'text-muted'}">${r.dayName}</td>
        <td class="center">${statusBadge}</td>
        <td class="center">${shiftDisplay}</td>
        <td class="center">${hoursDisplay}</td>
        <td class="center">${r.otHours > 0 ? `<span class="z-ot-pill">+${r.otHours.toFixed(1)}h</span>` : '-'}</td>
        <td class="right text-bold">${r.dayAmount > 0 ? `₹${r.dayAmount.toLocaleString('en-IN')}` : '-'}</td>
        <td class="text-muted small">${escape(r.notes || '')}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(worker.name)} - ${escape(monthTitle)} - Payslip</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #1E293B;
      background: #FFFFFF;
      font-size: 9px;
      line-height: 1.4;
    }

    /* Zoho Header */
    .zoho-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 1.5px solid #E2E8F0;
      margin-bottom: 10px;
    }
    .zoho-company-name {
      font-size: 17px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.3px;
    }
    .zoho-doc-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 2px;
    }
    .zoho-header-meta {
      text-align: right;
      font-size: 8.5px;
      color: #64748B;
    }
    .zoho-period-badge {
      display: inline-block;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 9.5px;
      margin-bottom: 3px;
    }

    /* Zoho 2-Column Employee Profile Card */
    .zoho-emp-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 10px;
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 16px;
      align-items: center;
    }
    .zoho-emp-name {
      font-size: 15px;
      font-weight: 800;
      color: #0F172A;
    }
    .zoho-emp-details {
      font-size: 9px;
      color: #475569;
      margin-top: 3px;
      line-height: 1.5;
    }
    .zoho-emp-details b {
      color: #1E293B;
    }
    .zoho-pay-summary {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 6px 12px;
      text-align: right;
    }
    .zoho-pay-lbl {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .zoho-pay-val {
      font-size: 15px;
      font-weight: 900;
      color: #059669;
      margin-top: 1px;
    }

    /* Zoho Metric Strip */
    .zoho-metrics-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 6px 12px;
      margin-bottom: 10px;
    }
    .zoho-metric-item {
      text-align: center;
      flex: 1;
    }
    .zoho-metric-item .z-lbl {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .zoho-metric-item .z-val {
      font-size: 11.5px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 1px;
    }
    .zoho-metric-divider {
      width: 1px;
      height: 20px;
      background: #E2E8F0;
    }

    /* Table Styles */
    table.zoho-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
      margin-bottom: 12px;
    }
    table.zoho-table th {
      background: #F8FAFC;
      color: #475569;
      font-weight: 800;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1.5px solid #CBD5E1;
      padding: 6px 5px;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table.zoho-table td {
      border-bottom: 1px solid #F1F5F9;
      padding: 4px 5px;
      vertical-align: middle;
      color: #334155;
    }
    table.zoho-table tbody tr:hover {
      background: #F8FAFC;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .text-bold { font-weight: 700; color: #0F172A; }
    .text-muted { color: #64748B; }
    .text-danger { color: #DC2626; font-weight: 700; }
    .small { font-size: 7.5px; }
    .z-sunday-row { background: #FFFBEB !important; }

    /* Badges */
    .badge-status {
      display: inline-block;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-size: 7.5px;
      font-weight: 700;
    }
    .badge-p { background: #DCFCE7; color: #166534; }
    .badge-hd { background: #FEF3C7; color: #92400E; }
    .badge-a { background: #FEE2E2; color: #991B1B; }
    .badge-w { background: #F1F5F9; color: #475569; }
    .badge-dash { color: #CBD5E1; font-weight: 700; }

    .z-time-in { color: #15803D; font-weight: 700; font-family: monospace; }
    .z-time-out { color: #1D4ED8; font-weight: 700; font-family: monospace; }
    .z-hours-pill {
      display: inline-block;
      background: #F1F5F9;
      color: #334155;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 700;
    }
    .z-ot-pill {
      display: inline-block;
      background: #EFF6FF;
      color: #2563EB;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 700;
    }

    .zoho-total-row td {
      background: #F8FAFC !important;
      font-weight: 800;
      color: #0F172A;
      border-top: 1.5px solid #CBD5E1;
      border-bottom: 1.5px solid #CBD5E1;
      padding: 6px 5px;
    }

    /* Footer */
    .zoho-footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 8px;
      font-size: 8px;
      color: #64748B;
    }
    .zoho-sign-box {
      width: 160px;
      border-top: 1px dashed #94A3B8;
      text-align: center;
      padding-top: 4px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="zoho-header">
    <div>
      <div class="zoho-company-name">${escape(orgName)}</div>
      <div class="zoho-doc-title">${escape(L.title)}</div>
    </div>
    <div class="zoho-header-meta">
      <div class="zoho-period-badge">${escape(monthTitle)}</div><br/>
      ${escape(L.generatedOn)}: <b>${new Date().toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
    </div>
  </div>

  <div class="zoho-emp-card">
    <div>
      <div class="zoho-emp-name">${escape(worker.name)}</div>
      <div class="zoho-emp-details">
        ${escape(L.role)}: <b>${escape(worker.skill || 'Worker')}</b> &nbsp;•&nbsp; ${escape(L.phone)}: <b>${escape(worker.phone || 'N/A')}</b><br/>
        ${escape(L.site)}: <b>${escape(siteFilterName)}</b> &nbsp;•&nbsp; ${escape(L.dailyRate)}: <b>₹${dailyRate.toLocaleString('en-IN')}${escape(L.perDay)}</b>
      </div>
    </div>
    <div class="zoho-pay-summary">
      <div class="zoho-pay-lbl">${escape(L.kpiTotalWage)}</div>
      <div class="zoho-pay-val">₹${totalWageEarned.toLocaleString('en-IN')}</div>
    </div>
  </div>

  <div class="zoho-metrics-bar">
    <div class="zoho-metric-item">
      <div class="z-lbl">${escape(L.kpiPresent)}</div>
      <div class="z-val" style="color:#15803D;">${pCount} ${escape(L.daysUnit)}</div>
    </div>
    <div class="zoho-metric-divider"></div>
    <div class="zoho-metric-item">
      <div class="z-lbl">${escape(L.kpiHalf)}</div>
      <div class="z-val" style="color:#B45309;">${hdCount} ${escape(L.daysUnit)}</div>
    </div>
    <div class="zoho-metric-divider"></div>
    <div class="zoho-metric-item">
      <div class="z-lbl">${escape(L.kpiAbsent)}</div>
      <div class="z-val" style="color:#DC2626;">${aCount} ${escape(L.daysUnit)}</div>
    </div>
    <div class="zoho-metric-divider"></div>
    <div class="zoho-metric-item">
      <div class="z-lbl">${escape(L.kpiOt)}</div>
      <div class="z-val" style="color:#2563EB;">+${totalOtHours.toFixed(1)} ${escape(L.hrsUnit)}</div>
    </div>
    <div class="zoho-metric-divider"></div>
    <div class="zoho-metric-item">
      <div class="z-lbl">${escape(L.kpiTotalHours)}</div>
      <div class="z-val" style="color:#7C3AED;">${totalShiftHours.toFixed(1)} ${escape(L.hrsUnit)}</div>
    </div>
    <div class="zoho-metric-divider"></div>
    <div class="zoho-metric-item">
      <div class="z-lbl">${escape(L.kpiTotalDays)}</div>
      <div class="z-val">${totalUnits.toFixed(1)} ${escape(L.daysUnit)}</div>
    </div>
  </div>

  <table class="zoho-table">
    <thead>
      <tr>
        <th style="width: 25px;" class="center">${escape(L.thSr)}</th>
        <th style="width: 65px;">${escape(L.thDate)}</th>
        <th style="width: 35px;" class="center">${escape(L.thDay)}</th>
        <th style="width: 80px;" class="center">${escape(L.thStatus)}</th>
        <th style="width: 140px;" class="center">${escape(L.thShift)}</th>
        <th style="width: 55px;" class="center">${escape(L.thHours)}</th>
        <th style="width: 55px;" class="center">${escape(L.thOt)}</th>
        <th style="width: 80px;" class="right">${escape(L.thWage)}</th>
        <th>${escape(L.thNotes)}</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="zoho-total-row">
        <td colspan="3" class="center">${escape(L.totalLabel)}</td>
        <td class="center">${totalUnits.toFixed(1)} ${escape(L.unitsLabel)}</td>
        <td class="center">-</td>
        <td class="center text-bold">${totalShiftHours.toFixed(1)}h</td>
        <td class="center text-bold">${totalOtHours > 0 ? `+${totalOtHours.toFixed(1)}h` : '-'}</td>
        <td class="right text-bold" style="color:#059669; font-size:10px;">₹${totalWageEarned.toLocaleString('en-IN')}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="zoho-footer">
    <div>${escape(L.footerVerified)}</div>
    <div style="display: flex; gap: 40px;">
      <div class="zoho-sign-box">${escape(L.workerSign)}</div>
      <div class="zoho-sign-box">${escape(L.contractorSign)}</div>
    </div>
  </div>
</body>
</html>`;

  await printOrShareHtml(html, `${worker.name} - ${monthTitle}`);
}

/**
 * Full Landscape Muster Roll Register (1 to 31) across all workers
 */
export async function printMusterRollPdf(
  data: Snapshot,
  year: number,
  month: number,
  siteId?: string,
  workerId?: string,
  lang: string = 'en'
) {
  const isHi = lang === 'hi';
  const countDays = new Date(year, month, 0).getDate();
  const monthDate = new Date(year, month - 1, 1);
  const monthTitle = monthDate.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const selectedSite = siteId && siteId !== 'ALL' ? data.sites.find((s) => s.id === siteId) : null;
  const siteFilterName = selectedSite ? selectedSite.name : (isHi ? 'सभी कार्य स्थल' : 'All Work Sites');

  // Labels dictionary for strict language handling
  const L = {
    title: isHi ? 'मासिक मजदूर हाजिरी रजिस्टर / मस्टर रोल' : 'MONTHLY WORKER ATTENDANCE REGISTER / MUSTER ROLL',
    site: isHi ? 'साइट' : 'Site',
    month: isHi ? 'महीना' : 'Month',
    generatedOn: isHi ? 'जारी दिनांक' : 'Generated on',
    totalWorkers: isHi ? 'कुल मजदूर' : 'Total Workers',
    kpiRegistered: isHi ? 'पंजीकृत मजदूर' : 'Registered Labour',
    kpiPresent: isHi ? 'उपस्थित दिन (P)' : 'Present Days (P)',
    kpiHalf: isHi ? 'आधे दिन (HD)' : 'Half Days (HD)',
    kpiOt: isHi ? 'कुल ओवरटाइम' : 'Overtime Total',
    kpiUnits: isHi ? 'कुल कार्य दिन' : 'Total Work Units',
    kpiWage: isHi ? 'देय कुल मजदूरी' : 'Gross Wages Payable',
    daysUnit: isHi ? 'दिन' : 'Days',
    hrsUnit: isHi ? 'घंटे' : 'hrs',
    legendTitle: isHi ? 'संकेत विवरण:' : 'Attendance Legend:',
    legPresent: isHi ? 'उपस्थित (1.0)' : 'Present (1.0)',
    legHalf: isHi ? 'आधा दिन (0.5)' : 'Half Day (0.5)',
    legAbsent: isHi ? 'अनुपस्थित (0.0)' : 'Absent (0.0)',
    legOt: isHi ? 'ओवरटाइम' : 'Overtime',
    standardForm: isHi ? 'श्रम अधिनियम प्रारूप एवं साइट मस्टर रोल' : 'Standard Labour Compliance Register & Site Muster Roll',
    thSr: '#',
    thWorker: isHi ? 'मजदूर का नाम व पद' : 'Worker Name & Role',
    thRate: isHi ? 'दर / दिन' : 'Daily Rate',
    thDaysMonth: isHi ? 'माह के दिन' : 'Days of Month',
    thAttCounts: isHi ? 'उपस्थिति विवरण' : 'Attendance Summary',
    thUnits: isHi ? 'कुल दिन' : 'Units',
    thWage: isHi ? 'कुल मजदूरी' : 'Wage Payable',
    thSign: isHi ? 'हस्ताक्षर / अंगूठा' : 'Signature / Thumb',
    grandTotal: isHi ? 'कुल महायोग (GRAND TOTAL):' : 'GRAND TOTAL:',
    footerLedger: isHi ? 'ठेकाबुक डिजिटल लेजर • सत्यापित कार्य रजिस्टर' : 'ThekaBook Contractor Management System • Verified Digital Ledger',
    supervisorSign: isHi ? 'साइट सुपरवाइजर हस्ताक्षर' : 'Site Supervisor Signature',
    contractorSign: isHi ? 'ठेकेदार / अधिकृत हस्ताक्षर' : 'Contractor / Authorized Signature',
  };

  // Workers list (filter by workerId if single worker, else all active workers)
  let workers = data.workers.filter((w) => w.active);
  if (workerId && workerId !== 'ALL') {
    workers = workers.filter((w) => w.id === workerId);
  }
  if (workers.length === 0) {
    workers = data.workers;
  }

  // Days array
  const days: Array<{ day: number; dateStr: string; dayName: string; isSunday: boolean }> = [];
  for (let d = 1; d <= countDays; d++) {
    const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month - 1, d);
    const dayName = dt.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { weekday: 'narrow' }); // M, T, W, T, F, S, S or initial letter
    const isSunday = dt.getDay() === 0;
    days.push({ day: d, dateStr: dStr, dayName, isSunday });
  }

  // Calculate stats per worker
  let grandTotalP = 0;
  let grandTotalHD = 0;
  let grandTotalA = 0;
  let grandTotalOTHours = 0;
  let grandTotalUnits = 0;
  let grandTotalWage = 0;

  const rowsHtml = workers.map((w, index) => {
    let pCount = 0;
    let hdCount = 0;
    let aCount = 0;
    let otMinsTotal = 0;

    const cellsHtml = days.map(({ dateStr, isSunday }) => {
      // Find attendance record
      const att = data.attendance.find((a) => {
        const matchWorker = a.worker_id === w.id;
        const matchDate = String(a.date).slice(0, 10) === dateStr;
        const matchSite = !selectedSite || a.site_id === selectedSite.id;
        return matchWorker && matchDate && matchSite;
      });

      if (!att) {
        return `<td class="day-cell ${isSunday ? 'sunday' : ''}">-</td>`;
      }

      const units = Number(att.units);
      const otMins = Number(att.overtime_minutes || 0);
      otMinsTotal += otMins;

      if (units === 1) {
        pCount += 1;
        const otBadge = otMins > 0 ? `<span class="ot-tag">+${(otMins / 60).toFixed(0)}h</span>` : '';
        return `<td class="day-cell cell-p ${isSunday ? 'sunday' : ''}">P${otBadge}</td>`;
      } else if (units === 0.5) {
        hdCount += 1;
        const otBadge = otMins > 0 ? `<span class="ot-tag">+${(otMins / 60).toFixed(0)}h</span>` : '';
        return `<td class="day-cell cell-hd ${isSunday ? 'sunday' : ''}">HD${otBadge}</td>`;
      } else if (units === 0) {
        aCount += 1;
        return `<td class="day-cell cell-a ${isSunday ? 'sunday' : ''}">A</td>`;
      } else {
        return `<td class="day-cell ${isSunday ? 'sunday' : ''}">-</td>`;
      }
    }).join('');

    const totalUnits = pCount + hdCount * 0.5;
    const dailyRate = Number(w.daily_rate || 0);
    const otHours = otMinsTotal / 60;
    const hourlyRate = dailyRate > 0 ? dailyRate / 8 : 0;
    const wageEarned = Math.round(totalUnits * dailyRate + otHours * hourlyRate);

    grandTotalP += pCount;
    grandTotalHD += hdCount;
    grandTotalA += aCount;
    grandTotalOTHours += otHours;
    grandTotalUnits += totalUnits;
    grandTotalWage += wageEarned;

    return `
      <tr>
        <td class="center text-bold">${index + 1}</td>
        <td class="worker-name-col">
          <div class="w-name">${escape(w.name)}</div>
          <div class="w-skill">${escape(w.skill || 'Worker')} • ${escape(w.phone || '')}</div>
        </td>
        <td class="rate-col">₹${dailyRate.toLocaleString('en-IN')}</td>
        ${cellsHtml}
        <td class="stat-col p-col">${pCount}</td>
        <td class="stat-col hd-col">${hdCount}</td>
        <td class="stat-col a-col">${aCount}</td>
        <td class="stat-col ot-col">${otHours > 0 ? otHours.toFixed(1) + 'h' : '-'}</td>
        <td class="stat-col units-col">${totalUnits.toFixed(1)}</td>
        <td class="wage-col">₹${wageEarned.toLocaleString('en-IN')}</td>
        <td class="sign-col"></td>
      </tr>
    `;
  }).join('');

  // Column Width Calculation for exactly 100% table layout
  const dayColPct = (49 / countDays).toFixed(2);

  const headerDaysHtml = days.map((d) => `
    <th class="day-th ${d.isSunday ? 'sunday-th' : ''}" style="width: ${dayColPct}%;">
      <div class="th-dname">${d.dayName}</div>
      <div class="th-dnum">${d.day}</div>
    </th>
  `).join('');

  const orgName = data.organization.name || data.user.name || 'ThekaBook Contractor';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(L.title)} - ${escape(monthTitle)} - ${escape(orgName)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 5mm 6mm 5mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 8.5px;
      line-height: 1.25;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0F2851;
      padding-bottom: 5px;
      margin-bottom: 6px;
    }
    .firm-name {
      font-size: 16px;
      font-weight: 900;
      color: #0F2851;
      letter-spacing: -0.3px;
    }
    .register-title {
      font-size: 11px;
      font-weight: 800;
      color: #1E40AF;
      margin-top: 1px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-details {
      text-align: right;
      font-size: 8.5px;
      color: #475569;
      line-height: 1.35;
    }
    .meta-pill {
      display: inline-block;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 9.5px;
      margin-bottom: 2px;
    }

    /* KPI Summary Strip */
    .kpi-summary-strip {
      display: flex;
      gap: 6px;
      margin-bottom: 6px;
    }
    .kpi-mini-card {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 3px 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .kpi-mini-lbl {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .kpi-mini-val {
      font-size: 10.5px;
      font-weight: 900;
      color: #0F172A;
    }

    /* Legend Bar */
    .legend-bar {
      display: flex;
      gap: 10px;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 3px 8px;
      margin-bottom: 6px;
      font-size: 8px;
      font-weight: 600;
    }
    .legend-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .badge-sample {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 800;
      font-size: 7.5px;
    }
    .badge-p { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
    .badge-hd { background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; }
    .badge-a { background: #FEE2E2; color: #B91C1C; border: 1px solid #FCA5A5; }
    .badge-ot { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }

    /* Fixed Layout Table */
    table.muster-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 8px;
    }
    table.muster-table th, table.muster-table td {
      border: 1px solid #CBD5E1;
      padding: 2.5px 1.5px;
      text-align: center;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    table.muster-table th {
      background: #F1F5F9;
      color: #0F172A;
      font-weight: 800;
    }
    .sr-col { width: 2.5%; }
    .name-col { width: 13%; }
    .rate-col { width: 4.5%; }
    .stat-head-col { width: 2.5%; }
    .units-head-col { width: 4%; }
    .wage-head-col { width: 8%; }
    .sign-head-col { width: 9%; }

    .day-th {
      padding: 1px 0 !important;
    }
    .th-dname {
      font-size: 6.5px;
      color: #64748B;
      font-weight: 700;
      text-transform: uppercase;
      line-height: 1;
    }
    .th-dnum {
      font-size: 8px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .sunday-th {
      background: #FEE2E2 !important;
      color: #991B1B !important;
    }
    .worker-name-col {
      text-align: left !important;
      padding-left: 4px !important;
    }
    .w-name {
      font-size: 8.5px;
      font-weight: 800;
      color: #0F172A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .w-skill {
      font-size: 7px;
      color: #64748B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rate-cell {
      font-weight: 700;
      color: #334155;
      font-size: 7.5px;
    }
    .day-cell {
      font-size: 7px;
      font-weight: 700;
      color: #94A3B8;
      height: 18px;
      padding: 1px 0 !important;
    }
    .cell-p {
      background: #DCFCE7 !important;
      color: #15803D !important;
      font-weight: 900;
    }
    .cell-hd {
      background: #FEF3C7 !important;
      color: #B45309 !important;
      font-weight: 900;
    }
    .cell-a {
      background: #FEE2E2 !important;
      color: #DC2626 !important;
      font-weight: 900;
    }
    .sunday {
      background: #FAFAFA;
      border-left: 1.5px solid #FCA5A5 !important;
      border-right: 1.5px solid #FCA5A5 !important;
    }
    .ot-tag {
      display: block;
      font-size: 6px;
      color: #1D4ED8;
      line-height: 1;
      font-weight: 800;
    }
    .stat-col {
      font-weight: 800;
      font-size: 8px;
    }
    .p-col { color: #15803D; background: #F0FDF4; }
    .hd-col { color: #B45309; background: #FFFBEB; }
    .a-col { color: #B91C1C; background: #FEF2F2; }
    .ot-col { color: #1D4ED8; background: #EFF6FF; }
    .units-col { color: #0F172A; background: #F8FAFC; font-weight: 900; }
    .wage-col {
      font-weight: 900;
      font-size: 8.5px;
      color: #0F172A;
      background: #F8FAFC;
      text-align: right !important;
      padding-right: 4px !important;
    }
    .sign-col {
      background: #FFFFFF;
    }
    .total-row td {
      background: #0F2851 !important;
      color: #FFFFFF !important;
      font-weight: 900;
      font-size: 8.5px;
      padding: 3.5px 2px;
    }
    .footer-sign-box {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 6px;
      font-size: 8px;
      color: #475569;
    }
    .sign-line {
      width: 140px;
      border-top: 1px dashed #64748B;
      text-align: center;
      padding-top: 3px;
      font-weight: 700;
      color: #0F172A;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="firm-name">${escape(orgName)}</div>
      <div class="register-title">${escape(L.title)}</div>
      <div style="font-size: 8.5px; color: #475569; margin-top: 1px;">
        ${escape(L.site)}: <b>${escape(siteFilterName)}</b> | ${escape(L.month)}: <b>${escape(monthTitle)}</b>
      </div>
    </div>
    <div class="meta-details">
      <div class="meta-pill">${escape(monthTitle)}</div><br/>
      ${escape(L.totalWorkers)}: <b>${workers.length}</b> • ${escape(L.generatedOn)}: <b>${new Date().toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
    </div>
  </div>

  <!-- Summary KPI Bar -->
  <div class="kpi-summary-strip">
    <div class="kpi-mini-card">
      <span class="kpi-mini-lbl">${escape(L.kpiRegistered)}</span>
      <span class="kpi-mini-val">${workers.length}</span>
    </div>
    <div class="kpi-mini-card" style="border-left: 3px solid #16A34A;">
      <span class="kpi-mini-lbl">${escape(L.kpiPresent)}</span>
      <span class="kpi-mini-val" style="color: #15803D;">${grandTotalP}</span>
    </div>
    <div class="kpi-mini-card" style="border-left: 3px solid #D97706;">
      <span class="kpi-mini-lbl">${escape(L.kpiHalf)}</span>
      <span class="kpi-mini-val" style="color: #B45309;">${grandTotalHD}</span>
    </div>
    <div class="kpi-mini-card" style="border-left: 3px solid #2563EB;">
      <span class="kpi-mini-lbl">${escape(L.kpiOt)}</span>
      <span class="kpi-mini-val" style="color: #1D4ED8;">+${grandTotalOTHours.toFixed(1)}h</span>
    </div>
    <div class="kpi-mini-card" style="border-left: 3px solid #0F2851;">
      <span class="kpi-mini-lbl">${escape(L.kpiUnits)}</span>
      <span class="kpi-mini-val">${grandTotalUnits.toFixed(1)} ${escape(L.daysUnit)}</span>
    </div>
    <div class="kpi-mini-card" style="border-left: 3px solid #059669; background: #ECFDF5;">
      <span class="kpi-mini-lbl">${escape(L.kpiWage)}</span>
      <span class="kpi-mini-val" style="color: #047857;">₹${grandTotalWage.toLocaleString('en-IN')}</span>
    </div>
  </div>

  <div class="legend-bar">
    <span><b>${escape(L.legendTitle)}</b></span>
    <span class="legend-tag"><span class="badge-sample badge-p">P</span> ${escape(L.legPresent)}</span>
    <span class="legend-tag"><span class="badge-sample badge-hd">HD</span> ${escape(L.legHalf)}</span>
    <span class="legend-tag"><span class="badge-sample badge-a">A</span> ${escape(L.legAbsent)}</span>
    <span class="legend-tag"><span class="badge-sample badge-ot">+Nh</span> ${escape(L.legOt)}</span>
    <span style="margin-left: auto; color: #64748B;">${escape(L.standardForm)}</span>
  </div>

  <table class="muster-table">
    <thead>
      <tr>
        <th rowspan="2" class="sr-col">${escape(L.thSr)}</th>
        <th rowspan="2" class="name-col worker-name-col">${escape(L.thWorker)}</th>
        <th rowspan="2" class="rate-col">${escape(L.thRate)}</th>
        <th colspan="${countDays}">${escape(L.thDaysMonth)} (${escape(monthTitle)})</th>
        <th colspan="4">${escape(L.thAttCounts)}</th>
        <th rowspan="2" class="units-head-col">${escape(L.thUnits)}</th>
        <th rowspan="2" class="wage-head-col">${escape(L.thWage)}</th>
        <th rowspan="2" class="sign-head-col">${escape(L.thSign)}</th>
      </tr>
      <tr>
        ${headerDaysHtml}
        <th class="stat-head-col stat-col p-col" title="Present">P</th>
        <th class="stat-head-col stat-col hd-col" title="Half Day">HD</th>
        <th class="stat-head-col stat-col a-col" title="Absent">A</th>
        <th class="stat-head-col stat-col ot-col" title="Overtime">OT</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align: right; padding-right: 6px;">${escape(L.grandTotal)}</td>
        <td colspan="${countDays}" style="font-size: 7px; opacity: 0.9;">${workers.length} Workers • ${grandTotalUnits.toFixed(1)} Days Total</td>
        <td class="stat-col">${grandTotalP}</td>
        <td class="stat-col">${grandTotalHD}</td>
        <td class="stat-col">${grandTotalA}</td>
        <td class="stat-col">${grandTotalOTHours.toFixed(1)}h</td>
        <td class="stat-col" style="color: #FEF08A !important;">${grandTotalUnits.toFixed(1)}</td>
        <td class="wage-col" style="color: #4ADE80 !important; font-size: 9.5px;">₹${grandTotalWage.toLocaleString('en-IN')}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer-sign-box">
    <div>
      ${escape(L.footerLedger)}
    </div>
    <div style="display: flex; gap: 40px;">
      <div class="sign-line">${escape(L.supervisorSign)}</div>
      <div class="sign-line">${escape(L.contractorSign)}</div>
    </div>
  </div>
</body>
</html>`;

  await printOrShareHtml(html, `Muster Roll - ${monthTitle}`);
}

export interface SiteDocInfo {
  id?: string;
  name: string;
  category: string;
  date: string;
  size?: string;
  refNo?: string;
  terms?: string;
  dataUrl?: string;
}

export interface SiteInfoForDoc {
  name: string;
  owner_name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  state?: string;
  stateCode?: string;
  businessName?: string;
  work_type?: string;
  pricing?: string;
}

export async function viewSiteDocument(
  doc: SiteDocInfo,
  site?: SiteInfoForDoc,
  token?: string
) {
  if (Platform.OS === 'web') {
    // 1. In-memory dataUrl (uploaded directly in session)
    if (doc.dataUrl) {
      openDataUrlInViewer(doc.dataUrl, doc.name);
      return;
    }

    // 2. Local IndexedDB cache by doc.id or name
    try {
      const local =
        (doc.id ? await getDocFromIndexedDB(doc.id) : null) ||
        (await getDocFromIndexedDB(doc.name));
      if (local && local.dataUrl) {
        openDataUrlInViewer(local.dataUrl, doc.name);
        return;
      }
    } catch { }

    // 3. Fetch from API server
    try {
      const serverDoc =
        (doc.id ? await fetchDocFromServer(doc.id, token) : null) ||
        (await fetchDocFromServer(doc.name, token));
      if (serverDoc && serverDoc.blobUrl) {
        window.open(serverDoc.blobUrl, '_blank');
        return;
      }
    } catch { }
  }

  // Fallback: If only terms/notes exist, render a clean standalone document view (NOT full site details)
  const categoryColor =
    doc.category === 'AGREEMENT'
      ? '#16A34A'
      : doc.category === 'DRAWING'
        ? '#2563EB'
        : doc.category === 'QUOTATION'
          ? '#D97706'
          : '#7C3AED';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(doc.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 28px; color: #0F172A; background: #FFFFFF; }
    .header-bar { border-bottom: 2px solid #0F2851; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .brand-title { font-size: 20px; font-weight: 800; color: #0F2851; margin: 0; }
    .cat-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; text-transform: uppercase; background: #EFF6FF; color: ${categoryColor}; border: 1.5px solid ${categoryColor}; }
    .doc-headline { margin-top: 10px; margin-bottom: 16px; }
    .doc-name { font-size: 18px; font-weight: 800; color: #0F172A; }
    .doc-meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .card { border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .card-header { background: #F8FAFC; padding: 8px 14px; font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E2E8F0; }
    .card-body { padding: 14px; font-size: 13px; line-height: 1.6; color: #1E293B; white-space: pre-wrap; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #F1F5F9; font-size: 11px; color: #94A3B8; text-align: center; }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="brand-title">THEKABOOK • DOCUMENT RECORD</div>
    <div class="cat-badge">${escape(doc.category)}</div>
  </div>

  <div class="doc-headline">
    <div class="doc-name">${escape(doc.name)}</div>
    <div class="doc-meta">Date: ${escape(doc.date)} ${doc.refNo ? '• Reference No: ' + escape(doc.refNo) : ''}</div>
  </div>

  <div class="card">
    <div class="card-header">Document Terms & Specifications</div>
    <div class="card-body">${doc.terms ? escape(doc.terms) : 'Document file attached: ' + escape(doc.name)}</div>
  </div>

  <div class="footer">
    ThekaBook Verified Document Viewer
  </div>
</body>
</html>`;

  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      await Print.printAsync({ html });
    }
    return;
  }

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `View ${doc.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

function openDataUrlInViewer(dataUrl: string, filename?: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    if (dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return;
    }
    window.open(dataUrl, '_blank');
  } catch {
    window.open(dataUrl, '_blank');
  }
}

export async function downloadSiteDocument(
  doc: SiteDocInfo,
  site: SiteInfoForDoc,
  token?: string
) {
  if (Platform.OS === 'web') {
    // 1. In-memory dataUrl (freshly uploaded or present on doc object)
    if (doc.dataUrl) {
      triggerBrowserDownload(doc.dataUrl, doc.name);
      return;
    }

    // 2. Check local client IndexedDB by doc id or file name
    try {
      const local =
        (doc.id ? await getDocFromIndexedDB(doc.id) : null) ||
        (await getDocFromIndexedDB(doc.name));
      if (local && local.dataUrl) {
        triggerBrowserDownload(local.dataUrl, doc.name);
        return;
      }
    } catch { }

    // 3. Fetch original uploaded binary from server /documents/:id
    try {
      const serverDoc =
        (doc.id ? await fetchDocFromServer(doc.id, token) : null) ||
        (await fetchDocFromServer(doc.name, token));
      if (serverDoc && serverDoc.blobUrl) {
        triggerBrowserDownload(serverDoc.blobUrl, doc.name);
        return;
      }
    } catch { }
  }

  const categoryColor =
    doc.category === 'AGREEMENT'
      ? '#16A34A'
      : doc.category === 'DRAWING'
        ? '#2563EB'
        : doc.category === 'QUOTATION'
          ? '#D97706'
          : '#7C3AED';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(doc.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #0F172A; background: #FFFFFF; }
    .header-bar { border-bottom: 3px solid #1E3A8A; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .brand-title { font-size: 22px; font-weight: 800; color: #1E3A8A; margin: 0; }
    .brand-sub { font-size: 12px; color: #64748B; margin-top: 3px; font-weight: 500; }
    .cat-badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: 800; font-size: 11px; text-transform: uppercase; background: #EFF6FF; color: ${categoryColor}; border: 1.5px solid ${categoryColor}; }
    .doc-headline { margin-top: 16px; margin-bottom: 18px; }
    .doc-name { font-size: 18px; font-weight: 800; color: #0F172A; }
    .doc-meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .card { border: 1px solid #E2E8F0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
    .card-header { background: #F8FAFC; padding: 10px 16px; font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E2E8F0; }
    .card-body { padding: 14px 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .item-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; }
    .item-val { font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 2px; }
    .terms-box { background: #F8FAFC; border-left: 4px solid #1E3A8A; padding: 12px 14px; border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #1E293B; }
    .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #CBD5E1; }
    .sign-block { border-top: 1.5px solid #94A3B8; padding-top: 8px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #F1F5F9; font-size: 11px; color: #94A3B8; text-align: center; }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="brand-title">THEKABOOK • ठेका बुक</div>
      <div class="brand-sub">Contractor Work & Legal Project Document Record</div>
    </div>
    <div class="cat-badge">${escape(doc.category)}</div>
  </div>

  <div class="doc-headline">
    <div class="doc-name">${escape(doc.name)}</div>
    <div class="doc-meta">Record Date: ${escape(doc.date)} ${doc.refNo ? '• Reference No: ' + escape(doc.refNo) : ''}</div>
  </div>

  <div class="card">
    <div class="card-header">Project & Client Details</div>
    <div class="card-body">
      <div class="grid-2">
        <div>
          <div class="item-label">Site / Project Name</div>
          <div class="item-val">${escape(site.name)}</div>
        </div>
        <div>
          <div class="item-label">Client / Property Owner</div>
          <div class="item-val">${escape(site.owner_name)} ${site.phone ? '• ' + escape(site.phone) : ''}</div>
        </div>
        ${site.businessName ? `<div><div class="item-label">Legal Business / Firm Name</div><div class="item-val">${escape(site.businessName)}</div></div>` : ''}
        ${site.gstin ? `<div><div class="item-label">Client GSTIN</div><div class="item-val" style="color:#1E3A8A; font-family:monospace;">${escape(site.gstin)} (${escape(site.state || '')}${site.stateCode ? ' - ' + escape(site.stateCode) : ''})</div></div>` : ''}
        ${site.address ? `<div style="grid-column: span 2;"><div class="item-label">Site Address</div><div class="item-val">${escape(site.address)}</div></div>` : ''}
      </div>
    </div>
  </div>

  ${doc.terms ? `
  <div class="card">
    <div class="card-header">Document Terms, Scope & Conditions</div>
    <div class="card-body">
      <div class="terms-box">${escape(doc.terms)}</div>
    </div>
  </div>` : ''}

  <div class="sign-row">
    <div class="sign-block">
      Authorized Contractor Signature
      <div style="font-size:10px; color:#94A3B8; font-weight:normal; margin-top:2px;">(Signed & Verified)</div>
    </div>
    <div class="sign-block">
      Client / Property Owner Signature
      <div style="font-size:10px; color:#94A3B8; font-weight:normal; margin-top:2px;">(Accepted & Acknowledged)</div>
    </div>
  </div>

  <div class="footer">
    Generated via ThekaBook • Verified Digital Project Record
  </div>
</body>
</html>`;

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Download ${doc.name}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Sharing is unavailable on this device');
  }
}

