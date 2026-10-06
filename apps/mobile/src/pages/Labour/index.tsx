import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MetricCard } from '../../components/common/MetricCard';
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { money, workerSummary } from '../../finance';
import { WorkerDetailPage } from './WorkerDetailPage';

export interface LabourPageProps {
  data: Snapshot;
  onOpenWorkerModal: (worker?: Row) => void;
  onOpenPaymentModal: (workerId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

const AVATAR_PALETTES = [
  { bg: '#EFF6FF', text: '#1E40AF' }, // Blue
  { bg: '#ECFDF5', text: '#065F46' }, // Emerald
  { bg: '#F5F3FF', text: '#5B21B6' }, // Purple
  { bg: '#FFFBEB', text: '#92400E' }, // Amber
  { bg: '#FFF1F2', text: '#9F1239' }, // Rose
  { bg: '#F0FDF4', text: '#166534' }, // Green
  { bg: '#F8FAFC', text: '#334155' }, // Slate
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'W';
}

function getSkillIcon(skill: string = ''): string {
  const s = skill.toLowerCase();
  if (s.includes('mason') || s.includes('mistri') || s.includes('raj')) return 'construct';
  if (s.includes('paint')) return 'color-palette';
  if (s.includes('carpent') || s.includes('wood')) return 'cut';
  if (s.includes('electr') || s.includes('bijli')) return 'flash';
  if (s.includes('plumb') || s.includes('pipe')) return 'water';
  if (s.includes('weld') || s.includes('loha') || s.includes('steel')) return 'hammer';
  if (s.includes('supervis') || s.includes('thekadar')) return 'briefcase';
  if (s.includes('help') || s.includes('mazdoor') || s.includes('labour')) return 'people';
  return 'person';
}

export function LabourPage({
  data,
  onOpenWorkerModal,
  onOpenPaymentModal,
  refreshing,
  onRefresh,
}: LabourPageProps) {
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Row | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Financial aggregates & worker summaries
  const {
    totalEarned,
    totalPendingWages,
    totalAdvances,
    pendingCount,
    advanceCount,
    activeCount,
    totalWorkers,
    workerSummariesMap,
    workerAttendanceMap,
  } = useMemo(() => {
    let earnedSum = 0;
    let pendingSum = 0;
    let advanceSum = 0;
    let pendingC = 0;
    let advanceC = 0;
    let activeC = 0;

    const sMap = new Map<string, any>();
    const aMap = new Map<string, { days: number; otMinutes: number }>();

    // Precompute attendance by worker
    for (const a of data.attendance) {
      const cur = aMap.get(a.worker_id) || { days: 0, otMinutes: 0 };
      cur.days += Number(a.units || 0);
      cur.otMinutes += Number(a.overtime_minutes || 0);
      aMap.set(a.worker_id, cur);
    }

    for (const w of data.workers) {
      if (w.active) activeC++;

      const s = workerSummary(w, data.attendance, data.entries);
      sMap.set(w.id, s);

      earnedSum += s.earned;
      if (s.balance > 0) {
        pendingSum += s.balance;
        pendingC++;
      } else if (s.balance < 0) {
        advanceSum += -s.balance;
        advanceC++;
      }
    }

    return {
      totalEarned: earnedSum,
      totalPendingWages: pendingSum,
      totalAdvances: advanceSum,
      pendingCount: pendingC,
      advanceCount: advanceC,
      activeCount: activeC,
      totalWorkers: data.workers.length,
      workerSummariesMap: sMap,
      workerAttendanceMap: aMap,
    };
  }, [data.workers, data.attendance, data.entries]);

  // Filtered & sorted workers list
  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.workers
      .filter((w) => {
        if (!q) return true;
        const matchName = w.name?.toLowerCase().includes(q);
        const matchSkill = w.skill?.toLowerCase().includes(q);
        const matchPhone = w.phone?.toLowerCase().includes(q);
        return matchName || matchSkill || matchPhone;
      })
      .sort((a, b) => {
        // Active first, then highest pending balance
        if (a.active !== b.active) return a.active ? -1 : 1;
        const sumA = workerSummariesMap.get(a.id) || { balance: 0 };
        const sumB = workerSummariesMap.get(b.id) || { balance: 0 };
        return sumB.balance - sumA.balance;
      });
  }, [data.workers, search, workerSummariesMap]);

  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned) {
      Linking.openURL(`tel:${cleaned}`).catch(() => {});
    }
  };

  // If a worker is selected, render full detail page instead of list
  if (selectedWorker) {
    return (
      <WorkerDetailPage
        worker={selectedWorker}
        data={data}
        onBack={() => setSelectedWorker(null)}
        onOpenPaymentModal={(wId) => {
          setSelectedWorker(null);
          onOpenPaymentModal(wId);
        }}
        onOpenWorkerModal={(w) => {
          setSelectedWorker(null);
          onOpenWorkerModal(w);
        }}
      />
    );
  }

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title="Labour & Team"
        onRefresh={onRefresh}
        refreshing={refreshing}
        actions={
          <Pressable
            onPress={() => onOpenWorkerModal()}
            style={({ pressed }) => [
              styles.navActionBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            accessibilityLabel="Add new worker"
          >
            <Text style={styles.navActionBtnText}>Add Worker</Text>
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
          {/* Financial & Workforce Overview Cards */}
          <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
            <View style={styles.statCol}>
              <MetricCard
                label="Total Wages Earned"
                value={money(totalEarned)}
                foot="Across all time"
                icon="cash-outline"
              />
            </View>
            <View style={styles.statCol}>
              <MetricCard
                label="Pending Wages"
                value={money(totalPendingWages)}
                foot={`${pendingCount} worker${pendingCount === 1 ? '' : 's'} to pay`}
                icon="time-outline"
                tone="warning"
              />
            </View>
            <View style={styles.statCol}>
              <MetricCard
                label="Worker Advances"
                value={money(totalAdvances)}
                foot={`${advanceCount} worker${advanceCount === 1 ? '' : 's'} in advance`}
                icon="arrow-forward-outline"
                accent
              />
            </View>
            <View style={styles.statCol}>
              <MetricCard
                label="Active Workforce"
                value={`${activeCount} / ${totalWorkers}`}
                foot={`${Math.round((activeCount / (totalWorkers || 1)) * 100)}% available team`}
                icon="people-outline"
                tone="success"
              />
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search worker by name, skill (mason, helper) or phone…"
            />
          </View>

          {/* Workers List */}
          <View style={styles.list}>
            {filteredWorkers.map((w) => {
              const f = workerSummariesMap.get(w.id) || { earned: 0, paid: 0, balance: 0 };
              const isPending = f.balance > 0;
              const isAdvance = f.balance < 0;
              const avatarTheme = getAvatarStyle(w.name);

              return (
                <Pressable
                  key={w.id}
                  onPress={() => setSelectedWorker(w)}
                  style={({ pressed }) => [
                    styles.workerRowItem,
                    pressed && styles.workerRowItemPressed,
                  ]}
                  accessibilityLabel={`Worker ${w.name}`}
                >
                  {/* Left Side: Avatar Image + Name + Designation & Rate */}
                  <View style={styles.workerRowLeft}>
                    <View style={[styles.avatarBox, { backgroundColor: avatarTheme.bg }]}>
                      <Text style={[styles.avatarText, { color: avatarTheme.text }]}>
                        {getInitials(w.name)}
                      </Text>
                      <View
                        style={[
                          styles.statusDotRing,
                          { backgroundColor: w.active ? '#16A34A' : '#94A3B8' },
                        ]}
                      />
                    </View>

                    <View style={styles.workerInfoCol}>
                      <View style={styles.nameRow}>
                        <Text style={styles.workerNameText} numberOfLines={1}>
                          {w.name}
                        </Text>
                        {!w.active ? <Badge label="INACTIVE" tone="gray" /> : null}
                      </View>

                      <View style={styles.designationRow}>
                        <View style={styles.skillBadge}>
                          <AppIcon name={getSkillIcon(w.skill)} size={11} color="#1E40AF" />
                          <Text style={styles.skillBadgeText} numberOfLines={1}>
                            {w.skill || 'General Labour'}
                          </Text>
                        </View>
                        <Text style={styles.rateText} numberOfLines={1}>
                          • {money(w.daily_rate)}/day
                        </Text>
                        {isPending ? (
                          <View style={styles.dueBadge}>
                            <Text style={styles.dueBadgeText}>
                              Due: {money(f.balance)}
                            </Text>
                          </View>
                        ) : isAdvance ? (
                          <View style={styles.advBadge}>
                            <Text style={styles.advBadgeText}>
                              Adv: {money(-f.balance)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Right Side: Quick Call (if phone) + View Icon Button */}
                  <View style={styles.workerRowRight}>
                    {w.phone ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleCall(w.phone);
                        }}
                        style={({ pressed }) => [
                          styles.iconBtnCall,
                          pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                        ]}
                        accessibilityLabel={`Call ${w.name}`}
                      >
                        <AppIcon name="call" size={13} color="#15803D" />
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setSelectedWorker(w);
                      }}
                      style={({ pressed }) => [
                        styles.viewActionBtn,
                        pressed && styles.viewActionBtnPressed,
                      ]}
                      accessibilityLabel={`View details for ${w.name}`}
                    >
                      <AppIcon name="eye-outline" size={16} color="#0F2851" />
                      <Text style={styles.viewActionBtnText}>View</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}

            {filteredWorkers.length === 0 ? (
              <EmptyState
                title={search ? 'No Matching Workers' : 'No Workers Added Yet'}
                description={
                  search
                    ? 'No workers found matching your search term.'
                    : 'Add masons, helpers, and carpenters to track daily attendance and wages.'
                }
                actionTitle={search ? 'Clear Search' : '+ Add First Worker'}
                onAction={search ? () => setSearch('') : () => onOpenWorkerModal()}
              />
            ) : null}
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
  navActionBtn: {
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
  navActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 40,
  },
  container: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  statCol: {
    flex: 1,
    minWidth: '46%',
  },
  searchSection: {
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  workerRowItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  workerRowItemPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  workerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusDotRing: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  workerInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  designationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  rateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  dueBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  dueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  advBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  advBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  workerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtnCall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  viewActionBtnPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.96 }],
  },
  viewActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F2851',
  },
});

export { WorkerDetailPage } from './WorkerDetailPage';
export { EditWorkerPage } from './EditWorkerPage';
