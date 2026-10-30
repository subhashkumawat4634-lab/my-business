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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Row, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { today } from '../../forms';
import { money, workerSummary } from '../../finance';
import { useLanguage } from '../../i18n';

export interface WagePaymentModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
  asPage?: boolean;
}

const PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash (Nokad)', icon: 'cash-outline', badge: 'Handover' },
  { key: 'UPI', label: 'UPI / PhonePe / GPay', icon: 'phone-portrait-outline', badge: 'Instant' },
  { key: 'BANK', label: 'Bank / Cheque', icon: 'business-outline', badge: 'Account' },
];

const NOTE_PRESETS = [
  'Weekly Wage Payment',
  'Advance Payment',
  'Overtime Payment',
  'Festival Advance',
  'Final Settlement',
];

const AMOUNT_PRESETS = [500, 1000, 2000, 5000];

export function WagePaymentModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
  asPage = false,
}: WagePaymentModalProps) {
  const { width } = useWindowDimensions();
  const { t, lang } = useLanguage();
  const isDesktop = width > 768;

  // Initial States
  const [workerId, setWorkerId] = useState<string>(
    spec.initial.worker_id || data.workers.find((w) => w.active)?.id || data.workers[0]?.id || ''
  );
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>(spec.initial.amount || '');
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [mode, setMode] = useState<string>(spec.initial.mode || 'CASH');
  const [description, setDescription] = useState<string>(spec.initial.description || '');
  const [reference, setReference] = useState<string>(spec.initial.reference || '');

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Selected entities
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === workerId),
    [data.workers, workerId]
  );
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId),
    [data.sites, siteId]
  );

  // Worker Financial summary
  const summary = useMemo(() => {
    if (!selectedWorker) return null;
    return workerSummary(selectedWorker, data.attendance, data.entries);
  }, [selectedWorker, data.attendance, data.entries]);

  const dueBalance = summary ? summary.balance : 0;
  const isDue = dueBalance > 0;
  const isAdv = dueBalance < 0;

  const handleSubmit = () => {
    setLocalError('');
    const amtNum = parseFloat(amount.trim());
    if (isNaN(amtNum) || amtNum <= 0) {
      setLocalError(lang === 'hi' ? 'कृपया मान्य भुगतान राशि दर्ज करें।' : 'Please enter a valid payment amount.');
      return;
    }
    if (!workerId) {
      setLocalError(lang === 'hi' ? 'कृपया मजदूर (Worker) चुनें।' : 'Please select a worker.');
      return;
    }
    if (!siteId) {
      setLocalError(lang === 'hi' ? 'कृपया साइट (Work Site) चुनें।' : 'Please select a work site.');
      return;
    }

    onSave({
      site_id: siteId,
      worker_id: workerId,
      amount: amount.trim(),
      date,
      mode,
      description: description.trim() || 'Labour Wage Payment',
      reference: reference.trim(),
    });
  };

  const displayError = localError || error;

  const formContent = (
    <SafeAreaView
      style={[styles.safeArea, asPage && styles.pageSafeArea]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, asPage && styles.pageHeader]}>
          <View style={styles.headerLeft}>
            {asPage ? (
              <Pressable
                onPress={() => !busy && onClose()}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Back"
              >
                <AppIcon name="arrow-back" size={18} color="#2563EB" />
              </Pressable>
            ) : null}
            <View style={styles.headerIconBadge}>
              <AppIcon name="cash" size={20} color="#047857" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {lang === 'hi' ? 'मजदूरी भुगतान / एडवांस' : 'Labour Wage Payment'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {lang === 'hi'
                  ? 'मजदूर को हाजिरी मजदूरी या एडवांस भुगतान रिकॉर्ड करें'
                  : 'Record wage settlement, payment or cash advance'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => !busy && onClose()}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            accessibilityLabel={asPage ? 'Back' : 'Close'}
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
          contentContainerStyle={[styles.scrollBody, isDesktop && styles.scrollBodyDesktop]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. WORKER SELECTOR CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon name="person-outline" size={16} color="#047857" />
              <Text style={styles.sectionTitle}>
                {lang === 'hi' ? 'मजदूर चुनें (Select Worker)' : 'Select Worker'}
              </Text>
            </View>

            {/* Worker Dropdown / Picker */}
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={workerId}
                onValueChange={(val) => setWorkerId(String(val))}
                style={styles.picker}
              >
                {data.workers.map((w) => (
                  <Picker.Item
                    key={w.id}
                    label={`${w.name} • ${w.skill || 'General'} (${w.active ? 'Active' : 'Inactive'})`}
                    value={w.id}
                  />
                ))}
              </Picker>
            </View>

            {/* Selected Worker Info Badge */}
            {selectedWorker ? (
              <View style={styles.workerInfoCard}>
                <View style={styles.workerAvatar}>
                  {selectedWorker.photo ? (
                    <Image source={{ uri: selectedWorker.photo }} style={styles.workerAvatarImg} />
                  ) : (
                    <Text style={styles.workerAvatarText}>
                      {(selectedWorker.name || 'W').slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerNameText}>{selectedWorker.name}</Text>
                  <Text style={styles.workerMetaText}>
                    {selectedWorker.skill || 'Worker'} • {money(selectedWorker.daily_rate)}/day
                  </Text>
                </View>
                {summary ? (
                  <View
                    style={[
                      styles.balanceBadge,
                      isDue ? styles.balanceDueBadge : isAdv ? styles.balanceAdvBadge : styles.balanceSettledBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.balanceBadgeText,
                        isDue ? styles.balanceDueText : isAdv ? styles.balanceAdvText : styles.balanceSettledText,
                      ]}
                    >
                      {isDue
                        ? `${money(dueBalance)} Due`
                        : isAdv
                          ? `${money(-dueBalance)} Adv`
                          : 'Settled'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* 2. WORK SITE SELECTOR CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon name="business-outline" size={16} color="#0284C7" />
              <Text style={styles.sectionTitle}>
                {lang === 'hi' ? 'साइट चुनें (Charge to Site)' : 'Charge to Work Site'}
              </Text>
            </View>

            <View style={styles.pickerBox}>
              <Picker
                selectedValue={siteId}
                onValueChange={(val) => setSiteId(String(val))}
                style={styles.picker}
              >
                {data.sites.map((s) => (
                  <Picker.Item key={s.id} label={`${s.name} (${s.owner_name})`} value={s.id} />
                ))}
              </Picker>
            </View>
          </View>

          {/* 3. PAYMENT AMOUNT CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon name="wallet-outline" size={16} color="#16A34A" />
              <Text style={styles.sectionTitle}>
                {lang === 'hi' ? 'भुगतान राशि (Payment Amount)' : 'Payment Amount'}
              </Text>
            </View>

            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={(val) => setAmount(val.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
            </View>

            {/* Quick Amount Chips */}
            <View style={styles.chipsRow}>
              {isDue ? (
                <Pressable
                  onPress={() => setAmount(String(dueBalance / 100))}
                  style={styles.fullDueChip}
                >
                  <AppIcon name="checkmark-circle" size={13} color="#D97706" />
                  <Text style={styles.fullDueChipText}>
                    {lang === 'hi' ? `पूरा बाकी: ${money(dueBalance)}` : `Full Due: ${money(dueBalance)}`}
                  </Text>
                </Pressable>
              ) : null}
              {AMOUNT_PRESETS.map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setAmount(String(amt))}
                  style={[
                    styles.amountPresetChip,
                    amount === String(amt) && styles.amountPresetChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.amountPresetChipText,
                      amount === String(amt) && styles.amountPresetChipTextActive,
                    ]}
                  >
                    +₹{amt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 4. PAYMENT DATE & MODE CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon name="calendar-outline" size={16} color="#6366F1" />
              <Text style={styles.sectionTitle}>
                {lang === 'hi' ? 'दिनांक व भुगतान का माध्यम' : 'Date & Payment Mode'}
              </Text>
            </View>

            {/* Date Button */}
            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              style={styles.datePickerBtn}
              accessibilityLabel="Select date"
            >
              <View style={styles.dateLeft}>
                <AppIcon name="calendar" size={16} color="#2563EB" />
                <Text style={styles.dateText}>{date}</Text>
              </View>
              <Text style={styles.dateChangeText}>
                {date === today() ? (lang === 'hi' ? 'आज (Today)' : 'Today') : 'Change'}
              </Text>
            </Pressable>

            {/* Payment Mode Selector */}
            <View style={{ gap: 8, marginTop: 10 }}>
              <Text style={styles.subFieldLabel}>
                {lang === 'hi' ? 'माध्यम (Payment Mode)' : 'Payment Mode'}
              </Text>
              <View style={styles.modesRow}>
                {PAYMENT_MODES.map((m) => {
                  const isSelected = mode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMode(m.key)}
                      style={[styles.modeCard, isSelected && styles.modeCardActive]}
                    >
                      <AppIcon
                        name={m.icon as any}
                        size={18}
                        color={isSelected ? '#047857' : '#64748B'}
                      />
                      <Text style={[styles.modeLabel, isSelected && styles.modeLabelActive]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 5. NOTES & REFERENCE CARD */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon name="create-outline" size={16} color="#64748B" />
              <Text style={styles.sectionTitle}>
                {lang === 'hi' ? 'विवरण व संदर्भ (Notes & Ref)' : 'Notes & Reference'}
              </Text>
            </View>

            {/* Quick Note Presets */}
            <View style={styles.chipsRow}>
              {NOTE_PRESETS.map((note) => (
                <Pressable
                  key={note}
                  onPress={() => setDescription(note)}
                  style={[
                    styles.notePresetChip,
                    description === note && styles.notePresetChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.notePresetText,
                      description === note && styles.notePresetTextActive,
                    ]}
                  >
                    {note}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={lang === 'hi' ? 'विवरण या टिप्पणी दर्ज करें…' : 'Description or payment note…'}
              placeholderTextColor="#94A3B8"
              style={styles.textInput}
            />

            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder={lang === 'hi' ? 'UPI / रसीद / ट्रांजेक्शन संदर्भ (वैकल्पिक)' : 'UPI / Transaction Ref ID (Optional)'}
              placeholderTextColor="#94A3B8"
              style={styles.textInput}
            />
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelBtnText}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={busy}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              busy && { opacity: 0.6 },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <AppIcon name="checkmark-sharp" size={16} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  {amount.trim() && Number(amount) > 0
                    ? `${lang === 'hi' ? 'भुगतान सेव करें' : 'Save Payment'} (${money(Number(amount) * 100)})`
                    : lang === 'hi'
                      ? 'भुगतान सुरक्षित करें'
                      : 'Save Wage Payment'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Calendar Picker Modal */}
        {isCalendarOpen && (
          <CalendarPickerModal
            visible={isCalendarOpen}
            title={lang === 'hi' ? 'भुगतान दिनांक चुनें' : 'Select Payment Date'}
            selectedDate={date}
            onSelect={(newDate) => {
              if (newDate) setDate(newDate);
              setIsCalendarOpen(false);
            }}
            onClose={() => setIsCalendarOpen(false)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (asPage) {
    return <View style={styles.pageRoot}>{formContent}</View>;
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
        <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
          {formContent}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pageRoot: { flex: 1, backgroundColor: '#F8FAFC', width: '100%' },
  pageSafeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  pageHeader: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalOverlay: { flex: 1, backgroundColor: '#F8FAFC' },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: { flex: 1, backgroundColor: '#F8FAFC', width: '100%' },
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
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  errorBannerText: { fontSize: 12, color: '#DC2626', fontWeight: '600', flex: 1 },
  scrollBody: { padding: 14, gap: 12 },
  scrollBodyDesktop: { maxWidth: 740, width: '100%', alignSelf: 'center' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  pickerBox: {
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  picker: { width: '100%', height: 44, color: '#0F172A' },
  workerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  workerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  workerAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  workerAvatarText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  workerNameText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  workerMetaText: { fontSize: 11, color: '#64748B' },
  balanceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  balanceBadgeText: { fontSize: 11, fontWeight: '800' },
  balanceDueBadge: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  balanceDueText: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  balanceAdvBadge: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  balanceAdvText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  balanceSettledBadge: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  balanceSettledText: { fontSize: 11, fontWeight: '800', color: '#16A34A' },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  currencySymbol: { fontSize: 24, fontWeight: '800', color: '#047857', marginRight: 6 },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 4,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fullDueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fullDueChipText: { fontSize: 11.5, fontWeight: '800', color: '#B45309' },
  amountPresetChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  amountPresetChipActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  amountPresetChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  amountPresetChipTextActive: { color: '#15803D' },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  dateChangeText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  subFieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  modesRow: { flexDirection: 'row', gap: 8 },
  modeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  modeLabel: { fontSize: 11, fontWeight: '600', color: '#475569', textAlign: 'center' },
  modeLabelActive: { color: '#047857', fontWeight: '800' },
  notePresetChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notePresetChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  notePresetText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  notePresetTextActive: { color: '#2563EB', fontWeight: '700' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#047857',
  },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
