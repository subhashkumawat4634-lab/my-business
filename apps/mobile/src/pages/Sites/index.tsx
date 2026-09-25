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
import { Snapshot, Row } from '../../types';
import { money, siteSummary } from '../../finance';
import { parseSiteNotesAndDocs } from '../../components/sites/SiteFormModal';

interface SitesPageProps {
  data: Snapshot;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string | null) => void;
  onOpenNewSite: () => void;
  onEditSite: (site: Row) => void;
  onOpenEntry: (kind: string, siteId?: string) => void;
  onOpenAttendance: (siteId?: string) => void;
  onShareReport: (siteId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
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
  refreshing,
  onRefresh,
}: SitesPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const site = selectedSiteId
    ? data.sites.find((s) => s.id === selectedSiteId)
    : null;

  // Render Single Site Details View
  if (site) {
    const f = siteSummary(site, data.attendance, data.entries);
    const { userNotes, documents, gstin, state, stateCode, businessName } =
      parseSiteNotesAndDocs(site.notes || '');
    const siteEntries = data.entries
      .filter((e) => e.site_id === site.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return (
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
          {/* Back Action */}
          <Pressable
            onPress={() => onSelectSite(null)}
            style={styles.backRow}
            accessibilityLabel="Back to all sites"
          >
            <AppIcon name="arrow-back" size={18} color={Colors.primary} />
            <Text style={styles.backText}>All Work Sites</Text>
          </Pressable>

          {/* Site Overview Header Card */}
          <Card style={styles.siteHeaderCard}>
            <View style={styles.siteHeaderTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.siteTitle}>{site.name}</Text>
                <Text style={styles.siteClient}>
                  {site.owner_name} • {site.phone || 'No phone'}
                </Text>
                {businessName ? (
                  <Text style={styles.siteBusinessText}>
                    🏢 {businessName}
                  </Text>
                ) : null}
              </View>
              <Button
                title="Edit"
                variant="secondary"
                size="sm"
                onPress={() => onEditSite(site)}
                icon="create-outline"
              />
            </View>

            <View style={styles.badgeRow}>
              <Badge
                label={site.status}
                tone={site.status === 'PAUSED' ? 'orange' : 'green'}
              />
              <Badge
                label={
                  site.work_type === 'LABOUR'
                    ? 'LABOUR ONLY'
                    : 'LABOUR + MATERIAL'
                }
                tone="blue"
              />
              <Badge label={site.pricing} tone="gray" />
              {gstin ? (
                <Badge label={`GST: ${gstin}`} tone="green" />
              ) : null}
              {state ? (
                <Badge
                  label={`${state}${stateCode ? ` (${stateCode})` : ''}`}
                  tone="blue"
                />
              ) : null}
            </View>

            {site.address ? (
              <Text style={styles.siteAddress}>
                <AppIcon name="location-outline" size={14} color={Colors.textMuted} />{' '}
                {site.address}
              </Text>
            ) : null}
            {userNotes ? (
              <Text style={styles.siteNotes}>Notes: {userNotes}</Text>
            ) : null}
          </Card>

          {/* Financial Stat Cards */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Agreed Contract"
              value={money(f.contract)}
              foot="Incl. approved extras"
            />
            <MetricCard
              label="Received"
              value={money(f.received)}
              foot="Collected so far"
              tone="success"
            />
            <MetricCard
              label="Client Balance"
              value={money(f.ownerBalance)}
              foot={f.ownerBalance < 0 ? 'Overpaid' : 'To collect'}
              tone={f.ownerBalance < 0 ? 'danger' : 'warning'}
            />
            <MetricCard
              label={f.final ? 'Final Margin' : 'Est. Margin'}
              value={money(f.profit)}
              foot="Before common overhead"
              accent
              tone={f.profit >= 0 ? 'success' : 'danger'}
            />
          </View>

          {/* Agreements & Documents Section */}
          <Card style={styles.documentsCard}>
            <View style={styles.docHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppIcon name="document-text" size={18} color="#7C3AED" />
                <Text style={styles.cardHeaderTitle}>
                  Agreements & Documents ({documents.length})
                </Text>
              </View>
              <Pressable
                onPress={() => onEditSite(site)}
                style={({ pressed }) => [
                  styles.uploadDocBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <AppIcon name="cloud-upload" size={14} color="#7C3AED" />
                <Text style={styles.uploadDocBtnText}>+ Manage</Text>
              </Pressable>
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
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDocText}>
                No contracts or agreements attached yet. Tap "+ Manage" to attach files.
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
          <View style={styles.actionsWrap}>
            <Button
              title="Receive Payment"
              onPress={() => onOpenEntry('RECEIPT', site.id)}
              icon="arrow-down"
            />
            <Button
              title="Attendance"
              variant="secondary"
              onPress={() => onOpenAttendance(site.id)}
              icon="calendar"
            />
            <Button
              title="Material Bill"
              variant="secondary"
              onPress={() => onOpenEntry('MATERIAL', site.id)}
              icon="cube"
            />
            <Button
              title="Extra Work"
              variant="secondary"
              onPress={() => onOpenEntry('EXTRA', site.id)}
              icon="add-circle"
            />
            <Button
              title="Share Statement"
              variant="secondary"
              onPress={() => onShareReport(site.id)}
              icon="share-social"
            />
          </View>

          {/* Site Ledger Entries */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Site Ledger</Text>
            <Text style={styles.sectionSubtitle}>All transactions for this site</Text>
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
                No expenses or receipts recorded for this site yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
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

  return (
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
        {/* Page Topbar */}
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Work Sites</Text>
            <Text style={styles.pageSubtitle}>
              Projects, client agreements & balances
            </Text>
          </View>
          <Pressable
            onPress={onOpenNewSite}
            style={({ pressed }) => [
              styles.nayaThekaBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <AppIcon name="add" size={19} color="#FFFFFF" />
            <Text style={styles.nayaThekaBtnText}>+ New Site</Text>
          </Pressable>
        </View>

        {/* Quick Stats Overview Banner */}
        <View style={styles.statsBanner}>
          <View style={styles.statBannerItem}>
            <Text style={styles.statBannerLabel}>Total Sites</Text>
            <Text style={styles.statBannerValue}>{totalSitesCount}</Text>
          </View>
          <View style={styles.statBannerDivider} />
          <View style={styles.statBannerItem}>
            <Text style={styles.statBannerLabel}>Active Sites</Text>
            <Text style={[styles.statBannerValue, { color: Colors.success }]}>
              {ongoingSitesCount}
            </Text>
          </View>
          <View style={styles.statBannerDivider} />
          <View style={styles.statBannerItem}>
            <Text style={styles.statBannerLabel}>Total Value</Text>
            <Text style={styles.statBannerValue}>
              {money(totalContractVal)}
            </Text>
          </View>
        </View>

        {/* Search */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search site or client name…"
        />

        {/* Status Filter Chips */}
        <View style={styles.chipsRow}>
          {['ALL', 'ONGOING', 'UPCOMING', 'PAUSED', 'COMPLETED'].map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={[
                styles.chip,
                statusFilter === status && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === status && styles.chipTextActive,
                ]}
              >
                {status}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Sites List */}
        {filteredSites.length ? (
          <View style={[styles.sitesGrid, isDesktop && styles.desktopGrid]}>
            {filteredSites.map((siteItem) => {
              const f = siteSummary(siteItem, data.attendance, data.entries);
              const progress =
                f.contract > 0 ? Math.min(1, f.received / f.contract) : 0;
              return (
                <Pressable
                  key={siteItem.id}
                  onPress={() => onSelectSite(siteItem.id)}
                  style={styles.siteCard}
                  accessibilityLabel={'Open site ' + siteItem.name}
                >
                  <View style={styles.siteCardTop}>
                    <View style={styles.siteIconBadge}>
                      <AppIcon
                        name={
                          siteItem.work_type === 'LABOUR'
                            ? 'hammer-outline'
                            : 'construct-outline'
                        }
                        size={20}
                        color={Colors.primary}
                      />
                    </View>
                    <Badge
                      label={siteItem.status}
                      tone={siteItem.status === 'PAUSED' ? 'orange' : 'green'}
                    />
                  </View>

                  <Text style={styles.siteName}>{siteItem.name}</Text>
                  <Text style={styles.siteOwner}>
                    {siteItem.owner_name} •{' '}
                    {siteItem.work_type === 'LABOUR'
                      ? 'Labour Only'
                      : 'Labour + Material'}
                  </Text>

                  <View style={styles.siteProgressRow}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(progress * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(progress * 100)}%
                    </Text>
                  </View>

                  <View style={styles.siteCardFooter}>
                    <View>
                      <Text style={styles.metaLabel}>Contract</Text>
                      <Text style={styles.metaValue}>{money(f.contract)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.metaLabel}>To Collect</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          {
                            color:
                              f.ownerBalance < 0
                                ? Colors.danger
                                : Colors.warning,
                          },
                        ]}
                      >
                        {f.ownerBalance >= 0
                          ? money(f.ownerBalance)
                          : `${money(-f.ownerBalance)} Adv`}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No Work Sites Found"
            description="No work sites found. Create a new site to start managing contract agreements, daily attendance and cash flows."
            actionTitle="+ Create New Site"
            onAction={onOpenNewSite}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statBannerItem: {
    flex: 1,
    alignItems: 'center',
  },
  statBannerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statBannerValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  statBannerDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
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
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  siteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
    elevation: 2,
  },
  siteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  siteIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  siteOwner: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  siteProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  siteCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceSubtle,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
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
    padding: 18,
    gap: 10,
    marginBottom: 16,
  },
  siteHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  siteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  siteClient: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  siteBusinessText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  siteAddress: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  siteNotes: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
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
  uploadDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
  },
  uploadDocBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
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
});
