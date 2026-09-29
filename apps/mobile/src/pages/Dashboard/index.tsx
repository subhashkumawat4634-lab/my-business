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
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MetricCard } from '../../components/common/MetricCard';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
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

  const totalContract = summaries.reduce((s, f) => s + f.contract, 0);
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
    .slice(0, 4);

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title="ThekaBook"
        subtitle={data.organization.name}
        icon="grid-outline"
        userInitials={data.user.name}
        onLogout={onLogout}
        onRefresh={onRefresh}
        refreshing={refreshing}
        actions={
          <Pressable
            onPress={onOpenNewSite}
            style={styles.navNewSiteBtn}
            accessibilityLabel="Create new work site"
          >
            <AppIcon name="add" size={17} color="#FFFFFF" />
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
        {/* Welcome Section */}
        <View style={styles.welcomeBox}>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).toUpperCase()}
          </Text>
          <Text style={styles.companyTitle}>{data.organization.name}</Text>
        </View>

        {/* BHIM UPI Style Hero Balance Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroHeaderLeft}>
              <View style={styles.heroBadge}>
                <AppIcon name="wallet" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.heroSubtitle}>MALIK SE LENA BAKI (COLLECTIONS)</Text>
            </View>
            <Pressable
              onPress={() => onOpenEntry('RECEIPT')}
              style={styles.heroPlusBtn}
              accessibilityLabel="Record payment received"
            >
              <AppIcon name="add" size={20} color={Colors.primary} />
            </Pressable>
          </View>

          <Text style={styles.heroValue}>{money(totalDuesToCollect)}</Text>

          <View style={styles.heroFooter}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Active Sites</Text>
              <Text style={styles.heroMetaValue}>{activeSites.length}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Labour Strength</Text>
              <Text style={styles.heroMetaValue}>
                {data.workers.filter((w) => w.active).length} Workers
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Received</Text>
              <Text style={styles.heroMetaValue}>{money(totalReceived)}</Text>
            </View>
          </View>
        </View>

        {/* Fintech 4-Action Quick Actions Grid */}
        <View style={styles.quickGrid}>
          <Pressable
            onPress={onOpenAttendance}
            style={styles.quickActionItem}
            accessibilityLabel="Mark Attendance"
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#E8F0FE' }]}>
              <AppIcon name="checkmark-done" size={22} color={Colors.accentDark} />
            </View>
            <Text style={styles.quickActionText}>Haziri Lagao</Text>
          </Pressable>

          <Pressable
            onPress={() => onOpenEntry('MATERIAL')}
            style={styles.quickActionItem}
            accessibilityLabel="Add Material Bill"
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#FFF4E5' }]}>
              <AppIcon name="cube" size={22} color={Colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Material Bill</Text>
          </Pressable>

          <Pressable
            onPress={() => onOpenEntry('WAGE_PAYMENT')}
            style={styles.quickActionItem}
            accessibilityLabel="Pay Labour"
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#E6F4EA' }]}>
              <AppIcon name="cash" size={22} color={Colors.success} />
            </View>
            <Text style={styles.quickActionText}>Labour Payment</Text>
          </Pressable>

          <Pressable
            onPress={onOpenNewSite}
            style={styles.quickActionItem}
            accessibilityLabel="Add New Site"
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#EEF4FF' }]}>
              <AppIcon name="business" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>New Site</Text>
          </Pressable>
        </View>

        {/* Business Metrics Grid */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Pending Wages"
            value={money(labourDue)}
            foot={workerAdvances ? `${money(workerAdvances)} advances` : 'Labour dues'}
            icon="people-outline"
            tone={labourDue > 0 ? 'warning' : 'default'}
          />
          <MetricCard
            label="Net Cash"
            value={money(totalCashMovement)}
            foot="Inward - Outward"
            icon="swap-horizontal-outline"
            tone={totalCashMovement >= 0 ? 'success' : 'danger'}
          />
          <MetricCard
            label="Estimated Margin"
            value={money(totalEstimatedMargin)}
            foot="Gross site profit"
            icon="trending-up-outline"
            accent
          />
        </View>

        {/* Active Work Sites Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Active Theke / Sites</Text>
            <Text style={styles.sectionSubtitle}>
              Contract value, collections & site margin
            </Text>
          </View>
          <Pressable onPress={() => onNavigateTab('sites')}>
            <Text style={styles.viewAllText}>View All →</Text>
          </Pressable>
        </View>

        {/* Sites List */}
        {data.sites.length ? (
          <View style={[styles.sitesGrid, isDesktop && styles.desktopGrid]}>
            {data.sites.slice(0, 4).map((site) => {
              const f = siteSummary(site, data.attendance, data.entries);
              const progress = f.contract > 0 ? Math.min(1, f.received / f.contract) : 0;
              return (
                <Pressable
                  key={site.id}
                  onPress={() => onOpenSite(site.id)}
                  style={styles.siteCard}
                  accessibilityLabel={'Open site ' + site.name}
                >
                  <View style={styles.siteCardTop}>
                    <View style={styles.siteIconBadge}>
                      <AppIcon
                        name={
                          site.work_type === 'LABOUR'
                            ? 'hammer-outline'
                            : 'construct-outline'
                        }
                        size={20}
                        color={Colors.primary}
                      />
                    </View>
                    <Badge
                      label={site.status}
                      tone={site.status === 'PAUSED' ? 'orange' : 'green'}
                    />
                  </View>

                  <Text style={styles.siteName}>{site.name}</Text>
                  <Text style={styles.siteOwner}>
                    {site.owner_name} •{' '}
                    {site.work_type === 'LABOUR' ? 'Labour Only' : 'Labour + Material'}
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
                      <Text style={styles.metaLabel}>Balance Dues</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          {
                            color:
                              f.ownerBalance < 0 ? Colors.danger : Colors.warning,
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
            title="Add Your First Work Site"
            description="Create a work site, add workers, and begin tracking daily attendance and project ledger."
            actionTitle="Create New Site"
            onAction={onOpenNewSite}
          />
        )}

        {/* Recent Activity Section */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Text style={styles.sectionSubtitle}>Last transactions & entries</Text>
          </View>
          <Pressable onPress={() => onNavigateTab('ledger')}>
            <Text style={styles.viewAllText}>Full Ledger →</Text>
          </Pressable>
        </View>

        <View style={styles.recentList}>
          {recentEntries.map((e) => {
            const isReceipt = e.kind === 'RECEIPT';
            const siteName = data.sites.find((s) => s.id === e.site_id)?.name;
            return (
              <Card key={e.id} style={styles.entryRow}>
                <View style={styles.entryLeft}>
                  <View
                    style={[
                      styles.entryIconBox,
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
                    <Text style={styles.entryDesc} numberOfLines={1}>
                      {e.description}
                    </Text>
                    <Text style={styles.entryMeta} numberOfLines={1}>
                      {String(e.date).slice(0, 10)} • {siteName || 'Site'}
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
          {!recentEntries.length && (
            <Text style={styles.noEntriesText}>
              Abhi koi transaction entry nahi hai.
            </Text>
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
  welcomeBox: {
    marginBottom: 12,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  companyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
  },
  heroPlusBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroMetaItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroMetaLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroMetaValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 2,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentDark,
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
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
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
  recentList: {
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
  entryIconBox: {
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
    fontSize: 15,
    fontWeight: '800',
  },
  noEntriesText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    marginVertical: 12,
  },
});
