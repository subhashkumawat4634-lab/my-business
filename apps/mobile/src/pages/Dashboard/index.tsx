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
import { useLanguage } from '../../i18n';

interface DashboardPageProps {
  data: Snapshot;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenSite: (siteId: string) => void;
  onOpenNewSite: () => void;
  onOpenAttendance: () => void;
  onOpenEntry: (kind: string) => void;
  onNavigateTab: (tabKey: string) => void;
  onUpdateProfile?: (values: { name?: string; organization_name?: string }) => Promise<void> | void;
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
  onUpdateProfile,
  onLogout,
}: DashboardPageProps) {
  const { t, lang } = useLanguage();
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
        title={t('appName', 'ThekaBook')}
        subtitle={t('overviewSubtitle', 'Business overview, cash flow & live site pulse')}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={() => onNavigateTab('profile')}
        onUpdateProfile={onUpdateProfile}
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
            <Text style={styles.greetingTitle}>
              {t('contractorOverview', 'Contractor Overview')}
            </Text>
            <Text style={styles.greetingSub}>
              {new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })} • {data.organization.name}
            </Text>
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
                  <Text style={styles.heroLabel}>{t('totalReceivables', 'TOTAL RECEIVABLES')}</Text>
                  <Text style={styles.heroSubLabel}>{t('pendingClientDues', 'Pending Client Dues')}</Text>
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
                <Text style={styles.heroAddBtnText}>{t('paymentIn', 'Payment In')}</Text>
              </Pressable>
            </View>

            <Text style={styles.heroMainAmount}>{money(totalDuesToCollect)}</Text>

            {/* Quick Metrics Bar Inside Hero */}
            <View style={styles.heroStatsBar}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>{t('activeSitesCount', 'Active Sites')}</Text>
                <Text style={styles.heroStatValue}>{activeSites.length}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>{t('activeLabourCount', 'Active Labour')}</Text>
                <Text style={styles.heroStatValue}>{activeWorkerCount}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>{t('totalReceived', 'Received')}</Text>
                <Text style={styles.heroStatValue}>{money(totalReceived)}</Text>
              </View>
            </View>
          </View>

          {/* Primary Quick Actions Grid */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('quickActions', 'Quick Actions')}</Text>
          </View>

          {/* Unified Quick Actions & Financial Hub Card (All in 1 Card) */}
          <View style={styles.unifiedHubCard}>
            {/* Row 1: Actions */}
            <View style={styles.hubGridRow}>
              <Pressable
                onPress={() => onNavigateTab('attendance')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Daily Attendance"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                  <AppIcon name="calendar-outline" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('dailyAttendance', 'Daily Attendance')}
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
                <View style={[styles.quickIconCircle, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <AppIcon name="cube-outline" size={24} color="#D97706" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('materialBill', 'Material Bill')}
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
                <View style={[styles.quickIconCircle, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <AppIcon name="cash-outline" size={24} color="#059669" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('labourWage', 'Labour Wage')}
                </Text>
              </Pressable>
            </View>

            {/* Row 2: Payments & Bills */}
            <View style={styles.hubGridRow}>
              <Pressable
                onPress={() => onOpenEntry('RECEIPT')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Receive Payment"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <AppIcon name="card-outline" size={24} color="#16A34A" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('receivePayment', 'Receive Payment')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onOpenEntry('EXPENSE')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Other Expense"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                  <AppIcon name="receipt-outline" size={24} color="#E11D48" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('otherExpense', 'Other Expense')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onOpenEntry('EXTRA')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Extra Work"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                  <AppIcon name="add-circle-outline" size={24} color="#7C3AED" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('extraWork', 'Extra Work')}
                </Text>
              </Pressable>
            </View>

            {/* Row 3: Management & Reports */}
            <View style={styles.hubGridRow}>
              <Pressable
                onPress={() => onNavigateTab('sites')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Work Sites"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                  <AppIcon name="business-outline" size={24} color="#0284C7" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('workSites', 'Work Sites')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onNavigateTab('team')}
                style={({ pressed }) => [
                  styles.hubActionItem,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Labour / Workers"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#FDF4FF', borderColor: '#F5D0FE' }]}>
                  <AppIcon name="people-outline" size={24} color="#C026D3" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('navLabour', 'Labour / Workers')}
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
                <View style={[styles.quickIconCircle, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
                  <AppIcon name="bar-chart-outline" size={24} color="#0D9488" />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {t('plReports', 'P&L Reports')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Active Work Sites Section */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{t('activeSitesTheke', 'Active Sites & Theke')}</Text>
              <Text style={styles.sectionSubtitle}>{t('liveSitesSubtitle', 'Live site status and collection dues')}</Text>
            </View>
            <Pressable
              onPress={() => onNavigateTab('sites')}
              style={styles.sectionActionBtn}
            >
              <Text style={styles.viewAllText}>{t('allSites', 'All Sites')}</Text>
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
                            {site.owner_name || (lang === 'hi' ? 'पार्टी' : 'Client')} • {site.work_type === 'LABOUR' ? t('labourOnly', 'Labour Only') : t('labourMaterial', 'Labour + Material')}
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
                          {site.status === 'PAUSED' ? t('paused', 'Paused') : t('active', 'Active')}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.siteProgressSection}>
                      <View style={styles.progressHeaderRow}>
                        <Text style={styles.progressLabel}>{t('collectionProgress', 'Collection Progress')}</Text>
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
                        <Text style={styles.cardMetaLabel}>{t('contract', 'CONTRACT')}</Text>
                        <Text style={styles.cardMetaValue}>{money(f.contract)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cardMetaLabel}>{t('balanceDues', 'BALANCE DUES')}</Text>
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
              title={t('addFirstSite', 'Add Your First Work Site')}
              description={t('addFirstSiteDesc', 'Create a work site, add workers, and begin tracking daily attendance and project ledger.')}
              actionTitle={t('createSiteBtn', 'Create New Site')}
              onAction={onOpenNewSite}
            />
          )}

          {/* Recent Activity Section */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <View>
              <Text style={styles.sectionTitle}>{t('recentEntries', 'Recent Entries')}</Text>
              <Text style={styles.sectionSubtitle}>{t('lastTransactions', 'Last transactions & wage payments')}</Text>
            </View>
            <Pressable
              onPress={() => onNavigateTab('ledger')}
              style={styles.sectionActionBtn}
            >
              <Text style={styles.viewAllText}>{t('fullHisab', 'Full Hisab')}</Text>
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
    gap: 3,
    paddingHorizontal: 2,
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 17,
  },

  /* Hero Card - Soft Lavender / Ice Blue Minimalist Theme */
  heroCard: {
    backgroundColor: '#F0F6FF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
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
    height: 3,
    backgroundColor: '#2563EB',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleCol: {
    gap: 1,
  },
  heroLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.6,
  },
  heroSubLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  heroAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  heroAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  heroMainAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F2851',
    letterSpacing: -0.6,
    marginVertical: 6,
  },
  heroStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  heroStatLabel: {
    fontSize: 8.5,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heroStatValue: {
    fontSize: 12.5,
    color: '#0F2851',
    fontWeight: '900',
    marginTop: 1,
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
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
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

