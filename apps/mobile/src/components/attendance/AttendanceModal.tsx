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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Row, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
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

export function AttendanceModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: AttendanceModalProps) {
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
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [isWorkerPickerOpen, setIsWorkerPickerOpen] = useState(false);

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

  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

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
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
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
                  <AppIcon name="calendar" size={18} color="#2563EB" />
                  <Text style={styles.datePickerText}>{formattedDate}</Text>
                  {isToday ? (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>Today</Text>
                    </View>
                  ) : null}
                  <View style={{ marginLeft: 'auto' }}>
                    <AppIcon
                      name="chevron-forward"
                      size={16}
                      color={Colors.textMuted}
                    />
                  </View>
                </Pressable>
              </View>

              {/* Quick Date Chips */}
              <View style={styles.quickDateRow}>
                <Pressable
                  onPress={() => setDate(today())}
                  style={[
                    styles.quickDateChip,
                    isToday && styles.quickDateChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickDateChipText,
                      isToday && styles.quickDateChipTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setDate(getYesterday())}
                  style={[
                    styles.quickDateChip,
                    date === getYesterday() && styles.quickDateChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickDateChipText,
                      date === getYesterday() && styles.quickDateChipTextActive,
                    ]}
                  >
                    Yesterday
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  style={styles.pickCalendarChip}
                >
                  <AppIcon name="calendar-outline" size={13} color="#2563EB" />
                  <Text style={styles.pickCalendarChipText}>Choose Date</Text>
                </Pressable>
              </View>
            </View>

            {/* 2. COMBINED WORK SITE & WORKER SELECTOR CARD (Side-by-Side Dropdowns) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="business-outline" size={16} color="#0284C7" />
                <Text style={styles.sectionTitle}>Site & Worker</Text>
                <Text style={styles.sectionSubBadge}>Tap dropdown to select</Text>
              </View>

              <View style={styles.dualDropdownRow}>
                {/* Left Column: Work Site Dropdown */}
                <View style={styles.dropdownCol}>
                  <Text style={styles.dropdownFieldLabel}>Work Site *</Text>
                  <Pressable
                    onPress={() => {
                      setSiteSearch('');
                      setIsSitePickerOpen(true);
                    }}
                    style={({ pressed }) => [
                      styles.dropdownSelectorBtn,
                      pressed && { opacity: 0.85, borderColor: '#2563EB' },
                    ]}
                    accessibilityLabel="Select work site"
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
                          : 'Tap to change site'}
                      </Text>
                    </View>
                    <AppIcon name="chevron-down" size={15} color="#64748B" />
                  </Pressable>
                </View>

                {/* Right Column: Select Worker Dropdown */}
                <View style={styles.dropdownCol}>
                  <Text style={styles.dropdownFieldLabel}>
                    Worker ({filteredWorkers.length}) *
                  </Text>
                  <Pressable
                    onPress={() => {
                      setWorkerSearch('');
                      setIsWorkerPickerOpen(true);
                    }}
                    style={({ pressed }) => [
                      styles.dropdownSelectorBtn,
                      pressed && { opacity: 0.85, borderColor: '#7C3AED' },
                    ]}
                    accessibilityLabel="Select worker"
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
                          : 'Tap to choose worker'}
                      </Text>
                    </View>
                    <AppIcon name="chevron-down" size={15} color="#64748B" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 3. ATTENDANCE STATUS (FULL DAY / HALF DAY / ABSENT) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="shield-checkmark-outline" size={16} color="#16A34A" />
                <Text style={styles.sectionTitle}>Attendance Status</Text>
              </View>

              <View style={styles.statusCardsRow}>
                {/* FULL DAY (1.0) */}
                <Pressable
                  onPress={() => setUnits('1')}
                  style={[
                    styles.statusOptionCard,
                    styles.statusOptionPresent,
                    units === '1' && styles.statusOptionPresentActive,
                  ]}
                >
                  <View style={styles.statusOptionTop}>
                    <AppIcon
                      name="checkmark-circle"
                      size={20}
                      color={units === '1' ? '#15803D' : '#16A34A'}
                    />
                    <Text
                      style={[
                        styles.statusOptionTitle,
                        units === '1' && styles.statusOptionTitlePresentActive,
                      ]}
                    >
                      Present
                    </Text>
                  </View>
                  <Text style={styles.statusOptionDesc}>Full Day · 1.0</Text>
                  <Text style={styles.statusWageTag}>
                    {money(selectedWorker ? selectedWorker.daily_rate : 0)}
                  </Text>
                </Pressable>

                {/* HALF DAY (0.5) */}
                <Pressable
                  onPress={() => setUnits('0.5')}
                  style={[
                    styles.statusOptionCard,
                    styles.statusOptionHalf,
                    units === '0.5' && styles.statusOptionHalfActive,
                  ]}
                >
                  <View style={styles.statusOptionTop}>
                    <AppIcon
                      name="time"
                      size={20}
                      color={units === '0.5' ? '#B45309' : '#D97706'}
                    />
                    <Text
                      style={[
                        styles.statusOptionTitle,
                        units === '0.5' && styles.statusOptionTitleHalfActive,
                      ]}
                    >
                      Half Day
                    </Text>
                  </View>
                  <Text style={styles.statusOptionDesc}>Half Day · 0.5</Text>
                  <Text style={styles.statusWageTag}>
                    {money(
                      selectedWorker
                        ? Math.round(Number(selectedWorker.daily_rate) * 0.5)
                        : 0
                    )}
                  </Text>
                </Pressable>

                {/* ABSENT (0.0) */}
                <Pressable
                  onPress={() => {
                    setUnits('0');
                    setOvertimeMinutes('0');
                  }}
                  style={[
                    styles.statusOptionCard,
                    styles.statusOptionAbsent,
                    units === '0' && styles.statusOptionAbsentActive,
                  ]}
                >
                  <View style={styles.statusOptionTop}>
                    <AppIcon
                      name="close-circle"
                      size={20}
                      color={units === '0' ? '#B91C1C' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.statusOptionTitle,
                        units === '0' && styles.statusOptionTitleAbsentActive,
                      ]}
                    >
                      Absent
                    </Text>
                  </View>
                  <Text style={styles.statusOptionDesc}>Chhutti · 0.0</Text>
                  <Text style={styles.statusWageTag}>₹ 0</Text>
                </Pressable>
              </View>
            </View>

            {/* 4. OVERTIME (OT) SECTION - Enhanced & Bulletproof */}
            {units !== '0' && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="time-outline" size={16} color="#D97706" />
                  <Text style={styles.sectionTitle}>Overtime (OT)</Text>
                  <Text style={styles.sectionCountText}>
                    ({money(selectedWorker?.overtime_rate || 0)}/hr rate)
                  </Text>
                </View>

                {/* Overtime Quick Chips */}
                <View style={styles.otChipsRow}>
                  {[
                    { label: 'No OT', mins: 0 },
                    { label: '+30 min', mins: 30 },
                    { label: '+1 hr (60m)', mins: 60 },
                    { label: '+1.5 hr (90m)', mins: 90 },
                    { label: '+2 hrs (120m)', mins: 120 },
                    { label: '+3 hrs (180m)', mins: 180 },
                    { label: '+4 hrs (240m)', mins: 240 },
                  ].map((o) => {
                    const isSelected = currentOtMins === o.mins;
                    return (
                      <Pressable
                        key={o.mins}
                        onPress={() => handleSetOvertime(o.mins)}
                        style={[
                          styles.otChip,
                          isSelected && styles.otChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.otChipText,
                            isSelected && styles.otChipTextActive,
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Direct Custom Minutes Input */}
                <View style={styles.otInputRow}>
                  <Text style={styles.otInputLabel}>Custom OT Minutes:</Text>
                  <View style={styles.otInputBox}>
                    <TextInput
                      value={overtimeMinutes === '0' ? '' : overtimeMinutes}
                      onChangeText={(t) => {
                        const sanitized = t.replace(/[^0-9]/g, '');
                        setOvertimeMinutes(sanitized ? String(parseInt(sanitized, 10)) : '0');
                      }}
                      onBlur={() => {
                        if (!overtimeMinutes.trim()) {
                          setOvertimeMinutes('0');
                        }
                      }}
                      placeholder="0"
                      placeholderTextColor={Colors.textSubtle}
                      keyboardType="numeric"
                      style={styles.otTextInput}
                    />
                    <Text style={styles.otUnitText}>mins</Text>
                  </View>
                  {currentOtMins > 0 ? (
                    <Text style={styles.otEarnedHighlight}>
                      + {money(wageCalc.overtime)} ({formatOtDuration(currentOtMins)})
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

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
      </SafeAreaView>

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        title="Select Attendance Date"
        selectedDate={date}
        onSelect={(newDate) => {
          if (newDate) setDate(newDate);
        }}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* Site Picker Modal */}
      <Modal
        visible={isSitePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSitePickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppIcon name="business" size={18} color="#0284C7" />
                <Text style={styles.pickerTitle}>Select Work Site</Text>
              </View>
              <Pressable
                onPress={() => setIsSitePickerOpen(false)}
                style={styles.pickerCloseBtn}
              >
                <AppIcon name="close" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {data.sites.length > 3 && (
              <View style={styles.pickerSearchBox}>
                <AppIcon name="search" size={15} color={Colors.textMuted} />
                <TextInput
                  value={siteSearch}
                  onChangeText={setSiteSearch}
                  placeholder="Search work site or client..."
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.pickerSearchInput}
                />
                {siteSearch ? (
                  <Pressable onPress={() => setSiteSearch('')}>
                    <AppIcon name="close-circle" size={15} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            )}

            <ScrollView style={styles.pickerListScroll}>
              {filteredSites.map((s) => {
                const isSelected = s.id === siteId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setSiteId(s.id);
                      setIsSitePickerOpen(false);
                    }}
                    style={[
                      styles.pickerListItem,
                      isSelected && styles.pickerListItemActive,
                    ]}
                  >
                    <View style={styles.pickerListLeft}>
                      <View
                        style={[
                          styles.pickerAvatarSite,
                          isSelected && { backgroundColor: '#DBEAFE' },
                        ]}
                      >
                        <AppIcon
                          name="business"
                          size={16}
                          color={isSelected ? '#2563EB' : '#0284C7'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerItemTitle,
                            isSelected && { color: '#1D4ED8', fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                        {s.owner_name ? (
                          <Text style={styles.pickerItemSub} numberOfLines={1}>
                            Client: {s.owner_name}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {isSelected && (
                      <AppIcon name="checkmark-circle" size={18} color="#2563EB" />
                    )}
                  </Pressable>
                );
              })}

              {!filteredSites.length && (
                <Text style={styles.pickerEmptyText}>No sites found.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Worker Picker Modal */}
      <Modal
        visible={isWorkerPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWorkerPickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppIcon name="people" size={18} color="#7C3AED" />
                <Text style={styles.pickerTitle}>
                  Select Worker ({filteredWorkers.length})
                </Text>
              </View>
              <Pressable
                onPress={() => setIsWorkerPickerOpen(false)}
                style={styles.pickerCloseBtn}
              >
                <AppIcon name="close" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.pickerSearchBox}>
              <AppIcon name="search" size={15} color={Colors.textMuted} />
              <TextInput
                value={workerSearch}
                onChangeText={setWorkerSearch}
                placeholder="Search worker by name or skill..."
                placeholderTextColor={Colors.textSubtle}
                style={styles.pickerSearchInput}
              />
              {workerSearch ? (
                <Pressable onPress={() => setWorkerSearch('')}>
                  <AppIcon name="close-circle" size={15} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={styles.pickerListScroll}>
              {filteredWorkers.map((w) => {
                const isSelected = w.id === workerId;
                const initials = (w.name || 'W').slice(0, 2).toUpperCase();
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      setWorkerId(w.id);
                      setIsWorkerPickerOpen(false);
                    }}
                    style={[
                      styles.pickerListItem,
                      isSelected && styles.pickerListItemActive,
                    ]}
                  >
                    <View style={styles.pickerListLeft}>
                      <View
                        style={[
                          styles.pickerAvatarWorker,
                          isSelected && { backgroundColor: '#EDE9FE' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickerAvatarWorkerText,
                            isSelected && { color: '#6D28D9' },
                          ]}
                        >
                          {initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerItemTitle,
                            isSelected && { color: '#6D28D9', fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                        >
                          {w.name}
                        </Text>
                        <Text style={styles.pickerItemSub} numberOfLines={1}>
                          {w.skill || 'Worker'} • {money(w.daily_rate)}/day (OT: {money(w.overtime_rate || 0)}/hr)
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <AppIcon name="checkmark-circle" size={18} color="#7C3AED" />
                    )}
                  </Pressable>
                );
              })}

              {!filteredWorkers.length && (
                <Text style={styles.pickerEmptyText}>No workers found.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
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
  pickCalendarChip: {
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
  pickCalendarChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  /* Combined Dual Dropdown Card */
  dualDropdownRow: {
    flexDirection: 'row',
    gap: 10,
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

  /* Status Cards */
  statusCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusOptionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  statusOptionPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusOptionPresentActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  statusOptionHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusOptionHalfActive: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  statusOptionAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusOptionAbsentActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  statusOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  statusOptionTitlePresentActive: {
    color: '#15803D',
  },
  statusOptionTitleHalfActive: {
    color: '#B45309',
  },
  statusOptionTitleAbsentActive: {
    color: '#B91C1C',
  },
  statusOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusWageTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  /* Overtime Chips & Custom Input */
  otChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  otChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  otChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  otChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  otChipTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },

  /* Custom OT Input */
  otInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  otInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  otInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    height: 36,
    width: 90,
  },
  otTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    paddingVertical: 2,
  },
  otUnitText: {
    fontSize: 11,
    color: '#64748B',
  },
  otEarnedHighlight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    marginLeft: 'auto',
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
