import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { reportText } from '../../../shared/finance';
import { Snapshot } from './types';
import {
  getDocFromIndexedDB,
  fetchDocFromServer,
  triggerBrowserDownload,
} from './storage/docStorage';
const escape = (v:string) => v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function shareReport(data:Snapshot,siteId?:string) {
  const message = reportText(data,siteId);
  if(Platform.OS==='web') { await navigator.clipboard.writeText(message); return 'Statement copied to clipboard'; }
  await Share.share({message,title:'ThekaBook statement'}); return 'Statement ready to share';
}
export async function pdfReport(data:Snapshot,siteId?:string) {
  const html = `<html><head><meta charset="utf-8"><style>body{font:12px Arial;padding:32px;color:#172f31}h1{color:#11685d}pre{white-space:pre-wrap;line-height:1.7;font-family:Arial}footer{color:#71817f}</style></head><body><h1>ThekaBook</h1><pre>${escape(reportText(data,siteId))}</pre></body></html>`;
  if(Platform.OS==='web') { await Print.printAsync({html}); return; }
  const file = await Print.printToFileAsync({html});
  if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',dialogTitle:'Contractor statement',UTI:'com.adobe.pdf'});
  else throw new Error('Sharing is unavailable on this device');
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
    } catch {}

    // 3. Fetch original uploaded binary from server /documents/:id
    try {
      const serverDoc =
        (doc.id ? await fetchDocFromServer(doc.id, token) : null) ||
        (await fetchDocFromServer(doc.name, token));
      if (serverDoc && serverDoc.blobUrl) {
        triggerBrowserDownload(serverDoc.blobUrl, doc.name);
        return;
      }
    } catch {}
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

