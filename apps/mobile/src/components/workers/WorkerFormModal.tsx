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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Row, Snapshot } from '../../types';
import { money, workerSummary } from '../../finance';

export interface WorkerFormModalProps {
  spec: FormSpec;
  data: Snapshot;
  worker?: Row;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
  onOpenPaymentModal?: (workerId: string) => void;
  onOpenAttendanceModal?: (workerId: string) => void;
  asPage?: boolean;
}

interface SkillOption {
  id: string;
  name: string;
  category: string;
  icon: string;
  defaultDailyRate: number;
}

const COMMON_SKILLS: SkillOption[] = [
  { id: 'mason', name: 'Mason / Bricklayer', category: 'Masonry & Plaster', icon: 'hammer-outline', defaultDailyRate: 850 },
  { id: 'painter', name: 'Painter', category: 'Painting & Putty', icon: 'color-palette-outline', defaultDailyRate: 750 },
  { id: 'electrician', name: 'Electrician', category: 'Wiring & Fittings', icon: 'flash-outline', defaultDailyRate: 800 },
  { id: 'plumber', name: 'Plumber', category: 'Pipes & Drainage', icon: 'water-outline', defaultDailyRate: 800 },
  { id: 'carpenter', name: 'Carpenter', category: 'Woodwork & Shuttering', icon: 'construct-outline', defaultDailyRate: 850 },
  { id: 'tile', name: 'Tile / Marble Mason', category: 'Flooring & Tiles', icon: 'grid-outline', defaultDailyRate: 900 },
  { id: 'helper', name: 'Helper / Labour', category: 'General Assistance', icon: 'people-outline', defaultDailyRate: 500 },
  { id: 'welder', name: 'Welder / Fabricator', category: 'Iron & Steel Work', icon: 'flame-outline', defaultDailyRate: 800 },
  { id: 'foreman', name: 'Foreman / Supervisor', category: 'Site Supervision', icon: 'shield-checkmark-outline', defaultDailyRate: 1000 },
  { id: 'other', name: 'Other Trade', category: 'Custom Work', icon: 'create-outline', defaultDailyRate: 700 },
];

export function WorkerFormModal({
  spec,
  data,
  worker,
  busy,
  error,
  onClose,
  onSave,
  onOpenPaymentModal,
  onOpenAttendanceModal,
  asPage = false,
}: WorkerFormModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const isEdit = spec.action === 'worker.update' || !!worker;

  // Resolve existing worker row if not passed directly
  const activeWorker = useMemo(() => {
    if (worker) return worker;
    if (spec.entity_id) {
      return data.workers.find((w) => w.id === spec.entity_id);
    }
    return undefined;
  }, [worker, spec.entity_id, data.workers]);

  // Existing worker accounting summary
  const summary = useMemo(() => {
    if (!activeWorker) return null;
    const f = workerSummary(activeWorker, data.attendance, data.entries);
    const daysWorked = data.attendance.filter((a) => a.worker_id === activeWorker.id).length;
    return { ...f, daysWorked };
  }, [activeWorker, data.attendance, data.entries]);

  // Form Fields State
  const [name, setName] = useState<string>(
    String(spec.initial.name || activeWorker?.name || '')
  );
  const [phone, setPhone] = useState<string>(
    String(spec.initial.phone || activeWorker?.phone || '')
  );

  // Skill state
  const initialSkillStr = String(spec.initial.skill || activeWorker?.skill || 'Painter');
  const matchedSkill = COMMON_SKILLS.find(
    (s) => s.name.toLowerCase() === initialSkillStr.toLowerCase() || initialSkillStr.toLowerCase().includes(s.id)
  );

  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    matchedSkill ? matchedSkill.id : 'other'
  );
  const [customSkill, setCustomSkill] = useState<string>(
    matchedSkill ? '' : initialSkillStr
  );
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);

  const selectedSkill = useMemo(() => {
    return COMMON_SKILLS.find((s) => s.id === selectedSkillId) || COMMON_SKILLS[0];
  }, [selectedSkillId]);

  // Wage Rates
  const [dailyRate, setDailyRate] = useState<string>(
    spec.initial.daily_rate ? String(spec.initial.daily_rate) : (activeWorker ? String(Number(activeWorker.daily_rate) / 100) : '700')
  );
  const [overtimeRate, setOvertimeRate] = useState<string>(
    spec.initial.overtime_rate ? String(spec.initial.overtime_rate) : (activeWorker ? String(Number(activeWorker.overtime_rate) / 100) : '100')
  );

  // Status
  const [active, setActive] = useState<boolean>(
    spec.initial.active !== undefined
      ? String(spec.initial.active) === 'true'
      : (activeWorker ? activeWorker.active : true)
  );

  // Local Validation Error
  const [validationError, setValidationError] = useState<string>('');

  // Handle skill select
  const handleSelectSkill = (skill: SkillOption) => {
    setSelectedSkillId(skill.id);
    if (skill.id === 'other') {
      if (!customSkill) setCustomSkill('');
    } else {
      setCustomSkill('');
      if (!dailyRate || dailyRate === '0') {
        setDailyRate(String(skill.defaultDailyRate));
        setOvertimeRate(String(Math.round(skill.defaultDailyRate / 8)));
      }
    }
  };

  // Auto calculate OT from Daily Wage (Daily / 8 hrs)
  const handleAutoCalculateOT = () => {
    const dailyNum = parseFloat(dailyRate);
    if (!isNaN(dailyNum) && dailyNum > 0) {
      const calculatedOT = Math.round(dailyNum / 8);
      setOvertimeRate(String(calculatedOT));
    }
  };

  // Adjust daily rate by increment
  const handleAdjustRate = (delta: number) => {
    const current = parseFloat(dailyRate) || 0;
    const nextVal = Math.max(0, current + delta);
    setDailyRate(String(nextVal));
  };

  // Adjust overtime rate by increment
  const handleAdjustOT = (delta: number) => {
    const current = parseFloat(overtimeRate) || 0;
    const nextVal = Math.max(0, current + delta);
    setOvertimeRate(String(nextVal));
  };

  // Quick Communication
  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {});
    }
  };

  const handleWhatsApp = () => {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      Linking.openURL(`https://wa.me/${fullPhone}`).catch(() => {});
    }
  };

  // Submit Handler
  const handleSubmit = () => {
    setValidationError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setValidationError('Please enter the worker full name');
      return;
    }

    const dailyNum = parseFloat(dailyRate);
    if (isNaN(dailyNum) || dailyNum < 0) {
      setValidationError('Please enter a valid daily wage rate');
      return;
    }

    const otNum = parseFloat(overtimeRate);
    if (isNaN(otNum) || otNum < 0) {
      setValidationError('Please enter a valid overtime rate');
      return;
    }

    let finalSkill = '';
    if (selectedSkillId === 'other') {
      finalSkill = customSkill.trim() || 'Worker';
    } else if (customSkill.trim()) {
      finalSkill = customSkill.trim();
    } else {
      finalSkill = selectedSkill.name;
    }

    onSave({
      name: cleanName,
      phone: phone.trim(),
      skill: finalSkill,
      daily_rate: String(dailyNum),
      overtime_rate: String(otNum),
      active: active ? 'true' : 'false',
    });
  };

  // Numeric previews
  const dailyNumeric = parseFloat(dailyRate) || 0;
  const otNumeric = parseFloat(overtimeRate) || 0;
  const halfDayAmount = Math.round(dailyNumeric / 2);
  const monthlyStandardEstimate = Math.round(dailyNumeric * 26);
  const overtime10HrsEstimate = Math.round(otNumeric * 10);
  const totalMonthlyEstimate = monthlyStandardEstimate + overtime10HrsEstimate;

  const content = (
    <View style={styles.sheetContainer}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconContainer}>
            <AppIcon
              name={isEdit ? 'person-circle-outline' : 'person-add-outline'}
              size={22}
              color={Colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.headerBadgeRow}>
              <Text style={styles.headerTitle}>
                {isEdit ? 'Edit Worker Profile' : 'Add New Worker'}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: active ? Colors.successLight : Colors.warningLight },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: active ? Colors.success : Colors.warning },
                  ]}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: active ? Colors.successDark : Colors.warningText },
                  ]}
                >
                  {active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {isEdit
                ? 'Update worker rates, daily wage and contact information'
                : 'Register worker profile, daily wage and overtime rate'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => !busy && onClose()}
          style={styles.closeBtn}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <AppIcon name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Existing Worker Summary Hero Card */}
        {isEdit && activeWorker && summary && (
          <View style={styles.workerHeroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>
                  {activeWorker.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroWorkerName}>{activeWorker.name}</Text>
                <Text style={styles.heroWorkerSkill}>
                  {activeWorker.skill} • {activeWorker.phone || 'No phone'}
                </Text>
              </View>

              {/* Quick Communication Buttons */}
              {activeWorker.phone ? (
                <View style={styles.quickContactRow}>
                  <Pressable
                    onPress={handleCall}
                    style={styles.contactIconBtn}
                    accessibilityLabel="Call Worker"
                  >
                    <AppIcon name="call" size={15} color={Colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={handleWhatsApp}
                    style={[styles.contactIconBtn, { backgroundColor: '#E7F7ED' }]}
                    accessibilityLabel="WhatsApp Worker"
                  >
                    <AppIcon name="logo-whatsapp" size={15} color="#25D366" />
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Financial & Attendance Metrics */}
            <View style={styles.heroMetricsGrid}>
              <View style={styles.heroMetricItem}>
                <Text style={styles.heroMetricLabel}>Total Present</Text>
                <Text style={styles.heroMetricVal}>{summary.daysWorked} Days</Text>
                <Text style={styles.heroMetricSub}>Attendance</Text>
              </View>
              <View style={styles.heroMetricItem}>
                <Text style={styles.heroMetricLabel}>Total Earned</Text>
                <Text style={styles.heroMetricVal}>{money(summary.earned)}</Text>
                <Text style={styles.heroMetricSub}>Accrued Wages</Text>
              </View>
              <View style={styles.heroMetricItem}>
                <Text style={styles.heroMetricLabel}>
                  {summary.balance < 0 ? 'Advance Paid' : 'Pending Wages'}
                </Text>
                <Text
                  style={[
                    styles.heroMetricVal,
                    { color: summary.balance < 0 ? Colors.warning : Colors.success },
                  ]}
                >
                  {summary.balance < 0 ? money(-summary.balance) : money(summary.balance)}
                </Text>
                <Text style={styles.heroMetricSub}>
                  {summary.balance < 0 ? 'Worker Advance' : 'Due to Worker'}
                </Text>
              </View>
            </View>


          </View>
        )}

        {/* SECTION 1: Personal Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>1</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Personal Details</Text>
              <Text style={styles.sectionSubtitle}>Worker name and mobile number</Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Full Name <Text style={styles.reqStar}>*</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconBox}>
                <AppIcon name="person-outline" size={16} color={Colors.textMuted} />
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={Colors.textSubtle}
                style={styles.textInput}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {name ? (
                <Pressable onPress={() => setName('')} style={styles.clearBtn}>
                  <AppIcon name="close-circle" size={16} color={Colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mobile Number (Optional)</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryFlag}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.textSubtle}
                style={styles.textInput}
                keyboardType="phone-pad"
                maxLength={13}
              />
              {phone ? (
                <Pressable onPress={() => setPhone('')} style={styles.clearBtn}>
                  <AppIcon name="close-circle" size={16} color={Colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>

          </View>
        </View>

        {/* SECTION 2: Role & Skill Selection */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>2</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Skill & Trade</Text>
              <Text style={styles.sectionSubtitle}>Select trade category and optional custom title</Text>
            </View>
          </View>

          {/* Trade Dropdown */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Trade Category <Text style={styles.reqStar}>*</Text>
            </Text>
            <Pressable
              onPress={() => setIsSkillDropdownOpen(!isSkillDropdownOpen)}
              style={styles.dropdownBtn}
              accessibilityRole="button"
              accessibilityLabel="Select trade category"
            >
              <View style={styles.dropdownIconCircle}>
                <AppIcon
                  name={selectedSkill.icon}
                  size={15}
                  color={Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownValueText}>{selectedSkill.name}</Text>
                <Text style={styles.dropdownCategoryText}>{selectedSkill.category}</Text>
              </View>
              <AppIcon
                name={isSkillDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textMuted}
              />
            </Pressable>

            {/* Dropdown Menu Items */}
            {isSkillDropdownOpen && (
              <View style={styles.dropdownMenu}>
                <ScrollView
                  style={styles.dropdownScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={true}
                >
                  {COMMON_SKILLS.map((skill) => {
                    const isSelected = selectedSkillId === skill.id;
                    return (
                      <Pressable
                        key={skill.id}
                        onPress={() => {
                          handleSelectSkill(skill);
                          setIsSkillDropdownOpen(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.dropdownItemIconCircle,
                            isSelected && styles.dropdownItemIconCircleActive,
                          ]}
                        >
                          <AppIcon
                            name={skill.icon}
                            size={14}
                            color={isSelected ? '#FFFFFF' : Colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.dropdownItemTitle,
                              isSelected && styles.dropdownItemTitleActive,
                            ]}
                          >
                            {skill.name}
                          </Text>
                          <Text style={styles.dropdownItemSub}>
                            {skill.category}
                          </Text>
                        </View>
                        {isSelected && (
                          <AppIcon
                            name="checkmark-circle"
                            size={16}
                            color={Colors.accent}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Custom Trade / Specific Skill Input */}
          <View style={[styles.fieldGroup, { marginTop: 4 }]}>
            <Text style={styles.fieldLabel}>
              Custom Trade / Specific Skill {selectedSkillId === 'other' ? <Text style={styles.reqStar}>*</Text> : <Text style={styles.optLabel}>(Optional)</Text>}
            </Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconBox}>
                <AppIcon name="create-outline" size={15} color={Colors.textMuted} />
              </View>
              <TextInput
                value={customSkill}
                onChangeText={setCustomSkill}
                placeholder={
                  selectedSkillId === 'other'
                    ? 'Enter custom trade (e.g. POP Installer, Glass Glazier)'
                    : `Specify custom role or leave blank for "${selectedSkill.name}"`
                }
                placeholderTextColor={Colors.textSubtle}
                style={styles.textInput}
              />
              {customSkill ? (
                <Pressable onPress={() => setCustomSkill('')} style={styles.clearBtn}>
                  <AppIcon name="close-circle" size={16} color={Colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* SECTION 3: Wage & Overtime Rates */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>3</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Daily Wage & Overtime Rate</Text>
              <Text style={styles.sectionSubtitle}>Configure base daily wage and overtime hourly rate</Text>
            </View>
          </View>

          {/* Daily Wage */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>
                Daily Wage Rate <Text style={styles.reqStar}>*</Text>
              </Text>
              <Text style={styles.halfDayBadge}>
                Half Day = ₹{halfDayAmount}
              </Text>
            </View>

            <View style={styles.rateInputRow}>
              <View style={styles.rateInputWrapper}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  value={dailyRate}
                  onChangeText={setDailyRate}
                  placeholder="700"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.rateInput}
                  keyboardType="numeric"
                />
                <Text style={styles.rateUnitText}>/ day</Text>
              </View>

              {/* Increment / Decrement Stepper */}
              <View style={styles.stepperContainer}>
                <Pressable
                  onPress={() => handleAdjustRate(-50)}
                  style={styles.stepperBtn}
                  accessibilityLabel="Decrease rate by 50"
                >
                  <AppIcon name="remove" size={14} color={Colors.textPrimary} />
                </Pressable>
                <Pressable
                  onPress={() => handleAdjustRate(50)}
                  style={styles.stepperBtn}
                  accessibilityLabel="Increase rate by 50"
                >
                  <AppIcon name="add" size={14} color={Colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Overtime Rate */}
          <View style={[styles.fieldGroup, { marginTop: 8 }]}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>
                Overtime Hourly Rate <Text style={styles.reqStar}>*</Text>
              </Text>
              <Pressable
                onPress={handleAutoCalculateOT}
                style={styles.autoCalculateBtn}
                accessibilityRole="button"
              >
                <AppIcon name="calculator-outline" size={12} color={Colors.accentDark} />
                <Text style={styles.autoCalculateBtnText}>Auto (Daily ÷ 8 hrs)</Text>
              </Pressable>
            </View>

            <View style={styles.rateInputRow}>
              <View style={styles.rateInputWrapper}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  value={overtimeRate}
                  onChangeText={setOvertimeRate}
                  placeholder="100"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.rateInput}
                  keyboardType="numeric"
                />
                <Text style={styles.rateUnitText}>/ hr</Text>
              </View>

              {/* OT Increment / Decrement Stepper */}
              <View style={styles.stepperContainer}>
                <Pressable
                  onPress={() => handleAdjustOT(-10)}
                  style={styles.stepperBtn}
                  accessibilityLabel="Decrease OT by 10"
                >
                  <AppIcon name="remove" size={14} color={Colors.textPrimary} />
                </Pressable>
                <Pressable
                  onPress={() => handleAdjustOT(10)}
                  style={styles.stepperBtn}
                  accessibilityLabel="Increase OT by 10"
                >
                  <AppIcon name="add" size={14} color={Colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Live Wage Calculation Simulator Box */}
          <View style={styles.simulatorCard}>
            <View style={styles.simulatorHeader}>
              <AppIcon name="calculator" size={14} color={Colors.primary} />
              <Text style={styles.simulatorTitle}>
                Monthly Wage Projection (Preview)
              </Text>
            </View>
            <View style={styles.simulatorGrid}>
              <View style={styles.simulatorItem}>
                <Text style={styles.simulatorLabel}>26 Days Regular</Text>
                <Text style={styles.simulatorValue}>
                  ₹{monthlyStandardEstimate.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.simulatorDivider} />
              <View style={styles.simulatorItem}>
                <Text style={styles.simulatorLabel}>10 Hrs OT (~₹{otNumeric}/hr)</Text>
                <Text style={styles.simulatorValue}>
                  ₹{overtime10HrsEstimate.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.simulatorDivider} />
              <View style={styles.simulatorItem}>
                <Text style={[styles.simulatorLabel, { color: Colors.primaryDark, fontWeight: '700' }]}>
                  Estimated Month Total
                </Text>
                <Text style={[styles.simulatorValue, { color: Colors.successDark, fontWeight: '800' }]}>
                  ₹{totalMonthlyEstimate.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 4: Worker Status (Active / Inactive) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>4</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Worker Status & Availability</Text>
              <Text style={styles.sectionSubtitle}>Active on job sites or on leave</Text>
            </View>
          </View>

          <View style={styles.statusOptionRow}>
            {/* Active Card */}
            <Pressable
              onPress={() => setActive(true)}
              style={[
                styles.statusSelectCard,
                active && styles.statusSelectCardActive,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.statusSelectHeader}>
                <View
                  style={[
                    styles.statusSelectDot,
                    { backgroundColor: active ? Colors.success : Colors.borderStrong },
                  ]}
                />
                <Text
                  style={[
                    styles.statusSelectTitle,
                    active && { color: Colors.successDark, fontWeight: '800' },
                  ]}
                >
                  Active Worker
                </Text>
                {active && (
                  <AppIcon name="checkmark-circle" size={15} color={Colors.success} />
                )}
              </View>
              <Text style={styles.statusSelectDesc}>
                Working on sites. Appears in daily attendance.
              </Text>
            </Pressable>

            {/* Inactive Card */}
            <Pressable
              onPress={() => setActive(false)}
              style={[
                styles.statusSelectCard,
                !active && styles.statusSelectCardInactive,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.statusSelectHeader}>
                <View
                  style={[
                    styles.statusSelectDot,
                    { backgroundColor: !active ? Colors.warning : Colors.borderStrong },
                  ]}
                />
                <Text
                  style={[
                    styles.statusSelectTitle,
                    !active && { color: Colors.warningText, fontWeight: '800' },
                  ]}
                >
                  Inactive / On Leave
                </Text>
                {!active && (
                  <AppIcon name="checkmark-circle" size={15} color={Colors.warning} />
                )}
              </View>
              <Text style={styles.statusSelectDesc}>
                Hidden from attendance. Past wages & balance safe.
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Errors & Alerts */}
        {(validationError || error) ? (
          <View style={styles.errorBanner}>
            <AppIcon name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorBannerText}>{validationError || error}</Text>
          </View>
        ) : null}

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Sticky Bottom Actions Bar */}
      <View style={styles.footerBar}>
        <Pressable
          onPress={() => !busy && onClose()}
          style={styles.cancelBtn}
          disabled={busy}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          style={[styles.saveBtn, busy && { opacity: 0.7 }]}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEdit ? 'Save Worker' : 'Add Worker'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  if (asPage) {
    return (
      <SafeAreaView style={styles.pageRoot} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
            {content}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
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
  },
  modalCardDesktop: {
    maxWidth: 560,
    width: '100%',
    maxHeight: '92%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 30,
  },

  /* Hero Card */
  workerHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroWorkerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroWorkerSkill: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  heroMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  heroMetricSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  reassuranceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#1D4ED8',
  },

  /* Form Sections */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  sectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  reqStar: {
    color: '#DC2626',
    fontWeight: '800',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  inputIconBox: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 4,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
  },
  countryFlag: {
    fontSize: 15,
  },
  countryCodeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  inputHelp: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 14,
  },

  /* Trade Dropdown Styles */
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 46,
  },
  dropdownIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownCategoryText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemIconCircleActive: {
    backgroundColor: '#2563EB',
  },
  dropdownItemTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  dropdownItemTitleActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  dropdownItemSub: {
    fontSize: 10.5,
    color: '#64748B',
  },
  optLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },

  /* Wages Section */
  halfDayBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 44,
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
    marginRight: 4,
  },
  rateInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 6,
  },
  rateUnitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperBtn: {
    width: 36,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  presetsLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  presetsScroll: {
    gap: 5,
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  autoCalculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  autoCalculateBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  /* Simulator Card */
  simulatorCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    marginTop: 6,
    gap: 6,
  },
  simulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  simulatorTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  simulatorGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simulatorItem: {
    flex: 1,
    alignItems: 'center',
  },
  simulatorDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#DCFCE7',
  },
  simulatorLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  simulatorValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  /* Status Selection */
  statusOptionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusSelectCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 3,
  },
  statusSelectCardActive: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  statusSelectCardInactive: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  statusSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusSelectDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusSelectTitle: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  statusSelectDesc: {
    fontSize: 9.5,
    lineHeight: 13,
    color: '#64748B',
  },

  /* Quick Actions */
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  quickActionsTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickActionsButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickOpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickOpBtnSecondary: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  quickOpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  /* Errors */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#DC2626',
    lineHeight: 15,
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
    borderColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
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
    minHeight: 46,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
