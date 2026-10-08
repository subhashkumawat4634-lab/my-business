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
  siteId?: string
) {
  const countDays = new Date(year, month, 0).getDate();
  const monthDate = new Date(year, month - 1, 1);
  const monthTitle = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const selectedSite = siteId && siteId !== 'ALL' ? data.sites.find((s) => s.id === siteId) : null;
  const siteFilterName = selectedSite ? selectedSite.name : 'All Work Sites (सभी साइटें)';

  // Attendance records for this worker in this month
  const workerMonthAtt = data.attendance.filter(
    (a) => a.worker_id === worker.id && String(a.date).startsWith(monthPrefix) && (!selectedSite || a.site_id === selectedSite.id)
  );

  let pCount = 0;
  let hdCount = 0;
  let aCount = 0;
  let otMinsTotal = 0;
  let totalWageEarned = 0;

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
    status: 'P' | 'HD' | 'A' | 'UNMARKED';
    siteName: string;
    otHours: number;
    dayAmount: number;
    notes: string;
  }> = [];

  for (let d = 1; d <= countDays; d++) {
    const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month - 1, d);
    const dayName = dt.toLocaleDateString('en-IN', { weekday: 'short' });
    const formattedDate = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const isSunday = dt.getDay() === 0;

    const att = workerMonthAtt.find((a) => String(a.date).slice(0, 10) === dStr);
    const site = att ? data.sites.find((s) => s.id === att.site_id) : null;

    let status: 'P' | 'HD' | 'A' | 'UNMARKED' = 'UNMARKED';
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
      } else if (units === 0.5) {
        hdCount += 1;
        status = 'HD';
      } else if (units === 0) {
        aCount += 1;
        status = 'A';
      }
    }

    dayRows.push({
      day: d,
      dateStr: dStr,
      formattedDate,
      dayName,
      isSunday,
      status,
      siteName: site ? site.name : (att ? 'General Site' : '-'),
      otHours,
      dayAmount,
      notes,
    });
  }

  const totalUnits = pCount + hdCount * 0.5;
  const dailyRate = Number(worker.daily_rate || 0);
  const totalOtHours = otMinsTotal / 60;
  const netPayable = totalWageEarned - totalPaidInMonth;
  const orgName = data.organization.name || data.user.name || 'ThekaBook Contractor';

  const rowsHtml = dayRows.map((r, i) => {
    let statusBadge = '<span class="badge-dash">-</span>';
    if (r.status === 'P') {
      statusBadge = '<span class="badge-status badge-p">🟢 Present (पूरा दिन)</span>';
    } else if (r.status === 'HD') {
      statusBadge = '<span class="badge-status badge-hd">🟡 Half Day (आधा दिन)</span>';
    } else if (r.status === 'A') {
      statusBadge = '<span class="badge-status badge-a">🔴 Absent (छुट्टी)</span>';
    }

    return `
      <tr class="${r.isSunday ? 'sunday-row' : ''}">
        <td class="center text-muted">${r.day}</td>
        <td class="text-bold">${r.formattedDate}</td>
        <td class="center ${r.isSunday ? 'text-danger' : 'text-muted'}">${r.dayName}</td>
        <td class="center">${statusBadge}</td>
        <td>${escape(r.siteName)}</td>
        <td class="center">${r.otHours > 0 ? `<span class="ot-pill">+${r.otHours.toFixed(1)}h</span>` : '-'}</td>
        <td class="right text-bold">${r.dayAmount > 0 ? `₹${r.dayAmount.toLocaleString('en-IN')}` : '-'}</td>
        <td class="text-muted small">${escape(r.notes || '')}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(worker.name)} - Monthly Attendance Report - ${escape(monthTitle)}</title>
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 10px;
      line-height: 1.4;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0F2851;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 19px;
      font-weight: 900;
      color: #0F2851;
      letter-spacing: -0.3px;
    }
    .report-subtitle {
      font-size: 12px;
      font-weight: 800;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }
    .meta-box {
      text-align: right;
      font-size: 9px;
      color: #64748B;
    }
    .meta-pill {
      display: inline-block;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .worker-profile-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .w-name-large {
      font-size: 16px;
      font-weight: 900;
      color: #0F172A;
    }
    .w-meta-row {
      font-size: 10px;
      color: #475569;
      font-weight: 600;
      margin-top: 3px;
    }
    .w-rate-badge {
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      padding: 6px 14px;
      border-radius: 8px;
      text-align: right;
    }
    .w-rate-label {
      font-size: 8.5px;
      color: #64748B;
      text-transform: uppercase;
      font-weight: 800;
    }
    .w-rate-value {
      font-size: 15px;
      font-weight: 900;
      color: #0F172A;
    }
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .kpi-box {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 6px 8px;
      text-align: center;
    }
    .kpi-box.p-box { background: #F0FDF4; border-color: #86EFAC; }
    .kpi-box.hd-box { background: #FFFBEB; border-color: #FDE68A; }
    .kpi-box.a-box { background: #FEF2F2; border-color: #FECACA; }
    .kpi-box.ot-box { background: #EFF6FF; border-color: #BFDBFE; }
    .kpi-box.units-box { background: #F8FAFC; border-color: #CBD5E1; }
    .kpi-box.wage-box { background: #ECFDF5; border-color: #6EE7B7; }
    .kpi-lbl {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748B;
    }
    .kpi-val {
      font-size: 13px;
      font-weight: 900;
      margin-top: 2px;
    }
    .kpi-box.p-box .kpi-lbl { color: #166534; }
    .kpi-box.p-box .kpi-val { color: #15803D; }
    .kpi-box.hd-box .kpi-lbl { color: #92400E; }
    .kpi-box.hd-box .kpi-val { color: #B45309; }
    .kpi-box.a-box .kpi-lbl { color: #991B1B; }
    .kpi-box.a-box .kpi-val { color: #B91C1C; }
    .kpi-box.ot-box .kpi-lbl { color: #1E40AF; }
    .kpi-box.ot-box .kpi-val { color: #1D4ED8; }
    .kpi-box.units-box .kpi-lbl { color: #334155; }
    .kpi-box.units-box .kpi-val { color: #0F172A; }
    .kpi-box.wage-box .kpi-lbl { color: #065F46; }
    .kpi-box.wage-box .kpi-val { color: #047857; }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 14px;
    }
    table.data-table th {
      background: #0F2851;
      color: #FFFFFF;
      font-weight: 800;
      border: 1px solid #0F2851;
      padding: 6px 8px;
      text-align: left;
    }
    table.data-table td {
      border: 1px solid #E2E8F0;
      padding: 4.5px 7px;
      vertical-align: middle;
    }
    table.data-table tbody tr:nth-child(even) {
      background: #FAFAFA;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .text-bold { font-weight: 700; }
    .text-muted { color: #64748B; }
    .text-danger { color: #DC2626; font-weight: 700; }
    .small { font-size: 8px; }
    .sunday-row { background: #FFF1F2 !important; }
    
    .badge-status {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
    }
    .badge-p { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
    .badge-hd { background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; }
    .badge-a { background: #FEE2E2; color: #B91C1C; border: 1px solid #FCA5A5; }
    .badge-dash { color: #CBD5E1; font-weight: 700; }
    .ot-pill {
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 8px;
    }
    .table-total-row {
      background: #F1F5F9 !important;
      font-weight: 800;
      color: #0F172A;
      border-top: 2px solid #CBD5E1;
    }
    .footer-sign {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 10px;
      font-size: 9px;
      color: #64748B;
    }
    .sign-box {
      width: 180px;
      border-top: 1px dashed #64748B;
      text-align: center;
      padding-top: 6px;
      font-weight: 700;
      color: #0F172A;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <div class="brand-title">${escape(orgName)}</div>
      <div class="report-subtitle">📋 Worker Monthly Attendance & Wage Statement (मासिक हाजिरी विवरण)</div>
      <div style="font-size: 9.5px; color: #475569; margin-top: 3px;">
        Site: <b>${escape(siteFilterName)}</b>
      </div>
    </div>
    <div class="meta-box">
      <div class="meta-pill">${escape(monthTitle)}</div><br/>
      Generated on: <b>${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
    </div>
  </div>

  <div class="worker-profile-card">
    <div>
      <div class="w-name-large">${escape(worker.name)}</div>
      <div class="w-meta-row">Role/Skill: <b>${escape(worker.skill || 'Worker')}</b> • Phone: <b>${escape(worker.phone || 'N/A')}</b> • Month: <b>${escape(monthTitle)}</b></div>
    </div>
    <div class="w-rate-badge">
      <div class="w-rate-label">Daily Wage Rate</div>
      <div class="w-rate-value">₹${dailyRate.toLocaleString('en-IN')}<span style="font-size: 9px; font-weight: normal; color: #64748B;">/day</span></div>
    </div>
  </div>

  <div class="kpi-strip">
    <div class="kpi-box p-box">
      <div class="kpi-lbl">Present (पूरा)</div>
      <div class="kpi-val">${pCount} Days</div>
    </div>
    <div class="kpi-box hd-box">
      <div class="kpi-lbl">Half Day (आधा)</div>
      <div class="kpi-val">${hdCount} Days</div>
    </div>
    <div class="kpi-box a-box">
      <div class="kpi-lbl">Absent (छुट्टी)</div>
      <div class="kpi-val">${aCount} Days</div>
    </div>
    <div class="kpi-box ot-box">
      <div class="kpi-lbl">Overtime (OT)</div>
      <div class="kpi-val">${totalOtHours.toFixed(1)} hrs</div>
    </div>
    <div class="kpi-box units-box">
      <div class="kpi-lbl">Total Units</div>
      <div class="kpi-val">${totalUnits.toFixed(1)} Days</div>
    </div>
    <div class="kpi-box wage-box">
      <div class="kpi-lbl">Total Earned</div>
      <div class="kpi-val">₹${totalWageEarned.toLocaleString('en-IN')}</div>
    </div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 30px;" class="center">#</th>
        <th style="width: 70px;">Date</th>
        <th style="width: 45px;" class="center">Day</th>
        <th style="width: 140px;" class="center">Status</th>
        <th>Site Name</th>
        <th style="width: 65px;" class="center">OT (hrs)</th>
        <th style="width: 85px;" class="right">Daily Wage</th>
        <th>Notes / Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="table-total-row">
        <td colspan="3" class="center">TOTAL / कुल योग:</td>
        <td class="center">${totalUnits.toFixed(1)} Units (${pCount}P, ${hdCount}HD, ${aCount}A)</td>
        <td>-</td>
        <td class="center text-bold">${totalOtHours > 0 ? `+${totalOtHours.toFixed(1)}h` : '-'}</td>
        <td class="right text-bold" style="color: #047857; font-size: 10.5px;">₹${totalWageEarned.toLocaleString('en-IN')}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer-sign">
    <div>ThekaBook Contractor Management System • Verified Digital Attendance Record</div>
    <div style="display: flex; gap: 40px;">
      <div class="sign-box">Worker Signature / अंगूठा</div>
      <div class="sign-box">Contractor Stamp & Signature</div>
    </div>
  </div>
</body>
</html>`;

  await printOrShareHtml(html, `${worker.name} - ${monthTitle} Attendance Slip`);
}

/**
 * Full Landscape Muster Roll Register (1 to 31) across all workers
 */
export async function printMusterRollPdf(
  data: Snapshot,
  year: number,
  month: number,
  siteId?: string,
  workerId?: string
) {
  const countDays = new Date(year, month, 0).getDate();
  const monthDate = new Date(year, month - 1, 1);
  const monthTitle = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const selectedSite = siteId && siteId !== 'ALL' ? data.sites.find((s) => s.id === siteId) : null;
  const siteFilterName = selectedSite ? selectedSite.name : 'All Work Sites (सभी साइटें)';

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
    const dayName = dt.toLocaleDateString('en-IN', { weekday: 'narrow' }); // M, T, W, T, F, S, S
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

  const headerDaysHtml = days.map((d) => `
    <th class="day-th ${d.isSunday ? 'sunday-th' : ''}">
      <div class="th-dname">${d.dayName}</div>
      <div class="th-dnum">${d.day}</div>
    </th>
  `).join('');

  const orgName = data.organization.name || data.user.name || 'ThekaBook Contractor';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Muster Roll - ${escape(monthTitle)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 6mm 8mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 4px;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 9px;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F2851;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .firm-name {
      font-size: 16px;
      font-weight: 800;
      color: #0F2851;
      letter-spacing: -0.3px;
    }
    .register-title {
      font-size: 12px;
      font-weight: 700;
      color: #2563EB;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-details {
      text-align: right;
      font-size: 9px;
      color: #475569;
      line-height: 1.4;
    }
    .meta-pill {
      display: inline-block;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .legend-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 4px 8px;
      margin-bottom: 8px;
      font-size: 8.5px;
      font-weight: 600;
    }
    .legend-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge-sample {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 800;
      font-size: 8px;
    }
    .badge-p { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
    .badge-hd { background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; }
    .badge-a { background: #FEE2E2; color: #B91C1C; border: 1px solid #FCA5A5; }
    .badge-ot { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }

    table.muster-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
    }
    table.muster-table th, table.muster-table td {
      border: 1px solid #CBD5E1;
      padding: 3px 2px;
      text-align: center;
      vertical-align: middle;
    }
    table.muster-table th {
      background: #F1F5F9;
      color: #0F172A;
      font-weight: 700;
    }
    .day-th {
      min-width: 17px;
      max-width: 22px;
      padding: 2px 0 !important;
    }
    .th-dname {
      font-size: 7px;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
    }
    .th-dnum {
      font-size: 8.5px;
      font-weight: 800;
      color: #0F172A;
    }
    .sunday-th {
      background: #FEE2E2 !important;
      color: #991B1B !important;
    }
    .worker-name-col {
      text-align: left !important;
      padding-left: 6px !important;
      min-width: 110px;
      max-width: 130px;
    }
    .w-name {
      font-size: 9px;
      font-weight: 700;
      color: #0F172A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .w-skill {
      font-size: 7.5px;
      color: #64748B;
    }
    .rate-col {
      font-weight: 700;
      color: #334155;
      font-size: 8px;
      min-width: 42px;
    }
    .day-cell {
      font-size: 7.5px;
      font-weight: 700;
      color: #94A3B8;
      height: 22px;
    }
    .cell-p {
      background: #DCFCE7 !important;
      color: #15803D !important;
      font-weight: 800;
    }
    .cell-hd {
      background: #FEF3C7 !important;
      color: #B45309 !important;
      font-weight: 800;
    }
    .cell-a {
      background: #FEE2E2 !important;
      color: #B91C1C !important;
      font-weight: 800;
    }
    .sunday {
      border-left: 1.5px solid #F87171 !important;
      border-right: 1.5px solid #F87171 !important;
    }
    .ot-tag {
      display: block;
      font-size: 6.5px;
      color: #1D4ED8;
      line-height: 1;
      margin-top: 1px;
    }
    .stat-col {
      font-weight: 800;
      font-size: 8.5px;
      min-width: 22px;
    }
    .p-col { color: #15803D; background: #F0FDF4; }
    .hd-col { color: #B45309; background: #FFFBEB; }
    .a-col { color: #B91C1C; background: #FEF2F2; }
    .ot-col { color: #1D4ED8; background: #EFF6FF; }
    .units-col { color: #0F172A; background: #F8FAFC; font-weight: 900; }
    .wage-col {
      font-weight: 900;
      font-size: 9px;
      color: #0F172A;
      background: #F8FAFC;
      text-align: right !important;
      padding-right: 4px !important;
      min-width: 55px;
    }
    .sign-col {
      min-width: 48px;
    }
    .total-row td {
      background: #0F2851 !important;
      color: #FFFFFF !important;
      font-weight: 800;
      font-size: 9px;
      padding: 4px 2px;
    }
    .footer-sign-box {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 8px;
      font-size: 8.5px;
      color: #475569;
    }
    .sign-line {
      width: 140px;
      border-top: 1px dashed #64748B;
      text-align: center;
      padding-top: 4px;
      font-weight: 700;
      color: #0F172A;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="firm-name">${escape(orgName)}</div>
      <div class="register-title">📋 MONTHLY WORKER ATTENDANCE REGISTER / MUSTER ROLL (मासिक हाजिरी रजिस्टर)</div>
      <div style="font-size: 9px; color: #475569; margin-top: 2px;">
        Site: <b>${escape(siteFilterName)}</b> | Month: <b>${escape(monthTitle)}</b>
      </div>
    </div>
    <div class="meta-details">
      <div class="meta-pill">${escape(monthTitle)}</div><br/>
      Total Workers: <b>${workers.length}</b><br/>
      Generated on: <b>${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
    </div>
  </div>

  <div class="legend-bar">
    <span><b>संकेत / Legend:</b></span>
    <span class="legend-tag"><span class="badge-sample badge-p">P</span> Present (पूरा दिन = 1.0)</span>
    <span class="legend-tag"><span class="badge-sample badge-hd">HD</span> Half Day (आधा दिन = 0.5)</span>
    <span class="legend-tag"><span class="badge-sample badge-a">A</span> Absent (अनुपस्थित = 0.0)</span>
    <span class="legend-tag"><span class="badge-sample badge-ot">+Nh</span> Overtime (ओवरटाइम घंटे)</span>
    <span style="margin-left: auto; color: #64748B;">Standard Labour Act Form & Site Muster Roll</span>
  </div>

  <table class="muster-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 18px;">#</th>
        <th rowspan="2" class="worker-name-col">मजदूर का नाम व पद<br/><span style="font-weight: normal; font-size: 7px;">Worker Name & Role</span></th>
        <th rowspan="2" class="rate-col">दर / Day<br/><span style="font-weight: normal; font-size: 7px;">Daily Rate</span></th>
        <th colspan="${countDays}">तारीख / Days of Month (${escape(monthTitle)})</th>
        <th colspan="4">कुल उपस्थिति / Counts</th>
        <th rowspan="2" class="units-col">कुल दिन<br/><span style="font-weight: normal; font-size: 7px;">Units</span></th>
        <th rowspan="2" class="wage-col">कुल मजदूरी<br/><span style="font-weight: normal; font-size: 7px;">Wage Payable</span></th>
        <th rowspan="2" class="sign-col">हस्ताक्षर / अंगूठा<br/><span style="font-weight: normal; font-size: 7px;">Signature</span></th>
      </tr>
      <tr>
        ${headerDaysHtml}
        <th class="stat-col p-col" title="Present">P</th>
        <th class="stat-col hd-col" title="Half Day">HD</th>
        <th class="stat-col a-col" title="Absent">A</th>
        <th class="stat-col ot-col" title="Overtime">OT</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align: right; padding-right: 8px;">GRAND TOTAL (कुल योग):</td>
        <td colspan="${countDays}" style="font-size: 7.5px; opacity: 0.85;">${workers.length} Workers Registered</td>
        <td class="stat-col">${grandTotalP}</td>
        <td class="stat-col">${grandTotalHD}</td>
        <td class="stat-col">${grandTotalA}</td>
        <td class="stat-col">${grandTotalOTHours.toFixed(1)}h</td>
        <td class="stat-col">${grandTotalUnits.toFixed(1)}</td>
        <td class="wage-col" style="color: #4ADE80 !important; font-size: 10px;">₹${grandTotalWage.toLocaleString('en-IN')}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer-sign-box">
    <div>
      ThekaBook Contractor Management System • Verified Digital Ledger
    </div>
    <div style="display: flex; gap: 40px;">
      <div class="sign-line">Site Supervisor Signature</div>
      <div class="sign-line">Contractor / Owner Signature</div>
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

