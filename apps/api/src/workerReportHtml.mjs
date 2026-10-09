function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function generateWorkerReportHtml({ worker, org, sites = [], attendance = [], entries = [], year, month, lang = 'hi' }) {
  const isHi = lang === 'hi';
  const countDays = new Date(year, month, 0).getDate();
  const monthDate = new Date(year, month - 1, 1);
  const monthTitle = monthDate.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const generatedOn = new Date().toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Map sites
  const siteMap = new Map();
  for (const s of sites) {
    siteMap.set(s.id, s.name);
  }

  // Filter attendance for month
  const workerMonthAtt = attendance.filter(a => String(a.date).startsWith(monthPrefix));

  const attendedSiteIds = Array.from(new Set(workerMonthAtt.map(a => a.site_id).filter(Boolean)));
  const attendedSiteNames = attendedSiteIds.map(id => siteMap.get(id)).filter(Boolean);
  const siteFilterName = attendedSiteNames.length > 0 ? attendedSiteNames.join(', ') : (sites[0]?.name || (isHi ? 'कार्य स्थल' : 'Work Site'));

  // Labels
  const L = {
    title: isHi ? 'मासिक मजदूर हाजिरी एवं वेतन पर्ची' : 'WORKER MONTHLY ATTENDANCE & WAGE STATEMENT',
    subTitle: isHi ? 'ठेकाबुक डिजिटल लेजर • सत्यापित कार्य रिकॉर्ड' : 'ThekaBook Contractor Management • Verified Digital Attendance Record',
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
    kpiTotalHours: isHi ? 'कुल ड्यूटी घंटे' : 'Total Duty Hrs',
    kpiTotalDays: isHi ? 'कुल कार्य दिन' : 'Total Work Units',
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
    thSite: isHi ? 'साइट' : 'Site',
    thNotes: isHi ? 'विवरण / टिप्पणी' : 'Remarks',
    stPresent: isHi ? 'उपस्थित' : 'Present',
    stHalf: isHi ? 'आधा दिन' : 'Half Day',
    stAbsent: isHi ? 'अनुपस्थित' : 'Absent',
    stOff: isHi ? 'रविवार अवकाश' : 'Weekly Off',
    totalLabel: isHi ? 'कुल योग / विवरण:' : 'TOTAL / SUMMARY:',
    unitsLabel: isHi ? 'दिन' : 'Units',
    advancesTitle: isHi ? 'महीने में प्राप्त भुगतान / एडवांस' : 'Payments & Advances Received in Month',
    noAdvances: isHi ? 'इस महीने में कोई एडवांस/भुगतान दर्ज नहीं है।' : 'No payment/advance recorded this month.',
    workerSign: isHi ? 'मजदूर के हस्ताक्षर / अंगूठा' : 'Worker Signature / Thumb',
    contractorSign: isHi ? 'ठेकेदार / अधिकृत हस्ताक्षर' : 'Contractor / Authorized Signature',
    printBtn: isHi ? '🖨️ प्रिंट / डाउनलोड PDF' : '🖨️ Print / Download PDF',
    switchLang: isHi ? '🌐 View in English' : '🌐 हिंदी में देखें',
    thekabookBadge: 'ThekaBook Verified',
  };

  let pCount = 0;
  let hdCount = 0;
  let aCount = 0;
  let otMinsTotal = 0;
  let totalWageEarned = 0;
  let totalShiftHours = 0;

  const dayRows = [];

  for (let d = 1; d <= countDays; d++) {
    const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month - 1, d);
    const dayName = dt.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { weekday: 'short' });
    const formattedDate = dt.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' });
    const isSunday = dt.getDay() === 0;

    const att = workerMonthAtt.find(a => String(a.date).slice(0, 10) === dStr);

    let status = isSunday ? 'W' : 'UNMARKED';
    let inTime = '-';
    let outTime = '-';
    let shiftHours = 0;
    let otHours = 0;
    let dayAmount = 0;
    let notes = att?.notes || '';
    let siteName = att?.site_id ? (siteMap.get(att.site_id) || '') : '';

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
          shiftHours = 8.5 + otHours;
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
      siteName,
      notes,
    });
  }

  const totalUnits = pCount + (hdCount * 0.5);
  const dailyRate = Number(worker.daily_rate || 0);
  const totalOtHours = otMinsTotal / 60;
  const orgName = org?.name || 'ThekaBook Contractor';

  // Worker wage payments / advances in month
  const workerEntries = entries.filter(e => e.worker_id === worker.id && String(e.date).startsWith(monthPrefix));
  const totalPaidInMonth = workerEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netDue = Math.max(0, totalWageEarned - totalPaidInMonth);

  const rowsHtml = dayRows.map(r => {
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
      <span class="z-time-in">${escapeHtml(r.inTime)}</span> <span style="color:#94A3B8;">-</span> <span class="z-time-out">${escapeHtml(r.outTime)}</span>
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
        <td class="small text-muted">${escapeHtml(r.siteName || '')}</td>
        <td class="text-muted small">${escapeHtml(r.notes || '')}</td>
      </tr>
    `;
  }).join('');

  const nextLang = isHi ? 'en' : 'hi';
  const langSwitchUrl = `?y=${year}&m=${month}&lang=${nextLang}`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worker.name)} - ${escapeHtml(monthTitle)} - ${isHi ? 'मासिक हाजिरी रिपोर्ट' : 'Monthly Attendance Slip'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #1E293B;
      background: #F1F5F9;
      font-size: 11px;
      line-height: 1.4;
    }

    /* Top Sticky Action Toolbar */
    .action-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #0F172A;
      color: #FFFFFF;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .toolbar-logo {
      font-weight: 900;
      font-size: 16px;
      color: #38BDF8;
      letter-spacing: -0.5px;
    }
    .toolbar-tag {
      background: #1E293B;
      color: #94A3B8;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-action {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
    }
    .btn-print {
      background: #2563EB;
      color: #FFFFFF;
    }
    .btn-print:hover {
      background: #1D4ED8;
    }
    .btn-lang {
      background: #334155;
      color: #F8FAFC;
    }
    .btn-lang:hover {
      background: #475569;
    }

    /* Page container */
    .sheet-wrapper {
      max-width: 860px;
      margin: 24px auto;
      padding: 24px 28px;
      background: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }

    /* Zoho Header */
    .zoho-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #E2E8F0;
      margin-bottom: 14px;
    }
    .zoho-company-name {
      font-size: 20px;
      font-weight: 900;
      color: #0F172A;
      letter-spacing: -0.3px;
    }
    .zoho-doc-title {
      font-size: 12px;
      font-weight: 800;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 3px;
    }
    .zoho-header-meta {
      text-align: right;
      font-size: 10px;
      color: #64748B;
    }
    .zoho-period-badge {
      display: inline-block;
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      margin-bottom: 4px;
    }

    /* Zoho 2-Column Employee Profile Card */
    .zoho-emp-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 14px;
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 16px;
      align-items: center;
    }
    .zoho-emp-name {
      font-size: 17px;
      font-weight: 800;
      color: #0F172A;
    }
    .zoho-emp-details {
      font-size: 10.5px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.6;
    }
    .zoho-emp-details b {
      color: #1E293B;
    }
    .zoho-pay-summary {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 8px 14px;
      text-align: right;
    }
    .zoho-pay-lbl {
      font-size: 9px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .zoho-pay-val {
      font-size: 18px;
      font-weight: 900;
      color: #059669;
      margin-top: 2px;
    }

    /* Zoho Metric Strip */
    .zoho-metrics-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 8px 14px;
      margin-bottom: 14px;
    }
    .zoho-metric-item {
      text-align: center;
      flex: 1;
    }
    .zoho-metric-item .z-lbl {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .zoho-metric-item .z-val {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .zoho-metric-divider {
      width: 1px;
      height: 24px;
      background: #E2E8F0;
    }

    /* Table Styles */
    table.zoho-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 14px;
    }
    table.zoho-table th {
      background: #F8FAFC;
      color: #475569;
      font-weight: 800;
      border-top: 1px solid #E2E8F0;
      border-bottom: 2px solid #CBD5E1;
      padding: 7px 6px;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table.zoho-table td {
      padding: 6px 6px;
      border-bottom: 1px solid #F1F5F9;
      vertical-align: middle;
    }
    table.zoho-table tr.z-sunday-row {
      background-color: #F8FAFC;
    }
    table.zoho-table tr:hover {
      background-color: #F1F5F9;
    }
    table.zoho-table tfoot td {
      background: #F8FAFC;
      border-top: 2px solid #CBD5E1;
      font-weight: 800;
      font-size: 10px;
      padding: 8px 6px;
    }

    /* Badges */
    .badge-status {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.2px;
    }
    .badge-p { background: #DCFCE7; color: #15803D; }
    .badge-hd { background: #FEF3C7; color: #B45309; }
    .badge-a { background: #FEE2E2; color: #B91C1C; }
    .badge-w { background: #F1F5F9; color: #64748B; font-weight: 600; }
    .badge-dash { color: #CBD5E1; }

    .z-time-in { color: #047857; font-weight: 700; font-size: 9px; }
    .z-time-out { color: #1D4ED8; font-weight: 700; font-size: 9px; }
    .z-hours-pill {
      background: #EFF6FF;
      color: #1E40AF;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 9px;
    }
    .z-ot-pill {
      background: #FEF3C7;
      color: #92400E;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 9px;
    }

    /* Payments card */
    .payments-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .payments-title {
      font-size: 11px;
      font-weight: 800;
      color: #1E293B;
      margin-bottom: 8px;
    }
    .payments-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    .payments-table th {
      color: #64748B;
      font-weight: 700;
      padding: 4px;
      border-bottom: 1px solid #CBD5E1;
      text-align: left;
    }
    .payments-table td {
      padding: 4px;
      border-bottom: 1px solid #E2E8F0;
    }

    /* Signatures & Footer */
    .zoho-footer {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #E2E8F0;
    }
    .zoho-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding: 0 10px;
    }
    .zoho-sign-box {
      text-align: center;
      width: 200px;
      border-top: 1.5px dashed #94A3B8;
      padding-top: 6px;
      font-size: 9.5px;
      font-weight: 700;
      color: #475569;
    }
    .zoho-verify-note {
      text-align: center;
      font-size: 8.5px;
      color: #94A3B8;
      margin-top: 16px;
      font-style: italic;
    }

    .center { text-align: center; }
    .right { text-align: right; }
    .text-bold { font-weight: 700; color: #0F172A; }
    .text-muted { color: #64748B; }
    .text-danger { color: #DC2626; font-weight: 700; }
    .small { font-size: 8.5px; }

    /* Print media query */
    @media print {
      body {
        background: #FFFFFF !important;
        font-size: 8.5px !important;
      }
      .no-print {
        display: none !important;
      }
      .sheet-wrapper {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        max-width: 100% !important;
      }
      table.zoho-table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>

  <!-- Top Action Toolbar for browser visitors -->
  <div class="action-toolbar no-print">
    <div class="toolbar-left">
      <span class="toolbar-logo">ThekaBook</span>
      <span class="toolbar-tag">${escapeHtml(orgName)}</span>
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="btn-action btn-print">${L.printBtn}</button>
      <a href="${langSwitchUrl}" class="btn-action btn-lang">${L.switchLang}</a>
    </div>
  </div>

  <div class="sheet-wrapper">
    <!-- Header -->
    <div class="zoho-header">
      <div>
        <div class="zoho-company-name">${escapeHtml(orgName)}</div>
        <div class="zoho-doc-title">${L.title}</div>
      </div>
      <div class="zoho-header-meta">
        <div class="zoho-period-badge">${escapeHtml(monthTitle)}</div>
        <div>${L.generatedOn}: <b>${escapeHtml(generatedOn)}</b></div>
      </div>
    </div>

    <!-- Employee Profile Card -->
    <div class="zoho-emp-card">
      <div>
        <div class="zoho-emp-name">${escapeHtml(worker.name)}</div>
        <div class="zoho-emp-details">
          <span>${L.role}: <b>${escapeHtml(worker.skill || (isHi ? 'मजदूर' : 'Labour'))}</b></span> &bull; 
          <span>${L.phone}: <b>${escapeHtml(worker.phone || '-')}</b></span><br>
          <span>${L.site}: <b>${escapeHtml(siteFilterName)}</b></span> &bull; 
          <span>${L.dailyRate}: <b>₹${dailyRate.toLocaleString('en-IN')}${L.perDay}</b></span>
        </div>
      </div>
      <div class="zoho-pay-summary">
        <div class="zoho-pay-lbl">${L.kpiTotalWage}</div>
        <div class="zoho-pay-val">₹${Math.round(totalWageEarned).toLocaleString('en-IN')}</div>
      </div>
    </div>

    <!-- KPI Metric Strip -->
    <div class="zoho-metrics-bar">
      <div class="zoho-metric-item">
        <div class="z-lbl" style="color: #15803D;">${L.kpiPresent}</div>
        <div class="z-val">${pCount} ${L.daysUnit}</div>
      </div>
      <div class="zoho-metric-divider"></div>
      <div class="zoho-metric-item">
        <div class="z-lbl" style="color: #B45309;">${L.kpiHalf}</div>
        <div class="z-val">${hdCount} ${L.daysUnit}</div>
      </div>
      <div class="zoho-metric-divider"></div>
      <div class="zoho-metric-item">
        <div class="z-lbl" style="color: #B91C1C;">${L.kpiAbsent}</div>
        <div class="z-val">${aCount} ${L.daysUnit}</div>
      </div>
      <div class="zoho-metric-divider"></div>
      <div class="zoho-metric-item">
        <div class="z-lbl">${L.kpiOt}</div>
        <div class="z-val">${totalOtHours > 0 ? `+${totalOtHours.toFixed(1)} ${L.hrsUnit}` : '0 h'}</div>
      </div>
      <div class="zoho-metric-divider"></div>
      <div class="zoho-metric-item">
        <div class="z-lbl">${L.kpiTotalHours}</div>
        <div class="z-val">${totalShiftHours.toFixed(1)} ${L.hrsUnit}</div>
      </div>
      <div class="zoho-metric-divider"></div>
      <div class="zoho-metric-item">
        <div class="z-lbl" style="color: #1D4ED8;">${L.kpiTotalDays}</div>
        <div class="z-val" style="color: #1D4ED8;">${totalUnits} ${L.unitsLabel}</div>
      </div>
    </div>

    <!-- Day-by-Day Attendance Table -->
    <table class="zoho-table">
      <thead>
        <tr>
          <th class="center" style="width: 25px;">${L.thSr}</th>
          <th style="width: 70px;">${L.thDate}</th>
          <th class="center" style="width: 35px;">${L.thDay}</th>
          <th class="center" style="width: 75px;">${L.thStatus}</th>
          <th class="center" style="width: 120px;">${L.thShift}</th>
          <th class="center" style="width: 65px;">${L.thHours}</th>
          <th class="center" style="width: 60px;">${L.thOt}</th>
          <th class="right" style="width: 80px;">${L.thWage}</th>
          <th style="width: 85px;">${L.thSite}</th>
          <th>${L.thNotes}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="right text-bold">${L.totalLabel}</td>
          <td class="center text-bold">${totalUnits} ${L.unitsLabel}</td>
          <td class="center text-muted">-</td>
          <td class="center text-bold">${totalShiftHours.toFixed(1)}h</td>
          <td class="center text-bold">${totalOtHours > 0 ? `+${totalOtHours.toFixed(1)}h` : '-'}</td>
          <td class="right text-bold" style="color: #059669; font-size: 11px;">₹${Math.round(totalWageEarned).toLocaleString('en-IN')}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    ${workerEntries.length > 0 ? `
    <!-- Advances / Payments Section -->
    <div class="payments-card">
      <div class="payments-title">${L.advancesTitle}</div>
      <table class="payments-table">
        <thead>
          <tr>
            <th>${L.thDate}</th>
            <th>${isHi ? 'विवरण' : 'Description'}</th>
            <th>${isHi ? 'माध्यम' : 'Payment Mode'}</th>
            <th class="right">${isHi ? 'रकम' : 'Amount'}</th>
          </tr>
        </thead>
        <tbody>
          ${workerEntries.map(e => `
            <tr>
              <td>${new Date(e.date).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' })}</td>
              <td>${escapeHtml(e.description || (isHi ? 'मजदूरी भुगतान' : 'Wage Payment'))}</td>
              <td><span class="toolbar-tag" style="background:#E2E8F0; color:#334155;">${escapeHtml(e.mode || 'CASH')}</span></td>
              <td class="right text-bold" style="color:#2563EB;">₹${Number(e.amount || 0).toLocaleString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="right text-bold">${isHi ? 'कुल भुगतान:' : 'Total Paid:'}</td>
            <td class="right text-bold" style="color:#2563EB; font-size:10.5px;">₹${Number(totalPaidInMonth).toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    ` : ''}

    <!-- Signatures & Verification -->
    <div class="zoho-footer">
      <div class="zoho-signatures">
        <div class="zoho-sign-box">${L.workerSign}</div>
        <div class="zoho-sign-box">${L.contractorSign}</div>
      </div>
      <div class="zoho-verify-note">
        ${L.subTitle}
      </div>
    </div>
  </div>

</body>
</html>`;
}
