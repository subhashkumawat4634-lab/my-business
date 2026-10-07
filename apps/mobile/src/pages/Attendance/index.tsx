import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';

interface AttendancePageProps {
  data: Snapshot;
  onOpenAttendanceModal: (siteId?: string, workerId?: string, existing?: Row) => void;
  onOpenProfile?: () => void;
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

export function AttendancePage({
  data,
  onOpenAttendanceModal,
  onOpenProfile,
  refreshing,
  onRefresh,
}: AttendancePageProps) {
  const { t, lang } = useLanguage();
  // Top View Switcher (Daily Marking vs Monthly Register)
  const [viewTab, setViewTab] = useState<'DAILY' | 'MONTHLY'>('DAILY');

  // Month Register State
  const now = new Date();
  const [monthYear, setMonthYear] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('ALL');
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const [workerPickerSearch, setWorkerPickerSearch] = useState('');

  // Navigation & Filtering State
  const currentDate = today();
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [dateMode, setDateMode] = useState<'selected' | 'all'>('selected');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '1' | '0.5' | '0' | 'UNMARKED'>('ALL');
  const [search, setSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMonthCalendarOpen, setIsMonthCalendarOpen] = useState(false);

  const query = search.trim().toLowerCase();

  // Active workers list
  const activeWorkers = useMemo(
    () => data.workers.filter((w) => w.active),
    [data.workers]
  );

  // Yesterday date string
  const yesterdayDate = useMemo(() => shiftDate(currentDate, -1), [currentDate]);

  // Attendance records for the selected date
  const selectedDateRecords = useMemo(() => {
    return data.attendance.filter(
      (a) => String(a.date).slice(0, 10) === selectedDate
    );
  }, [data.attendance, selectedDate]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setMonthYear((prev) => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setMonthYear((prev) => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const monthName = useMemo(() => {
    const d = new Date(monthYear.year, monthYear.month - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [monthYear]);

  // Month records filter prefix (e.g. "2026-10")
  const monthPrefix = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}`;

  // Attendance in the selected month
  const monthAttendanceRecords = useMemo(() => {
    return data.attendance.filter((a) => String(a.date).startsWith(monthPrefix));
  }, [data.attendance, monthPrefix]);

  // Selected Worker object for monthly view
  const currentMonthlyWorker = useMemo(() => {
    if (selectedWorkerId === 'ALL') return null;
    return data.workers.find((w) => w.id === selectedWorkerId) || null;
  }, [data.workers, selectedWorkerId]);

  // Filtered workers list for dropdown picker modal
  const filteredPickerWorkers = useMemo(() => {
    const q = workerPickerSearch.trim().toLowerCase();
    if (!q) return data.workers;
    return data.workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.skill || '').toLowerCase().includes(q)
    );
  }, [data.workers, workerPickerSearch]);

  // Days in month calculation for the calendar grid
  const daysInCurrentMonth = useMemo(() => {
    const count = new Date(monthYear.year, monthYear.month, 0).getDate();
    const daysArr = [];
    for (let day = 1; day <= count; day++) {
      const dayStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(monthYear.year, monthYear.month - 1, day);
      const weekday = dayDate.toLocaleDateString('en-IN', { weekday: 'short' });
      daysArr.push({ day, dateStr: dayStr, weekday });
    }
    return daysArr;
  }, [monthYear, monthPrefix]);

  // Worker Monthly Stats calculation
  const workerMonthStats = useMemo(() => {
    if (!currentMonthlyWorker) {
      // Overall monthly stats across all workers
      const present = monthAttendanceRecords.filter((a) => Number(a.units) === 1).length;
      const half = monthAttendanceRecords.filter((a) => Number(a.units) === 0.5).length;
      const absent = monthAttendanceRecords.filter((a) => Number(a.units) === 0).length;
      const totalUnits = monthAttendanceRecords.reduce((s, a) => s + Number(a.units || 0), 0);
      const totalOtMins = monthAttendanceRecords.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0);
      const totalWage = monthAttendanceRecords.reduce((s, a) => s + Number(a.amount || 0), 0);

      return {
        present,
        half,
        absent,
        totalUnits,
        totalOtHours: (totalOtMins / 60).toFixed(1).replace(/\.0$/, ''),
        totalWage,
      };
    }

    const workerRecords = monthAttendanceRecords.filter((a) => a.worker_id === currentMonthlyWorker.id);
    const present = workerRecords.filter((a) => Number(a.units) === 1).length;
    const half = workerRecords.filter((a) => Number(a.units) === 0.5).length;
    const absent = workerRecords.filter((a) => Number(a.units) === 0).length;
    const totalUnits = workerRecords.reduce((s, a) => s + Number(a.units || 0), 0);
    const totalOtMins = workerRecords.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0);
    const totalWage = workerRecords.reduce((s, a) => s + Number(a.amount || 0), 0);

    return {
      present,
      half,
      absent,
      totalUnits,
      totalOtHours: (totalOtMins / 60).toFixed(1).replace(/\.0$/, ''),
      totalWage,
    };
  }, [currentMonthlyWorker, monthAttendanceRecords]);

  // All workers breakdown for the month
  const allWorkersMonthSummary = useMemo(() => {
    return data.workers.map((w) => {
      const records = monthAttendanceRecords.filter((a) => a.worker_id === w.id);
      const present = records.filter((a) => Number(a.units) === 1).length;
      const half = records.filter((a) => Number(a.units) === 0.5).length;
      const absent = records.filter((a) => Number(a.units) === 0).length;
      const totalUnits = records.reduce((s, a) => s + Number(a.units || 0), 0);
      const otMins = records.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0);
      const earned = records.reduce((s, a) => s + Number(a.amount || 0), 0);

      return {
        worker: w,
        present,
        half,
        absent,
        totalUnits,
        otHours: (otMins / 60).toFixed(1).replace(/\.0$/, ''),
        earned,
        daysMarked: records.length,
      };
    }).sort((a, b) => b.earned - a.earned);
  }, [data.workers, monthAttendanceRecords]);

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

  const isToday = selectedDate === currentDate;
  const isYesterday = selectedDate === yesterdayDate;

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title={t('attendanceTitle', 'Haziri Register')}
        subtitle={viewTab === 'DAILY' ? t('dailyMarkingSub', 'Daily Attendance Marking') : `${monthName} ${t('monthlyRegisterSub', 'Monthly Attendance Register')}`}
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
          {/* 0. VIEW MODE SWITCHER (Daily Haziri vs Monthly Register) */}
          <View style={styles.viewModeSwitcher}>
            <Pressable
              onPress={() => setViewTab('DAILY')}
              style={[
                styles.viewModeTab,
                viewTab === 'DAILY' && styles.viewModeTabActive,
              ]}
            >
              <AppIcon
                name="calendar-outline"
                size={16}
                color={viewTab === 'DAILY' ? '#0F2851' : '#64748B'}
              />
              <Text
                style={[
                  styles.viewModeLabel,
                  viewTab === 'DAILY' && styles.viewModeLabelActive,
                ]}
              >
                {t('dailyHaziri', 'Daily Haziri')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setViewTab('MONTHLY')}
              style={[
                styles.viewModeTab,
                viewTab === 'MONTHLY' && styles.viewModeTabActive,
              ]}
            >
              <AppIcon
                name="grid-outline"
                size={16}
                color={viewTab === 'MONTHLY' ? '#0F2851' : '#64748B'}
              />
              <Text
                style={[
                  styles.viewModeLabel,
                  viewTab === 'MONTHLY' && styles.viewModeLabelActive,
                ]}
              >
                {t('monthlyRegister', 'Monthly Register')}
              </Text>
            </Pressable>
          </View>

          {/* ========================================================= */}
          {/* VIEW A: MONTHLY REGISTER (महीना हाजिरी रजिस्टर) */}
          {/* ========================================================= */}
          {viewTab === 'MONTHLY' ? (
            <View style={styles.monthlySection}>
              {/* Single Row: Left Month Selector + Right Labour Select Bar */}

              <View style={styles.monthlyFilterHeaderRow}>
                {/* Left Box: Month Selector */}
                <View style={styles.filterBoxEqual}>
                  <Pressable
                    onPress={handlePrevMonth}
                    style={({ pressed }) => [styles.monthNavArrowBtn, pressed && { opacity: 0.6 }]}
                    hitSlop={8}
                    accessibilityLabel="Previous Month"
                  >
                    <AppIcon name="chevron-back" size={16} color="#0F2851" />
                  </Pressable>

                  <Pressable
                    onPress={() => setIsMonthCalendarOpen(true)}
                    style={({ pressed }) => [
                      styles.monthCenterInfo,
                      pressed && { opacity: 0.7, backgroundColor: '#EFF6FF' },
                    ]}
                    accessibilityLabel="Open Calendar to select Month"
                  >
                    <AppIcon name="calendar" size={14} color="#2563EB" />
                    <Text style={styles.monthNameText} numberOfLines={1}>{monthName}</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleNextMonth}
                    style={({ pressed }) => [styles.monthNavArrowBtn, pressed && { opacity: 0.6 }]}
                    hitSlop={8}
                    accessibilityLabel="Next Month"
                  >
                    <AppIcon name="chevron-forward" size={16} color="#0F2851" />
                  </Pressable>
                </View>

                {/* Right Box: Labour / Worker Select Bar */}
                <View
                  style={[
                    styles.filterBoxEqual,
                    styles.labourDropdownTrigger,
                    selectedWorkerId !== 'ALL' && styles.labourDropdownTriggerSelected,
                  ]}
                >
                  <View style={styles.dropdownLeftContent}>
                    <View
                      style={[
                        styles.dropdownAvatar,
                        selectedWorkerId !== 'ALL' && styles.dropdownAvatarSelected,
                      ]}
                    >
                      {selectedWorkerId === 'ALL' ? (
                        <AppIcon name="people" size={14} color="#2563EB" />
                      ) : (
                        <Text style={styles.dropdownAvatarText}>
                          {(currentMonthlyWorker?.name || 'W').slice(0, 2).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={styles.dropdownTextCol}>
                      <Text style={styles.dropdownLabelMini}>Labour / Worker</Text>
                      <Text style={styles.dropdownSelectedValue} numberOfLines={1}>
                        {currentMonthlyWorker ? currentMonthlyWorker.name : 'All Workers'}
                      </Text>
                    </View>
                  </View>

                  <AppIcon name="chevron-down" size={16} color="#64748B" />

                  {/* Native HTML Select Bar Element for direct dropdown selection */}
                  {Platform.OS === 'web' && (
                    <select
                      value={selectedWorkerId}
                      onChange={(e: any) => setSelectedWorkerId(e.target.value)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 10,
                      }}
                      title="Select Labour / Worker"
                    >
                      <option value="ALL">👥 All Workers (All Labour Register)</option>
                      {data.workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.skill ? `(${w.skill})` : ''} — ₹{w.daily_rate}/day
                        </option>
                      ))}
                    </select>
                  )}
                </View>

              </View>

              {/* Monthly KPI Summary Cards */}
              <View style={styles.statsSummaryGrid}>
                <View style={[styles.statKpiCard, styles.statKpiPresent]}>
                  <View style={styles.statKpiTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                      <AppIcon name="checkmark-circle" size={16} color="#16A34A" />
                    </View>
                    <Text style={[styles.statKpiLabel, { color: '#166534' }]}>Present</Text>
                  </View>
                  <Text style={[styles.statKpiValue, { color: '#15803D' }]}>
                    {workerMonthStats.present}
                  </Text>
                  <Text style={styles.statKpiFoot}>Full days</Text>
                </View>

                <View style={[styles.statKpiCard, styles.statKpiHalf]}>
                  <View style={styles.statKpiTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                      <AppIcon name="time" size={16} color="#D97706" />
                    </View>
                    <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>Half Day</Text>
                  </View>
                  <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                    {workerMonthStats.half}
                  </Text>
                  <Text style={styles.statKpiFoot}>0.5 units</Text>
                </View>

                <View style={[styles.statKpiCard, styles.statKpiAbsent]}>
                  <View style={styles.statKpiTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                      <AppIcon name="close-circle" size={16} color="#DC2626" />
                    </View>
                    <Text style={[styles.statKpiLabel, { color: '#991B1B' }]}>Absent</Text>
                  </View>
                  <Text style={[styles.statKpiValue, { color: '#B91C1C' }]}>
                    {workerMonthStats.absent}
                  </Text>
                  <Text style={styles.statKpiFoot}>Leave</Text>
                </View>

                <View style={[styles.statKpiCard, styles.statKpiWage]}>
                  <View style={styles.statKpiTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                      <AppIcon name="wallet" size={16} color="#2563EB" />
                    </View>
                    <Text style={[styles.statKpiLabel, { color: '#1E40AF' }]}>Month Wage</Text>
                  </View>
                  <Text style={[styles.statKpiValue, { color: '#1D4ED8' }]}>
                    {money(workerMonthStats.totalWage)}
                  </Text>
                  <Text style={styles.statKpiFoot}>
                    {Number(workerMonthStats.totalOtHours) > 0 ? `+${workerMonthStats.totalOtHours}h OT` : `${workerMonthStats.totalUnits} Units`}
                  </Text>
                </View>
              </View>

              {/* IF SINGLE WORKER IS SELECTED: SHOW DETAILED CALENDAR MATRIX */}
              {currentMonthlyWorker ? (
                <View style={styles.calendarMatrixCard}>
                  <View style={styles.calendarCardHeader}>
                    <View>
                      <Text style={styles.calendarCardTitle}>
                        {currentMonthlyWorker.name} — {monthName}
                      </Text>
                      <Text style={styles.calendarCardSub}>
                        Daily Rate: {money(currentMonthlyWorker.daily_rate)}/day • Overtime: {money(currentMonthlyWorker.overtime_rate)}/hr
                      </Text>
                    </View>
                    <View style={styles.calendarLegendRow}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
                        <Text style={styles.legendText}>P (1)</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
                        <Text style={styles.legendText}>HD (0.5)</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                        <Text style={styles.legendText}>A (0)</Text>
                      </View>
                    </View>
                  </View>

                  {/* Day-by-Day Grid */}
                  <View style={styles.monthDaysGrid}>
                    {daysInCurrentMonth.map(({ day, dateStr, weekday }) => {
                      const att = data.attendance.find(
                        (a) => String(a.date).slice(0, 10) === dateStr && a.worker_id === currentMonthlyWorker.id
                      );
                      const units = att ? Number(att.units) : null;
                      const isP = units === 1;
                      const isHD = units === 0.5;
                      const isA = units === 0;
                      const isUnmarked = units === null;
                      const otMins = att ? Number(att.overtime_minutes || 0) : 0;
                      const site = att ? data.sites.find((s) => s.id === att.site_id) : null;

                      return (
                        <Pressable
                          key={dateStr}
                          onPress={() => {
                            onOpenAttendanceModal(
                              att?.site_id || data.sites[0]?.id,
                              currentMonthlyWorker.id,
                              att
                            );
                          }}
                          style={({ pressed }) => [
                            styles.dayCell,
                            isP && styles.dayCellP,
                            isHD && styles.dayCellHD,
                            isA && styles.dayCellA,
                            isUnmarked && styles.dayCellUnmarked,
                            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                          ]}
                          accessibilityLabel={`Date ${day} ${weekday}, status: ${isP ? 'Present' : isHD ? 'Half Day' : isA ? 'Absent' : 'Unmarked'}`}
                        >
                          <View style={styles.dayCellTop}>
                            <Text style={[styles.dayNumberText, isP && { color: '#15803D' }, isHD && { color: '#B45309' }, isA && { color: '#B91C1C' }]}>
                              {day}
                            </Text>
                            <Text style={styles.dayWeekdayText}>{weekday}</Text>
                          </View>

                          <View style={styles.dayStatusBox}>
                            {isP ? (
                              <Text style={styles.badgeP}>P</Text>
                            ) : isHD ? (
                              <Text style={styles.badgeHD}>HD</Text>
                            ) : isA ? (
                              <Text style={styles.badgeA}>A</Text>
                            ) : (
                              <Text style={styles.badgeUnmarked}>--</Text>
                            )}
                          </View>

                          {otMins > 0 ? (
                            <View style={styles.dayOtBadge}>
                              <Text style={styles.dayOtBadgeText}>+{(otMins / 60).toFixed(1)}h</Text>
                            </View>
                          ) : site ? (
                            <Text style={styles.daySiteText} numberOfLines={1}>
                              {site.name}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* ALL WORKERS MONTHLY ATTENDANCE REGISTER LIST */
                <View style={styles.allWorkersRegisterSection}>
                  <View style={styles.registerSectionHeader}>
                    <Text style={styles.registerSectionTitle}>All Workers Register — {monthName}</Text>
                    <Text style={styles.registerSectionSub}>Tap any worker to view their full month calendar</Text>
                  </View>

                  <View style={styles.workersSummaryList}>
                    {allWorkersMonthSummary.map((item) => {
                      const { worker: w, present, half, absent, otHours, earned, totalUnits } = item;
                      const initials = (w.name || 'W').slice(0, 2).toUpperCase();

                      return (
                        <Pressable
                          key={w.id}
                          onPress={() => setSelectedWorkerId(w.id)}
                          style={({ pressed }) => [
                            styles.workerMonthCard,
                            pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
                          ]}
                        >
                          <View style={styles.workerMonthCardHeader}>
                            <View style={styles.workerAvatar}>
                              <Text style={styles.workerAvatarText}>{initials}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.workerNameTitle}>{w.name}</Text>
                              <Text style={styles.workerSkillSub}>
                                {w.skill || 'Worker'} • {money(w.daily_rate)}/day
                              </Text>
                            </View>
                            <View style={styles.workerMonthEarned}>
                              <Text style={styles.workerMonthEarnedAmount}>{money(earned)}</Text>
                              <Text style={styles.workerMonthEarnedSub}>{totalUnits} Days total</Text>
                            </View>
                          </View>

                          {/* Attendance Count Chips */}
                          <View style={styles.workerChipsRow}>
                            <View style={[styles.chipBadge, { backgroundColor: '#DCFCE7' }]}>
                              <Text style={[styles.chipText, { color: '#166534' }]}>
                                🟢 {present} Present
                              </Text>
                            </View>
                            {half > 0 ? (
                              <View style={[styles.chipBadge, { backgroundColor: '#FEF3C7' }]}>
                                <Text style={[styles.chipText, { color: '#92400E' }]}>
                                  🟡 {half} Half
                                </Text>
                              </View>
                            ) : null}
                            {absent > 0 ? (
                              <View style={[styles.chipBadge, { backgroundColor: '#FEE2E2' }]}>
                                <Text style={[styles.chipText, { color: '#991B1B' }]}>
                                  🔴 {absent} Absent
                                </Text>
                              </View>
                            ) : null}
                            {Number(otHours) > 0 ? (
                              <View style={[styles.chipBadge, { backgroundColor: '#EFF6FF' }]}>
                                <Text style={[styles.chipText, { color: '#1E40AF' }]}>
                                  ⏰ +{otHours}h OT
                                </Text>
                              </View>
                            ) : null}

                            <View style={styles.viewCalBtn}>
                              <Text style={styles.viewCalBtnText}>Calendar →</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* ========================================================= */
            /* VIEW B: DAILY HAZIRI (The Original Daily Attendance View) */
            /* ========================================================= */
            <>
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
                      {dateMode === 'selected' && isToday ? (
                        <View style={styles.todayTag}>
                          <Text style={styles.todayTagText}>Today</Text>
                        </View>
                      ) : null}
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
                        onPress={() => onOpenAttendanceModal(undefined, w.id)}
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
            </>
          )}
        </View>
      </ScrollView>

      {/* Calendar Picker Modal (Daily View) */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        title="Select Register Date"
        selectedDate={selectedDate}
        onSelect={(newDate) => {
          if (newDate) {
            setSelectedDate(newDate);
            setDateMode('selected');
          }
        }}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* Month Calendar Picker Modal (Monthly View) */}
      <CalendarPickerModal
        visible={isMonthCalendarOpen}
        title="Select Register Month & Year"
        selectedDate={`${monthYear.year}-${String(monthYear.month).padStart(2, '0')}-01`}
        onSelect={(newDate) => {
          if (newDate) {
            const [y, m] = newDate.split('-').map(Number);
            setMonthYear({ year: y, month: m });
          }
        }}
        onClose={() => setIsMonthCalendarOpen(false)}
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
    shadowRadius: 3,
    elevation: 1,
  },
  dateControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  currentDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDateText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  currentDateSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  todayTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  todayTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickDateChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  quickDateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickDateChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  calendarPickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 'auto',
  },
  calendarPickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  /* 2. Stats KPI Grid */
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
  statKpiPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statKpiHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statKpiAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statKpiWage: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
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

  /* 3. Toolbar Box */
  toolbarBox: {
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: 'transparent',
    paddingVertical: 4,
  },
  filterChipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  statusPillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusPillChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  statusPillChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusPillChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* 4. Unmarked Workers Section */
  unmarkedSection: {
    backgroundColor: '#FFFDF5',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
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
    fontWeight: '600',
  },
  unmarkedGrid: {
    gap: 8,
  },
  unmarkedWorkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  unmarkedWorkerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  unmarkedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmarkedAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  unmarkedWorkerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  unmarkedWorkerSkill: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  unmarkedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  unmarkedActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },

  /* 5. Records List Section */
  recordsListSection: {
    gap: 10,
  },
  recordsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  recordsHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  recordsHeaderSub: {
    fontSize: 11,
    color: '#64748B',
  },
  attendanceCardWrapper: {
    borderRadius: 14,
  },
  attendanceCard: {
    padding: 14,
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
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBoxPresent: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  avatarBoxHalf: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  avatarBoxAbsent: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  workerNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  skillPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  skillPillText: {
    fontSize: 10,
    fontWeight: '700',
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
    fontWeight: '600',
    maxWidth: 120,
  },
  metaDivider: {
    fontSize: 10,
    color: '#CBD5E1',
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
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgePresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusBadgeHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  overtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  overtimePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  notesCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
  },
  notesText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
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
    fontWeight: '600',
  },
  wageAmountValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#15803D',
  },
  editActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  editActionLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },

  /* ========================================================= */
  /* MONTHLY REGISTER & CALENDAR MATRIX STYLES */
  /* ========================================================= */
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewModeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  viewModeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeLabelActive: {
    color: '#0F2851',
    fontWeight: '800',
  },
  monthlySection: {
    gap: 14,
  },
  /* Single Row Filter: Month Selector + Labour Dropdown (Equal Size 50-50) */
  monthlyFilterCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  monthlyFilterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterBoxEqual: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  monthNavArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  monthNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F2851',
  },
  labourDropdownTrigger: {
    paddingHorizontal: 8,
    cursor: 'pointer',
  },
  labourDropdownTriggerOpen: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  labourDropdownTriggerSelected: {
    borderColor: '#BFDBFE',
  },
  dropdownLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    overflow: 'hidden',
  },
  dropdownAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarSelected: {
    backgroundColor: '#2563EB',
  },
  dropdownAvatarText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dropdownTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  dropdownLabelMini: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropdownSelectedValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Inline Dropdown Menu */
  inlineDropdownMenu: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  dropdownScrollList: {
    maxHeight: 220,
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dropdownOptionItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  dropdownOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownOptionIconActive: {
    backgroundColor: '#2563EB',
  },
  dropdownOptionIconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  dropdownOptionName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownOptionNameActive: {
    color: '#1D4ED8',
  },
  dropdownOptionSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  inactiveText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* Calendar Matrix */
  calendarMatrixCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  calendarCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  calendarCardSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  calendarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  monthDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '13%',
    minWidth: 42,
    aspectRatio: 0.85,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  dayCellP: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  dayCellHD: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  dayCellA: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  dayCellUnmarked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  dayCellTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  dayNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayWeekdayText: {
    fontSize: 8.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  dayStatusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  badgeP: {
    fontSize: 12,
    fontWeight: '900',
    color: '#15803D',
  },
  badgeHD: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
  },
  badgeA: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B91C1C',
  },
  badgeUnmarked: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  dayOtBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  dayOtBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#1E40AF',
  },
  daySiteText: {
    fontSize: 7.5,
    color: '#64748B',
    fontWeight: '600',
  },

  /* All Workers Register List */
  allWorkersRegisterSection: {
    gap: 10,
  },
  registerSectionHeader: {
    paddingHorizontal: 2,
  },
  registerSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  registerSectionSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  workersSummaryList: {
    gap: 10,
  },
  workerMonthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  workerMonthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
  },
  workerNameTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  workerSkillSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  workerMonthEarned: {
    alignItems: 'flex-end',
  },
  workerMonthEarnedAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#15803D',
  },
  workerMonthEarnedSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  workerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  chipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  viewCalBtn: {
    marginLeft: 'auto',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewCalBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
});
