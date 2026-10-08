import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { AppIcon } from '../icons/AppIcon';
import { Colors } from '../../theme/colors';
import { money } from '../../finance';

export interface ClockPickerModalProps {
  visible: boolean;
  initialMinutes: number;
  hourlyRate?: number;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
}


const QUICK_PRESETS = [
  { label: '0 min (No OT)', mins: 0 },
  { label: '30 min', mins: 30 },
  { label: '1 hr', mins: 60 },
  { label: '1.5 hr', mins: 90 },
  { label: '2 hr', mins: 120 },
  { label: '2.5 hr', mins: 150 },
  { label: '3 hr', mins: 180 },
  { label: '4 hr', mins: 240 },
];

export function ClockPickerModal({
  visible,
  initialMinutes,
  hourlyRate = 0,
  onClose,
  onConfirm,
}: ClockPickerModalProps) {
  // Direct simple hours & minutes state
  const [selectedHours, setSelectedHours] = useState<number>(() =>
    Math.floor((initialMinutes || 0) / 60)
  );
  const [selectedMinutes, setSelectedMinutes] = useState<number>(() =>
    (initialMinutes || 0) % 60
  );

  // Sync state whenever modal opens
  useEffect(() => {
    if (visible) {
      const h = Math.floor((initialMinutes || 0) / 60);
      const m = (initialMinutes || 0) % 60;
      setSelectedHours(h);
      setSelectedMinutes(m);
    }
  }, [visible, initialMinutes]);

  const totalMinutes = useMemo(
    () => selectedHours * 60 + selectedMinutes,
    [selectedHours, selectedMinutes]
  );

  // Earned overtime amount
  const earnedAmount = useMemo(() => {
    if (hourlyRate <= 0) return 0;
    return Math.round((totalMinutes / 60) * hourlyRate);
  }, [totalMinutes, hourlyRate]);

  // Formatted duration text (e.g. 2 hr 30 min)
  const formattedDuration = useMemo(() => {
    if (totalMinutes <= 0) return '0 min (No OT)';
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
    if (hrs > 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
    return `${mins} min`;
  }, [totalMinutes]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <AppIcon name="time" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Select Overtime Time</Text>
                <Text style={styles.modalSubtitle}>
                  Choose hours & minutes easily
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Close"
            >
              <AppIcon name="close" size={18} color={Colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Digital Clock Display & Steppers Banner */}
            <View style={styles.clockHeroCard}>
              <View style={styles.timeDisplayRow}>
                {/* Hours Box with +/- */}
                <View style={styles.unitControlCol}>
                  <Text style={styles.unitControlHeader}>HOURS</Text>
                  <View style={styles.stepperBox}>
                    <Pressable
                      onPress={() => setSelectedHours((prev) => Math.max(0, prev - 1))}
                      disabled={selectedHours === 0}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        selectedHours === 0 && styles.stepperBtnDisabled,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityLabel="Decrease hours"
                    >
                      <AppIcon name="remove" size={14} color={selectedHours === 0 ? '#94A3B8' : '#1D4ED8'} />
                    </Pressable>

                    <Text style={styles.stepperValueText}>
                      {String(selectedHours).padStart(2, '0')}
                    </Text>

                    <Pressable
                      onPress={() => setSelectedHours((prev) => Math.min(12, prev + 1))}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityLabel="Increase hours"
                    >
                      <AppIcon name="add" size={14} color="#1D4ED8" />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.timeColonText}>:</Text>

                {/* Minutes Box with +/- */}
                <View style={styles.unitControlCol}>
                  <Text style={styles.unitControlHeader}>MINUTES</Text>
                  <View style={styles.stepperBox}>
                    <Pressable
                      onPress={() => {
                        const step = [0, 15, 30, 45];
                        const currIdx = step.indexOf(selectedMinutes);
                        if (currIdx > 0) {
                          setSelectedMinutes(step[currIdx - 1]);
                        } else if (selectedMinutes > 0) {
                          setSelectedMinutes(0);
                        }
                      }}
                      disabled={selectedMinutes === 0}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        selectedMinutes === 0 && styles.stepperBtnDisabled,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityLabel="Decrease minutes"
                    >
                      <AppIcon name="remove" size={14} color={selectedMinutes === 0 ? '#94A3B8' : '#1D4ED8'} />
                    </Pressable>

                    <Text style={styles.stepperValueText}>
                      {String(selectedMinutes).padStart(2, '0')}
                    </Text>

                    <Pressable
                      onPress={() => {
                        const step = [0, 15, 30, 45];
                        const currIdx = step.indexOf(selectedMinutes);
                        if (currIdx !== -1 && currIdx < step.length - 1) {
                          setSelectedMinutes(step[currIdx + 1]);
                        } else if (selectedMinutes < 45) {
                          setSelectedMinutes(selectedMinutes + 15);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityLabel="Increase minutes"
                    >
                      <AppIcon name="add" size={14} color="#1D4ED8" />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Total Summary Row */}
              <View style={styles.heroSummaryRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="stopwatch" size={15} color="#2563EB" />
                  <Text style={styles.heroDurationText}>{formattedDuration}</Text>
                </View>

                {hourlyRate > 0 && totalMinutes > 0 && (
                  <View style={styles.heroWageBadge}>
                    <Text style={styles.heroWageText}>
                      + {money(earnedAmount)}
                    </Text>
                    <Text style={styles.heroWageRateText}>
                      @{money(hourlyRate)}/hr
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Quick 1-Tap Presets */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <AppIcon name="flash-outline" size={14} color="#16A34A" />
                <Text style={styles.sectionTitle}>Quick 1-Tap Overtime Presets:</Text>
              </View>
              <View style={styles.chipsRow}>
                {QUICK_PRESETS.map((p) => {
                  const isSelected = totalMinutes === p.mins;
                  return (
                    <Pressable
                      key={p.mins}
                      onPress={() => {
                        setSelectedHours(Math.floor(p.mins / 60));
                        setSelectedMinutes(p.mins % 60);
                      }}
                      style={[
                        styles.presetChipBtn,
                        isSelected && styles.presetChipBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipBtnText,
                          isSelected && styles.presetChipBtnTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Premium Clean Footer Action Buttons */}
          <View style={styles.modalFooter}>
            <Pressable
              onPress={() => {
                if (totalMinutes > 0) {
                  setSelectedHours(0);
                  setSelectedMinutes(0);
                } else {
                  onClose();
                }
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityLabel={totalMinutes > 0 ? 'Clear overtime' : 'Cancel'}
            >
              <Text style={styles.secondaryButtonText}>
                {totalMinutes > 0 ? 'Clear (0m)' : 'Cancel'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onConfirm(totalMinutes);
                onClose();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {totalMinutes > 0 ? `Apply ${formattedDuration}` : 'Done'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  /* Clock Hero Display Card */
  clockHeroCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 12,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  unitControlCol: {
    alignItems: 'center',
    gap: 4,
  },
  unitControlHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepperBtn: {
    width: 28,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.4,
  },
  stepperValueText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    minWidth: 32,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeColonText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#94A3B8',
    marginTop: 14,
  },

  heroSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  heroDurationText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  heroWageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  heroWageText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  heroWageRateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  presetChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  presetChipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  presetChipBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  /* Footer */
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
