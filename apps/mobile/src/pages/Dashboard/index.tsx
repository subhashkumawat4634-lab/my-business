import React from 'react';
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
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { money, siteSummary, workerSummary } from '../../finance';

interface DashboardPageProps {
  data: Snapshot;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenSite: (siteId: string) => void;
  onOpenNewSite: () => void;
  onOpenAttendance: () => void;
  onOpenEntry: (kind: string) => void;
  onNavigateTab: (tabKey: string) => void;
  onLogout?: () => void;
}

export function DashboardPage({
  data,
  refreshing,
  onRefresh,
  onOpenSite,
  onOpenNewSite,
  onOpenAttendance,
  onOpenEntry,
  onNavigateTab,
  onLogout,
}: DashboardPageProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const summaries = data.sites.map((site) => ({
    site,
    ...siteSummary(site, data.attendance, data.entries),
  }));

  const totalReceived = summaries.reduce((s, f) => s + f.received, 0);
  const totalDuesToCollect = summaries.reduce(
    (s, f) => s + Math.max(0, f.ownerBalance),
    0
  );
  const totalCashMovement = summaries.reduce((s, f) => s + f.cash, 0);
  const totalEstimatedMargin = summaries.reduce((s, f) => s + f.profit, 0);

  const labourDue = data.workers.reduce(
    (sum, w) =>
      sum + Math.max(0, workerSummary(w, data.attendance, data.entries).balance),
    0
  );
  const workerAdvances = data.workers.reduce(
    (sum, w) =>
      sum + Math.max(0, -workerSummary(w, data.attendance, data.entries).balance),
    0
  );

  const activeSites = data.sites.filter((s) => s.status === 'ONGOING');
  const recentEntries = [...data.entries]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 5);

  const activeWorkerCount = data.workers.filter((w) => w.active).length;

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title="ThekaBook"
        subtitle={data.organization.name}
        icon="shield-checkmark"
        userInitials={data.user.name}
        onLogout={onLogout}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.container}>
          {/* Greeting & Date Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greetingTitle}>Contractor Overview</Text>
              <Text style={styles.greetingSub}>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })} • {data.organization.name}
              </Text>
            </View>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTagText}>Active Ledger</Text>
            </View>
          </View>

          {/* Premium Hero Financial Summary Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroAccentLine} />

            <View style={styles.heroTop}>
              <View style={styles.heroLeftWrap}>
                <View style={styles.heroIconBadge}>
                  <AppIcon name="wallet" size={18} color="#2563EB" />
                </View>
                <View style={styles.heroTitleCol}>
                  <Text style={styles.heroLabel}>TOTAL RECEIVABLES</Text>
                  <Text style={styles.heroSubLabel}>Pending Client Dues</Text>
                </View>
              </View>

              <Pressable
                onPress={() => onOpenEntry('RECEIPT')}
                style={({ pressed }) => [
                  styles.heroAddBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                ]}
                accessibilityLabel="Add payment received"
              >
                <AppIcon name="add" size={16} color="#FFFFFF" />
                <Text style={styles.heroAddBtnText}>Payment In</Text>
              </Pressable>
            </View>

            <Text style={styles.heroMainAmount}>{money(totalDuesToCollect)}</Text>

            {/* Quick Metrics Bar Inside Hero */}
            <View style={styles.heroStatsBar}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>Active Sites</Text>
                <Text style={styles.heroStatValue}>{activeSites.length}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>Active Labour</Text>
                <Text style={styles.heroStatValue}>{activeWorkerCount}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>Received</Text>
                <Text style={styles.heroStatValue}>{money(totalReceived)}</Text>
              </View>
            </View>
          </View>

          {/* Primary Quick Actions Grid */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          {/* Unified Quick Actions & Financial Hub Card (All in 1 Card) */}
          <View style={styles.unifiedHubCard}>
            {/* Row 1: Actions */}
            <View style={styles.hubGridRow}>
              <Pressable
                onPress={onOpenAttendance}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Daily Attendance"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="calendar-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Daily Attendance
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onOpenEntry('MATERIAL')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Material Bill"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="cube-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Material Bill
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onOpenEntry('WAGE_PAYMENT')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Labour Wage"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="cash-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Labour Wage
                </Text>
              </Pressable>
            </View>

            {/* Row 2: Actions */}
            <View style={styles.hubGridRow}>
              <Pressable
                onPress={() => onOpenEntry('RECEIPT')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Receive Payment"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="card-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Receive Payment
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onNavigateTab('sites')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Work Sites"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="business-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Work Sites
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onNavigateTab('reports')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="P&L Reports"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="bar-chart-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  P&L Reports
                </Text>
              </Pressable>
            </View>

            {/* Row 3: Financial Shortcuts */}
            <View style={styles.hubGridRow}>
              <Pressable
                onPress={() => onNavigateTab('ledger')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Pending Wages"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="people-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Pending Wages
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onNavigateTab('ledger')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Cash Flow"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="trending-up-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Cash Flow
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onNavigateTab('reports')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Est. Margin"
              >
                <View style={styles.quickIconCircle}>
                  <AppIcon name="pie-chart-outline" size={26} color="#1E293B" />
                  <View style={styles.quickCheckmarkBadge}>
                    <AppIcon name="checkmark" size={9} color="#EF4444" />
                  </View>
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  Est. Margin
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Active Work Sites Section */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Active Sites & Theke</Text>
              <Text style={styles.sectionSubtitle}>Live site status and collection dues</Text>
            </View>
            <Pressable
              onPress={() => onNavigateTab('sites')}
              style={styles.sectionActionBtn}
            >
              <Text style={styles.viewAllText}>All Sites</Text>
              <AppIcon name="chevron-forward" size={15} color="#2563EB" />
            </Pressable>
          </View>

          {data.sites.length ? (
            <View style={[styles.sitesGrid, isDesktop && styles.desktopGrid]}>
              {data.sites.slice(0, 4).map((site) => {
                const f = siteSummary(site, data.attendance, data.entries);
                const progress = f.contract > 0 ? Math.min(1, f.received / f.contract) : 0;
                const progressPct = Math.round(progress * 100);

                return (
                  <Pressable
                    key={site.id}
                    onPress={() => onOpenSite(site.id)}
                    style={({ pressed }) => [
                      styles.siteCard,
                      pressed && styles.siteCardPressed,
                    ]}
                    accessibilityLabel={'Open site ' + site.name}
                  >
                    <View style={styles.siteCardHeader}>
                      <View style={styles.siteHeaderLeft}>
                        <View style={styles.siteIconBadge}>
                          <AppIcon
                            name={site.work_type === 'LABOUR' ? 'hammer' : 'construct'}
                            size={18}
                            color="#0F2851"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.siteName} numberOfLines={1}>
                            {site.name}
                          </Text>
                          <Text style={styles.siteOwner} numberOfLines={1}>
                            {site.owner_name || 'Client'} • {site.work_type === 'LABOUR' ? 'Labour Only' : 'Labour + Material'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          site.status === 'PAUSED' ? styles.statusPaused : styles.statusActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            site.status === 'PAUSED' ? styles.statusPausedText : styles.statusActiveText,
                          ]}
                        >
                          {site.status}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.siteProgressSection}>
                      <View style={styles.progressHeaderRow}>
                        <Text style={styles.progressLabel}>Collection Progress</Text>
                        <Text style={styles.progressPctText}>{progressPct}%</Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${progressPct}%` },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Site Financial Summary */}
                    <View style={styles.siteCardFooter}>
                      <View>
                        <Text style={styles.cardMetaLabel}>CONTRACT</Text>
                        <Text style={styles.cardMetaValue}>{money(f.contract)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cardMetaLabel}>BALANCE DUES</Text>
                        <Text
                          style={[
                            styles.cardMetaValue,
                            { color: f.ownerBalance < 0 ? '#DC2626' : '#D97706' },
                          ]}
                        >
                          {f.ownerBalance >= 0 ? money(f.ownerBalance) : `${money(-f.ownerBalance)} Adv`}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title="Add Your First Work Site"
              description="Create a work site, add workers, and begin tracking daily attendance and project ledger."
              actionTitle="Create New Site"
              onAction={onOpenNewSite}
            />
          )}

          {/* Recent Activity Section */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <View>
              <Text style={styles.sectionTitle}>Recent Entries</Text>
              <Text style={styles.sectionSubtitle}>Last transactions & wage payments</Text>
            </View>
            <Pressable
              onPress={() => onNavigateTab('ledger')}
              style={styles.sectionActionBtn}
            >
              <Text style={styles.viewAllText}>Full Hisab</Text>
              <AppIcon name="chevron-forward" size={15} color="#2563EB" />
            </Pressable>
          </View>

          <View style={styles.recentList}>
            {recentEntries.map((e) => {
              const isReceipt = e.kind === 'RECEIPT';
              const siteName = data.sites.find((s) => s.id === e.site_id)?.name;

              return (
                <View key={e.id} style={styles.entryItem}>
                  <View style={styles.entryLeft}>
                    <View
                      style={[
                        styles.entryIconBox,
                        {
                          backgroundColor: isReceipt
                            ? '#DCFCE7'
                            : e.kind === 'MATERIAL'
                              ? '#FEF3C7'
                              : '#F1F5F9',
                        },
                      ]}
                    >
                      <AppIcon
                        name={
                          isReceipt
                            ? 'arrow-down'
                            : e.kind === 'MATERIAL'
                              ? 'cube'
                              : e.kind === 'WAGE_PAYMENT'
                                ? 'cash'
                                : 'arrow-up'
                        }
                        size={17}
                        color={
                          isReceipt
                            ? '#16A34A'
                            : e.kind === 'MATERIAL'
                              ? '#D97706'
                              : '#475569'
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryDesc} numberOfLines={1}>
                        {e.description || e.kind}
                      </Text>
                      <Text style={styles.entryMeta} numberOfLines={1}>
                        {String(e.date).slice(0, 10)} • {siteName || 'Site'}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.entryAmount,
                      { color: isReceipt ? '#16A34A' : '#0F172A' },
                    ]}
                  >
                    {isReceipt ? '+' : '-'} {money(e.amount)}
                  </Text>
                </View>
              );
            })}
            {!recentEntries.length && (
              <View style={styles.emptyRecentBox}>
                <AppIcon name="receipt-outline" size={24} color="#94A3B8" />
                <Text style={styles.noEntriesText}>
                  Abhi koi transaction entry nahi hai.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  navNewSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#0F2851',
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navNewSiteBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingBottom: 40,
  },
  container: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },

  /* Greeting Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
  },

  /* Hero Card - Soft Lavender / Ice Blue Minimalist Theme */
  heroCard: {
    backgroundColor: '#F0F6FF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  heroAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: '#2563EB',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleCol: {
    gap: 1.5,
  },
  heroLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.75,
  },
  heroSubLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  heroAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  heroAddBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  heroMainAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F2851',
    letterSpacing: -0.8,
    marginVertical: 10,
  },
  heroStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  heroStatLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heroStatValue: {
    fontSize: 13.5,
    color: '#0F2851',
    fontWeight: '900',
    marginTop: 2,
  },

  /* Unified Quick Actions & Financial Hub Card */
  sectionHeader: {
    paddingHorizontal: 2,
  },
  unifiedHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  hubGridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  hubActionItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quickIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#D4E2F0',
  },
  quickCheckmarkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  quickActionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: 6,
    lineHeight: 14,
  },

  /* Section Headers */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2563EB',
  },

  /* Sites List */
  sitesGrid: {
    gap: 12,
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  siteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  siteCardPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  siteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  siteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  siteIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  siteOwner: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  statusActiveText: {
    color: '#16A34A',
  },
  statusPaused: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  statusPausedText: {
    color: '#EA580C',
  },
  siteProgressSection: {
    gap: 5,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  progressPctText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2563EB',
  },
  progressBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  siteCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardMetaLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  cardMetaValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },

  /* Recent Activity */
  recentList: {
    gap: 8,
  },
  entryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  entryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDesc: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  entryMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  entryAmount: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  emptyRecentBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noEntriesText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '500',
  },
});

