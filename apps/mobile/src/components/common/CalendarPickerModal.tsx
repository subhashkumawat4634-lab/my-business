import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface CalendarPickerModalProps {
  visible: boolean;
  title?: string;
  selectedDate?: string; // YYYY-MM-DD format
  minDate?: string; // YYYY-MM-DD format
  allowClear?: boolean;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatToISO = (year: number, month: number, day: number): string => {
  const y = String(year);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayHeader = (isoDate: string): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'No Date Selected';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function CalendarPickerModal({
  visible,
  title = 'Select Date',
  selectedDate = '',
  minDate = '',
  allowClear = false,
  onSelect,
  onClose,
}: CalendarPickerModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const todayIso = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }, []);

  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return parseInt(selectedDate.slice(0, 4), 10);
    }
    return new Date().getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return parseInt(selectedDate.slice(5, 7), 10) - 1;
    }
    return new Date().getMonth();
  });

  const [activeDate, setActiveDate] = useState<string>(selectedDate || todayIso);

  // Sync internal state when opened or prop changes
  useEffect(() => {
    if (visible) {
      const initial = selectedDate || todayIso;
      setActiveDate(initial);
      if (/^\d{4}-\d{2}-\d{2}$/.test(initial)) {
        setCurrentYear(parseInt(initial.slice(0, 4), 10));
        setCurrentMonth(parseInt(initial.slice(5, 7), 10) - 1);
      }
    }
  }, [visible, selectedDate, todayIso]);

  // Calendar month days calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells: Array<{
      day: number | null;
      isoString: string;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Empty slots before month start
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({
        day: null,
        isoString: '',
        isDisabled: true,
        isToday: false,
        isSelected: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = formatToISO(currentYear, currentMonth, d);
      const isDisabled = !!minDate && iso < minDate;
      const isToday = iso === todayIso;
      const isSelected = iso === activeDate;

      cells.push({
        day: d,
        isoString: iso,
        isDisabled,
        isToday,
        isSelected,
      });
    }

    return cells;
  }, [currentYear, currentMonth, minDate, todayIso, activeDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (iso: string, disabled: boolean) => {
    if (disabled || !iso) return;
    setActiveDate(iso);
  };

  // Quick Shortcuts
  const applyQuickShortcut = (daysToAdd: number) => {
    const base = new Date();
    base.setDate(base.getDate() + daysToAdd);
    const iso = base.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (minDate && iso < minDate) return;
    setActiveDate(iso);
    setCurrentYear(base.getFullYear());
    setCurrentMonth(base.getMonth());
  };

  const applyMonthsShortcut = (monthsToAdd: number) => {
    const base = new Date();
    base.setMonth(base.getMonth() + monthsToAdd);
    const iso = base.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (minDate && iso < minDate) return;
    setActiveDate(iso);
    setCurrentYear(base.getFullYear());
    setCurrentMonth(base.getMonth());
  };

  const handleConfirm = () => {
    onSelect(activeDate);
    onClose();
  };

  const handleClear = () => {
    onSelect('');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <View style={[styles.dialogCard, isDesktop && styles.desktopDialogCard]}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dialogTitle}>{title}</Text>
              <Text style={styles.selectedDisplayDate}>
                {formatDisplayHeader(activeDate)}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeIconBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Close calendar"
            >
              <AppIcon name="close" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Quick Preset Buttons */}
          <View style={styles.quickPillsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPillsScroll}
            >
              <Pressable
                onPress={() => applyQuickShortcut(0)}
                style={[
                  styles.quickPill,
                  activeDate === todayIso && styles.quickPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickPillText,
                    activeDate === todayIso && styles.quickPillTextActive,
                  ]}
                >
                  Today
                </Text>
              </Pressable>

              <Pressable
                onPress={() => applyQuickShortcut(1)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText}>Tomorrow</Text>
              </Pressable>

              <Pressable
                onPress={() => applyQuickShortcut(7)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText}>+7 Days</Text>
              </Pressable>

              <Pressable
                onPress={() => applyQuickShortcut(15)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText}>+15 Days</Text>
              </Pressable>

              <Pressable
                onPress={() => applyMonthsShortcut(1)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText}>+1 Month</Text>
              </Pressable>

              <Pressable
                onPress={() => applyMonthsShortcut(3)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText}>+3 Months</Text>
              </Pressable>

              <Pressable
                onPress={() => applyMonthsShortcut(6)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText}>+6 Months</Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Month & Year Navigator */}
          <View style={styles.monthNavRow}>
            <Pressable
              onPress={handlePrevMonth}
              style={({ pressed }) => [
                styles.navArrowBtn,
                pressed && { backgroundColor: Colors.surfaceSubtle },
              ]}
              accessibilityLabel="Previous month"
            >
              <AppIcon name="chevron-back" size={20} color={Colors.textPrimary} />
            </Pressable>

            <View style={styles.monthYearBox}>
              <Text style={styles.monthYearText}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
            </View>

            <Pressable
              onPress={handleNextMonth}
              style={({ pressed }) => [
                styles.navArrowBtn,
                pressed && { backgroundColor: Colors.surfaceSubtle },
              ]}
              accessibilityLabel="Next month"
            >
              <AppIcon
                name="chevron-forward"
                size={20}
                color={Colors.textPrimary}
              />
            </Pressable>
          </View>

          {/* Day of Week Headers */}
          <View style={styles.weekDaysRow}>
            {WEEK_DAYS.map((wd, idx) => (
              <View key={wd} style={styles.weekDayCell}>
                <Text
                  style={[
                    styles.weekDayText,
                    idx === 0 && { color: Colors.danger },
                  ]}
                >
                  {wd}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarCells.map((cell, idx) => {
              if (cell.day === null) {
                return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
              }

              return (
                <Pressable
                  key={cell.isoString}
                  onPress={() => handleSelectDay(cell.isoString, cell.isDisabled)}
                  disabled={cell.isDisabled}
                  style={({ pressed }) => [
                    styles.dayCell,
                    cell.isToday && styles.dayCellToday,
                    cell.isSelected && styles.dayCellSelected,
                    cell.isDisabled && styles.dayCellDisabled,
                    pressed && !cell.isDisabled && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      cell.isToday && styles.dayTextToday,
                      cell.isSelected && styles.dayTextSelected,
                      cell.isDisabled && styles.dayTextDisabled,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {cell.isToday && !cell.isSelected && (
                    <View style={styles.todayIndicatorDot} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            {allowClear ? (
              <Pressable
                onPress={handleClear}
                style={({ pressed }) => [
                  styles.clearBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <AppIcon name="trash-outline" size={16} color={Colors.danger} />
                <Text style={styles.clearBtnText}>Clear Date</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <View style={styles.actionButtonsRight}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  desktopDialogCard: {
    maxWidth: 420,
    padding: 24,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  selectedDisplayDate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPillsWrap: {
    marginBottom: 14,
  },
  quickPillsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  quickPillTextActive: {
    color: '#FFFFFF',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearBox: {
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 34,
  },
  dayCell: {
    width: '14.28%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    marginVertical: 1,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: Colors.textMuted,
  },
  todayIndicatorDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
  },
  actionButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
