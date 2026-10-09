import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { entryLabels } from '../../forms';
import { useLanguage } from '../../i18n';
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { getDocFromIndexedDB, fetchDocFromServer } from '../../storage/docStorage';

interface HisabPageProps {
  data: Snapshot;
  onOpenEntry: (kind: string, siteId?: string, workerId?: string, bill?: Row) => void;
  onOpenVoidModal: (entry: Row) => void;
  onOpenProfile?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function HisabPage({
  data,
  onOpenEntry,
  onOpenVoidModal,
  onOpenProfile,
  refreshing,
  onRefresh,
}: HisabPageProps) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL');
  const [siteFilter, setSiteFilter] = useState('ALL');

  // Document photo viewer state
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

  const query = search.trim().toLowerCase();

  const activeEntries = useMemo(
    () => data.entries.filter((e) => !e.voided_at),
    [data.entries]
  );

  // Financial KPI totals
  const stats = useMemo(() => {
    let totalInflow = 0;
    let totalMaterial = 0;
    let totalLabour = 0;
    let totalExpense = 0;
    let totalSupplierPaid = 0;

    for (const e of activeEntries) {
      const amt = Number(e.amount || 0);
      if (e.kind === 'RECEIPT') totalInflow += amt;
      else if (e.kind === 'MATERIAL') totalMaterial += amt;
      else if (e.kind === 'WAGE_PAYMENT') totalLabour += amt;
      else if (e.kind === 'EXPENSE') totalExpense += amt;
      else if (e.kind === 'SUPPLIER_PAYMENT') totalSupplierPaid += amt;
    }

    const netCash = totalInflow - (totalLabour + totalSupplierPaid);
    const totalOutflowBills = totalMaterial + totalExpense + totalLabour;

    return {
      totalInflow,
      totalMaterial,
      totalLabour,
      totalExpense,
      totalSupplierPaid,
      netCash,
      totalOutflowBills,
    };
  }, [activeEntries]);

  // Filtered entries list
  const filteredEntries = useMemo(() => {
    return [...data.entries]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .filter((e) => {
        const matchesKind = kindFilter === 'ALL' || e.kind === kindFilter;
        const matchesSite = siteFilter === 'ALL' || e.site_id === siteFilter;
        if (!matchesKind || !matchesSite) return false;
        if (!query) return true;

        const desc = (e.description || '').toLowerCase();
        const party = (e.party || '').toLowerCase();
        const site = (data.sites.find((s) => s.id === e.site_id)?.name || '').toLowerCase();
        const worker = (data.workers.find((w) => w.id === e.worker_id)?.name || '').toLowerCase();
        return (
          desc.includes(query) ||
          party.includes(query) ||
          site.includes(query) ||
          worker.includes(query)
        );
      });
  }, [data.entries, data.sites, data.workers, kindFilter, siteFilter, query]);

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title={t('hisabTitle', 'Hisab & Ledger')}
        subtitle={t('hisabSubtitle', 'Money in, costs incurred & cash paid out')}
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
          {/* 1. FINANCIAL SUMMARY OVERVIEW STRIP */}
          <View style={styles.statsSummaryGrid}>
            {/* Total Inflow (Paisa Aaya) */}
            <View style={[styles.statKpiCard, styles.statKpiGreen]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <AppIcon name="arrow-down" size={14} color="#16A34A" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#166534' }]}>{t('totalInflow', 'Total Inflow')}</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#15803D' }]}>
                {money(stats.totalInflow)}
              </Text>
              <Text style={styles.statKpiFoot}>{t('clientReceipts', 'Client Receipts')}</Text>
            </View>

            {/* Total Material Bills */}
            <View style={[styles.statKpiCard, styles.statKpiAmber]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <AppIcon name="cube" size={14} color="#D97706" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>{t('materialBills', 'Material Bills')}</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                {money(stats.totalMaterial)}
              </Text>
              <Text style={styles.statKpiFoot}>{t('suppliesCost', 'Supplies Cost')}</Text>
            </View>

            {/* Labour Payments */}
            <View style={[styles.statKpiCard, styles.statKpiPurple]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#F3E8FF' }]}>
                  <AppIcon name="people" size={14} color="#7E22CE" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#6B21A8' }]}>{t('labourPaid', 'Labour Paid')}</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#7E22CE' }]}>
                {money(stats.totalLabour)}
              </Text>
              <Text style={styles.statKpiFoot}>{t('wagesAndAdvance', 'Wages & Advance')}</Text>
            </View>

            {/* Other Expenses */}
            <View style={[styles.statKpiCard, styles.statKpiRed]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                  <AppIcon name="receipt" size={14} color="#DC2626" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#991B1B' }]}>{t('otherExpenses', 'Other Expenses')}</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B91C1C' }]}>
                {money(stats.totalExpense)}
              </Text>
              <Text style={styles.statKpiFoot}>{t('chaiRentFuel', 'Chai, Rent, Fuel')}</Text>
            </View>
          </View>

          {/* 2. QUICK ACTION TILES (4 COLOR-CODED CARDS) */}
          <View style={styles.quickActionsGrid}>
            {/* Paisa Aaya */}
            <Pressable
              onPress={() => onOpenEntry('RECEIPT')}
              style={({ pressed }) => [
                styles.actionTile,
                styles.actionTileReceipt,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityLabel="Record client payment received"
            >
              <View style={[styles.actionTileIcon, { backgroundColor: '#DCFCE7' }]}>
                <AppIcon name="arrow-down-circle" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTileTitle, { color: '#14532D' }]}>{t('receivePayment', 'Receive Payment')}</Text>
                <Text style={styles.actionTileSub}>{t('receivePaymentSub', 'Client Payment')}</Text>
              </View>
              <AppIcon name="add" size={16} color="#16A34A" />
            </Pressable>

            {/* Material Bill */}
            <Pressable
              onPress={() => onOpenEntry('MATERIAL')}
              style={({ pressed }) => [
                styles.actionTile,
                styles.actionTileMaterial,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityLabel="Record material cost bill"
            >
              <View style={[styles.actionTileIcon, { backgroundColor: '#FEF3C7' }]}>
                <AppIcon name="cube" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTileTitle, { color: '#78350F' }]}>{t('materialBill', 'Material Bill')}</Text>
                <Text style={styles.actionTileSub}>{t('cementPaintSand', 'Cement, Paint, Sand')}</Text>
              </View>
              <AppIcon name="add" size={16} color="#D97706" />
            </Pressable>

            {/* Labour Payment */}
            <Pressable
              onPress={() => onOpenEntry('WAGE_PAYMENT')}
              style={({ pressed }) => [
                styles.actionTile,
                styles.actionTileLabour,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityLabel="Record labour payment"
            >
              <View style={[styles.actionTileIcon, { backgroundColor: '#E0E7FF' }]}>
                <AppIcon name="wallet" size={20} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTileTitle, { color: '#3730A3' }]}>{t('labourPay', 'Labour Pay')}</Text>
                <Text style={styles.actionTileSub}>{t('wagesAndAdvance', 'Wages & Advance')}</Text>
              </View>
              <AppIcon name="add" size={16} color="#4F46E5" />
            </Pressable>

            {/* Other Expense Bill */}
            <Pressable
              onPress={() => onOpenEntry('EXPENSE')}
              style={({ pressed }) => [
                styles.actionTile,
                styles.actionTileExpense,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityLabel="Record other expense bill"
            >
              <View style={[styles.actionTileIcon, { backgroundColor: '#FEE2E2' }]}>
                <AppIcon name="receipt" size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTileTitle, { color: '#7F1D1D' }]}>{t('expenseBill', 'Expense Bill')}</Text>
                <Text style={styles.actionTileSub}>{t('chaiRentFuel', 'Chai, Rent, Fuel')}</Text>
              </View>
              <AppIcon name="add" size={16} color="#DC2626" />
            </Pressable>
          </View>

          {/* 3. SEARCH & FILTER TOOLBAR */}
          <View style={styles.toolbarCard}>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <AppIcon name="search" size={16} color="#64748B" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('searchHisabPlaceholder', 'Search description, party or site...')}
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <AppIcon name="close-circle" size={16} color="#94A3B8" />
                </Pressable>
              ) : null}
            </View>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {[
                { key: 'ALL', label: t('allEntries', 'All Entries') },
                { key: 'RECEIPT', label: t('paymentInFilter', 'Payment In') },
                { key: 'MATERIAL', label: t('materialFilter', 'Material') },
                { key: 'WAGE_PAYMENT', label: t('labourFilter', 'Labour') },
                { key: 'EXPENSE', label: t('expenseFilter', 'Expense') },
                { key: 'SUPPLIER_PAYMENT', label: t('billPaidFilter', 'Bill Paid') },
              ].map((tab) => {
                const isSelected = kindFilter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setKindFilter(tab.key)}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Site Chips if multiple sites exist */}
            {data.sites.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsRow}
              >
                <Pressable
                  onPress={() => setSiteFilter('ALL')}
                  style={[
                    styles.siteFilterChip,
                    siteFilter === 'ALL' && styles.siteFilterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.siteFilterChipText,
                      siteFilter === 'ALL' && styles.siteFilterChipTextActive,
                    ]}
                  >
                    {t('allSitesFilterCount', 'All Sites ({count})').replace('{count}', String(data.sites.length))}
                  </Text>
                </Pressable>
                {data.sites.map((site) => {
                  const isSelected = siteFilter === site.id;
                  return (
                    <Pressable
                      key={site.id}
                      onPress={() => setSiteFilter(site.id)}
                      style={[
                        styles.siteFilterChip,
                        isSelected && styles.siteFilterChipActive,
                      ]}
                    >
                      <AppIcon
                        name="business-outline"
                        size={12}
                        color={isSelected ? '#2563EB' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.siteFilterChipText,
                          isSelected && styles.siteFilterChipTextActive,
                        ]}
                      >
                        {site.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>

          {/* 4. TRANSACTION ENTRIES LIST */}
          <View style={styles.entriesListSection}>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>
                {t('transactions', 'Transactions')} ({filteredEntries.length})
              </Text>
              {filteredEntries.length > 0 ? (
                <Text style={styles.listHeaderSub}>
                  {t('sortedByDate', 'Sorted by date (latest first)')}
                </Text>
              ) : null}
            </View>

            {filteredEntries.map((e) => {
              const isReceipt = e.kind === 'RECEIPT';
              const isMaterial = e.kind === 'MATERIAL';
              const isWage = e.kind === 'WAGE_PAYMENT';
              const isExpense = e.kind === 'EXPENSE';
              const isSupplierPay = e.kind === 'SUPPLIER_PAYMENT';
              const isBill = isMaterial || isExpense;

              const paid = activeEntries
                .filter((p) => p.linked_entry_id === e.id)
                .reduce((s, p) => s + Number(p.amount), 0);
              const pendingAmount = Number(e.amount) - paid;
              const siteName = data.sites.find((s) => s.id === e.site_id)?.name;
              const workerName = e.worker_id
                ? data.workers.find((w) => w.id === e.worker_id)?.name
                : null;

              const iconName = isReceipt
                ? 'arrow-down-circle'
                : isMaterial
                  ? 'cube'
                  : isWage
                    ? 'people'
                    : isExpense
                      ? 'receipt'
                      : 'cash';

              const iconBg = isReceipt
                ? '#DCFCE7'
                : isMaterial
                  ? '#FEF3C7'
                  : isWage
                    ? '#F3E8FF'
                    : isExpense
                      ? '#FEE2E2'
                      : '#EFF6FF';

              const iconColor = isReceipt
                ? '#16A34A'
                : isMaterial
                  ? '#D97706'
                  : isWage
                    ? '#7E22CE'
                    : isExpense
                      ? '#DC2626'
                      : '#2563EB';

              return (
                <Card
                  key={e.id}
                  style={[
                    styles.entryCard,
                    e.voided_at ? { opacity: 0.5 } : null,
                  ]}
                >
                  <View style={styles.entryMainRow}>
                    {/* Category Icon */}
                    <View style={[styles.entryIconBox, { backgroundColor: iconBg }]}>
                      <AppIcon name={iconName as any} size={18} color={iconColor} />
                    </View>

                    {/* Middle: Title, Meta, Site */}
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.entryTitle} numberOfLines={1}>
                          {e.description || entryLabels[e.kind] || 'Entry'}
                        </Text>
                        {e.voided_at ? (
                          <View style={styles.voidTag}>
                            <Text style={styles.voidTagText}>{t('voided', 'VOIDED')}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Meta Subtitle */}
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryDateText}>
                          {String(e.date).slice(0, 10)}
                        </Text>
                        <Text style={styles.entryMetaDot}>•</Text>
                        <Text style={styles.entrySiteText} numberOfLines={1}>
                          {siteName || t('workSite', 'Work Site')}
                        </Text>
                        {workerName ? (
                          <>
                            <Text style={styles.entryMetaDot}>•</Text>
                            <Text style={styles.entryWorkerText} numberOfLines={1}>
                              {workerName}
                            </Text>
                          </>
                        ) : null}
                        {e.party ? (
                          <>
                            <Text style={styles.entryMetaDot}>•</Text>
                            <Text style={styles.entryPartyText} numberOfLines={1}>
                              {e.party}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </View>

                    {/* Amount & Mode */}
                    <View style={styles.entryAmountCol}>
                      <Text
                        style={[
                          styles.entryAmountText,
                          { color: isReceipt ? '#15803D' : '#0F172A' },
                        ]}
                      >
                        {isReceipt ? '+' : '-'} {money(e.amount)}
                      </Text>
                      <View style={styles.modeBadge}>
                        <Text style={styles.modeBadgeText}>{e.mode || 'CASH'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Reference or Bill Breakdown if available */}
                  {e.reference ? (() => {
                    const docMatch = String(e.reference).match(/\[doc:([^\]]+)\]/);
                    const cleanRef = String(e.reference).replace(/\[doc:[^\]]+\]/g, '').trim();
                    const docId = docMatch ? docMatch[1] : null;

                    return (
                      <View style={styles.refContainer}>
                        {cleanRef ? (
                          <View style={styles.refRow}>
                            <AppIcon name="document-text-outline" size={12} color="#64748B" />
                            <Text style={styles.refText}>{t('ref', 'Ref')}: {cleanRef}</Text>
                          </View>
                        ) : null}

                        {docId ? (
                          <Pressable
                            onPress={() => handleOpenDoc(docId, e)}
                            style={({ pressed }) => [
                              styles.viewDocBadge,
                              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                            ]}
                          >
                            <AppIcon name="image" size={12} color="#2563EB" />
                            <Text style={styles.viewDocBadgeText}>
                              {lang === 'hi' ? '📸 पर्ची फोटो देखें' : '📸 View Bill Photo'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })() : null}

                  {/* Bottom Footer with Bill Payment Info & Actions */}
                  {!e.voided_at ? (
                    <View style={styles.entryCardFooter}>
                      {isBill ? (
                        <View style={styles.billStatusWrap}>
                          {pendingAmount > 0 ? (
                            <View style={styles.pendingTag}>
                              <Text style={styles.pendingTagText}>
                                {t('pendingAmt', 'Pending: {amount}').replace('{amount}', money(pendingAmount))}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.paidTag}>
                              <Text style={styles.paidTagText}>{t('fullPaid', 'Full Paid')}</Text>
                            </View>
                          )}
                          {paid > 0 ? (
                            <Text style={styles.paidSoFarText}>
                              {t('paidAmount', '(Paid {amount})').replace('{amount}', money(paid))}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <View />
                      )}

                      <View style={styles.btnActionRow}>
                        {isBill && pendingAmount > 0 ? (
                          <Pressable
                            onPress={() =>
                              onOpenEntry('SUPPLIER_PAYMENT', e.site_id, undefined, e)
                            }
                            style={styles.payBillBtn}
                          >
                            <AppIcon name="cash" size={13} color="#2563EB" />
                            <Text style={styles.payBillBtnText}>{t('payBill', 'Pay Bill')}</Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          onPress={() => onOpenVoidModal(e)}
                          style={styles.voidBtn}
                        >
                          <AppIcon name="trash-outline" size={13} color="#DC2626" />
                          <Text style={styles.voidBtnText}>{t('void', 'Void')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })}

            {/* Empty State */}
            {!filteredEntries.length ? (
              <EmptyState
                title={t('noLedgerEntries', 'No Ledger Entries Found')}
                description={
                  query
                    ? t('noFilterMatchDesc', 'No records match your search. Try a different query or clear filters.')
                    : t('noLedgerEntriesDesc', 'Add a payment, material bill, labour advance or expense to start tracking ledger.')
                }
              />
            ) : null}
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

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  refContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  viewDocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  viewDocBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingBottom: 40,
  },
  container: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },

  /* 1. KPI Stats Summary Grid */
  statsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statKpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statKpiGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statKpiAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statKpiPurple: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  statKpiRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statKpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statKpiLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statKpiValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  statKpiFoot: {
    fontSize: 10,
    color: '#64748B',
  },

  /* 2. Quick Action Tiles */
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionTile: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  actionTileReceipt: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  actionTileMaterial: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  actionTileLabour: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  actionTileExpense: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTileTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionTileSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* 3. Toolbar Box */
  toolbarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: 'transparent',
    paddingVertical: 4,
  },
  filterChipsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: '#0F2851',
    borderColor: '#0F2851',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  siteFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  siteFilterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  siteFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  siteFilterChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  /* 4. Entries List */
  entriesListSection: {
    gap: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  listHeaderSub: {
    fontSize: 11,
    color: '#64748B',
  },
  entryCard: {
    padding: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  entryMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  entryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  voidTag: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  voidTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  entryDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  entryMetaDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  entrySiteText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  entryWorkerText: {
    fontSize: 11,
    color: '#7E22CE',
    fontWeight: '600',
  },
  entryPartyText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  entryAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  entryAmountText: {
    fontSize: 15,
    fontWeight: '900',
  },
  modeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  refText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  entryCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  billStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pendingTag: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  paidTag: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paidTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  paidSoFarText: {
    fontSize: 10,
    color: '#64748B',
  },
  btnActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  payBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  payBillBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  voidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  voidBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});
