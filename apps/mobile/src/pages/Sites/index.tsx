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
import { downloadSiteDocument } from '../../report';

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
  const [termsExpanded, setTermsExpanded] = useState(false);
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
    const noteLines = userNotes
      ? userNotes.split('\n').filter((l) => l.trim().length > 0)
      : [];
    const isLongNotes = noteLines.length > 4 || userNotes.length > 250;
    const siteEntries = data.entries
      .filter((e) => e.site_id === site.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return (
      <View style={styles.pageWrapper}>
        <TopNavBar
          title={site.name}
          subtitle={`${site.owner_name} • ${site.phone || 'No phone'}`}
          onBack={() => onSelectSite(null)}
          backText="All Sites"
          badge={{
            label: site.status,
            tone:
              site.status === 'PAUSED'
                ? 'orange'
                : site.status === 'COMPLETED'
                ? 'blue'
                : 'green',
          }}
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
              {/* Primary Header: Avatar + Title & Meta + Status & Edit Button */}
              <View style={styles.headerPrimaryRow}>
                <View style={styles.siteAvatar}>
                  <AppIcon name="business" size={24} color={Colors.primary} />
                </View>

                <View style={styles.headerMainCol}>
                  <View style={styles.titleActionRow}>
                    <Text style={styles.siteTitle} numberOfLines={1}>
                      {site.name}
                    </Text>

                    <View style={styles.statusAndEditGroup}>
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
                  </View>

                  {/* Clean Client & Firm Subtitle */}
                  <View style={styles.headerMetaRow}>
                    <View style={styles.clientInlineGroup}>
                      <AppIcon name="person" size={12} color="#64748B" />
                      <Text style={styles.clientInlineName}>{site.owner_name}</Text>
                    </View>

                    {businessName ? (
                      <>
                        <Text style={styles.metaDotDivider}>•</Text>
                        <Text style={styles.businessInlineText} numberOfLines={1}>
                          {businessName}
                        </Text>
                      </>
                    ) : null}

                    {site.phone ? (
                      <>
                        <Text style={styles.metaDotDivider}>•</Text>
                        <View style={styles.phoneInlineGroup}>
                          <AppIcon name="call" size={12} color="#16A34A" />
                          <Text style={styles.phoneInlineText}>{site.phone}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Clean hairline separator */}
              <View style={styles.cardDivider} />

              {/* Key Project Specs Row */}
              <View style={[styles.specsRow, !isDesktop && styles.specsRowMobile]}>
                {/* Scope & Contract */}
                <View style={styles.specItem}>
                  <View style={styles.specIconBox}>
                    <AppIcon
                      name={site.work_type === 'LABOUR' ? 'people' : 'construct'}
                      size={15}
                      color="#475569"
                    />
                  </View>
                  <View style={styles.specContent}>
                    <Text style={styles.specLabel}>Scope & Rate</Text>
                    <Text style={styles.specValue} numberOfLines={1}>
                      {site.work_type === 'LABOUR' ? 'Labour Only' : 'Labour + Material'}
                      {' • '}
                      {site.pricing === 'FIXED'
                        ? 'Fixed Lumpsum'
                        : site.pricing === 'UNIT'
                        ? 'Unit Rate'
                        : 'Daily'}
                    </Text>
                  </View>
                </View>

                {/* Timeline */}
                {(site.start_date || site.end_date) ? (
                  <View style={styles.specItem}>
                    <View style={styles.specIconBox}>
                      <AppIcon name="calendar-outline" size={15} color="#475569" />
                    </View>
                    <View style={styles.specContent}>
                      <Text style={styles.specLabel}>Timeline</Text>
                      <Text style={styles.specValue} numberOfLines={1}>
                        {site.start_date}{site.end_date ? ` → ${site.end_date}` : ' (Active)'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Location */}
                {site.address ? (
                  <View style={styles.specItem}>
                    <View style={styles.specIconBox}>
                      <AppIcon name="location-outline" size={15} color="#475569" />
                    </View>
                    <View style={styles.specContent}>
                      <Text style={styles.specLabel}>Location</Text>
                      <Text style={styles.specValue} numberOfLines={1}>
                        {site.address}{state ? `, ${state}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* GST Verification Banner (if registered) */}
              {gstin ? (
                <View style={styles.gstStrip}>
                  <AppIcon name="shield-checkmark" size={13} color="#16A34A" />
                  <Text style={styles.gstStripText}>
                    GSTIN: <Text style={styles.gstCodeText}>{gstin}</Text>
                    {state ? ` • ${state}${stateCode ? ` (${stateCode})` : ''}` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Contract Terms & Notes Section */}
              {userNotes ? (
                <View style={styles.termsBox}>
                  <View style={styles.termsHeaderRow}>
                    <View style={styles.termsTitleGroup}>
                      <AppIcon name="document-text-outline" size={15} color="#0F2851" />
                      <Text style={styles.termsTitleText}>Contract Terms & Notes</Text>
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
                            ? 'Show Less'
                            : `Show All (${noteLines.length} lines)`}
                        </Text>
                        <AppIcon
                          name={termsExpanded ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color="#1D4ED8"
                        />
                      </Pressable>
                    )}
                  </View>

                  <Text
                    style={styles.termsBodyText}
                    numberOfLines={isLongNotes && !termsExpanded ? 4 : undefined}
                  >
                    {userNotes}
                  </Text>
                </View>
              ) : null}
            </View>

          {/* Financial Stat Cards */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Agreed Contract"
              value={money(f.contract)}
              foot="Total project value"
              icon="business-outline"
            />
            <MetricCard
              label="Received"
              value={money(f.received)}
              foot="Collected so far"
              tone="success"
              icon="cash-outline"
            />
            <MetricCard
              label="Client Balance"
              value={money(f.ownerBalance)}
              foot={f.ownerBalance < 0 ? 'Overpaid' : 'Pending to collect'}
              tone={f.ownerBalance < 0 ? 'danger' : 'warning'}
              icon="wallet-outline"
            />
            <MetricCard
              label={f.final ? 'Final Margin' : 'Est. Margin'}
              value={money(f.profit)}
              foot="Projected contractor margin"
              accent
              tone={f.profit >= 0 ? 'success' : 'danger'}
              icon="trending-up"
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
                    <Pressable
                      onPress={() => downloadSiteDocument(d, {
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
                        styles.docItemDownloadBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                      accessibilityLabel={`Download ${d.name}`}
                    >
                      <AppIcon name="download-outline" size={14} color="#1E40AF" />
                      <Text style={styles.docItemDownloadBtnText}>Download</Text>
                    </Pressable>
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
          {isDesktop ? (
            <View style={styles.actionsWrapDesktop}>
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
          ) : (
            <View style={styles.actionsWrapMobile}>
              {/* Row 1: Primary Receive Payment (Full Width) */}
              <Button
                title="Receive Payment"
                onPress={() => onOpenEntry('RECEIPT', site.id)}
                icon="arrow-down"
                style={styles.fullWidthActionBtn}
              />

              {/* Row 2: Attendance & Material Bill (50% each) */}
              <View style={styles.actionGridRow}>
                <View style={styles.actionGridCol}>
                  <Button
                    title="Attendance"
                    variant="secondary"
                    onPress={() => onOpenAttendance(site.id)}
                    icon="calendar"
                    style={styles.gridActionBtn}
                  />
                </View>
                <View style={styles.actionGridCol}>
                  <Button
                    title="Material Bill"
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
                    title="Extra Work"
                    variant="secondary"
                    onPress={() => onOpenEntry('EXTRA', site.id)}
                    icon="add-circle"
                    style={styles.gridActionBtn}
                  />
                </View>
                <View style={styles.actionGridCol}>
                  <Button
                    title="Share Statement"
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

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title="Work Sites"
        subtitle={`${totalSitesCount} Total • ${ongoingSitesCount} Active Sites`}
        icon="business-outline"
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
            <AppIcon name="add" size={18} color="#FFFFFF" />
            <Text style={styles.navNewSiteBtnText}>New Site</Text>
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
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  navNewSiteBtnText: {
    fontSize: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  siteAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerMainCol: {
    flex: 1,
    gap: 5,
  },
  titleActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  siteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  statusAndEditGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    width: 6,
    height: 6,
    borderRadius: 3,
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
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editSiteBtnText: {
    fontSize: 12,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  businessInlineText: {
    fontSize: 13,
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
    fontSize: 12,
    color: '#94A3B8',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  specsRowMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  specItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  specIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specContent: {
    flex: 1,
    gap: 1,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  gstStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignSelf: 'flex-start',
  },
  gstStripText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  gstCodeText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#14532D',
  },
  termsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#0F2851',
    padding: 12,
    gap: 8,
  },
  termsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  termsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  termsTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F2851',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  termsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  termsToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  termsBodyText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
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
  docItemDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 4,
  },
  docItemDownloadBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
});

export { NewSitePage } from './NewSitePage';

