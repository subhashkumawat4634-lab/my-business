import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Row, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { ClockPickerModal } from './ClockPickerModal';
import { today } from '../../forms';
import { money } from '../../finance';

export interface AttendanceModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const STATUS_OPTIONS: Array<{
  units: '1' | '0.5' | '0';
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
    {
      units: '1',
      label: 'Present',
      icon: 'checkmark-circle',
      color: '#16A34A',
      bgColor: '#F0FDF4',
      borderColor: '#BBF7D0',
    },
    {
      units: '0.5',
      label: 'Half Day',
      icon: 'time',
      color: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
    },
    {
      units: '0',
      label: 'Absent',
      icon: 'close-circle',
      color: '#DC2626',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
    },
  ];

export function AttendanceModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: AttendanceModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const isCorrection = spec.title.toLowerCase().includes('correct');
  const isWorkerLocked = Boolean(
    spec.initial.locked_worker_id ||
    (spec.fields && spec.fields.find((f) => f.key === 'worker_id')?.options?.length === 1) ||
    spec.entity_id
  );

  // Form State
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [workerId, setWorkerId] = useState<string>(
    spec.initial.worker_id || data.workers.find((w) => w.active)?.id || ''
  );
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [units, setUnits] = useState<'1' | '0.5' | '0'>(
    (spec.initial.units as any) || '1'
  );
  const [overtimeMinutes, setOvertimeMinutes] = useState<string>(
    spec.initial.overtime_minutes ? String(spec.initial.overtime_minutes) : '0'
  );
  const [notes, setNotes] = useState<string>(spec.initial.notes || '');

  // UI state for dropdown pickers
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isClockPickerOpen, setIsClockPickerOpen] = useState(false);

  // Search queries for pickers
  const [siteSearch, setSiteSearch] = useState('');
  const [workerSearch, setWorkerSearch] = useState('');
  const [localError, setLocalError] = useState('');

  // Currently selected site & worker
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === workerId) || data.workers[0],
    [data.workers, workerId]
  );

  const currentStatusOpt = useMemo(
    () => STATUS_OPTIONS.find((s) => s.units === units) || STATUS_OPTIONS[0],
    [units]
  );

  // Filtered sites for site picker
  const filteredSites = useMemo(() => {
    if (!siteSearch.trim()) return data.sites;
    const q = siteSearch.toLowerCase();
    return data.sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q))
    );
  }, [data.sites, siteSearch]);

  // Filtered active workers for worker picker (locked to single worker when targeted)
  const filteredWorkers = useMemo(() => {
    if (isWorkerLocked && selectedWorker) {
      return [selectedWorker];
    }
    const list = data.workers.filter((w) => w.active);
    if (!workerSearch.trim()) return list;
    const q = workerSearch.toLowerCase();
    return list.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.skill && w.skill.toLowerCase().includes(q))
    );
  }, [data.workers, workerSearch, isWorkerLocked, selectedWorker]);

  // Wage calculation preview
  const wageCalc = useMemo(() => {
    if (!selectedWorker) return { base: 0, overtime: 0, total: 0, dailyRate: 0, otRate: 0 };
    const dailyRate = Number(selectedWorker.daily_rate) || 0;
    const otRate = Number(selectedWorker.overtime_rate) || 0;
    const unitMultiplier = Number(units);

    const base = dailyRate * unitMultiplier;
    const otMinutes = Math.max(0, Number(overtimeMinutes) || 0);
    // Overtime rate is per hour (60 mins)
    const overtime = (otMinutes / 60) * otRate;
    const total = base + overtime;

    return { base, overtime, total, dailyRate, otRate };
  }, [selectedWorker, units, overtimeMinutes]);

  // Format date nicely
  const formattedDate = useMemo(() => {
    if (!date) return 'Select Date';
    try {
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }, [date]);

  const isToday = date === today();

  // Overtime helpers
  const currentOtMins = Math.max(0, Number(overtimeMinutes) || 0);

  const handleSetOvertime = (mins: number) => {
    const val = Math.max(0, mins);
    setOvertimeMinutes(String(val));
  };

  const handleStepOvertime = (delta: number) => {
    const nextVal = Math.max(0, currentOtMins + delta);
    setOvertimeMinutes(String(nextVal));
  };

  // Convert minutes into human readable text (e.g. 90m -> 1 hr 30m)
  const formatOtDuration = (mins: number) => {
    if (mins <= 0) return '0 min';
    const hrs = Math.floor(mins / 60);
    const remainder = mins % 60;
    if (hrs > 0 && remainder > 0) {
      return `${hrs} hr ${remainder} min`;
    } else if (hrs > 0) {
      return `${hrs} hr${hrs > 1 ? 's' : ''}`;
    }
    return `${remainder} min`;
  };

  const formatRupees = (amount: number | string | undefined | null) => {
    const num = Number(amount) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const handleSave = () => {
    setLocalError('');
    if (!siteId) {
      setLocalError('Please select a work site.');
      return;
    }
    if (!workerId) {
      setLocalError('Please select a worker.');
      return;
    }
    if (!date) {
      setLocalError('Please pick a date.');
      return;
    }
    const todayStr = today();
    if (String(date).slice(0, 10) > todayStr) {
      setLocalError('Attendance cannot be marked for future dates.');
      return;
    }
    if (isCorrection && !notes.trim()) {
      setLocalError('Please provide a reason or note for this correction.');
      return;
    }

    onSave({
      site_id: siteId,
      worker_id: workerId,
      date,
      units,
      overtime_minutes: units === '0' ? '0' : String(currentOtMins),
      notes: notes.trim(),
    });
  };

  const displayError = localError || error;

  return (
    <Modal
      visible
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={() => !busy && onClose()}
      presentationStyle={isDesktop ? 'overFullScreen' : 'fullScreen'}
      transparent={isDesktop}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <SafeAreaView
          style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}
          edges={['top', 'bottom']}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconBadge}>
                  <AppIcon
                    name={isCorrection ? 'create' : 'calendar'}
                    size={20}
                    color="#2563EB"
                  />
                </View>
                <View>
                  <Text style={styles.headerTitle}>
                    {isCorrection ? 'Update Attendance' : 'Mark Attendance'}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {isCorrection
                      ? 'Update daily presence, half-day or overtime'
                      : 'Record daily attendance & overtime'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => !busy && onClose()}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Close"
              >
                <AppIcon name="close" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {/* Error Banner */}
            {displayError ? (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{displayError}</Text>
              </View>
            ) : null}

            {/* Scrollable Form Body */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollBody}
            >
              {/* 1. ATTENDANCE DATE CARD */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                  <Text style={styles.sectionTitle}>Attendance Date</Text>
                  {isToday && (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>Today</Text>
                    </View>
                  )}
                </View>

                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  style={({ pressed }) => [
                    styles.datePickerBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityLabel="Pick date"
                >
                  <View style={styles.dateIconBox}>
                    <AppIcon name="calendar" size={17} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.datePickerMainText}>{formattedDate}</Text>
                    <Text style={styles.datePickerSubText}>Tap to change date</Text>
                  </View>
                  <View style={styles.changeDateChip}>
                    <Text style={styles.changeDateChipText}>Change</Text>
                  </View>
                </Pressable>
              </View>

              {/* 2. WORK SITE SELECTOR (Full-Width Card) */}
              <View style={[styles.sectionCard, { zIndex: 30 }]}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="business-outline" size={16} color="#0284C7" />
                  <Text style={styles.sectionTitle}>Work Site *</Text>
                  <Text style={styles.sectionSubBadge}>Tap to change site</Text>
                </View>

                <View
                  style={[
                    styles.dropdownSelectorBtn,
                    styles.fullWidthSelectorBtn,
                    { position: 'relative' },
                  ]}
                >
                  <View style={styles.dropdownIconBoxSite}>
                    <AppIcon name="business" size={18} color="#0284C7" />
                  </View>
                  <View style={styles.dropdownContentCol}>
                    <Text style={styles.dropdownMainText} numberOfLines={1}>
                      {selectedSite?.name || 'Select Work Site'}
                    </Text>
                    <Text style={styles.dropdownSubText} numberOfLines={1}>
                      Project Site • Tap to change
                    </Text>
                  </View>
                  <AppIcon name="chevron-down" size={16} color="#64748B" />

                  {/* Universal Native Picker for Mobile & Web */}
                  <Picker
                    selectedValue={siteId}
                    onValueChange={(val: any) => setSiteId(String(val))}
                    style={styles.nativeHiddenPicker}
                    dropdownIconColor="transparent"
                    prompt="Select Work Site"
                  >
                    {data.sites.map((s) => (
                      <Picker.Item
                        key={s.id}
                        label={`🏢 ${s.name}`}
                        value={s.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* 4. WORKER SELECTOR (Only when worker is NOT locked) */}
              {!isWorkerLocked && (
                <View style={[styles.sectionCard, { zIndex: 25 }]}>
                  <View style={styles.sectionHeadingRow}>
                    <AppIcon name="people-outline" size={16} color="#2563EB" />
                    <Text style={styles.sectionTitle}>
                      Worker ({filteredWorkers.length}) *
                    </Text>
                    <Text style={styles.sectionSubBadge}>Tap to select</Text>
                  </View>

                  <View
                    style={[
                      styles.dropdownSelectorBtn,
                      styles.fullWidthSelectorBtn,
                      { position: 'relative' },
                    ]}
                  >
                    <View style={styles.dropdownIconBoxWorker}>
                      <Text style={styles.dropdownAvatarInitials}>
                        {(selectedWorker?.name || 'W').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.dropdownContentCol}>
                      <Text style={styles.dropdownMainText} numberOfLines={1}>
                        {selectedWorker?.name || 'Select Worker'}
                      </Text>
                      <Text style={styles.dropdownSubText} numberOfLines={1}>
                        {selectedWorker
                          ? `${selectedWorker.skill || 'Worker'} • ${formatRupees(selectedWorker.daily_rate)}/day`
                          : 'Tap to choose worker'}
                      </Text>
                    </View>
                    <AppIcon name="chevron-down" size={16} color="#64748B" />

                    <Picker
                      selectedValue={workerId}
                      onValueChange={(val: any) => setWorkerId(String(val))}
                      style={styles.nativeHiddenPicker}
                      dropdownIconColor="transparent"
                      prompt="Select Worker"
                    >
                      {data.workers.filter((w) => w.active).map((w) => (
                        <Picker.Item
                          key={w.id}
                          label={`👷 ${w.name}${w.skill ? ` (${w.skill})` : ''} - ${formatRupees(w.daily_rate)}/day`}
                          value={w.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              {/* 5. ATTENDANCE STATUS - 3 PROMINENT SEGMENTED CARDS */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="shield-checkmark-outline" size={16} color="#16A34A" />
                  <Text style={styles.sectionTitle}>Attendance Status *</Text>
                  <Text style={styles.sectionSubBadge}>Tap one to select</Text>
                </View>

                <View style={styles.statusSegmentedRow}>
                  {/* Option 1: Present (Full Day) */}
                  <Pressable
                    onPress={() => setUnits('1')}
                    style={({ pressed }) => [
                      styles.statusCardBtn,
                      units === '1' ? styles.statusCardActivePresent : styles.statusCardInactive,
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select Present Full Day"
                  >
                    <View style={[styles.statusCardIconBox, units === '1' && styles.statusCardIconBoxPresent]}>
                      <AppIcon
                        name="checkmark-circle"
                        size={20}
                        color={units === '1' ? '#15803D' : '#64748B'}
                      />
                    </View>
                    <Text style={[styles.statusCardTitle, units === '1' && styles.statusCardTitlePresent]}>
                      Present
                    </Text>
                    <Text style={[styles.statusCardSub, units === '1' && styles.statusCardSubPresent]}>
                      Full Day (1.0)
                    </Text>
                    <Text style={[styles.statusCardWage, units === '1' && styles.statusCardWagePresent]}>
                      {selectedWorker ? formatRupees(selectedWorker.daily_rate) : 'Full Day'}
                    </Text>
                  </Pressable>

                  {/* Option 2: Half Day */}
                  <Pressable
                    onPress={() => setUnits('0.5')}
                    style={({ pressed }) => [
                      styles.statusCardBtn,
                      units === '0.5' ? styles.statusCardActiveHalf : styles.statusCardInactive,
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select Half Day"
                  >
                    <View style={[styles.statusCardIconBox, units === '0.5' && styles.statusCardIconBoxHalf]}>
                      <AppIcon
                        name="time"
                        size={20}
                        color={units === '0.5' ? '#B45309' : '#64748B'}
                      />
                    </View>
                    <Text style={[styles.statusCardTitle, units === '0.5' && styles.statusCardTitleHalf]}>
                      Half Day
                    </Text>
                    <Text style={[styles.statusCardSub, units === '0.5' && styles.statusCardSubHalf]}>
                      0.5 Day
                    </Text>
                    <Text style={[styles.statusCardWage, units === '0.5' && styles.statusCardWageHalf]}>
                      {selectedWorker ? formatRupees(Math.round(Number(selectedWorker.daily_rate) * 0.5)) : 'Half Day'}
                    </Text>
                  </Pressable>

                  {/* Option 3: Absent */}
                  <Pressable
                    onPress={() => {
                      setUnits('0');
                      setOvertimeMinutes('0');
                    }}
                    style={({ pressed }) => [
                      styles.statusCardBtn,
                      units === '0' ? styles.statusCardActiveAbsent : styles.statusCardInactive,
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select Absent"
                  >
                    <View style={[styles.statusCardIconBox, units === '0' && styles.statusCardIconBoxAbsent]}>
                      <AppIcon
                        name="close-circle"
                        size={20}
                        color={units === '0' ? '#B91C1C' : '#64748B'}
                      />
                    </View>
                    <Text style={[styles.statusCardTitle, units === '0' && styles.statusCardTitleAbsent]}>
                      Absent
                    </Text>
                    <Text style={[styles.statusCardSub, units === '0' && styles.statusCardSubAbsent]}>
                      0 Day
                    </Text>
                    <Text style={[styles.statusCardWage, units === '0' && styles.statusCardWageAbsent]}>
                      ₹0
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 6. OVERTIME (OT) SECTION */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionHeadingLeft}>
                    <AppIcon name="time-outline" size={16} color="#0284C7" />
                    <Text style={styles.sectionTitle}>Overtime (OT)</Text>
                  </View>
                  <View style={styles.otRateHeaderBadge}>
                    <Text style={styles.otRateHeaderBadgeText}>
                      OT: {formatRupees(selectedWorker?.overtime_rate || 0)}/hr
                    </Text>
                  </View>
                </View>

                {units === '0' ? (
                  <View style={styles.otDisabledRow}>
                    <AppIcon name="information-circle-outline" size={16} color="#94A3B8" />
                    <Text style={styles.otDisabledText}>Overtime is not applicable for Absent</Text>
                  </View>
                ) : (
                  <View style={styles.otControlContainer}>
                    {/* Tap to open Clock Picker */}
                    <Pressable
                      onPress={() => setIsClockPickerOpen(true)}
                      style={({ pressed }) => [
                        styles.otClockBtnClean,
                        currentOtMins > 0 && styles.otClockBtnCleanActive,
                        pressed && { opacity: 0.85 },
                      ]}
                      accessibilityLabel="Open clock time picker"
                    >
                      <View
                        style={[
                          styles.otClockIconBadgeClean,
                          currentOtMins > 0 && styles.otClockIconBadgeCleanActive,
                        ]}
                      >
                        <AppIcon
                          name="time"
                          size={18}
                          color={currentOtMins > 0 ? '#1D4ED8' : '#0284C7'}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={[
                            styles.otClockMainText,
                            currentOtMins > 0 && styles.otClockMainTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {currentOtMins > 0 ? formatOtDuration(currentOtMins) : 'No Overtime (0 min)'}
                        </Text>
                        <Text style={styles.otClockSubText}>
                          {currentOtMins > 0
                            ? `Earns +${formatRupees(wageCalc.overtime)} extra`
                            : 'Tap to pick exact hours & minutes'}
                        </Text>
                      </View>
                      <View style={styles.otClockActionChip}>
                        <AppIcon name="stopwatch" size={13} color="#2563EB" />
                        <Text style={styles.otClockActionChipText}>Clock Picker</Text>
                      </View>
                    </Pressable>

                    {/* Quick Presets */}
                    <View style={styles.otQuickPresetsRow}>
                      <Text style={styles.otQuickPresetsLabel}>Quick Set:</Text>
                      <Pressable
                        onPress={() => handleSetOvertime(0)}
                        style={[styles.otQuickChip, currentOtMins === 0 && styles.otQuickChipActive]}
                      >
                        <Text style={[styles.otQuickChipText, currentOtMins === 0 && styles.otQuickChipTextActive]}>
                          0 min
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSetOvertime(30)}
                        style={[styles.otQuickChip, currentOtMins === 30 && styles.otQuickChipActive]}
                      >
                        <Text style={[styles.otQuickChipText, currentOtMins === 30 && styles.otQuickChipTextActive]}>
                          +30m
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSetOvertime(60)}
                        style={[styles.otQuickChip, currentOtMins === 60 && styles.otQuickChipActive]}
                      >
                        <Text style={[styles.otQuickChipText, currentOtMins === 60 && styles.otQuickChipTextActive]}>
                          +1 hr
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSetOvertime(120)}
                        style={[styles.otQuickChip, currentOtMins === 120 && styles.otQuickChipActive]}
                      >
                        <Text style={[styles.otQuickChipText, currentOtMins === 120 && styles.otQuickChipTextActive]}>
                          +2 hrs
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              {/* 7. LIVE WAGE PREVIEW CARD */}
              <View style={styles.wagePreviewCard}>
                <View style={styles.wagePreviewTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppIcon name="cash" size={17} color="#15803D" />
                    <Text style={styles.wagePreviewHeading}>Payable Wage for Today</Text>
                  </View>
                  {!isWorkerLocked && selectedWorker?.name ? (
                    <Text style={styles.wagePreviewWorkerName} numberOfLines={1}>
                      {selectedWorker.name}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.wageBreakdownRow}>
                  <View style={styles.wageCol}>
                    <Text style={styles.wageColLabel}>
                      Base ({units === '1' ? '1.0 Day' : units === '0.5' ? '0.5 Day' : '0 Day'})
                    </Text>
                    <Text style={styles.wageColVal}>{formatRupees(wageCalc.base)}</Text>
                  </View>
                  <Text style={styles.wageMathSign}>+</Text>
                  <View style={styles.wageCol}>
                    <Text style={styles.wageColLabel}>
                      OT ({currentOtMins}m)
                    </Text>
                    <Text style={styles.wageColVal}>{formatRupees(wageCalc.overtime)}</Text>
                  </View>
                  <Text style={styles.wageMathSign}>=</Text>
                  <View style={[styles.wageCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.wageColLabel}>Total Earned</Text>
                    <Text style={styles.wageTotalAmount}>{formatRupees(wageCalc.total)}</Text>
                  </View>
                </View>
              </View>

              {/* 8. NOTES / CORRECTION REASON */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="create-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.sectionTitle}>
                    {isCorrection ? 'Correction Reason *' : 'Remarks (Optional)'}
                  </Text>
                </View>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={
                    isCorrection
                      ? 'State why this record is being updated...'
                      : 'e.g. Worked on 2nd floor ceiling, arrived on time'
                  }
                  placeholderTextColor={Colors.textSubtle}
                  multiline
                  style={styles.notesInput}
                />
              </View>
            </ScrollView>

            {/* Bottom Action Footer */}
            <View style={styles.footerBar}>
              <Pressable
                onPress={() => !busy && onClose()}
                disabled={busy}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveBtn,
                  busy && { opacity: 0.6 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {isCorrection ? 'Update Attendance' : 'Save Attendance'}
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* Calendar Picker Modal */}
          {isCalendarOpen && (
            <CalendarPickerModal
              visible={isCalendarOpen}
              title="Select Attendance Date"
              selectedDate={date}
              maxDate={today()}
              onSelect={(newDate) => {
                if (newDate) {
                  if (newDate > today()) {
                    setLocalError('Attendance cannot be marked for future dates.');
                    return;
                  }
                  setDate(newDate);
                }
              }}
              onClose={() => setIsCalendarOpen(false)}
            />
          )}

          {/* Overtime Clock Picker Modal */}
          {isClockPickerOpen && (
            <ClockPickerModal
              visible={isClockPickerOpen}
              initialMinutes={currentOtMins}
              hourlyRate={Number(selectedWorker?.overtime_rate || 0)}
              onClose={() => setIsClockPickerOpen(false)}
              onConfirm={(newMins) => {
                setOvertimeMinutes(String(newMins));
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  modalCardDesktop: {
    maxWidth: 680,
    width: '100%',
    maxHeight: '94%',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  errorBannerText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  scrollBody: {
    padding: 16,
    gap: 14,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionSubBadge: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 'auto',
  },
  sectionCountText: {
    fontSize: 11,
    color: '#64748B',
  },
  dateDisplayRow: {
    marginTop: 2,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  dateIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  datePickerSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  changeDateChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeDateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayPill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginLeft: 'auto',
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },

  /* Dedicated Worker Profile Banner (When locked to single worker) */
  workerLockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  workerLockedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  workerLockedInitials: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  workerLockedInfo: {
    flex: 1,
    gap: 5,
  },
  workerLockedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  workerLockedName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
  },
  workerLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  workerLockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  workerLockedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  workerSkillPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  workerSkillPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  workerRatePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  workerRatePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  workerOtRatePill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  workerOtRatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },

  /* Full Width Selectors */
  fullWidthSelectorBtn: {
    width: '100%',
  },

  /* Segmented 3-Option Attendance Status */
  statusSegmentedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCardBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
    gap: 3,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  statusCardActivePresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  statusCardActiveHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  statusCardActiveAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  statusCardInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusCardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statusCardIconBoxPresent: {
    backgroundColor: '#DCFCE7',
  },
  statusCardIconBoxHalf: {
    backgroundColor: '#FEF3C7',
  },
  statusCardIconBoxAbsent: {
    backgroundColor: '#FEE2E2',
  },
  statusCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  statusCardTitlePresent: {
    color: '#15803D',
  },
  statusCardTitleHalf: {
    color: '#B45309',
  },
  statusCardTitleAbsent: {
    color: '#B91C1C',
  },
  statusCardSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statusCardSubPresent: {
    color: '#16A34A',
  },
  statusCardSubHalf: {
    color: '#D97706',
  },
  statusCardSubAbsent: {
    color: '#DC2626',
  },
  statusCardWage: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    marginTop: 2,
  },
  statusCardWagePresent: {
    color: '#15803D',
  },
  statusCardWageHalf: {
    color: '#B45309',
  },
  statusCardWageAbsent: {
    color: '#B91C1C',
  },

  /* Overtime (OT) Controls */
  otDisabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otDisabledText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  otControlContainer: {
    gap: 10,
  },
  otClockBtnClean: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  otClockBtnCleanActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  otClockIconBadgeClean: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otClockIconBadgeCleanActive: {
    backgroundColor: '#DBEAFE',
  },
  otClockMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  otClockMainTextActive: {
    color: '#1D4ED8',
  },
  otClockSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  otClockActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  otClockActionChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  otQuickPresetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  otQuickPresetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 2,
  },
  otQuickChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  otQuickChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  otQuickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  otQuickChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  /* Combined Dual Dropdown Card */
  dualDropdownRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  inlineSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 4,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  dropdownCol: {
    flex: 1,
    gap: 4,
  },
  dropdownFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 48,
  },
  dropdownSelectorBtnLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  lockedWorkerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIconBoxSite: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIconBoxWorker: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarInitials: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  dropdownContentCol: {
    flex: 1,
  },
  dropdownMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownSubText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  /* Combined Attendance & Overtime Single Row Card */
  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otRateHeaderBadge: {
    marginLeft: 'auto',
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
  otRateHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  statusOtRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  statusCol: {
    flex: 1,
    gap: 5,
  },
  otCol: {
    flex: 1,
    gap: 5,
  },
  colLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  /* Status Dropdown Trigger Button */
  statusDropdownBtn: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    minHeight: 48,
  },
  statusDropdownIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDropdownContent: {
    flex: 1,
  },
  statusDropdownMainText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusDropdownSubText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  /* Status Dropdown Menu (3 items) */
  statusDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 4,
    gap: 4,
    marginTop: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  statusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  statusMenuItemActive: {
    backgroundColor: '#F8FAFC',
  },
  statusMenuItemIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMenuItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusMenuItemDesc: {
    fontSize: 10,
    color: '#64748B',
  },
  statusMenuItemWage: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 2,
  },

  /* Overtime Clock Picker Trigger Button */
  otPickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  otPickerTriggerBtnActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  otPickerIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otPickerIconBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  otPickerContent: {
    flex: 1,
  },
  otPickerMainText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  otPickerMainTextActive: {
    color: '#1D4ED8',
  },
  otPickerSubText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  /* Disabled State for Absent */
  watchBoxDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 48,
  },
  watchIconBadgeDisabled: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchDisabledTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  watchDisabledSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  watchDisabledPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  watchDisabledPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  otEarnedHighlight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },

  /* Wage Preview Card */
  wagePreviewCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  wagePreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wagePreviewHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  wagePreviewWorkerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  wageBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  wageCol: {
    flex: 1,
  },
  wageColLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  wageColVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  wageMathSign: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  wageTotalAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16A34A',
    marginTop: 1,
  },

  /* Notes */
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
  },

  /* Footer */
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Picker Modals (Site & Worker Sheets) */
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 4,
  },
  pickerListScroll: {
    maxHeight: 340,
  },
  pickerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerListItemActive: {
    backgroundColor: '#F8FAFC',
  },
  pickerListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pickerAvatarSite: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarWorker: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarWorkerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
  },
  pickerItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  pickerEmptyText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  nativeHiddenPicker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
});
