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
  desc: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    units: '1',
    label: 'Present',
    desc: 'Full Day · 1.0',
    icon: 'checkmark-circle',
    color: '#15803D',
    bgColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  {
    units: '0.5',
    label: 'Half Day',
    desc: 'Half Day · 0.5',
    icon: 'time',
    color: '#B45309',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  {
    units: '0',
    label: 'Absent',
    desc: 'Chhutti · 0.0',
    icon: 'close-circle',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
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

  // Filtered active workers for worker picker
  const filteredWorkers = useMemo(() => {
    const list = data.workers.filter((w) => w.active);
    if (!workerSearch.trim()) return list;
    const q = workerSearch.toLowerCase();
    return list.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.skill && w.skill.toLowerCase().includes(q))
    );
  }, [data.workers, workerSearch]);

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
      animationType="slide"
      onRequestClose={() => !busy && onClose()}
      presentationStyle="pageSheet"
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
                  {isCorrection ? 'Correct Attendance' : 'Mark Daily Attendance'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isCorrection
                    ? 'Update presence, half-day or overtime'
                    : 'Record daily worker presence & haziri'}
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
            {/* 1. DATE SELECTOR SECTION */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                <Text style={styles.sectionTitle}>Attendance Date</Text>
              </View>

              <View style={styles.dateDisplayRow}>
                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  style={({ pressed }) => [
                    styles.datePickerBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityLabel="Pick date"
                >
                  <Text style={styles.datePickerText}>{formattedDate}</Text>
                  {isToday ? (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>Today</Text>
                    </View>
                  ) : null}
                  <View style={{ marginLeft: 'auto' }}>
                    <AppIcon
                      name="calendar"
                      size={18}
                      color="#2563EB"
                    />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* 2. COMBINED WORK SITE & WORKER SELECTOR CARD (Side-by-Side Dropdowns) */}
            <View style={[styles.sectionCard, { zIndex: 30 }]}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="business-outline" size={16} color="#0284C7" />
                <Text style={styles.sectionTitle}>Site & Worker</Text>
                <Text style={styles.sectionSubBadge}>Tap dropdown to select</Text>
              </View>

              <View style={styles.dualDropdownRow}>
                {/* Left Column: Work Site Dropdown / Select Bar */}
                <View style={styles.dropdownCol}>
                  <Text style={styles.dropdownFieldLabel}>Work Site *</Text>
                  <View
                    style={[
                      styles.dropdownSelectorBtn,
                      { position: 'relative' },
                    ]}
                  >
                    <View style={styles.dropdownIconBoxSite}>
                      <AppIcon name="business" size={16} color="#0284C7" />
                    </View>
                    <View style={styles.dropdownContentCol}>
                      <Text style={styles.dropdownMainText} numberOfLines={1}>
                        {selectedSite?.name || 'Select Site'}
                      </Text>
                      <Text style={styles.dropdownSubText} numberOfLines={1}>
                        {selectedSite?.owner_name
                          ? `Client: ${selectedSite.owner_name}`
                          : 'Select site'}
                      </Text>
                    </View>
                    <AppIcon
                      name="chevron-down"
                      size={15}
                      color="#64748B"
                    />

                    {/* Native HTML Select Bar */}
                    {Platform.OS === 'web' && (
                      <select
                        value={siteId}
                        onChange={(e: any) => setSiteId(e.target.value)}
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
                        title="Select Work Site"
                      >
                        {data.sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            🏢 {s.name} {s.owner_name ? `(Client: ${s.owner_name})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </View>

                  {/* Work Site Inline Dropdown Menu */}
                  {isSiteDropdownOpen && (
                    <View style={styles.statusDropdownMenu}>
                      {data.sites.length > 5 && (
                        <View style={styles.inlineSearchBox}>
                          <AppIcon name="search" size={13} color={Colors.textMuted} />
                          <TextInput
                            value={siteSearch}
                            onChangeText={setSiteSearch}
                            placeholder="Search site..."
                            placeholderTextColor={Colors.textSubtle}
                            style={styles.inlineSearchInput}
                          />
                        </View>
                      )}
                      <ScrollView
                        style={{ maxHeight: 220 }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {filteredSites.map((s) => {
                          const isSelected = s.id === siteId;
                          return (
                            <Pressable
                              key={s.id}
                              onPress={() => {
                                setSiteId(s.id);
                                setIsSiteDropdownOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.statusMenuItem,
                                isSelected && styles.statusMenuItemActive,
                                pressed && { opacity: 0.8 },
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusMenuItemIcon,
                                  { backgroundColor: isSelected ? '#E0F2FE' : '#F1F5F9' },
                                ]}
                              >
                                <AppIcon
                                  name="business"
                                  size={14}
                                  color={isSelected ? '#0284C7' : '#64748B'}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.statusMenuItemTitle,
                                    isSelected && { color: '#0284C7', fontWeight: '800' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {s.name}
                                </Text>
                                <Text style={styles.statusMenuItemDesc} numberOfLines={1}>
                                  {s.owner_name ? `Client: ${s.owner_name}` : 'No client specified'}
                                </Text>
                              </View>
                              {isSelected && (
                                <AppIcon name="checkmark" size={14} color="#0284C7" />
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Right Column: Select Worker Dropdown / Select Bar */}
                <View style={styles.dropdownCol}>
                  <Text style={styles.dropdownFieldLabel}>
                    Worker ({filteredWorkers.length}) *
                  </Text>
                  <View
                    style={[
                      styles.dropdownSelectorBtn,
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
                          ? `${selectedWorker.skill || 'Worker'} • ${money(selectedWorker.daily_rate)}/d`
                          : 'Select worker'}
                      </Text>
                    </View>
                    <AppIcon
                      name="chevron-down"
                      size={15}
                      color="#64748B"
                    />

                    {/* Native HTML Select Bar */}
                    {Platform.OS === 'web' && (
                      <select
                        value={workerId}
                        onChange={(e: any) => setWorkerId(e.target.value)}
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
                        title="Select Worker"
                      >
                        {data.workers.filter((w) => w.active).map((w) => (
                          <option key={w.id} value={w.id}>
                            👷 {w.name} {w.skill ? `(${w.skill})` : ''} — ₹{w.daily_rate}/day
                          </option>
                        ))}
                      </select>
                    )}
                  </View>

                  {/* Worker Inline Dropdown Menu */}
                  {isWorkerDropdownOpen && (
                    <View style={styles.statusDropdownMenu}>
                      {data.workers.length > 5 && (
                        <View style={styles.inlineSearchBox}>
                          <AppIcon name="search" size={13} color={Colors.textMuted} />
                          <TextInput
                            value={workerSearch}
                            onChangeText={setWorkerSearch}
                            placeholder="Search worker..."
                            placeholderTextColor={Colors.textSubtle}
                            style={styles.inlineSearchInput}
                          />
                        </View>
                      )}
                      <ScrollView
                        style={{ maxHeight: 220 }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {filteredWorkers.map((w) => {
                          const isSelected = w.id === workerId;
                          return (
                            <Pressable
                              key={w.id}
                              onPress={() => {
                                setWorkerId(w.id);
                                setIsWorkerDropdownOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.statusMenuItem,
                                isSelected && styles.statusMenuItemActive,
                                pressed && { opacity: 0.8 },
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusMenuItemIcon,
                                  { backgroundColor: isSelected ? '#EDE9FE' : '#F1F5F9' },
                                ]}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '800',
                                    color: isSelected ? '#7C3AED' : '#64748B',
                                  }}
                                >
                                  {(w.name || 'W').slice(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.statusMenuItemTitle,
                                    isSelected && { color: '#7C3AED', fontWeight: '800' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {w.name}
                                </Text>
                                <Text style={styles.statusMenuItemDesc} numberOfLines={1}>
                                  {w.skill || 'Worker'} • {money(w.daily_rate)}/d
                                </Text>
                              </View>
                              {isSelected && (
                                <AppIcon name="checkmark" size={14} color="#7C3AED" />
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* 3. COMBINED ATTENDANCE STATUS & OVERTIME (OT) CARD */}
            <View style={[styles.sectionCard, { zIndex: 20 }]}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionHeadingLeft}>
                  <AppIcon name="shield-checkmark-outline" size={16} color="#16A34A" />
                  <Text style={styles.sectionTitle}>Attendance & Overtime (OT)</Text>
                </View>
                <View style={styles.otRateHeaderBadge}>
                  <AppIcon name="time-outline" size={12} color="#0284C7" />
                  <Text style={styles.otRateHeaderBadgeText}>
                    OT: {money(selectedWorker?.overtime_rate || 0)}/hr
                  </Text>
                </View>
              </View>

              <View style={styles.statusOtRow}>
                {/* Left Column: Attendance Status Dropdown (3 Items) */}
                <View style={styles.statusCol}>
                  <View style={styles.colLabelRow}>
                    <Text style={styles.colLabel}>Attendance Status *</Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      setIsStatusDropdownOpen((prev) => !prev);
                      setIsSiteDropdownOpen(false);
                      setIsWorkerDropdownOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.statusDropdownBtn,
                      {
                        borderColor: currentStatusOpt.borderColor,
                        backgroundColor: isStatusDropdownOpen
                          ? '#F8FAFC'
                          : currentStatusOpt.bgColor,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityLabel="Select attendance status"
                  >
                    <View
                      style={[
                        styles.statusDropdownIconBadge,
                        { backgroundColor: currentStatusOpt.bgColor },
                      ]}
                    >
                      <AppIcon
                        name={currentStatusOpt.icon}
                        size={17}
                        color={currentStatusOpt.color}
                      />
                    </View>

                    <View style={styles.statusDropdownContent}>
                      <Text
                        style={[
                          styles.statusDropdownMainText,
                          { color: currentStatusOpt.color },
                        ]}
                        numberOfLines={1}
                      >
                        {currentStatusOpt.label}
                      </Text>
                      <Text style={styles.statusDropdownSubText} numberOfLines={1}>
                        {units === '1'
                          ? `Full Day (1.0) • ${money(selectedWorker ? selectedWorker.daily_rate : 0)}`
                          : units === '0.5'
                          ? `Half Day (0.5) • ${money(selectedWorker ? Math.round(Number(selectedWorker.daily_rate) * 0.5) : 0)}`
                          : 'Chhutti (0.0) • ₹0'}
                      </Text>
                    </View>

                    <AppIcon
                      name={isStatusDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color="#64748B"
                    />
                  </Pressable>

                  {/* Dropdown Options (when open) */}
                  {isStatusDropdownOpen && (
                    <View style={styles.statusDropdownMenu}>
                      {STATUS_OPTIONS.map((opt) => {
                        const isSelected = units === opt.units;
                        const wage =
                          opt.units === '1'
                            ? selectedWorker
                              ? selectedWorker.daily_rate
                              : 0
                            : opt.units === '0.5'
                            ? selectedWorker
                              ? Math.round(Number(selectedWorker.daily_rate) * 0.5)
                              : 0
                            : 0;

                        return (
                          <Pressable
                            key={opt.units}
                            onPress={() => {
                              setUnits(opt.units);
                              if (opt.units === '0') {
                                setOvertimeMinutes('0');
                              }
                              setIsStatusDropdownOpen(false);
                            }}
                            style={({ pressed }) => [
                              styles.statusMenuItem,
                              isSelected && styles.statusMenuItemActive,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusMenuItemIcon,
                                { backgroundColor: opt.bgColor },
                              ]}
                            >
                              <AppIcon name={opt.icon} size={15} color={opt.color} />
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.statusMenuItemTitle,
                                  isSelected && { color: opt.color, fontWeight: '800' },
                                ]}
                              >
                                {opt.label}
                              </Text>
                              <Text style={styles.statusMenuItemDesc}>{opt.desc}</Text>
                            </View>

                            <Text
                              style={[
                                styles.statusMenuItemWage,
                                isSelected && { color: opt.color, fontWeight: '800' },
                              ]}
                            >
                              {money(wage)}
                            </Text>

                            {isSelected && (
                              <AppIcon name="checkmark" size={14} color={opt.color} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Right Column: Overtime Watch / Clock Time Picker Button */}
                <View style={styles.otCol}>
                  <View style={styles.colLabelRow}>
                    <Text style={styles.colLabel}>Overtime (OT)</Text>
                    {currentOtMins > 0 && units !== '0' && (
                      <Text style={styles.otEarnedHighlight}>
                        +{money(wageCalc.overtime)}
                      </Text>
                    )}
                  </View>

                  {units === '0' ? (
                    /* Disabled State for Absent */
                    <View style={styles.watchBoxDisabled}>
                      <View style={styles.watchIconBadgeDisabled}>
                        <AppIcon name="stopwatch-outline" size={17} color="#94A3B8" />
                      </View>
                      <View style={styles.otPickerContent}>
                        <Text style={styles.watchDisabledTitle}>No Overtime</Text>
                        <Text style={styles.watchDisabledSub} numberOfLines={1}>
                          Absent worker has 0 OT
                        </Text>
                      </View>
                      <View style={styles.watchDisabledPill}>
                        <Text style={styles.watchDisabledPillText}>0h 00m</Text>
                      </View>
                    </View>
                  ) : (
                    /* Clean Clock Button - Tap to open interactive Clock Picker */
                    <Pressable
                      onPress={() => setIsClockPickerOpen(true)}
                      style={({ pressed }) => [
                        styles.otPickerTriggerBtn,
                        currentOtMins > 0 && styles.otPickerTriggerBtnActive,
                        pressed && { opacity: 0.85 },
                      ]}
                      accessibilityLabel="Open clock time picker"
                    >
                      <View
                        style={[
                          styles.otPickerIconBadge,
                          currentOtMins > 0 && styles.otPickerIconBadgeActive,
                        ]}
                      >
                        <AppIcon
                          name="time"
                          size={17}
                          color={currentOtMins > 0 ? '#1D4ED8' : '#0284C7'}
                        />
                      </View>

                      <View style={styles.otPickerContent}>
                        <Text
                          style={[
                            styles.otPickerMainText,
                            currentOtMins > 0 && styles.otPickerMainTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {currentOtMins > 0
                            ? formatOtDuration(currentOtMins)
                            : '0 min (No OT)'}
                        </Text>
                        <Text style={styles.otPickerSubText} numberOfLines={1}>
                          {currentOtMins > 0
                            ? `Overtime • +${money(wageCalc.overtime)}`
                            : 'Tap to set hours & mins'}
                        </Text>
                      </View>

                      <AppIcon name="chevron-forward" size={15} color="#64748B" />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* 5. LIVE WAGE PREVIEW CARD */}
            <View style={styles.wagePreviewCard}>
              <View style={styles.wagePreviewTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="cash" size={17} color="#15803D" />
                  <Text style={styles.wagePreviewHeading}>Today's Payable Wage</Text>
                </View>
                <Text style={styles.wagePreviewWorkerName} numberOfLines={1}>
                  {selectedWorker?.name}
                </Text>
              </View>

              <View style={styles.wageBreakdownRow}>
                <View style={styles.wageCol}>
                  <Text style={styles.wageColLabel}>Base ({units} day)</Text>
                  <Text style={styles.wageColVal}>{money(wageCalc.base)}</Text>
                </View>
                <Text style={styles.wageMathSign}>+</Text>
                <View style={styles.wageCol}>
                  <Text style={styles.wageColLabel}>
                    OT ({currentOtMins}m)
                  </Text>
                  <Text style={styles.wageColVal}>{money(wageCalc.overtime)}</Text>
                </View>
                <Text style={styles.wageMathSign}>=</Text>
                <View style={[styles.wageCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.wageColLabel}>Total Earned</Text>
                  <Text style={styles.wageTotalAmount}>{money(wageCalc.total)}</Text>
                </View>
              </View>
            </View>

            {/* 6. NOTES / CORRECTION REASON */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="create-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>
                  {isCorrection ? 'Correction Reason *' : 'Notes / Remarks (Optional)'}
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
                <>
                  <AppIcon name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {isCorrection ? 'Update Attendance' : 'Save Attendance'}
                  </Text>
                </>
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
            onSelect={(newDate) => {
              if (newDate) setDate(newDate);
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
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 48,
  },
  dropdownIconBoxSite: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownIconBoxWorker: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarInitials: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#E0F2FE',
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
    color: '#15803D',
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
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    color: '#15803D',
    marginTop: 1,
  },

  /* Notes */
  notesInput: {
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: Colors.primary,
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
});
