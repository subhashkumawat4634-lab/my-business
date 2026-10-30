import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';
import { showToast } from '../../context/ToastContext';

export interface DailyHaziriPageProps {
  data: Snapshot;
  onOpenAttendanceModal: (siteId?: string, workerId?: string, existing?: Row) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

// Helpers for date manipulation
const shiftDate = (dateStr: string, days: number): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  } catch {
    return dateStr;
  }
};

const formatDateDisplay = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export function DailyHaziriPage({
  data,
  onOpenAttendanceModal,
  onOpenProfile,
  onBack,
  refreshing,
  onRefresh,
}: DailyHaziriPageProps) {
  const { t } = useLanguage();

  // Navigation & Filtering State
  const currentDate = today();
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [dateMode, setDateMode] = useState<'selected' | 'all'>('selected');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '1' | '0.5' | '0' | 'UNMARKED'>('ALL');
  const [search, setSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const query = search.trim().toLowerCase();

  // Active workers list
  const activeWorkers = useMemo(
    () => data.workers.filter((w) => w.active),
    [data.workers]
  );

  // Attendance records for the selected date
  const selectedDateRecords = useMemo(() => {
    return data.attendance.filter(
      (a) => String(a.date).slice(0, 10) === selectedDate
    );
  }, [data.attendance, selectedDate]);

  // Stats calculation for the current view
  const stats = useMemo(() => {
    const sourceRecords = dateMode === 'selected' ? selectedDateRecords : data.attendance;
    const presentRecords = sourceRecords.filter((a) => Number(a.units) === 1);
    const halfDayRecords = sourceRecords.filter((a) => Number(a.units) === 0.5);
    const absentRecords = sourceRecords.filter((a) => Number(a.units) === 0);
    const totalWage = sourceRecords.reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const markedWorkerIds = new Set(selectedDateRecords.map((a) => a.worker_id));
    const pendingCount = activeWorkers.filter((w) => !markedWorkerIds.has(w.id)).length;

    return {
      present: presentRecords.length,
      halfDay: halfDayRecords.length,
      absent: absentRecords.length,
      totalWage,
      pendingCount,
      totalActive: activeWorkers.length,
    };
  }, [dateMode, selectedDateRecords, data.attendance, activeWorkers]);

  // Unmarked active workers for the selected date
  const unmarkedWorkers = useMemo(() => {
    if (dateMode !== 'selected') return [];
    const markedWorkerIds = new Set(selectedDateRecords.map((a) => a.worker_id));
    return activeWorkers.filter((w) => {
      if (markedWorkerIds.has(w.id)) return false;
      if (!query) return true;
      return (
        w.name.toLowerCase().includes(query) ||
        (w.skill || '').toLowerCase().includes(query)
      );
    });
  }, [dateMode, selectedDateRecords, activeWorkers, query]);

  // Filtered attendance records
  const filteredAttendance = useMemo(() => {
    let list = dateMode === 'selected' ? selectedDateRecords : data.attendance;

    // Filter by site
    if (selectedSiteId !== 'ALL') {
      list = list.filter((a) => a.site_id === selectedSiteId);
    }

    // Filter by status
    if (statusFilter === '1') {
      list = list.filter((a) => Number(a.units) === 1);
    } else if (statusFilter === '0.5') {
      list = list.filter((a) => Number(a.units) === 0.5);
    } else if (statusFilter === '0') {
      list = list.filter((a) => Number(a.units) === 0);
    }

    // Filter by search query
    if (query) {
      list = list.filter((a) => {
        const worker = data.workers.find((w) => w.id === a.worker_id);
        const site = data.sites.find((s) => s.id === a.site_id);
        const wName = worker?.name || '';
        const sName = site?.name || '';
        const skill = worker?.skill || '';
        const notes = a.notes || '';
        return (
          wName.toLowerCase().includes(query) ||
          sName.toLowerCase().includes(query) ||
          skill.toLowerCase().includes(query) ||
          notes.toLowerCase().includes(query)
        );
      });
    }

    // Sort by date desc, then amount desc
    return [...list].sort((a, b) => {
      const dateCmp = String(b.date).localeCompare(String(a.date));
      if (dateCmp !== 0) return dateCmp;
      return Number(b.amount || 0) - Number(a.amount || 0);
    });
  }, [
    dateMode,
    selectedDateRecords,
    data.attendance,
    selectedSiteId,
    statusFilter,
    query,
    data.workers,
    data.sites,
  ]);

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title="Daily Attendance"
        subtitle={t('manageLabourAttendance', 'Worker attendance & wage records')}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
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
          {/* 1. DATE NAVIGATION & FILTER STRIP */}
          <View style={styles.dateNavigatorCard}>
            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              style={({ pressed }) => [
                styles.currentDatePill,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityLabel="Choose date"
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.currentDateText}>
                    {dateMode === 'all'
                      ? 'All Dates'
                      : formatDateDisplay(selectedDate)}
                  </Text>
                </View>
                <Text style={styles.currentDateSub}>
                  {dateMode === 'all'
                    ? 'Showing complete historical register'
                    : 'Tap to pick any calendar date'}
                </Text>
              </View>
              <View style={styles.calendarIconCircle}>
                <AppIcon name="calendar" size={16} color="#2563EB" />
              </View>
            </Pressable>
          </View>

          {/* 2. STATS SUMMARY CARDS */}
          <View style={styles.statsSummaryGrid}>
            {/* Present Card */}
            <View style={[styles.statKpiCard, styles.statKpiPresent]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <AppIcon name="checkmark-circle" size={16} color="#16A34A" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#166534' }]}>Present</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#15803D' }]}>
                {stats.present}
              </Text>
              <Text style={styles.statKpiFoot}>
                {stats.totalActive ? `${Math.round((stats.present / stats.totalActive) * 100)}% of team` : 'workers'}
              </Text>
            </View>

            {/* Half Day Card */}
            <View style={[styles.statKpiCard, styles.statKpiHalf]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <AppIcon name="time" size={16} color="#D97706" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>Half Day</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                {stats.halfDay}
              </Text>
              <Text style={styles.statKpiFoot}>0.5 day units</Text>
            </View>

            {/* Absent Card */}
            <View style={[styles.statKpiCard, styles.statKpiAbsent]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                  <AppIcon name="close-circle" size={16} color="#DC2626" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#991B1B' }]}>Absent</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B91C1C' }]}>
                {stats.absent}
              </Text>
              <Text style={styles.statKpiFoot}>Leave / chhutti</Text>
            </View>

            {/* Total Wage Card */}
            <View style={[styles.statKpiCard, styles.statKpiWage]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="wallet" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#1E40AF' }]}>Wages Earned</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#1D4ED8' }]}>
                {money(stats.totalWage)}
              </Text>
              <Text style={styles.statKpiFoot}>
                {stats.present + stats.halfDay * 0.5} Days Total
              </Text>
            </View>
          </View>

          {/* 3. SEARCH & FILTER TOOLBAR */}
          <View style={styles.toolbarBox}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <AppIcon name="search" size={16} color={Colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search worker name, site or role..."
                placeholderTextColor={Colors.textSubtle}
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <AppIcon name="close-circle" size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Status Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsScroll}
            >
              {[
                { key: 'ALL', label: 'All Status' },
                { key: '1', label: 'Present' },
                { key: '0.5', label: 'Half Day' },
                { key: '0', label: 'Absent' },
                ...(dateMode === 'selected' && stats.pendingCount > 0
                  ? [{ key: 'UNMARKED', label: `Pending (${stats.pendingCount})` }]
                  : []),
              ].map((tab) => {
                const isSelected = statusFilter === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setStatusFilter(tab.key as any)}
                    style={[
                      styles.statusPillChip,
                      isSelected && styles.statusPillChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillChipText,
                        isSelected && styles.statusPillChipTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 4. UNMARKED WORKERS SECTION (Fast 1-tap Haziri Marking) */}
          {dateMode === 'selected' &&
            statusFilter !== '1' &&
            statusFilter !== '0.5' &&
            statusFilter !== '0' &&
            unmarkedWorkers.length > 0 ? (
            <View style={styles.unmarkedSection}>
              <View style={styles.unmarkedHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.unmarkedDot} />
                  <Text style={styles.unmarkedSectionTitle}>
                    Pending Haziri ({unmarkedWorkers.length})
                  </Text>
                </View>
                <Text style={styles.unmarkedSectionSub}>
                  Tap to mark attendance
                </Text>
              </View>

              <View style={styles.unmarkedGrid}>
                {unmarkedWorkers.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      if (selectedDate > today()) {
                        showToast('Attendance cannot be marked for future dates', 'w');
                        return;
                      }
                      onOpenAttendanceModal(undefined, w.id, { date: selectedDate, worker_id: w.id } as any);
                    }}
                    style={({ pressed }) => [
                      styles.unmarkedWorkerCard,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                    ]}
                    accessibilityLabel={'Mark haziri for ' + w.name}
                  >
                    <View style={styles.unmarkedWorkerLeft}>
                      <View style={styles.unmarkedAvatar}>
                        <Text style={styles.unmarkedAvatarText}>
                          {(w.name || 'W').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.unmarkedWorkerName} numberOfLines={1}>
                          {w.name}
                        </Text>
                        <Text style={styles.unmarkedWorkerSkill} numberOfLines={1}>
                          {w.skill || 'Worker'} • {money(w.daily_rate)}/day
                        </Text>
                      </View>
                    </View>

                    <View style={styles.unmarkedActionBtn}>
                      <Text style={styles.unmarkedActionBtnText}>Mark</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* 5. RECORDED ATTENDANCE CARDS LIST */}
          <View style={styles.recordsListSection}>
            <View style={styles.recordsHeaderRow}>
              <Text style={styles.recordsHeaderTitle}>
                {dateMode === 'selected'
                  ? `Recorded Attendance (${filteredAttendance.length})`
                  : `All Attendance Records (${filteredAttendance.length})`}
              </Text>
              {filteredAttendance.length > 0 ? (
                <Text style={styles.recordsHeaderSub}>
                  Tap any card to correct or edit
                </Text>
              ) : null}
            </View>

            {filteredAttendance.map((a) => {
              const worker = data.workers.find((w) => w.id === a.worker_id);
              const site = data.sites.find((s) => s.id === a.site_id);
              const units = Number(a.units);
              const isPresent = units === 1;
              const isHalf = units === 0.5;
              const isAbsent = units === 0;

              const workerInitials = (worker?.name || 'W').slice(0, 2).toUpperCase();
              const formattedRowDate = String(a.date).slice(0, 10);
              const otMins = Number(a.overtime_minutes) || 0;

              return (
                <Pressable
                  key={a.id}
                  onPress={() => onOpenAttendanceModal(a.site_id, a.worker_id, a)}
                  style={({ pressed }) => [
                    styles.attendanceCardWrapper,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                  ]}
                  accessibilityLabel={'Edit attendance for ' + (worker?.name || '')}
                >
                  <Card style={styles.attendanceCard}>
                    {/* Top Row: Worker Info & Attendance Status Badge */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.workerAvatarInfo}>
                        <View
                          style={[
                            styles.avatarBox,
                            isPresent && styles.avatarBoxPresent,
                            isHalf && styles.avatarBoxHalf,
                            isAbsent && styles.avatarBoxAbsent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarInitials,
                              isPresent && { color: '#15803D' },
                              isHalf && { color: '#B45309' },
                              isAbsent && { color: '#B91C1C' },
                            ]}
                          >
                            {workerInitials}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.workerNameText} numberOfLines={1}>
                              {worker?.name || 'Unknown Worker'}
                            </Text>
                            {worker?.skill ? (
                              <View style={styles.skillPill}>
                                <Text style={styles.skillPillText}>{worker.skill}</Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.siteInfoRow}>
                            <AppIcon name="business-outline" size={12} color="#64748B" />
                            <Text style={styles.siteNameText} numberOfLines={1}>
                              {site?.name || 'Site'}
                            </Text>
                            <Text style={styles.metaDivider}>•</Text>
                            <Text style={styles.dateMetaText}>
                              {dateMode === 'all'
                                ? formatDateDisplay(formattedRowDate)
                                : formattedRowDate}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          isPresent && styles.statusBadgePresent,
                          isHalf && styles.statusBadgeHalf,
                          isAbsent && styles.statusBadgeAbsent,
                        ]}
                      >
                        <AppIcon
                          name={
                            isPresent
                              ? 'checkmark-circle'
                              : isHalf
                                ? 'time'
                                : 'close-circle'
                          }
                          size={14}
                          color={
                            isPresent ? '#15803D' : isHalf ? '#B45309' : '#B91C1C'
                          }
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isPresent && { color: '#15803D' },
                            isHalf && { color: '#B45309' },
                            isAbsent && { color: '#B91C1C' },
                          ]}
                        >
                          {isPresent
                            ? 'PRESENT · 1.0'
                            : isHalf
                              ? 'HALF DAY · 0.5'
                              : 'ABSENT · 0.0'}
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Overtime & Notes if applicable */}
                    {(otMins > 0 || Boolean(a.notes)) ? (
                      <View style={styles.cardDetailsRow}>
                        {otMins > 0 ? (
                          <View style={styles.overtimePill}>
                            <AppIcon name="time-outline" size={13} color="#D97706" />
                            <Text style={styles.overtimePillText}>
                              OT: {otMins} mins ({Math.round((otMins / 60) * 10) / 10} hrs)
                            </Text>
                          </View>
                        ) : null}

                        {a.notes ? (
                          <View style={styles.notesCallout}>
                            <AppIcon name="chatbubble-outline" size={12} color="#64748B" />
                            <Text style={styles.notesText} numberOfLines={1}>
                              {a.notes}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Bottom Row: Wage Earned + Edit CTA */}
                    <View style={styles.cardFooterRow}>
                      <View style={styles.wageDisplayCol}>
                        <Text style={styles.wageSubLabel}>Total Earned:</Text>
                        <Text style={styles.wageAmountValue}>{money(a.amount)}</Text>
                      </View>

                      <View style={styles.editActionLink}>
                        <AppIcon name="create-outline" size={14} color="#2563EB" />
                        <Text style={styles.editActionLinkText}>Edit Haziri</Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}

            {/* Empty State */}
            {!filteredAttendance.length && statusFilter !== 'UNMARKED' ? (
              <EmptyState
                title={
                  query
                    ? 'No Matching Attendance'
                    : dateMode === 'selected'
                      ? `No Haziri for ${formatDateDisplay(selectedDate)}`
                      : 'No Attendance Records'
                }
                description={
                  query
                    ? 'Try searching with a different worker or site name.'
                    : 'Mark attendance to track daily wages, half days, and overtime.'
                }
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Calendar Picker Modal (Daily View) */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        title="Select Register Date"
        selectedDate={selectedDate}
        maxDate={today()}
        onSelect={(newDate) => {
          if (newDate) {
            if (newDate > today()) {
              showToast('Cannot select a future date', 'w');
              return;
            }
            setSelectedDate(newDate);
            setDateMode('selected');
          }
        }}
        onClose={() => setIsCalendarOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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

  /* 1. Date Navigator */
  dateNavigatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  currentDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  currentDateText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  currentDateSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  calendarIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },

  /* 2. Stats Grid */
  statsSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statKpiCard: {
    flex: 1,
    minWidth: 74,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  statKpiPresent: {
    borderLeftWidth: 3,
    borderLeftColor: '#16A34A',
  },
  statKpiHalf: {
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
  },
  statKpiAbsent: {
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  statKpiWage: {
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  statKpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statKpiValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  statKpiFoot: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },

  /* 3. Toolbar Box */
  toolbarBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
    height: '100%',
  },
  filterChipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  statusPillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPillChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusPillChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusPillChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* 4. Unmarked Section */
  unmarkedSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  unmarkedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unmarkedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  unmarkedSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  unmarkedSectionSub: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
  },
  unmarkedGrid: {
    gap: 6,
  },
  unmarkedWorkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  unmarkedWorkerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  unmarkedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmarkedAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  unmarkedWorkerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  unmarkedWorkerSkill: {
    fontSize: 11,
    color: '#64748B',
  },
  unmarkedActionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  unmarkedActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* 5. Records List Section */
  recordsListSection: {
    gap: 10,
  },
  recordsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  recordsHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordsHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  attendanceCardWrapper: {
    marginBottom: 2,
  },
  attendanceCard: {
    padding: 12,
    borderRadius: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  workerAvatarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBoxPresent: {
    backgroundColor: '#DCFCE7',
  },
  avatarBoxHalf: {
    backgroundColor: '#FEF3C7',
  },
  avatarBoxAbsent: {
    backgroundColor: '#FEE2E2',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  workerNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  skillPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  siteInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  siteNameText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metaDivider: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dateMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  statusBadgePresent: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeHalf: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeAbsent: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  overtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  overtimePillText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
  },
  notesCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
  },
  notesText: {
    fontSize: 11,
    color: '#64748B',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  wageDisplayCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  wageSubLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  wageAmountValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },
  editActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editActionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
});
