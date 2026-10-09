import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { MetricCard } from '../../components/common/MetricCard';
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { money, siteSummary } from '../../finance';
import { parseSiteNotesAndDocs } from '../../components/sites/SiteFormModal';
import { downloadSiteDocument, viewSiteDocument } from '../../report';
import { useLanguage } from '../../i18n';
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { getDocFromIndexedDB, fetchDocFromServer } from '../../storage/docStorage';

interface SitesPageProps {
  data: Snapshot;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string | null) => void;
  onOpenNewSite: () => void;
  onEditSite: (site: Row) => void;
  onOpenEntry: (kind: string, siteId?: string) => void;
  onOpenAttendance: (siteId?: string) => void;
  onShareReport: (siteId: string) => void;
  onOpenProfile?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

function getSiteStatusTheme(status: string) {
  switch (status) {
    case 'ONGOING':
      return {
        color: '#16A34A',
        accent: '#22C55E',
        bg: '#F0FDF4',
        badgeBg: '#DCFCE7',
      };
    case 'COMPLETED':
      return {
        color: '#2563EB',
        accent: '#3B82F6',
        bg: '#EFF6FF',
        badgeBg: '#DBEAFE',
      };
    case 'PAUSED':
      return {
        color: '#D97706',
        accent: '#F59E0B',
        bg: '#FFFBEB',
        badgeBg: '#FEF3C7',
      };
    case 'UPCOMING':
    default:
      return {
        color: '#6366F1',
        accent: '#818CF8',
        bg: '#EEF2FF',
        badgeBg: '#E0E7FF',
      };
  }
}

export function SitesPage({
  data,
  selectedSiteId,
  onSelectSite,
  onOpenNewSite,
  onEditSite,
  onOpenEntry,
  onOpenAttendance,
  onShareReport,
  onOpenProfile,
  refreshing,
  onRefresh,
}: SitesPageProps) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [termsExpanded, setTermsExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Bill & Parchi photo viewer state
  const [viewingDoc, setViewingDoc] = useState<{
    url: string;
    title: string;
    date: string;
    amount: number | string;
    party: string;
  } | null>(null);

  const handleOpenDoc = async (docId: string, entry: Row) => {
    try {
      const local = await getDocFromIndexedDB(docId);
      if (local && local.dataUrl) {
        setViewingDoc({
          url: local.dataUrl,
          title: entry.description || 'Bill Photo',
          date: String(entry.date).slice(0, 10),
          amount: entry.amount,
          party: entry.party || '',
        });
        return;
      }
      const remote = await fetchDocFromServer(docId);
      if (remote && remote.blobUrl) {
        setViewingDoc({
          url: remote.blobUrl,
          title: entry.description || 'Bill Photo',
          date: String(entry.date).slice(0, 10),
          amount: entry.amount,
          party: entry.party || '',
        });
      }
    } catch (err) {
      console.warn('Could not open doc:', err);
    }
  };

  const site = selectedSiteId
    ? data.sites.find((s) => s.id === selectedSiteId)
    : null;

  // Render Single Site Details View
  if (site) {
    const f = siteSummary(site, data.attendance, data.entries);
    const { userNotes, documents, gstin, state, stateCode, businessName } =
      parseSiteNotesAndDocs(site.notes || '');
    const noteLines = userNotes
      ? userNotes.split('\n').filter((l) => l.trim().length > 0)
      : [];
    const isLongNotes = noteLines.length > 4 || userNotes.length > 250;
    const siteEntries = data.entries
      .filter((e) => e.site_id === site.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const statusBadgeLabel =
      site.status === 'ONGOING'
        ? t('active', 'Active')
        : site.status === 'COMPLETED'
          ? t('completed', 'Completed')
          : site.status === 'PAUSED'
            ? t('paused', 'Paused')
            : t('upcoming', 'Upcoming');

    return (
      <View style={styles.pageWrapper}>
        <TopNavBar
          title={t('siteDetails', 'Site Details')}
          icon="business"
          userInitials={data.user.name}
          organizationName={data.organization.name}
          onOpenProfile={onOpenProfile}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          <View style={styles.container}>
            {/* Executive Site Overview Card */}
            <View style={styles.siteHeaderCard}>
              {/* Primary Header: Avatar + Title & Meta + Edit Button */}
              <View style={styles.headerPrimaryRow}>
                <View style={styles.siteAvatar}>
                  <AppIcon name="business" size={22} color={Colors.primary} />
                </View>

                <View style={styles.headerMainCol}>
                  <Text style={styles.siteTitle}>
                    {site.name}
                  </Text>

                  {/* Clean Status & Client Subtitle */}
                  <View style={styles.headerMetaRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        site.status === 'ONGOING'
                          ? styles.statusBadgeOngoing
                          : site.status === 'COMPLETED'
                            ? styles.statusBadgeCompleted
                            : styles.statusBadgePaused,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          site.status === 'ONGOING'
                            ? styles.statusDotOngoing
                            : site.status === 'COMPLETED'
                              ? styles.statusDotCompleted
                              : styles.statusDotPaused,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          site.status === 'ONGOING'
                            ? styles.statusTextOngoing
                            : site.status === 'COMPLETED'
                              ? styles.statusTextCompleted
                              : styles.statusTextPaused,
                        ]}
                      >
                        {site.status === 'ONGOING'
                          ? 'Ongoing'
                          : site.status === 'COMPLETED'
                            ? 'Completed'
                            : 'Paused'}
                      </Text>
                    </View>

                    <Text style={styles.metaDotDivider}>•</Text>

                    <View style={styles.clientInlineGroup}>
                      <AppIcon name="person" size={12} color="#64748B" />
                      <Text style={styles.clientInlineName}>{site.owner_name}</Text>
                    </View>

                    {site.phone ? (
                      <>
                        <Text style={styles.metaDotDivider}>•</Text>
                        <View style={styles.phoneInlineGroup}>
                          <AppIcon name="call" size={12} color="#16A34A" />
                          <Text style={styles.phoneInlineText}>{site.phone}</Text>
                        </View>
                      </>
                    ) : null}

                    {businessName ? (
                      <>
                        <Text style={styles.metaDotDivider}>•</Text>
                        <Text style={styles.businessInlineText}>
                          {businessName}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                <Pressable
                  onPress={() => onEditSite(site)}
                  style={({ pressed }) => [
                    styles.editSiteBtn,
                    pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                  ]}
                  accessibilityLabel="Edit site details"
                >
                  <AppIcon name="create-outline" size={13} color="#334155" />
                  <Text style={styles.editSiteBtnText}>Edit</Text>
                </Pressable>
              </View>

              {/* Clean hairline separator */}
              <View style={styles.cardDivider} />

              {/* Key Project Specs Chips - Wrapping naturally with no truncation */}
              <View style={styles.specsChipsContainer}>
                {/* Scope & Rate */}
                <View style={styles.specChip}>
                  <AppIcon
                    name={site.work_type === 'LABOUR' ? 'people-outline' : 'construct-outline'}
                    size={13}
                    color="#2563EB"
                  />
                  <Text style={styles.specChipText}>
                    {site.work_type === 'LABOUR' ? t('labourOnly', 'Labour Only') : t('labourMaterial', 'Labour + Material')}
                    {' • '}
                    {site.pricing === 'FIXED'
                      ? t('fixedLumpsum', 'Fixed Lumpsum')
                      : site.pricing === 'UNIT'
                        ? t('unitRate', 'Unit Rate')
                        : t('daily', 'Daily')}
                  </Text>
                </View>

                {/* Timeline */}
                {(site.start_date || site.end_date) ? (
                  <View style={styles.specChip}>
                    <AppIcon name="calendar-outline" size={13} color="#059669" />
                    <Text style={styles.specChipText}>
                      {site.start_date}{site.end_date ? ` → ${site.end_date}` : ` (${t('active', 'Active')})`}
                    </Text>
                  </View>
                ) : null}

                {/* Location */}
                {site.address ? (
                  <View style={styles.specChip}>
                    <AppIcon name="location-outline" size={13} color="#D97706" />
                    <Text style={styles.specChipText}>
                      {site.address}{state ? `, ${state}` : ''}
                    </Text>
                  </View>
                ) : null}

                {/* GST Verification Banner */}
                {gstin ? (
                  <View style={[styles.specChip, styles.specChipGst]}>
                    <AppIcon name="shield-checkmark-outline" size={13} color="#16A34A" />
                    <Text style={styles.specChipGstText}>
                      GSTIN: <Text style={styles.gstCodeText}>{gstin}</Text>
                      {state ? ` • ${state}${stateCode ? ` (${stateCode})` : ''}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Contract Terms & Notes Section */}
              {userNotes ? (
                <View style={styles.termsBox}>
                  <View style={styles.termsHeaderRow}>
                    <View style={styles.termsTitleGroup}>
                      <AppIcon name="document-text-outline" size={14} color="#0F2851" />
                      <Text style={styles.termsTitleText}>{t('contractTermsNotes', 'Contract Terms & Notes')}</Text>
                    </View>
                    {isLongNotes && (
                      <Pressable
                        onPress={() => setTermsExpanded((v) => !v)}
                        style={({ pressed }) => [
                          styles.termsToggleBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                        hitSlop={8}
                        accessibilityLabel={termsExpanded ? 'Show less terms' : 'Show all terms'}
                      >
                        <Text style={styles.termsToggleBtnText}>
                          {termsExpanded
                            ? t('showLess', 'Show Less')
                            : `${t('showAll', 'Show All')} (${noteLines.length})`}
                        </Text>
                        <AppIcon
                          name={termsExpanded ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color="#1D4ED8"
                        />
                      </Pressable>
                    )}
                  </View>

                  <Text
                    style={styles.termsBodyText}
                    numberOfLines={isLongNotes && !termsExpanded ? 3 : undefined}
                  >
                    {userNotes}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Financial Stat Cards */}
            <View style={styles.metricsGrid}>
              <MetricCard
                label={t('agreedContract', 'Agreed Contract')}
                value={money(f.contract)}
                foot={t('totalProjectValue', 'Total project value')}
                icon="business-outline"
              />
              <MetricCard
                label={t('totalReceived', 'Received')}
                value={money(f.received)}
                foot={t('collectedSoFar', 'Collected so far')}
                tone="success"
                icon="cash-outline"
              />
              <MetricCard
                label={t('clientBalance', 'Client Balance')}
                value={money(f.ownerBalance)}
                foot={f.ownerBalance < 0 ? t('overpaid', 'Overpaid') : t('pendingToCollect', 'Pending to collect')}
                tone={f.ownerBalance < 0 ? 'danger' : 'warning'}
                icon="wallet-outline"
              />
              <MetricCard
                label={f.final ? t('finalMargin', 'Final Margin') : t('estMargin', 'Est. Margin')}
                value={money(f.profit)}
                foot={t('projectedMargin', 'Projected contractor margin')}
                accent
                tone={f.profit >= 0 ? 'success' : 'danger'}
                icon="trending-up"
              />
            </View>

            {/* Agreements & Documents Section */}
            <Card style={styles.documentsCard}>
              <View style={styles.docHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppIcon name="document-text" size={17} color="#7C3AED" />
                  <Text style={styles.cardHeaderTitle}>
                    Agreements & Documents ({documents.length})
                  </Text>
                </View>
              </View>

              {documents.length > 0 ? (
                <View style={styles.docItemsGrid}>
                  {documents.map((d) => (
                    <View key={d.id} style={styles.docItemCard}>
                      <View style={styles.docItemIconBox}>
                        <AppIcon
                          name={
                            d.category === 'AGREEMENT'
                              ? 'document-text'
                              : d.category === 'DRAWING'
                                ? 'map'
                                : d.category === 'QUOTATION'
                                  ? 'receipt'
                                  : 'image'
                          }
                          size={18}
                          color={
                            d.category === 'AGREEMENT'
                              ? '#16A34A'
                              : d.category === 'DRAWING'
                                ? '#2563EB'
                                : d.category === 'QUOTATION'
                                  ? '#D97706'
                                  : '#9333EA'
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.docItemName} numberOfLines={1}>
                            {d.name}
                          </Text>
                          <Badge label={d.category} tone="gray" />
                        </View>
                        <Text style={styles.docItemMeta}>
                          {d.size ? `${d.size} • ` : ''}Date: {d.date}
                          {d.refNo ? ` • Ref: ${d.refNo}` : ''}
                        </Text>
                        {d.terms ? (
                          <Text style={styles.docItemTerms} numberOfLines={2}>
                            Terms: {d.terms}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => viewSiteDocument(d, {
                          name: site.name,
                          owner_name: site.owner_name,
                          phone: site.phone,
                          address: site.address,
                          gstin,
                          state,
                          stateCode,
                          businessName,
                          work_type: site.work_type,
                          pricing: site.pricing,
                        })}
                        style={({ pressed }) => [
                          styles.docItemActionViewBtn,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                        ]}
                        accessibilityLabel={`View ${d.name}`}
                      >
                        <AppIcon name="eye-outline" size={14} color="#7C3AED" />
                        <Text style={styles.docItemActionViewBtnText}>View</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDocText}>
                  {lang === 'hi' ? 'अभी कोई दस्तावेज संलग्न नहीं है।' : 'No documents attached yet.'}
                </Text>
              )}
            </Card>

            {/* Cost & Cash Breakdown */}
            <Card style={styles.breakdownCard}>
              <Text style={styles.cardHeaderTitle}>Cost & Cash Breakdown</Text>
              <View style={styles.breakdownGrid}>
                {[
                  ['Labour Earned (Wages)', f.labour],
                  ['Labour Paid (Cash)', f.wagesPaid],
                  ['Material Cost', f.material],
                  ['Other Site Expense', f.expenses],
                  ['Supplier Bills Paid', f.suppliersPaid],
                  ['Supplier Dues Pending', f.supplierBalance],
                  ['Estimated Remaining Cost', f.remaining],
                  ['Net Cash In Hand (This Site)', f.cash],
                ].map(([label, v]) => (
                  <View key={label as string} style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>{label as string}</Text>
                    <Text style={styles.breakdownValue}>{money(v as number)}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Site Action Buttons */}
            {isDesktop ? (
              <View style={styles.actionsWrapDesktop}>
                <Button
                  title={t('receivePayment', 'Receive Payment')}
                  onPress={() => onOpenEntry('RECEIPT', site.id)}
                  icon="arrow-down"
                />
                <Button
                  title={t('navAttendance', 'Attendance')}
                  variant="secondary"
                  onPress={() => onOpenAttendance(site.id)}
                  icon="calendar"
                />
                <Button
                  title={t('materialBill', 'Material Bill')}
                  variant="secondary"
                  onPress={() => onOpenEntry('MATERIAL', site.id)}
                  icon="cube"
                />
                <Button
                  title={t('extraWork', 'Extra Work')}
                  variant="secondary"
                  onPress={() => onOpenEntry('EXTRA', site.id)}
                  icon="add-circle"
                />
                <Button
                  title={t('shareStatement', 'Share Statement')}
                  variant="secondary"
                  onPress={() => onShareReport(site.id)}
                  icon="share-social"
                />
              </View>
            ) : (
              <View style={styles.actionsWrapMobile}>
                {/* Row 1: Primary Receive Payment (Full Width) */}
                <Button
                  title={t('receivePayment', 'Receive Payment')}
                  onPress={() => onOpenEntry('RECEIPT', site.id)}
                  icon="arrow-down"
                  style={styles.fullWidthActionBtn}
                />

                {/* Row 2: Attendance & Material Bill (50% each) */}
                <View style={styles.actionGridRow}>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('navAttendance', 'Attendance')}
                      variant="secondary"
                      onPress={() => onOpenAttendance(site.id)}
                      icon="calendar"
                      style={styles.gridActionBtn}
                    />
                  </View>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('materialBill', 'Material Bill')}
                      variant="secondary"
                      onPress={() => onOpenEntry('MATERIAL', site.id)}
                      icon="cube"
                      style={styles.gridActionBtn}
                    />
                  </View>
                </View>

                {/* Row 3: Extra Work & Share Statement (50% each) */}
                <View style={styles.actionGridRow}>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('extraWork', 'Extra Work')}
                      variant="secondary"
                      onPress={() => onOpenEntry('EXTRA', site.id)}
                      icon="add-circle"
                      style={styles.gridActionBtn}
                    />
                  </View>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('shareStatement', 'Share Statement')}
                      variant="secondary"
                      onPress={() => onShareReport(site.id)}
                      icon="share-social"
                      style={styles.gridActionBtn}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Site Ledger Entries */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('siteLedger', 'Site Ledger')}</Text>
              <Text style={styles.sectionSubtitle}>{t('allTransactionsForSite', 'All transactions for this site')}</Text>
            </View>

            <View style={styles.ledgerList}>
              {siteEntries.map((e) => {
                const isReceipt = e.kind === 'RECEIPT';
                return (
                  <Card key={e.id} style={styles.entryRow}>
                    <View style={styles.entryLeft}>
                      <View
                        style={[
                          styles.entryIcon,
                          {
                            backgroundColor: isReceipt
                              ? Colors.successLight
                              : Colors.surfaceSubtle,
                          },
                        ]}
                      >
                        <AppIcon
                          name={
                            isReceipt
                              ? 'arrow-down'
                              : e.kind === 'MATERIAL'
                                ? 'cube'
                                : 'arrow-up'
                          }
                          size={18}
                          color={isReceipt ? Colors.success : Colors.textPrimary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryDesc}>{e.description}</Text>
                        <Text style={styles.entryMeta}>
                          {String(e.date).slice(0, 10)} • {e.kind}
                          {e.party ? ` • ${e.party}` : ''}
                        </Text>
                        {e.reference ? (() => {
                          const docMatch = String(e.reference).match(/\[doc:([^\]]+)\]/);
                          const cleanRef = String(e.reference).replace(/\[doc:[^\]]+\]/g, '').trim();
                          const docId = docMatch ? docMatch[1] : null;

                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              {cleanRef ? (
                                <Text style={[styles.entryMeta, { color: '#64748B' }]}>
                                  Ref: {cleanRef}
                                </Text>
                              ) : null}
                              {docId ? (
                                <Pressable
                                  onPress={() => handleOpenDoc(docId, e)}
                                  style={({ pressed }) => [
                                    {
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 3,
                                      backgroundColor: '#EFF6FF',
                                      paddingHorizontal: 7,
                                      paddingVertical: 2,
                                      borderRadius: 5,
                                      borderWidth: 1,
                                      borderColor: '#BFDBFE',
                                    },
                                    pressed && { opacity: 0.8 },
                                  ]}
                                >
                                  <AppIcon name="image" size={11} color="#2563EB" />
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#1D4ED8' }}>
                                    {lang === 'hi' ? '📸 पर्ची फोटो' : '📸 Bill Photo'}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          );
                        })() : null}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.entryAmount,
                        { color: isReceipt ? Colors.success : Colors.textPrimary },
                      ]}
                    >
                      {isReceipt ? '+' : '-'} {money(e.amount)}
                    </Text>
                  </Card>
                );
              })}
              {!siteEntries.length && (
                <Text style={styles.emptyNotice}>
                  {lang === 'hi' ? 'इस साइट के लिए अभी कोई लेन-देन दर्ज नहीं है।' : 'No expenses or receipts recorded for this site yet.'}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bill & Parchi Full Image Viewer Modal */}
        {viewingDoc && (
          <BillImageViewerModal
            visible={!!viewingDoc}
            imageUrl={viewingDoc.url}
            title={viewingDoc.title}
            date={viewingDoc.date}
            amount={viewingDoc.amount}
            party={viewingDoc.party}
            onClose={() => setViewingDoc(null)}
          />
        )}
      </View>
    );
  }

  // Render All Sites List View
  const query = search.trim().toLowerCase();
  const filteredSites = data.sites.filter((s) => {
    const matchesQuery = (s.name + ' ' + s.owner_name).toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const totalSitesCount = data.sites.length;
  const ongoingSitesCount = data.sites.filter((s) => s.status === 'ONGOING').length;
  const totalContractVal = data.sites.reduce(
    (acc, s) => acc + (Number(s.contract_amount) || 0),
    0
  );
  const totalPendingVal = data.sites.reduce((acc, s) => {
    const f = siteSummary(s, data.attendance, data.entries);
    return acc + (f.ownerBalance > 0 ? f.ownerBalance : 0);
  }, 0);

  const statusCounts: Record<string, number> = {
    ALL: data.sites.length,
    ONGOING: data.sites.filter((s) => s.status === 'ONGOING').length,
    UPCOMING: data.sites.filter((s) => s.status === 'UPCOMING').length,
    PAUSED: data.sites.filter((s) => s.status === 'PAUSED').length,
    COMPLETED: data.sites.filter((s) => s.status === 'COMPLETED').length,
  };

  const getStatusChipLabel = (status: string) => {
    switch (status) {
      case 'ONGOING': return t('active', 'Active');
      case 'UPCOMING': return t('upcoming', 'Upcoming');
      case 'PAUSED': return t('paused', 'Paused');
      case 'COMPLETED': return t('completed', 'Completed');
      default: return t('all', 'All');
    }
  };

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title={t('sitesTitle', 'Work Sites')}
        subtitle={t('sitesSubtitle', 'Manage construction sites, theke & contract ledger')}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        actions={
          <Pressable
            onPress={onOpenNewSite}
            style={({ pressed }) => [
              styles.navNewSiteBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityLabel="Create new work site"
          >
            <Text style={styles.navNewSiteBtnText}>{t('newSite', 'New Site')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.container}>

          {/* Quick Stats Overview 2x2 KPI Grid */}
          <View style={styles.statsSummaryGrid}>
            <View style={[styles.statKpiCard, styles.statKpiTotal]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="business" size={14} color="#2563EB" />
                </View>
                <Text style={styles.statKpiLabel}>{t('totalSites', 'Total Sites')}</Text>
              </View>
              <Text style={styles.statKpiValue}>{totalSitesCount}</Text>
              <Text style={styles.statKpiFoot}>{t('allCreatedSites', 'All sites')}</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiActive]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <AppIcon name="flash" size={14} color="#16A34A" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#166534' }]}>{t('activeSitesCount', 'Active Sites')}</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#15803D' }]}>{ongoingSitesCount}</Text>
              <Text style={styles.statKpiFoot}>{t('ongoingWork', 'Ongoing work')}</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiContract]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#F1F5F9' }]}>
                  <AppIcon name="receipt" size={14} color="#0F2851" />
                </View>
                <Text style={styles.statKpiLabel}>{t('totalValue', 'Total Value')}</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#0F2851' }]} numberOfLines={1}>
                {money(totalContractVal)}
              </Text>
              <Text style={styles.statKpiFoot}>{t('contractAmount', 'Contract amount')}</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiPending]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: totalPendingVal > 0 ? '#FEF3C7' : '#DCFCE7' }]}>
                  <AppIcon name="wallet" size={14} color={totalPendingVal > 0 ? '#D97706' : '#16A34A'} />
                </View>
                <Text style={[styles.statKpiLabel, { color: totalPendingVal > 0 ? '#92400E' : '#166534' }]}>
                  {t('pendingDue', 'Pending Due')}
                </Text>
              </View>
              <Text
                style={[
                  styles.statKpiValue,
                  { color: totalPendingVal > 0 ? '#B45309' : '#15803D' },
                ]}
                numberOfLines={1}
              >
                {money(totalPendingVal)}
              </Text>
              <Text style={styles.statKpiFoot}>{totalPendingVal > 0 ? t('toBeCollected', 'To collect') : t('allCleared', 'All clear')}</Text>
            </View>
          </View>

          {/* Search */}
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchSitePlaceholder', 'Search site or client name…')}
          />

          {/* Status Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {['ALL', 'ONGOING', 'UPCOMING', 'PAUSED', 'COMPLETED'].map((status) => {
              const isSelected = statusFilter === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => setStatusFilter(status)}
                  style={[
                    styles.chip,
                    isSelected && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                  >
                    {getStatusChipLabel(status)} ({statusCounts[status] || 0})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Sites List in Premium Single-Row Card UI */}
          {filteredSites.length ? (
            <View style={styles.sitesGrid}>
              {filteredSites.map((siteItem) => {
                const f = siteSummary(siteItem, data.attendance, data.entries);
                const progress =
                  f.contract > 0 ? Math.min(1, f.received / f.contract) : 0;
                const statusTheme = getSiteStatusTheme(siteItem.status);

                return (
                  <Pressable
                    key={siteItem.id}
                    onPress={() => onSelectSite(siteItem.id)}
                    style={({ pressed }) => [
                      styles.siteRowCard,
                      pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                    ]}
                    accessibilityLabel={'Open site ' + siteItem.name}
                  >
                    <View
                      style={[
                        styles.siteRowAccent,
                        { backgroundColor: statusTheme.accent },
                      ]}
                    />

                    <View style={styles.siteRowContent}>
                      {/* Header Row: Icon + Title & Owner + Status Pill + Chevron */}
                      <View style={styles.siteRowTop}>
                        <View
                          style={[
                            styles.siteRowIconBadge,
                            { backgroundColor: statusTheme.bg },
                          ]}
                        >
                          <AppIcon
                            name={
                              siteItem.work_type === 'LABOUR'
                                ? 'hammer'
                                : 'business'
                            }
                            size={18}
                            color={statusTheme.color}
                          />
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.siteRowTitleWrap}>
                            <Text style={styles.siteRowName} numberOfLines={1}>
                              {siteItem.name}
                            </Text>
                            <View
                              style={[
                                styles.siteStatusPill,
                                { backgroundColor: statusTheme.badgeBg },
                              ]}
                            >
                              <View
                                style={[
                                  styles.siteStatusDot,
                                  { backgroundColor: statusTheme.color },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.siteStatusPillText,
                                  { color: statusTheme.color },
                                ]}
                              >
                                {getStatusChipLabel(siteItem.status)}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.siteRowChevron}>
                          <AppIcon name="chevron-forward" size={16} color="#94A3B8" />
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={styles.siteRowProgressRow}>
                        <View style={styles.siteRowProgressBar}>
                          <View
                            style={[
                              styles.siteRowProgressFill,
                              {
                                width: `${Math.max(3, Math.round(progress * 100))}%`,
                                backgroundColor: statusTheme.accent,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.siteRowProgressText}>
                          {Math.round(progress * 100)}% {lang === 'hi' ? 'प्राप्त' : 'Recv'}
                        </Text>
                      </View>

                      {/* 3 Metric Pills Footer */}
                      <View style={styles.siteRowMetricsFooter}>
                        <View style={styles.siteRowMetricCol}>
                          <Text style={styles.siteRowMetricLabel}>{t('contract', 'Contract')}</Text>
                          <Text style={styles.siteRowMetricVal}>
                            {money(f.contract)}
                          </Text>
                        </View>

                        <View style={styles.siteRowMetricDiv} />

                        <View style={styles.siteRowMetricCol}>
                          <Text style={styles.siteRowMetricLabel}>{t('totalReceived', 'Received')}</Text>
                          <Text
                            style={[
                              styles.siteRowMetricVal,
                              { color: '#16A34A' },
                            ]}
                          >
                            {money(f.received)}
                          </Text>
                        </View>

                        <View style={styles.siteRowMetricDiv} />

                        <View style={styles.siteRowMetricCol}>
                          <Text style={styles.siteRowMetricLabel}>{t('balanceDues', 'Balance Due')}</Text>
                          <Text
                            style={[
                              styles.siteRowMetricVal,
                              {
                                color:
                                  f.ownerBalance > 0
                                    ? '#D97706'
                                    : f.ownerBalance < 0
                                      ? '#DC2626'
                                      : '#16A34A',
                              },
                            ]}
                          >
                            {f.ownerBalance > 0
                              ? money(f.ownerBalance)
                              : f.ownerBalance < 0
                                ? `${money(-f.ownerBalance)} Adv`
                                : (lang === 'hi' ? '₹0 हिसाब चुकता' : '₹0 Settled')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title={t('noSitesFound', 'No sites found matching your filter.')}
              description={t('noFilterMatchDesc', 'No records match your search. Try a different query or clear filters.')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navNewSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  navNewSiteBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 32,
  },
  container: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  nayaThekaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  nayaThekaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statKpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statKpiTotal: {
    backgroundColor: '#FFFFFF',
  },
  statKpiActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statKpiContract: {
    backgroundColor: '#FFFFFF',
  },
  statKpiPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statKpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statKpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  statKpiValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  statKpiFoot: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sitesGrid: {
    gap: 12,
  },
  siteRowCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  siteRowAccent: {
    width: 5,
  },
  siteRowContent: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  siteRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  siteRowIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteRowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  siteRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    flex: 1,
  },
  siteStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  siteStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  siteStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  siteRowMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  siteRowChevron: {
    paddingLeft: 2,
  },
  siteRowProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  siteRowProgressBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  siteRowProgressFill: {
    height: 5,
    borderRadius: 3,
  },
  siteRowProgressText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  siteRowMetricsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  siteRowMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  siteRowMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  siteRowMetricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  siteRowMetricDiv: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  // Details view styles
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  siteHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  siteAvatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerMainCol: {
    flex: 1,
    gap: 4,
  },
  siteTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeOngoing: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeCompleted: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusBadgePaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusDotOngoing: {
    backgroundColor: '#16A34A',
  },
  statusDotCompleted: {
    backgroundColor: '#2563EB',
  },
  statusDotPaused: {
    backgroundColor: '#D97706',
  },
  statusTextOngoing: {
    color: '#15803D',
  },
  statusTextCompleted: {
    color: '#1D4ED8',
  },
  statusTextPaused: {
    color: '#B45309',
  },
  editSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 2,
  },
  editSiteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  clientInlineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clientInlineName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  businessInlineText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  phoneInlineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  phoneInlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  metaDotDivider: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  specsChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  specChipGst: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  specChipGstText: {
    fontSize: 11.5,
    color: '#166534',
    fontWeight: '600',
  },
  gstCodeText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#14532D',
  },
  termsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#0F2851',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  termsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  termsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  termsTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F2851',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  termsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  termsToggleBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  termsBodyText: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  navEditIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  breakdownCard: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  breakdownGrid: {
    gap: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceSubtle,
  },
  breakdownLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionsWrapDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  actionsWrapMobile: {
    gap: 8,
    marginBottom: 20,
  },
  fullWidthActionBtn: {
    width: '100%',
  },
  actionGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionGridCol: {
    flex: 1,
  },
  gridActionBtn: {
    width: '100%',
    paddingHorizontal: 8,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  ledgerList: {
    gap: 8,
  },
  entryRow: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  entryMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyNotice: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    marginVertical: 12,
  },
  documentsCard: {
    padding: 16,
    marginBottom: 16,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  docItemsGrid: {
    gap: 8,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  docItemMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  docItemTerms: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  noDocText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  docItemActionViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginLeft: 6,
  },
  docItemActionViewBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#7C3AED',
  },
});

export { NewSitePage } from './NewSitePage';

