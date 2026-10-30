import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Platform,
  Share,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { useLanguage } from '../../i18n';
import { printWorkerMonthlySlipPdf } from '../../report';
import { getPublicReportBaseUrl } from '../../api';
import { today } from '../../forms';
import { showToast } from '../../context/ToastContext';

export interface MonthlyAttendancePageProps {
  data: Snapshot;
  onOpenAttendanceModal?: (siteId?: string, workerId?: string, existing?: Row) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function MonthlyAttendancePage({
  data,
  onOpenAttendanceModal,
  onOpenProfile,
  onBack,
  refreshing,
  onRefresh,
}: MonthlyAttendancePageProps) {
  const { t, lang } = useLanguage();

  // Month Register State
  const now = new Date();
  const [monthYear, setMonthYear] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [isMonthCalendarOpen, setIsMonthCalendarOpen] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  // Auto-select first active worker if none selected or invalid
  useEffect(() => {
    if (!selectedWorkerId || selectedWorkerId === 'ALL' || !data.workers.some((w) => w.id === selectedWorkerId)) {
      const defaultWorker = data.workers.find((w) => w.active) || data.workers[0];
      if (defaultWorker) {
        setSelectedWorkerId(defaultWorker.id);
      }
    }
  }, [data.workers, selectedWorkerId]);

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
    return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
  }, [monthYear, lang]);

  // Month records filter prefix (e.g. "2026-10")
  const monthPrefix = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}`;

  // Attendance in the selected month (excluding future dates)
  const todayStr = today();
  const monthAttendanceRecords = useMemo(() => {
    return data.attendance.filter(
      (a) => String(a.date).startsWith(monthPrefix) && String(a.date).slice(0, 10) <= todayStr
    );
  }, [data.attendance, monthPrefix, todayStr]);

  // Selected Worker object for monthly view
  const currentMonthlyWorker = useMemo(() => {
    if (selectedWorkerId && selectedWorkerId !== 'ALL') {
      const found = data.workers.find((w) => w.id === selectedWorkerId);
      if (found) return found;
    }
    return data.workers.find((w) => w.active) || data.workers[0] || null;
  }, [data.workers, selectedWorkerId]);

  // Days in month calculation for the 7-column calendar grid (Monday-first with leading blanks)
  const calendarGridDays = useMemo(() => {
    const firstDayDate = new Date(monthYear.year, monthYear.month - 1, 1);
    const jsDay = firstDayDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const startDayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0 = Mon, ..., 6 = Sun
    const count = new Date(monthYear.year, monthYear.month, 0).getDate();
    const grid: Array<{
      isBlank: boolean;
      day?: number;
      dateStr?: string;
      isSunday?: boolean;
      weekday?: string;
    }> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      grid.push({ isBlank: true });
    }

    for (let d = 1; d <= count; d++) {
      const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      const dt = new Date(monthYear.year, monthYear.month - 1, d);
      const isSunday = dt.getDay() === 0;
      const weekday = dt.toLocaleDateString('en-IN', { weekday: 'short' });
      grid.push({
        isBlank: false,
        day: d,
        dateStr: dStr,
        isSunday,
        weekday,
      });
    }
    return grid;
  }, [monthYear, monthPrefix]);

  // Worker Monthly Stats calculation
  const workerMonthStats = useMemo(() => {
    if (!currentMonthlyWorker) {
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

  // PDF Slip Download Handler
  const handleDownloadWorkerSlip = async (worker: Row) => {
    try {
      setExportingReport(true);
      await printWorkerMonthlySlipPdf(
        data,
        worker,
        monthYear.year,
        monthYear.month,
        'ALL',
        lang
      );
    } catch (err: any) {
      console.warn('Could not print worker slip:', err);
    } finally {
      setExportingReport(false);
    }
  };

  // WhatsApp Slip Share Handler
  const handleShareWorkerSlipWhatsapp = async (worker: Row) => {
    try {
      const present = workerMonthStats.present;
      const half = workerMonthStats.half;
      const absent = workerMonthStats.absent;
      const otHours = workerMonthStats.totalOtHours;
      const earned = workerMonthStats.totalWage;
      const totalUnits = workerMonthStats.totalUnits;

      const orgName = data.organization.name || data.user.name || 'ThekaBook';
      const isHi = lang === 'hi';
      const monthDisplay = new Date(monthYear.year, monthYear.month - 1, 1).toLocaleDateString(
        isHi ? 'hi-IN' : 'en-IN',
        { month: 'long', year: 'numeric' }
      );
      const reportUrl = `${getPublicReportBaseUrl()}/report/worker/${worker.id}?y=${monthYear.year}&m=${monthYear.month}&lang=${lang}`;

      const msg = isHi
        ? `🏗️ *${orgName}* - मासिक हाजिरी पर्ची\n\n` +
        `👤 *मजदूर:* ${worker.name} (${worker.skill || 'मजदूर'})\n` +
        `📅 *महीना:* ${monthDisplay}\n` +
        `💰 *दैनिक दर:* ₹${worker.daily_rate || 0}/दिन\n\n` +
        `📊 *उपस्थिति विवरण:*\n` +
        `🟢 उपस्थित: ${present} दिन\n` +
        (half > 0 ? `🟡 आधा दिन: ${half} दिन\n` : '') +
        (absent > 0 ? `🔴 छुट्टी / अनुपस्थित: ${absent} दिन\n` : '') +
        (Number(otHours) > 0 ? `⏰ ओवरटाइम: +${otHours} घंटे\n` : '') +
        `📌 कुल कार्य दिन: ${totalUnits} दिन\n\n` +
        `💵 *कुल अर्जित वेतन:* ₹${Number(earned).toLocaleString('en-IN')}\n\n` +
        `📄 *पूरी रिपोर्ट देखें / डाउनलोड करें (PDF):*\n🔗 ${reportUrl}\n\n` +
        `_ठेकाबुक डिजिटल लेजर द्वारा निर्मित_`
        : `🏗️ *${orgName}* - Monthly Attendance Slip\n\n` +
        `👤 *Worker:* ${worker.name} (${worker.skill || 'Labour'})\n` +
        `📅 *Month:* ${monthDisplay}\n` +
        `💰 *Daily Rate:* ₹${worker.daily_rate || 0}/day\n\n` +
        `📊 *Attendance Summary:*\n` +
        `🟢 Present: ${present} Days\n` +
        (half > 0 ? `🟡 Half Day: ${half} Days\n` : '') +
        (absent > 0 ? `🔴 Absent/Leave: ${absent} Days\n` : '') +
        (Number(otHours) > 0 ? `⏰ Overtime: +${otHours} Hours\n` : '') +
        `📌 Total Work Units: ${totalUnits} Units\n\n` +
        `💵 *Gross Month Wage Earned:* ₹${Number(earned).toLocaleString('en-IN')}\n\n` +
        `📄 *View & Download Full PDF Report:*\n🔗 ${reportUrl}\n\n` +
        `_Generated via ThekaBook Digital Contractor Ledger_`;

      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(msg);
        }
        if (typeof window !== 'undefined') {
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
        }
      } else {
        await Share.share({
          message: msg,
          title: `${worker.name} - ${monthDisplay} ${isHi ? 'हाजिरी' : 'Attendance'}`,
        });
      }
    } catch (err: any) {
      console.warn('Could not share via WhatsApp:', err);
    }
  };

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title="Monthly Attendance"
        subtitle="Monthly Attendance Register"
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
          <View style={styles.monthlySection}>
            {/* Top Row: Full-width Month Selector */}
            <View style={styles.monthlyFilterHeaderRow}>
              <View style={styles.filterBoxEqual}>
                <Pressable
                  onPress={handlePrevMonth}
                  style={({ pressed }) => [styles.monthNavArrowBtn, pressed && { opacity: 0.6 }]}
                  hitSlop={8}
                  accessibilityLabel="Previous Month"
                >
                  <AppIcon name="chevron-back" size={16} color="#2563EB" />
                </Pressable>

                <Pressable
                  onPress={() => setIsMonthCalendarOpen(true)}
                  style={({ pressed }) => [
                    styles.monthCenterInfo,
                    pressed && { opacity: 0.7, backgroundColor: '#EFF6FF' },
                  ]}
                  accessibilityLabel="Open Calendar to select Month"
                >
                  <AppIcon name="calendar" size={15} color="#2563EB" />
                  <Text style={styles.monthNameText} numberOfLines={1}>{monthName}</Text>
                </Pressable>

                <Pressable
                  onPress={handleNextMonth}
                  style={({ pressed }) => [styles.monthNavArrowBtn, pressed && { opacity: 0.6 }]}
                  hitSlop={8}
                  accessibilityLabel="Next Month"
                >
                  <AppIcon name="chevron-forward" size={16} color="#2563EB" />
                </Pressable>
              </View>
            </View>

            {/* SINGLE WORKER: CALENDAR MATRIX CARD */}
            {currentMonthlyWorker ? (
              <View style={styles.calendarMatrixCard}>
                {/* Worker Header (Exact same Labour / Worker Select Bar) & Quick Action Buttons */}
                <View style={styles.workerReportHeaderBox}>
                  {/* Worker Select Bar - Clean Name Only */}
                  <View
                    style={[
                      styles.filterBoxEqual,
                      styles.labourDropdownTrigger,
                      { position: 'relative', flex: 1, marginRight: 8 },
                      styles.labourDropdownTriggerSelected,
                    ]}
                  >
                    <Text style={styles.dropdownSelectedValue} numberOfLines={1}>
                      {currentMonthlyWorker ? currentMonthlyWorker.name : 'Select Labour'}
                    </Text>

                    <AppIcon name="chevron-down" size={16} color="#64748B" />

                    {/* Universal Native Picker for Mobile (Android/iOS) & Web - Individual Workers Only */}
                    <Picker
                      selectedValue={selectedWorkerId || currentMonthlyWorker?.id}
                      onValueChange={(val: any) => setSelectedWorkerId(String(val))}
                      style={styles.nativeHiddenPicker}
                      dropdownIconColor="transparent"
                      prompt="Select Labour / Worker"
                    >
                      {data.workers.map((w) => (
                        <Picker.Item
                          key={w.id}
                          label={`${w.name}${w.skill ? ` (${w.skill})` : ''}`}
                          value={w.id}
                        />
                      ))}
                    </Picker>
                  </View>

                  {/* Action Icon Buttons: PDF Download & WhatsApp */}
                  <View style={styles.workerActionBtnsRow}>
                    <Pressable
                      onPress={() => handleDownloadWorkerSlip(currentMonthlyWorker)}
                      disabled={exportingReport}
                      style={({ pressed }) => [
                        styles.workerPdfSlipBtn,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
                      ]}
                      accessibilityLabel="Download monthly attendance PDF report"
                    >
                      <AppIcon name="download-outline" size={16} color="#1D4ED8" />
                    </Pressable>

                    <Pressable
                      onPress={() => handleShareWorkerSlipWhatsapp(currentMonthlyWorker)}
                      style={({ pressed }) => [
                        styles.workerWaSlipBtn,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
                      ]}
                      accessibilityLabel="Share monthly attendance slip on WhatsApp"
                    >
                      <AppIcon name="logo-whatsapp" size={16} color="#15803D" />
                    </Pressable>
                  </View>
                </View>

                {/* 7-Column Weekday Header Row (Monday to Sunday) */}
                <View style={styles.calendarWeekdaysRow}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
                    <View key={w} style={styles.calendarWeekdayCol}>
                      <Text style={styles.calendarWeekdayLabel}>
                        {w}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* 7-Column Attendance Day Grid (Circles matching the user's design) */}
                <View style={styles.calendarDaysGrid}>
                  {calendarGridDays.map((cell, idx) => {
                    if (cell.isBlank) {
                      return <View key={`blank-${idx}`} style={styles.calendarDayCellEmpty} />;
                    }

                    const rec = monthAttendanceRecords.find(
                      (a) => a.worker_id === currentMonthlyWorker.id && String(a.date).slice(0, 10) === cell.dateStr
                    );

                    let status = '';
                    let circleStyle: any = styles.cellCircleUnmarked;
                    let textStyle: any = styles.cellDayTextUnmarked;
                    let subTextStyle: any = styles.cellSubTextUnmarked;

                    const todayStr = today();
                    const isFuture = !!cell.dateStr && cell.dateStr > todayStr;

                    if (isFuture) {
                      status = '';
                      circleStyle = styles.cellCircleFuture;
                      textStyle = styles.cellDayTextFuture;
                      subTextStyle = styles.cellSubTextFuture;
                    } else if (rec) {
                      const u = Number(rec.units);
                      if (u === 1) {
                        status = 'P';
                        circleStyle = styles.cellCirclePresent;
                        textStyle = styles.cellDayTextPresent;
                        subTextStyle = styles.cellSubTextPresent;
                      } else if (u === 0.5) {
                        status = 'H';
                        circleStyle = styles.cellCircleHalf;
                        textStyle = styles.cellDayTextHalf;
                        subTextStyle = styles.cellSubTextHalf;
                      } else if (u === 0) {
                        status = 'A';
                        circleStyle = styles.cellCircleAbsent;
                        textStyle = styles.cellDayTextAbsent;
                        subTextStyle = styles.cellSubTextAbsent;
                      }
                    }

                    const dayDisplay = String(cell.day).padStart(2, '0');

                    return (
                      <View key={cell.dateStr} style={styles.calendarDayCellWrap}>
                        <Pressable
                          onPress={() => {
                            if (isFuture) {
                              showToast('Attendance cannot be marked for future dates', 'w');
                              return;
                            }
                            if (onOpenAttendanceModal && currentMonthlyWorker && cell.dateStr) {
                              onOpenAttendanceModal(
                                rec?.site_id || data.sites[0]?.id,
                                currentMonthlyWorker.id,
                                rec || ({
                                  date: cell.dateStr,
                                  worker_id: currentMonthlyWorker.id,
                                  site_id: data.sites[0]?.id,
                                  units: 1,
                                } as any)
                              );
                            }
                          }}
                          style={({ pressed }) => [
                            styles.cellCircleBase,
                            circleStyle,
                            pressed && { opacity: 0.75, transform: [{ scale: 0.92 }] },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Date ${dayDisplay}, status ${status || (isFuture ? 'Future Date' : 'Unmarked')}`}
                        >
                          <Text style={[styles.cellDayNum, textStyle]}>{dayDisplay}</Text>
                          {status ? (
                            <Text style={[styles.cellStatusSub, subTextStyle]}>{status}</Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                {/* Legend Below Calendar */}
                <View style={styles.calendarLegendRowClean}>
                  <View style={styles.legendItemClean}>
                    <View style={[styles.legendDotClean, { backgroundColor: '#06B6D4' }]} />
                    <Text style={styles.legendLabelClean}>P - Present</Text>
                  </View>
                  <View style={styles.legendItemClean}>
                    <View style={[styles.legendDotClean, { backgroundColor: '#22C55E' }]} />
                    <Text style={styles.legendLabelClean}>H - Half Day</Text>
                  </View>
                  <View style={styles.legendItemClean}>
                    <View style={[styles.legendDotClean, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.legendLabelClean}>A - Absent</Text>
                  </View>
                </View>
              </View>
            ) : (
              /* EMPTY STATE IF NO WORKERS EXIST */
              <View style={styles.emptyWorkersState}>
                <AppIcon name="people-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyWorkersTitle}>No Labour / Worker Found</Text>
                <Text style={styles.emptyWorkersSub}>Please add workers to view their monthly attendance.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Month Calendar Picker Modal */}
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
  monthlySection: {
    gap: 14,
  },
  monthlyFilterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  emptyWorkersState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 16,
    gap: 8,
  },
  emptyWorkersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyWorkersSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
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
    paddingHorizontal: 6,
  },
  monthNavArrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
  },
  monthNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  labourDropdownTrigger: {
    paddingHorizontal: 14,
  },
  labourDropdownTriggerSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  dropdownLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownAvatar: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarSelected: {
    backgroundColor: '#2563EB',
  },
  dropdownAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dropdownTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  dropdownLabelMini: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dropdownSelectedValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  nativeHiddenPicker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  /* Calendar Matrix Card */
  calendarMatrixCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  workerReportHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  workerActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerPdfSlipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerWaSlipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 7-Column Calendar */
  calendarWeekdaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  calendarWeekdayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekdayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    paddingVertical: 6,
  },
  calendarDayCellEmpty: {
    width: '14.285%',
    aspectRatio: 1,
  },
  calendarDayCellWrap: {
    width: '14.285%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cellCircleBase: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  cellCircleUnmarked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cellCircleFuture: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cellCircleFutureDisabled: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cellDayTextFuture: {
    color: '#475569',
    fontWeight: '600',
  },
  cellSubTextFuture: {
    color: '#94A3B8',
  },
  cellDayTextUnmarked: {
    color: '#64748B',
    fontWeight: '600',
  },
  cellSubTextUnmarked: {
    color: '#94A3B8',
  },
  cellCirclePresent: {
    backgroundColor: '#67E8F9',
    borderColor: '#22D3EE',
  },
  cellDayTextPresent: {
    color: '#083344',
    fontWeight: '800',
  },
  cellSubTextPresent: {
    color: '#083344',
    fontWeight: '800',
  },
  cellCircleHalf: {
    backgroundColor: '#86EFAC',
    borderColor: '#4ADE80',
  },
  cellDayTextHalf: {
    color: '#052E16',
    fontWeight: '800',
  },
  cellSubTextHalf: {
    color: '#052E16',
    fontWeight: '800',
  },
  cellCircleAbsent: {
    backgroundColor: '#FCA5A5',
    borderColor: '#F87171',
  },
  cellDayTextAbsent: {
    color: '#450A0A',
    fontWeight: '800',
  },
  cellSubTextAbsent: {
    color: '#450A0A',
    fontWeight: '800',
  },
  cellCircleOff: {
    backgroundColor: '#64748B',
    borderColor: '#475569',
  },
  cellDayTextOff: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cellSubTextOff: {
    color: '#F1F5F9',
    fontWeight: '800',
  },
  cellDayNum: {
    fontSize: 10,
    lineHeight: 11,
  },
  cellStatusSub: {
    fontSize: 9,
    lineHeight: 10,
  },
  calendarLegendRowClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItemClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotClean: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabelClean: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
