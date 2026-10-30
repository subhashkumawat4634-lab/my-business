import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Snapshot, Row } from '../../types';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../context/ToastContext';
import { request, commandKey } from '../../api';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';

export interface BulkAttendancePageProps {
  data: Snapshot;
  initialSiteId?: string;
  siteId?: string;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

type AttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT';
type AttendanceFilterTab = 'PENDING' | 'MARKED' | 'ALL' | 'PRESENT' | 'ABSENT' | 'HALF_DAY';

// Format date to match format: e.g. "Thu, 23 Oct 2025"
const formatScreenshotDate = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export function BulkAttendancePage({
  data,
  initialSiteId,
  siteId,
  onBack,
  onRefresh,
  refreshing = false,
}: BulkAttendancePageProps) {
  const { t } = useLanguage();
  const { token } = useAuth();

  const effectiveSiteId = siteId || initialSiteId;

  // Selected Site
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    if (effectiveSiteId && data.sites.some((s) => s.id === effectiveSiteId)) {
      return effectiveSiteId;
    }
    return data.sites[0]?.id || '';
  });

  // Selected Date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(today());

  // Locally marked worker IDs in this session
  const [locallyMarkedWorkerIds, setLocallyMarkedWorkerIds] = useState<Set<string>>(new Set());

  // Active Filter Tab: 'PENDING' | 'MARKED' | 'ALL' | 'PRESENT' | 'ABSENT' | 'HALF_DAY'
  const [activeFilter, setActiveFilter] = useState<AttendanceFilterTab>('PENDING');

  // Modals state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Overtime / Notes modal state for specific worker
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [overtimeMinutes, setOvertimeMinutes] = useState<Record<string, number>>({});
  const [workerNotes, setWorkerNotes] = useState<Record<string, string>>({});

  // Active workers list
  const activeWorkers = useMemo(() => {
    return (data.workers || []).filter((w) => w.active);
  }, [data.workers]);

  // Selected site object
  const currentSite = useMemo(() => {
    return data.sites.find((s) => s.id === selectedSiteId) || data.sites[0];
  }, [data.sites, selectedSiteId]);

  // Map of worker attendance status: workerId -> 'PRESENT' | 'HALF_DAY' | 'ABSENT'
  const [workerStatus, setWorkerStatus] = useState<Record<string, AttendanceStatus>>({});
  const [initialStatusSnapshot, setInitialStatusSnapshot] = useState<Record<string, AttendanceStatus>>({});

  // Reset local marked workers when site or date changes
  useEffect(() => {
    setLocallyMarkedWorkerIds(new Set());
  }, [selectedSiteId, selectedDate]);

  // Set of worker IDs that already have an attendance record for this site & date
  const markedWorkerIdSet = useMemo(() => {
    const set = new Set<string>();
    (data.attendance || []).forEach((a) => {
      if (
        a.site_id === selectedSiteId &&
        String(a.date).slice(0, 10) === selectedDate
      ) {
        set.add(a.worker_id);
      }
    });
    locallyMarkedWorkerIds.forEach((id) => set.add(id));
    return set;
  }, [data.attendance, selectedSiteId, selectedDate, locallyMarkedWorkerIds]);

  // Pending vs Marked worker lists
  const pendingWorkers = useMemo(() => {
    return activeWorkers.filter((w) => !markedWorkerIdSet.has(w.id));
  }, [activeWorkers, markedWorkerIdSet]);

  const markedWorkers = useMemo(() => {
    return activeWorkers.filter((w) => markedWorkerIdSet.has(w.id));
  }, [activeWorkers, markedWorkerIdSet]);

  // Automatically adjust default filter when site/date changes
  useEffect(() => {
    if (pendingWorkers.length === 0 && markedWorkers.length > 0) {
      setActiveFilter('ALL');
    } else {
      setActiveFilter('PENDING');
    }
  }, [selectedSiteId, selectedDate, pendingWorkers.length, markedWorkers.length]);

  // Set of selected worker IDs (for the checkbox on the left)
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(() => {
    return new Set(activeWorkers.map((w) => w.id));
  });

  // Load existing records whenever selectedSiteId or selectedDate changes
  useEffect(() => {
    const statusMap: Record<string, AttendanceStatus> = {};
    const otMap: Record<string, number> = {};
    const notesMap: Record<string, string> = {};

    activeWorkers.forEach((w) => {
      const record = (data.attendance || []).find(
        (a) =>
          a.site_id === selectedSiteId &&
          a.worker_id === w.id &&
          String(a.date).slice(0, 10) === selectedDate
      );

      if (record) {
        if (Number(record.units) === 1) {
          statusMap[w.id] = 'PRESENT';
        } else if (Number(record.units) === 0.5) {
          statusMap[w.id] = 'HALF_DAY';
        } else {
          statusMap[w.id] = 'ABSENT';
        }
        otMap[w.id] = Number(record.overtime_minutes || 0);
        notesMap[w.id] = record.notes || '';
      } else {
        statusMap[w.id] = 'PRESENT';
        otMap[w.id] = 0;
        notesMap[w.id] = '';
      }
    });

    setWorkerStatus(statusMap);
    setInitialStatusSnapshot({ ...statusMap });
    setOvertimeMinutes(otMap);
    setWorkerNotes(notesMap);

    // If there are pending workers, select only pending workers by default
    const unrecordedWorkers = activeWorkers.filter((w) => !markedWorkerIdSet.has(w.id));
    if (unrecordedWorkers.length > 0) {
      setSelectedWorkerIds(new Set(unrecordedWorkers.map((w) => w.id)));
    } else {
      setSelectedWorkerIds(new Set(activeWorkers.map((w) => w.id)));
    }
  }, [selectedSiteId, selectedDate, data.attendance, activeWorkers, markedWorkerIdSet]);

  // Count metrics for the filter tabs
  const allCount = activeWorkers.length;
  const pendingCount = pendingWorkers.length;
  const markedCount = markedWorkers.length;

  const presentCount = useMemo(() => {
    return activeWorkers.filter((w) => (workerStatus[w.id] || 'PRESENT') === 'PRESENT').length;
  }, [activeWorkers, workerStatus]);

  const absentCount = useMemo(() => {
    return activeWorkers.filter((w) => workerStatus[w.id] === 'ABSENT').length;
  }, [activeWorkers, workerStatus]);

  const halfDayCount = useMemo(() => {
    return activeWorkers.filter((w) => workerStatus[w.id] === 'HALF_DAY').length;
  }, [activeWorkers, workerStatus]);

  // Filtered workers list based on active tab
  const displayedWorkers = useMemo(() => {
    return activeWorkers.filter((w) => {
      const isMarked = markedWorkerIdSet.has(w.id);
      const status = workerStatus[w.id] || 'PRESENT';

      if (activeFilter === 'PENDING') return !isMarked;
      if (activeFilter === 'MARKED') return isMarked;
      if (activeFilter === 'PRESENT') return status === 'PRESENT';
      if (activeFilter === 'ABSENT') return status === 'ABSENT';
      if (activeFilter === 'HALF_DAY') return status === 'HALF_DAY';
      return true;
    });
  }, [activeWorkers, workerStatus, activeFilter, markedWorkerIdSet]);

  // Toggle selection for a single worker
  const handleToggleWorker = (workerId: string) => {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  // Toggle Select All for currently displayed workers
  const isAllDisplayedSelected = useMemo(() => {
    if (displayedWorkers.length === 0) return false;
    return displayedWorkers.every((w) => selectedWorkerIds.has(w.id));
  }, [displayedWorkers, selectedWorkerIds]);

  const handleToggleSelectAll = () => {
    if (isAllDisplayedSelected) {
      setSelectedWorkerIds((prev) => {
        const next = new Set(prev);
        displayedWorkers.forEach((w) => next.delete(w.id));
        return next;
      });
    } else {
      setSelectedWorkerIds((prev) => {
        const next = new Set(prev);
        displayedWorkers.forEach((w) => next.add(w.id));
        return next;
      });
    }
  };

  // Cycle worker status: PRESENT -> HALF_DAY -> ABSENT -> PRESENT
  const cycleWorkerStatus = (workerId: string) => {
    setWorkerStatus((prev) => {
      const current = prev[workerId] || 'PRESENT';
      let next: AttendanceStatus = 'PRESENT';
      if (current === 'PRESENT') {
        next = 'HALF_DAY';
      } else if (current === 'HALF_DAY') {
        next = 'ABSENT';
      } else {
        next = 'PRESENT';
      }
      return { ...prev, [workerId]: next };
    });
  };

  // Check if any status has changed compared to initial
  const hasChanges = useMemo(() => {
    return activeWorkers.some(
      (w) => (workerStatus[w.id] || 'PRESENT') !== (initialStatusSnapshot[w.id] || 'PRESENT')
    );
  }, [activeWorkers, workerStatus, initialStatusSnapshot]);

  // Save attendance to backend
  const handleSaveAttendance = async (forceAllPresent = false) => {
    if (!token) {
      showToast('Please login to save attendance', 'w');
      return;
    }
    if (!selectedSiteId) {
      showToast('Please select a work site', 'w');
      return;
    }

    const pool = activeFilter === 'PENDING' ? pendingWorkers : activeWorkers;
    const targets = forceAllPresent
      ? pool
      : pool.filter((w) => selectedWorkerIds.has(w.id));

    if (targets.length === 0) {
      showToast('Please select at least one worker to mark attendance', 'w');
      return;
    }

    if (selectedDate > today()) {
      showToast('Attendance cannot be marked for future dates', 'w');
      return;
    }

    setIsSaving(true);
    try {
      for (const worker of targets) {
        const status = forceAllPresent ? 'PRESENT' : workerStatus[worker.id] || 'PRESENT';
        const units = status === 'PRESENT' ? 1 : status === 'HALF_DAY' ? 0.5 : 0;
        const ot = overtimeMinutes[worker.id] || 0;
        const notes = workerNotes[worker.id] || '';

        const payload = {
          action: 'attendance.save',
          data: {
            site_id: selectedSiteId,
            worker_id: worker.id,
            date: selectedDate,
            units,
            overtime_minutes: ot,
            notes,
          },
          key: commandKey(),
        };

        await request('/commands', token, payload);
      }

      // Add saved targets to local marked set so pending list updates immediately
      setLocallyMarkedWorkerIds((prev) => {
        const next = new Set(prev);
        targets.forEach((w) => next.add(w.id));
        return next;
      });

      if (forceAllPresent) {
        const allPresentMap: Record<string, AttendanceStatus> = {};
        activeWorkers.forEach((w) => {
          allPresentMap[w.id] = 'PRESENT';
        });
        setWorkerStatus(allPresentMap);
        setInitialStatusSnapshot(allPresentMap);
      } else {
        setInitialStatusSnapshot({ ...workerStatus });
      }

      showToast(
        forceAllPresent
          ? `All ${targets.length} workers marked Present successfully!`
          : `Attendance saved for ${targets.length} workers successfully!`,
        's'
      );

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save attendance', 'e');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* 1. APP-MATCHING CLEAN HEADER */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
          onPress={onBack}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Bulk Attendance</Text>
          <Text style={styles.headerSubtitle}>
            {currentSite?.name ? `${currentSite.name} • ` : ''}Mark attendance for all workers
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* 2. BODY CONTENT */}
      <View style={styles.sheetContainer}>
        {/* WORK SITE DROPDOWN (Native Picker with Scrollbar inside, NO POPUP) */}
        <View style={styles.selectorInputBox}>
          <Ionicons name="business" size={20} color="#2563EB" />
          <Text style={styles.selectorInputText} numberOfLines={1}>
            {currentSite?.name || 'Select Work Site'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#64748B" />

          {/* Universal Native Picker with built-in scroll bar on click */}
          <Picker
            selectedValue={selectedSiteId}
            onValueChange={(val: any) => setSelectedSiteId(String(val))}
            style={styles.nativeHiddenPicker}
            dropdownIconColor="transparent"
            prompt="Select Work Site"
          >
            {data.sites.map((s) => (
              <Picker.Item
                key={s.id}
                label={`🏢 ${s.name}${s.location ? ` (${s.location})` : ''}`}
                value={s.id}
              />
            ))}
          </Picker>
        </View>

        {/* DATE SELECTOR */}
        <Pressable
          style={({ pressed }) => [styles.selectorInputBox, pressed && { opacity: 0.85 }]}
          onPress={() => setIsCalendarOpen(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#2563EB" />
          <Text style={styles.selectorInputText} numberOfLines={1}>
            {formatScreenshotDate(selectedDate)}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </Pressable>

        {/* FILTER TABS ROW (SCROLLABLE STRIP) */}
        <View style={styles.filterTabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsScroll}
          >
            {/* Pending Tab */}
            <Pressable
              style={[
                styles.filterTabPill,
                activeFilter === 'PENDING'
                  ? styles.filterTabPillPendingActive
                  : styles.filterTabPillInactive,
              ]}
              onPress={() => setActiveFilter('PENDING')}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  activeFilter === 'PENDING'
                    ? styles.filterTabLabelPendingActive
                    : styles.filterTabLabelInactive,
                ]}
              >
                Pending ({pendingCount})
              </Text>
            </Pressable>

            {/* Marked Tab */}
            <Pressable
              style={[
                styles.filterTabPill,
                activeFilter === 'MARKED'
                  ? styles.filterTabPillMarkedActive
                  : styles.filterTabPillInactive,
              ]}
              onPress={() => setActiveFilter('MARKED')}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  activeFilter === 'MARKED'
                    ? styles.filterTabLabelMarkedActive
                    : styles.filterTabLabelInactive,
                ]}
              >
                Marked ({markedCount})
              </Text>
            </Pressable>

            {/* All Tab */}
            <Pressable
              style={[
                styles.filterTabPill,
                activeFilter === 'ALL' ? styles.filterTabPillActive : styles.filterTabPillInactive,
              ]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  activeFilter === 'ALL' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
                ]}
              >
                All ({allCount})
              </Text>
            </Pressable>

            {/* Present Tab */}
            <Pressable
              style={[
                styles.filterTabPill,
                activeFilter === 'PRESENT' ? styles.filterTabPillActive : styles.filterTabPillInactive,
              ]}
              onPress={() => setActiveFilter('PRESENT')}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  activeFilter === 'PRESENT' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
                ]}
              >
                Present ({presentCount})
              </Text>
            </Pressable>

            {/* Absent Tab */}
            <Pressable
              style={[
                styles.filterTabPill,
                activeFilter === 'ABSENT' ? styles.filterTabPillActive : styles.filterTabPillInactive,
              ]}
              onPress={() => setActiveFilter('ABSENT')}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  activeFilter === 'ABSENT' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
                ]}
              >
                Absent ({absentCount})
              </Text>
            </Pressable>

            {/* Half Day Tab */}
            <Pressable
              style={[
                styles.filterTabPill,
                activeFilter === 'HALF_DAY' ? styles.filterTabPillActive : styles.filterTabPillInactive,
              ]}
              onPress={() => setActiveFilter('HALF_DAY')}
            >
              <Text
                style={[
                  styles.filterTabLabel,
                  activeFilter === 'HALF_DAY' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
                ]}
              >
                Half Day ({halfDayCount})
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* SELECT ALL ROW */}
        {displayedWorkers.length > 0 && (
          <View style={styles.selectAllRow}>
            <Pressable
              style={styles.checkboxTouch}
              onPress={handleToggleSelectAll}
              hitSlop={8}
            >
              <View
                style={[
                  styles.checkboxSquare,
                  isAllDisplayedSelected && styles.checkboxSquareChecked,
                ]}
              >
                {isAllDisplayedSelected && (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.selectAllText}>
                Select All ({displayedWorkers.length})
              </Text>
            </Pressable>

            <Text style={styles.selectedCountBadge}>
              {selectedWorkerIds.size} selected
            </Text>
          </View>
        )}

        {/* WORKER LIST */}
        <ScrollView
          style={styles.workerListScroll}
          contentContainerStyle={styles.workerListContent}
          showsVerticalScrollIndicator={false}
        >
          {activeFilter === 'PENDING' && pendingCount === 0 ? (
            /* ALL ATTENDANCE MARKED CELEBRATION CARD */
            <View style={styles.allMarkedCard}>
              <View style={styles.allMarkedIconCircle}>
                <Ionicons name="checkmark-done-circle" size={48} color="#16A34A" />
              </View>
              <Text style={styles.allMarkedTitle}>All Attendance Marked!</Text>
              <Text style={styles.allMarkedSub}>
                {markedCount > 0
                  ? `All ${markedCount} active workers have their attendance recorded for ${formatScreenshotDate(selectedDate)} at ${currentSite?.name || 'this site'}.`
                  : 'No active workers found for this site.'}
              </Text>
              {markedCount > 0 && (
                <Pressable
                  style={styles.viewMarkedButton}
                  onPress={() => setActiveFilter('MARKED')}
                >
                  <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.viewMarkedButtonText}>
                    View Marked Workers ({markedCount})
                  </Text>
                </Pressable>
              )}
            </View>
          ) : displayedWorkers.length === 0 ? (
            <View style={styles.emptyListContainer}>
              <Ionicons name="people-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyListTitle}>No workers match this filter</Text>
              <Text style={styles.emptyListSub}>
                Try switching to the 'All' or 'Marked' tab.
              </Text>
            </View>
          ) : (
            displayedWorkers.map((worker) => {
              const isSelected = selectedWorkerIds.has(worker.id);
              const status = workerStatus[worker.id] || 'PRESENT';
              const isAlreadyMarked = markedWorkerIdSet.has(worker.id);
              const ot = overtimeMinutes[worker.id] || 0;

              return (
                <View key={worker.id} style={styles.workerRow}>
                  {/* Left Checkbox */}
                  <Pressable
                    style={styles.rowCheckboxArea}
                    onPress={() => handleToggleWorker(worker.id)}
                    hitSlop={8}
                  >
                    <View
                      style={[
                        styles.checkboxSquare,
                        isSelected && styles.checkboxSquareChecked,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>

                  {/* Worker Avatar */}
                  <View style={styles.workerAvatarCircle}>
                    {worker.photo ? (
                      <Image
                        source={{ uri: worker.photo }}
                        style={styles.workerAvatarImg}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatarMasonStack,
                          {
                            backgroundColor: '#EFF6FF',
                            width: '100%',
                            height: '100%',
                          },
                        ]}
                      >
                        <Ionicons name="person" size={22} color="#2563EB" />
                        <View style={styles.helmetBadgeSmall}>
                          <Ionicons name="construct" size={10} color="#78350F" />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Worker Info */}
                  <Pressable
                    style={styles.workerInfoCol}
                    onPress={() => setEditingWorkerId(worker.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.workerNameText} numberOfLines={1}>
                        {worker.name}
                      </Text>
                      {isAlreadyMarked && (
                        <View style={styles.markedBadge}>
                          <Text style={styles.markedBadgeText}>Saved</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.workerSubRow}>
                      <Text style={styles.workerRoleText} numberOfLines={1}>
                        {worker.role || 'Worker'}
                      </Text>
                      {ot > 0 && (
                        <View style={styles.overtimeBadge}>
                          <Ionicons name="time" size={11} color="#D97706" />
                          <Text style={styles.overtimeBadgeText}>
                            +{ot < 60 ? `${ot}m` : `${ot / 60}h`} OT
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>

                  {/* Right Status Pill (Tap to toggle: Present -> Half Day -> Absent) */}
                  <Pressable
                    style={[
                      styles.statusPillBtn,
                      status === 'PRESENT' && styles.statusPillPresent,
                      status === 'HALF_DAY' && styles.statusPillHalfDay,
                      status === 'ABSENT' && styles.statusPillAbsent,
                    ]}
                    onPress={() => cycleWorkerStatus(worker.id)}
                  >
                    {status === 'PRESENT' && (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                        <Text style={styles.statusPillTextPresent}>Present</Text>
                      </>
                    )}
                    {status === 'HALF_DAY' && (
                      <>
                        <Ionicons name="time" size={18} color="#D97706" />
                        <Text style={styles.statusPillTextHalfDay}>Half Day</Text>
                      </>
                    )}
                    {status === 'ABSENT' && (
                      <>
                        <Ionicons name="close-circle" size={18} color="#DC2626" />
                        <Text style={styles.statusPillTextAbsent}>Absent</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* 3. BOTTOM STICKY ACTION BUTTON */}
        {!(activeFilter === 'PENDING' && pendingCount === 0) && (
          <View style={styles.bottomBarContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryCtaBtn,
                isSaving && styles.primaryCtaBtnDisabled,
                pressed && !isSaving && { opacity: 0.9 },
              ]}
              onPress={() => {
                if (hasChanges) {
                  handleSaveAttendance(false);
                } else {
                  handleSaveAttendance(true);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <Text style={styles.primaryCtaText}>
                  {hasChanges ? 'Save Attendance' : 'Mark All Present'}
                </Text>
              )}
            </Pressable>

            {hasChanges && !isSaving && (
              <Pressable
                style={styles.subActionBtn}
                onPress={() => handleSaveAttendance(true)}
              >
                <Text style={styles.subActionText}>or Mark All Present</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* CALENDAR PICKER MODAL */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        selectedDate={selectedDate}
        maxDate={today()}
        title="Select Attendance Date"
        onSelect={(dateStr) => {
          if (dateStr > today()) {
            showToast('Cannot select a future date', 'w');
            return;
          }
          setSelectedDate(dateStr);
          setIsCalendarOpen(false);
        }}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* OPTIONAL OVERTIME & NOTES MODAL */}
      {editingWorkerId && (
        <Modal
          visible={!!editingWorkerId}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingWorkerId(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setEditingWorkerId(null)}
          >
            <View style={styles.otModalCard}>
              <View style={styles.sitePickerHeader}>
                <View>
                  <Text style={styles.sitePickerTitle}>
                    {activeWorkers.find((w) => w.id === editingWorkerId)?.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Overtime & Notes
                  </Text>
                </View>
                <Pressable
                  onPress={() => setEditingWorkerId(null)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color="#64748B" />
                </Pressable>
              </View>

              <Text style={styles.otSectionLabel}>Overtime Hours</Text>
              <View style={styles.otQuickBtnRow}>
                {[0, 30, 60, 120, 180].map((mins) => {
                  const currentOt = overtimeMinutes[editingWorkerId] || 0;
                  const isSelected = currentOt === mins;
                  const label =
                    mins === 0 ? 'None' : mins < 60 ? `${mins}m` : `${mins / 60}h`;
                  return (
                    <Pressable
                      key={mins}
                      style={[
                        styles.otQuickBtn,
                        isSelected && styles.otQuickBtnActive,
                      ]}
                      onPress={() =>
                        setOvertimeMinutes((prev) => ({
                          ...prev,
                          [editingWorkerId]: mins,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.otQuickBtnText,
                          isSelected && styles.otQuickBtnTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.otDoneBtn}
                onPress={() => setEditingWorkerId(null)}
              >
                <Text style={styles.otDoneBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  selectorInputBox: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
    position: 'relative',
  },
  selectorInputText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
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

  /* Filter Tabs Bar */
  filterTabsWrapper: {
    marginTop: 2,
    marginBottom: 12,
  },
  filterTabsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterTabPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabPillActive: {
    backgroundColor: '#2563EB',
  },
  filterTabPillPendingActive: {
    backgroundColor: '#EA580C',
  },
  filterTabPillMarkedActive: {
    backgroundColor: '#16A34A',
  },
  filterTabPillInactive: {
    backgroundColor: '#F1F5F9',
  },
  filterTabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterTabLabelPendingActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterTabLabelMarkedActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterTabLabelInactive: {
    color: '#64748B',
  },

  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 4,
  },
  checkboxTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  selectAllText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedCountBadge: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  workerListScroll: {
    flex: 1,
  },
  workerListContent: {
    paddingBottom: 16,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowCheckboxArea: {
    paddingRight: 6,
  },
  workerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  workerAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarMasonStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  helmetBadgeSmall: {
    position: 'absolute',
    top: -2,
    backgroundColor: '#FDE047',
    borderRadius: 8,
    padding: 2,
    zIndex: 2,
  },
  workerInfoCol: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  workerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  markedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  markedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  workerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  workerRoleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  overtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overtimeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  statusPillBtn: {
    minWidth: 105,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 5,
  },
  statusPillPresent: {
    backgroundColor: '#EBFBF2',
    borderColor: '#86EFAC',
  },
  statusPillTextPresent: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 13,
  },
  statusPillHalfDay: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  statusPillTextHalfDay: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 13,
  },
  statusPillAbsent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusPillTextAbsent: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  bottomBarContainer: {
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryCtaBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryCtaBtnDisabled: {
    opacity: 0.7,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subActionBtn: {
    marginTop: 6,
    alignItems: 'center',
  },
  subActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 10,
  },
  emptyListSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },

  /* All Marked Card */
  allMarkedCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  allMarkedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  allMarkedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 6,
  },
  allMarkedSub: {
    fontSize: 13,
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  viewMarkedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  viewMarkedButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  sitePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sitePickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  otSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  otQuickBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  otQuickBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otQuickBtnActive: {
    backgroundColor: '#2563EB',
  },
  otQuickBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  otQuickBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  otDoneBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
