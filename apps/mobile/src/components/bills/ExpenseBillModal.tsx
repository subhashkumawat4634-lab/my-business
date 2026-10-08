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
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { today } from '../../forms';
import { money } from '../../finance';

export interface ExpenseBillModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const EXPENSE_CATEGORIES = [
  { label: 'Chai & Snacks', icon: 'cafe-outline' },
  { label: 'Petrol & Travel', icon: 'car-outline' },
  { label: 'Tool & Machine Rent', icon: 'construct-outline' },
  { label: 'Transport / Tempo', icon: 'bus-outline' },
  { label: 'Malba / Site Cleaning', icon: 'trash-outline' },
  { label: 'Electricity / Water', icon: 'flash-outline' },
  { label: 'Food / Lunch', icon: 'restaurant-outline' },
  { label: 'Safety & First Aid', icon: 'medkit-outline' },
  { label: 'Misc Petty Cash', icon: 'receipt-outline' },
];

const AMOUNT_PRESETS = [100, 200, 500, 1000, 2000, 5000];

export function ExpenseBillModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: ExpenseBillModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [amount, setAmount] = useState<string>(spec.initial.amount || '');
  const [description, setDescription] = useState<string>(spec.initial.description || '');
  const [party, setParty] = useState<string>(spec.initial.party || '');
  const [reference, setReference] = useState<string>(spec.initial.reference || '');

  // Payment Mode: 'PAID' (Immediate) vs 'CREDIT' (Udhar)
  const initialMode = spec.initial.mode || 'CASH';
  const [paymentType, setPaymentType] = useState<'PAID' | 'CREDIT'>(
    initialMode === 'RECORD' ? 'CREDIT' : 'PAID'
  );
  const [paidMode, setPaidMode] = useState<'CASH' | 'UPI' | 'BANK'>(
    ['CASH', 'UPI', 'BANK'].includes(initialMode) ? (initialMode as any) : 'CASH'
  );
  const [dueDate, setDueDate] = useState<string>(spec.initial.due_date || '');

  // Dropdown and calendar states
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [calendarTarget, setCalendarTarget] = useState<'expenseDate' | 'dueDate' | null>(null);
  const [localError, setLocalError] = useState('');

  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );

  const filteredSites = useMemo(() => {
    if (!siteSearch.trim()) return data.sites;
    const q = siteSearch.toLowerCase();
    return data.sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q))
    );
  }, [data.sites, siteSearch]);

  const pastPayees = useMemo(() => {
    const set = new Set<string>();
    data.entries
      .filter((e) => e.kind === 'EXPENSE' && e.party && !e.voided_at)
      .forEach((e) => {
        if (e.party) set.add(e.party.trim());
      });
    return Array.from(set).slice(0, 6);
  }, [data.entries]);

  const handleSelectCategory = (cat: typeof EXPENSE_CATEGORIES[0]) => {
    if (!description || EXPENSE_CATEGORIES.some((c) => c.label === description)) {
      setDescription(cat.label);
    } else if (!description.toLowerCase().includes(cat.label.toLowerCase())) {
      setDescription(`${cat.label} - ${description}`);
    }
  };

  const handleAddAmount = (addValue: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + addValue));
  };

  const handleSubmit = () => {
    setLocalError('');
    if (!siteId) {
      setLocalError('Please select a work site.');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setLocalError('Please enter a valid expense amount greater than ₹0.');
      return;
    }
    if (!description.trim()) {
      setLocalError('Please enter an expense description.');
      return;
    }

    const finalMode = paymentType === 'CREDIT' ? 'RECORD' : paidMode;

    onSave({
      site_id: siteId,
      amount: amount.trim(),
      date,
      description: description.trim(),
      party: party.trim(),
      mode: finalMode,
      reference: reference.trim(),
      due_date: paymentType === 'CREDIT' ? dueDate : '',
      quantity: '',
      unit: '',
    });
  };

  const isToday = date === today();

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const displayError = localError || error;

  return (
    <Modal
      visible
      animationType={isDesktop ? 'fade' : 'slide'}
      presentationStyle={isDesktop ? 'overFullScreen' : 'fullScreen'}
      transparent={isDesktop}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <SafeAreaView
          style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}
          edges={['top', 'bottom']}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBadge}>
                <AppIcon name="receipt" size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Other Expense Bill</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  Chai, fuel, machine rent & petty cash
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              accessibilityLabel="Close form"
            >
              <AppIcon name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Body Form */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Error Banner */}
              {displayError ? (
                <View style={styles.errorBanner}>
                  <AppIcon name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              ) : null}

              {/* 1. HERO AMOUNT INPUT CARD */}
              <View style={styles.heroAmountCard}>
                <View style={styles.heroAmountTop}>
                  <Text style={styles.cardLabel}>EXPENSE AMOUNT</Text>
                  {Number(amount) > 0 ? (
                    <View style={styles.amountPill}>
                      <Text style={styles.amountPillText}>
                        {money(Number(amount) * 100)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    value={amount}
                    onChangeText={(txt) => setAmount(txt.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    style={[
                      styles.amountLargeInput,
                      Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : undefined,
                    ]}
                    autoFocus={!spec.initial.amount}
                  />
                  {amount ? (
                    <Pressable
                      onPress={() => setAmount('')}
                      style={styles.amountClearBtn}
                      accessibilityLabel="Clear amount"
                    >
                      <AppIcon name="close-circle" size={18} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                </View>

                {/* Quick Amount Chips */}
                <View style={styles.quickChipsRow}>
                  {AMOUNT_PRESETS.map((val) => (
                    <Pressable
                      key={val}
                      onPress={() => handleAddAmount(val)}
                      style={styles.quickChip}
                    >
                      <Text style={styles.quickChipText}>+{val}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 2. CATEGORY PRESETS & DESCRIPTION */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>CATEGORY / PURPOSE</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = description.toLowerCase().includes(cat.label.toLowerCase());
                    return (
                      <Pressable
                        key={cat.label}
                        onPress={() => handleSelectCategory(cat)}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                      >
                        <AppIcon
                          name={cat.icon as any}
                          size={13}
                          color={isSelected ? '#DC2626' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Description Input */}
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Expense description (e.g. Chai for 6 workers, Tempo fare...)"
                  placeholderTextColor="#94A3B8"
                  style={[
                    styles.inputBox,
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                  ]}
                />
              </View>

              {/* 3. WORK SITE SELECTOR */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>WORK SITE / PROJECT</Text>

                <Pressable
                  onPress={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}
                  style={({ pressed }) => [
                    styles.selectorTrigger,
                    isSiteDropdownOpen && styles.selectorTriggerActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.siteIconWrap}>
                    <AppIcon name="business" size={15} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectorTitle} numberOfLines={1}>
                      {selectedSite?.name || 'Select Work Site'}
                    </Text>
                    <Text style={styles.selectorSubtitle} numberOfLines={1}>
                      {selectedSite?.name ? 'Work Site' : 'Select site'}
                    </Text>
                  </View>
                  <AppIcon
                    name={isSiteDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#64748B"
                  />
                </Pressable>

                {/* Inline Site Dropdown */}
                {isSiteDropdownOpen && (
                  <View style={styles.dropdownBox}>
                    {data.sites.length > 4 ? (
                      <View style={styles.searchBar}>
                        <AppIcon name="search" size={13} color="#94A3B8" />
                        <TextInput
                          value={siteSearch}
                          onChangeText={setSiteSearch}
                          placeholder="Search work site..."
                          placeholderTextColor="#94A3B8"
                          style={[
                            styles.searchInput,
                            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                          ]}
                        />
                      </View>
                    ) : null}
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {filteredSites.map((s) => {
                        const isSelected = s.id === siteId;
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() => {
                              setSiteId(s.id);
                              setIsSiteDropdownOpen(false);
                            }}
                            style={[
                              styles.dropdownRow,
                              isSelected && styles.dropdownRowActive,
                            ]}
                          >
                            <View style={styles.siteIconWrapSmall}>
                              <AppIcon
                                name="business"
                                size={13}
                                color={isSelected ? '#2563EB' : '#64748B'}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.dropdownRowTitle,
                                  isSelected && { color: '#2563EB', fontWeight: '800' },
                                ]}
                                numberOfLines={1}
                              >
                                {s.name}
                              </Text>
                              <Text style={styles.dropdownRowSubtitle} numberOfLines={1}>
                                Work Site
                              </Text>
                            </View>
                            {isSelected && (
                              <AppIcon name="checkmark-circle" size={16} color="#2563EB" />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 4. EXPENSE DATE */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>EXPENSE DATE</Text>
                <Pressable
                  onPress={() => setCalendarTarget('expenseDate')}
                  style={styles.datePickerTrigger}
                >
                  <AppIcon name="calendar-outline" size={15} color="#64748B" />
                  <Text style={styles.datePickerText}>{formatDateDisplay(date)}</Text>
                  {isToday ? (
                    <View style={styles.todayTag}>
                      <Text style={styles.todayTagText}>Today</Text>
                    </View>
                  ) : null}
                  <AppIcon name="chevron-down" size={14} color="#94A3B8" />
                </Pressable>
              </View>

              {/* 5. PAID TO / VENDOR */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>PAID TO / VENDOR (OPTIONAL)</Text>
                <TextInput
                  value={party}
                  onChangeText={setParty}
                  placeholder="e.g. Tea stall, Fuel station, Hardware store"
                  placeholderTextColor="#94A3B8"
                  style={[
                    styles.inputBox,
                    Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : undefined,
                  ]}
                />

                {/* Autocomplete Payees */}
                {pastPayees.length > 0 && !party ? (
                  <View style={styles.pastPayeesWrap}>
                    <Text style={styles.pastPayeesLabel}>Recent:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {pastPayees.map((p) => (
                        <Pressable
                          key={p}
                          onPress={() => setParty(p)}
                          style={styles.pastPayeeChip}
                        >
                          <Text style={styles.pastPayeeText}>{p}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              {/* 6. PAYMENT STATUS: PAID NOW VS CREDIT */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>PAYMENT STATUS</Text>

                <View style={styles.paymentTypeRow}>
                  <Pressable
                    onPress={() => setPaymentType('PAID')}
                    style={[
                      styles.paymentTypeBtn,
                      paymentType === 'PAID' && styles.paymentTypeBtnPaid,
                    ]}
                  >
                    <AppIcon
                      name="checkmark-circle"
                      size={14}
                      color={paymentType === 'PAID' ? '#16A34A' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.paymentTypeText,
                        paymentType === 'PAID' && styles.paymentTypeTextPaid,
                      ]}
                    >
                      Paid Immediately
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPaymentType('CREDIT')}
                    style={[
                      styles.paymentTypeBtn,
                      paymentType === 'CREDIT' && styles.paymentTypeBtnCredit,
                    ]}
                  >
                    <AppIcon
                      name="time-outline"
                      size={14}
                      color={paymentType === 'CREDIT' ? '#D97706' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.paymentTypeText,
                        paymentType === 'CREDIT' && styles.paymentTypeTextCredit,
                      ]}
                    >
                      Udhar / Pay Later
                    </Text>
                  </Pressable>
                </View>

                {/* Paid Mode or Due Date Sub-field */}
                {paymentType === 'PAID' ? (
                  <View style={styles.modePillRow}>
                    {[
                      { key: 'CASH', label: 'Cash', icon: 'cash' },
                      { key: 'UPI', label: 'UPI / Online', icon: 'qr-code' },
                      { key: 'BANK', label: 'Bank / Cheque', icon: 'business' },
                    ].map((m) => {
                      const isSelected = paidMode === m.key;
                      return (
                        <Pressable
                          key={m.key}
                          onPress={() => setPaidMode(m.key as any)}
                          style={[
                            styles.modePill,
                            isSelected && styles.modePillActive,
                          ]}
                        >
                          <AppIcon
                            name={m.icon as any}
                            size={14}
                            color={isSelected ? '#16A34A' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.modePillText,
                              isSelected && { color: '#16A34A', fontWeight: '800' },
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setCalendarTarget('dueDate')}
                    style={styles.dueDateBtn}
                  >
                    <AppIcon name="time" size={14} color="#D97706" />
                    <Text style={styles.dueDateBtnText}>
                      {dueDate ? `Due on ${formatDateDisplay(dueDate)}` : 'Select payment due date'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* 6. REFERENCE / BILL NO */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>BILL / RECEIPT NO. (OPTIONAL)</Text>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  placeholder="e.g. Bill #104, UPI Ref 492019..."
                  placeholderTextColor="#94A3B8"
                  style={[
                    styles.inputBox,
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                  ]}
                />
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View style={styles.footerBar}>
              <Pressable
                onPress={onClose}
                style={styles.footerCancelBtn}
                disabled={busy}
              >
                <Text style={styles.footerCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit}
                style={[styles.footerSubmitBtn, busy && { opacity: 0.6 }]}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.footerSubmitText}>
                    {amount.trim() && Number(amount) > 0
                      ? `Save Expense (${money(Number(amount) * 100)})`
                      : 'Save Expense Bill'}
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* Calendar Picker Modal */}
          {calendarTarget !== null && (
            <CalendarPickerModal
              visible={calendarTarget !== null}
              title={calendarTarget === 'dueDate' ? 'Select Due Date' : 'Select Expense Date'}
              selectedDate={calendarTarget === 'dueDate' ? (dueDate || today()) : date}
              onSelect={(selected) => {
                if (selected) {
                  if (calendarTarget === 'dueDate') {
                    setDueDate(selected);
                  } else {
                    setDate(selected);
                  }
                }
                setCalendarTarget(null);
              }}
              onClose={() => setCalendarTarget(null)}
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
    backgroundColor: '#F8FAFC',
    width: '100%',
  },
  modalCardDesktop: {
    maxWidth: 580,
    width: '100%',
    maxHeight: '92%',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 14,
    gap: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  heroAmountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  heroAmountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  amountPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  amountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '900',
    color: '#DC2626',
    marginRight: 6,
  },
  amountLargeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  amountClearBtn: {
    padding: 4,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  categoryChipSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextSelected: {
    color: '#DC2626',
    fontWeight: '800',
  },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectorTriggerActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  siteIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteIconWrapSmall: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectorSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  dropdownBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 4,
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    margin: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
  },
  dropdownRowActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownRowTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  dropdownRowSubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginTop: 2,
  },
  datePickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  todayTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  todayTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  pastPayeesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  pastPayeesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  pastPayeeChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pastPayeeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  paymentTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
  },
  paymentTypeBtnPaid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  paymentTypeBtnCredit: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  paymentTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentTypeTextPaid: {
    color: '#15803D',
    fontWeight: '800',
  },
  paymentTypeTextCredit: {
    color: '#B45309',
    fontWeight: '800',
  },
  modePillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  modePillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#86EFAC',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dueDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  dueDateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  inputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0F172A',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  footerSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#DC2626',
  },
  footerSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
