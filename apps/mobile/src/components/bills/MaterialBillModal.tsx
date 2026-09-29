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

export interface MaterialBillModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const MATERIAL_CATEGORIES = [
  { label: 'Cement', icon: 'cube-outline', defaultUnit: 'bags' },
  { label: 'Paint & Primer', icon: 'color-palette-outline', defaultUnit: 'litres' },
  { label: 'Bricks / Eint', icon: 'grid-outline', defaultUnit: 'pieces' },
  { label: 'Sand / Reti', icon: 'layers-outline', defaultUnit: 'truck' },
  { label: 'Steel / Sariya', icon: 'reorder-four-outline', defaultUnit: 'kg' },
  { label: 'Tiles / Marble', icon: 'apps-outline', defaultUnit: 'boxes' },
  { label: 'Plumbing', icon: 'water-outline', defaultUnit: 'pieces' },
  { label: 'Electrical', icon: 'flash-outline', defaultUnit: 'pieces' },
  { label: 'Hardware', icon: 'construct-outline', defaultUnit: 'kg' },
];

const COMMON_UNITS = ['bags', 'litres', 'pieces', 'truck', 'sq ft', 'kg', 'ton', 'boxes'];

export function MaterialBillModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: MaterialBillModalProps) {
  // Form State
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [amount, setAmount] = useState<string>(spec.initial.amount || '');
  const [description, setDescription] = useState<string>(spec.initial.description || '');
  const [party, setParty] = useState<string>(spec.initial.party || '');
  const [quantity, setQuantity] = useState<string>(spec.initial.quantity || '');
  const [unit, setUnit] = useState<string>(spec.initial.unit || 'bags');
  const [reference, setReference] = useState<string>(spec.initial.reference || '');

  // Payment Mode: 'RECORD' (Credit / Pay Later) or 'CASH' | 'UPI' | 'BANK' (Paid Immediately)
  const initialMode = spec.initial.mode || 'RECORD';
  const [paymentType, setPaymentType] = useState<'CREDIT' | 'PAID'>(
    initialMode === 'RECORD' ? 'CREDIT' : 'PAID'
  );
  const [paidMode, setPaidMode] = useState<'CASH' | 'UPI' | 'BANK'>(
    ['CASH', 'UPI', 'BANK'].includes(initialMode) ? (initialMode as any) : 'CASH'
  );
  const [dueDate, setDueDate] = useState<string>(spec.initial.due_date || '');

  // Modal / Picker States
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [calendarTarget, setCalendarTarget] = useState<'billDate' | 'dueDate' | null>(null);
  const [localError, setLocalError] = useState('');

  // Selected site
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );

  // Filtered sites for picker
  const filteredSites = useMemo(() => {
    if (!siteSearch.trim()) return data.sites;
    const q = siteSearch.toLowerCase();
    return data.sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q))
    );
  }, [data.sites, siteSearch]);

  // Past supplier names from past material bills for 1-tap autocomplete
  const pastSuppliers = useMemo(() => {
    const set = new Set<string>();
    data.entries
      .filter((e) => e.kind === 'MATERIAL' && e.party && !e.voided_at)
      .forEach((e) => {
        const p = String(e.party).trim();
        if (p) set.add(p);
      });
    return Array.from(set).slice(0, 6);
  }, [data.entries]);

  // Date helpers
  const isToday = date === today();

  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const getFutureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Unit rate calculation preview
  const unitRateCalc = useMemo(() => {
    const amt = Number(amount) || 0;
    const qty = Number(quantity) || 0;
    if (amt > 0 && qty > 0) {
      const rate = Math.round((amt / qty) * 100) / 100;
      return rate;
    }
    return null;
  }, [amount, quantity]);

  // Category select handler
  const handleSelectCategory = (cat: typeof MATERIAL_CATEGORIES[0]) => {
    if (!description.trim()) {
      setDescription(cat.label);
    } else if (!description.toLowerCase().includes(cat.label.toLowerCase())) {
      setDescription(`${cat.label} - ${description}`);
    }
    if (cat.defaultUnit) {
      setUnit(cat.defaultUnit);
    }
  };

  const handleSave = () => {
    setLocalError('');
    if (!siteId) {
      setLocalError('Please select a work site.');
      return;
    }
    if (!amount.trim() || Number(amount) <= 0) {
      setLocalError('Please enter a valid bill amount.');
      return;
    }
    if (!description.trim()) {
      setLocalError('Please enter a material description (e.g. Cement 50 bags).');
      return;
    }
    if (!date) {
      setLocalError('Please select a bill date.');
      return;
    }

    const mode = paymentType === 'CREDIT' ? 'RECORD' : paidMode;

    onSave({
      site_id: siteId,
      amount: amount.trim(),
      date,
      description: description.trim(),
      party: party.trim(),
      mode,
      reference: reference.trim(),
      due_date: paymentType === 'CREDIT' ? dueDate : '',
      quantity: quantity.trim(),
      unit: unit.trim(),
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
                <AppIcon name="cube" size={20} color="#D97706" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Add Material Bill</Text>
                <Text style={styles.headerSubtitle}>
                  Record purchase of cement, paint, steel & hardware
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
            {/* 1. WORK SITE & BILL DATE (Top Row Card) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="business-outline" size={16} color="#0284C7" />
                <Text style={styles.sectionTitle}>Site & Bill Date</Text>
              </View>

              {/* Work Site Selector Dropdown */}
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>Work Site *</Text>
                <Pressable
                  onPress={() => {
                    setSiteSearch('');
                    setIsSitePickerOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.siteDropdownBtn,
                    pressed && { opacity: 0.85, borderColor: '#2563EB' },
                  ]}
                  accessibilityLabel="Select site"
                >
                  <View style={styles.siteIconBox}>
                    <AppIcon name="business" size={16} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteMainText} numberOfLines={1}>
                      {selectedSite?.name || 'Select Work Site'}
                    </Text>
                    {selectedSite?.owner_name ? (
                      <Text style={styles.siteSubText} numberOfLines={1}>
                        Client: {selectedSite.owner_name}
                      </Text>
                    ) : (
                      <Text style={styles.siteSubText}>Tap to change work site</Text>
                    )}
                  </View>
                  <AppIcon name="chevron-down" size={16} color="#64748B" />
                </Pressable>
              </View>

              {/* Bill Date */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Bill / Purchase Date *</Text>
                <Pressable
                  onPress={() => setCalendarTarget('billDate')}
                  style={({ pressed }) => [
                    styles.datePickerBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <AppIcon name="calendar" size={16} color="#2563EB" />
                  <Text style={styles.datePickerText}>{formatDateDisplay(date)}</Text>
                  {isToday ? (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>Today</Text>
                    </View>
                  ) : null}
                  <View style={{ marginLeft: 'auto' }}>
                    <AppIcon name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </Pressable>

                <View style={styles.quickDateRow}>
                  <Pressable
                    onPress={() => setDate(today())}
                    style={[styles.quickDateChip, isToday && styles.quickDateChipActive]}
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
                    onPress={() => setCalendarTarget('billDate')}
                    style={styles.pickCalendarChip}
                  >
                    <AppIcon name="calendar-outline" size={13} color="#2563EB" />
                    <Text style={styles.pickCalendarChipText}>Choose Date</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 2. MATERIAL DETAILS & CATEGORIES */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="cube-outline" size={16} color="#D97706" />
                <Text style={styles.sectionTitle}>Material Item Details</Text>
              </View>

              {/* Quick Categories Bar */}
              <View style={{ gap: 6 }}>
                <Text style={styles.fieldSubNotice}>Quick Select Category:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {MATERIAL_CATEGORIES.map((cat) => {
                    const isSelected =
                      description.toLowerCase().includes(cat.label.toLowerCase()) ||
                      (cat.label === 'Cement' && description.toLowerCase().includes('cement'));
                    return (
                      <Pressable
                        key={cat.label}
                        onPress={() => handleSelectCategory(cat)}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipActive,
                        ]}
                      >
                        <AppIcon
                          name={cat.icon as any}
                          size={14}
                          color={isSelected ? '#D97706' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Description Input */}
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>Material Description *</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. UltraTech Cement 50 bags, Asian Paints Apex 20L"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>

              {/* Quantity & Unit Row */}
              <View style={styles.qtyUnitRow}>
                {/* Quantity */}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.fieldLabel}>Quantity (Optional)</Text>
                  <TextInput
                    value={quantity}
                    onChangeText={(t) => setQuantity(t.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 50"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>

                {/* Unit */}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="bags / litres / pcs"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Common Unit Chips */}
              <View style={styles.commonUnitsRow}>
                {COMMON_UNITS.map((u) => {
                  const isSelected = unit.toLowerCase() === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.unitPill,
                        isSelected && styles.unitPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitPillText,
                          isSelected && styles.unitPillTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. BILL AMOUNT & CALCULATION */}
            <View style={styles.amountCard}>
              <View style={styles.amountTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="cash" size={17} color="#15803D" />
                  <Text style={styles.amountHeading}>Total Bill Amount (₹) *</Text>
                </View>
                {unitRateCalc !== null ? (
                  <View style={styles.unitRateBadge}>
                    <Text style={styles.unitRateBadgeText}>
                      ₹{unitRateCalc} / {unit || 'unit'}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  style={styles.amountLargeInput}
                />
              </View>

              {Number(amount) > 0 && (
                <Text style={styles.amountInWords}>
                  Total: {money(Number(amount) * 100)}
                </Text>
              )}
            </View>

            {/* 4. SUPPLIER (PARTY) & BILL REFERENCE */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="storefront-outline" size={16} color="#475569" />
                <Text style={styles.sectionTitle}>Supplier & Invoice</Text>
              </View>

              {/* Supplier Input */}
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>Supplier / Dukan Name (Party)</Text>
                <TextInput
                  value={party}
                  onChangeText={setParty}
                  placeholder="e.g. Gupta Building Materials, Laxmi Hardware..."
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />

                {/* Past Supplier Chips */}
                {pastSuppliers.length > 0 && (
                  <View style={{ marginTop: 4, gap: 4 }}>
                    <Text style={styles.fieldSubNotice}>Recent Suppliers (Tap to auto-fill):</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      {pastSuppliers.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => setParty(s)}
                          style={[
                            styles.supplierChip,
                            party === s && styles.supplierChipActive,
                          ]}
                        >
                          <AppIcon
                            name="storefront"
                            size={12}
                            color={party === s ? '#1D4ED8' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.supplierChipText,
                              party === s && styles.supplierChipTextActive,
                            ]}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Bill / Invoice Reference */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Invoice / Bill No. / Challan (Optional)</Text>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  placeholder="e.g. Bill #8924, Challan 14"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* 5. PAYMENT STATUS & DUE DATE */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="wallet-outline" size={16} color="#7C3AED" />
                <Text style={styles.sectionTitle}>Payment Terms</Text>
              </View>

              {/* Two Big Tactile Cards: Credit vs Paid */}
              <View style={styles.paymentTermsRow}>
                {/* Credit / Udhar (Pay Later) */}
                <Pressable
                  onPress={() => setPaymentType('CREDIT')}
                  style={[
                    styles.paymentOptionCard,
                    styles.paymentOptionCredit,
                    paymentType === 'CREDIT' && styles.paymentOptionCreditActive,
                  ]}
                >
                  <View style={styles.paymentOptionTop}>
                    <AppIcon
                      name="document-text"
                      size={18}
                      color={paymentType === 'CREDIT' ? '#B45309' : '#D97706'}
                    />
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        paymentType === 'CREDIT' && { color: '#B45309' },
                      ]}
                    >
                      Credit / Udhar
                    </Text>
                  </View>
                  <Text style={styles.paymentOptionSub}>Pay later (Accrued cost)</Text>
                </Pressable>

                {/* Paid Now */}
                <Pressable
                  onPress={() => setPaymentType('PAID')}
                  style={[
                    styles.paymentOptionCard,
                    styles.paymentOptionPaid,
                    paymentType === 'PAID' && styles.paymentOptionPaidActive,
                  ]}
                >
                  <View style={styles.paymentOptionTop}>
                    <AppIcon
                      name="checkmark-circle"
                      size={18}
                      color={paymentType === 'PAID' ? '#15803D' : '#16A34A'}
                    />
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        paymentType === 'PAID' && { color: '#15803D' },
                      ]}
                    >
                      Paid Immediately
                    </Text>
                  </View>
                  <Text style={styles.paymentOptionSub}>Paid on spot</Text>
                </Pressable>
              </View>

              {/* If Credit: Optional Due Date */}
              {paymentType === 'CREDIT' && (
                <View style={styles.dueDateSection}>
                  <Text style={styles.fieldLabel}>Payment Due Date (Optional):</Text>

                  <Pressable
                    onPress={() => setCalendarTarget('dueDate')}
                    style={styles.dueDateBtn}
                  >
                    <AppIcon name="calendar-outline" size={15} color="#D97706" />
                    <Text style={styles.dueDateBtnText}>
                      {dueDate ? formatDateDisplay(dueDate) : 'Set Due Date'}
                    </Text>
                    {dueDate ? (
                      <Pressable onPress={() => setDueDate('')}>
                        <AppIcon name="close-circle" size={15} color="#64748B" />
                      </Pressable>
                    ) : (
                      <View style={{ marginLeft: 'auto' }}>
                        <AppIcon
                          name="chevron-forward"
                          size={15}
                          color={Colors.textMuted}
                        />
                      </View>
                    )}
                  </Pressable>

                  {/* Quick Due Date Chips */}
                  <View style={styles.quickDateRow}>
                    <Pressable
                      onPress={() => setDueDate(getFutureDate(7))}
                      style={styles.quickDateChip}
                    >
                      <Text style={styles.quickDateChipText}>+7 Days</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDueDate(getFutureDate(15))}
                      style={styles.quickDateChip}
                    >
                      <Text style={styles.quickDateChipText}>+15 Days</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDueDate(getFutureDate(30))}
                      style={styles.quickDateChip}
                    >
                      <Text style={styles.quickDateChipText}>+30 Days</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* If Paid Immediately: Payment Method (Cash, UPI, Bank) */}
              {paymentType === 'PAID' && (
                <View style={styles.paidMethodSection}>
                  <Text style={styles.fieldLabel}>Payment Mode:</Text>
                  <View style={styles.paidModePillsRow}>
                    {[
                      { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
                      { key: 'UPI', label: 'UPI (GPay/PhonePe)', icon: 'phone-portrait-outline' },
                      { key: 'BANK', label: 'Bank / NEFT', icon: 'business-outline' },
                    ].map((m) => {
                      const isSelected = paidMode === m.key;
                      return (
                        <Pressable
                          key={m.key}
                          onPress={() => setPaidMode(m.key as any)}
                          style={[
                            styles.paidModePill,
                            isSelected && styles.paidModePillActive,
                          ]}
                        >
                          <AppIcon
                            name={m.icon as any}
                            size={14}
                            color={isSelected ? '#15803D' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.paidModePillText,
                              isSelected && styles.paidModePillTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
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
                  <Text style={styles.saveBtnText}>Save Material Bill</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={calendarTarget !== null}
        title={calendarTarget === 'dueDate' ? 'Select Payment Due Date' : 'Select Bill Date'}
        selectedDate={calendarTarget === 'dueDate' ? dueDate || today() : date}
        onSelect={(newDate) => {
          if (newDate) {
            if (calendarTarget === 'dueDate') {
              setDueDate(newDate);
            } else {
              setDate(newDate);
            }
          }
        }}
        onClose={() => setCalendarTarget(null)}
      />

      {/* Work Site Picker Modal */}
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
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  fieldSubNotice: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  siteDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  siteIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  siteSubText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  datePickerText: {
    fontSize: 13,
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
    paddingVertical: 5,
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
    fontSize: 11,
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
    paddingVertical: 5,
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
  categoryScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  categoryChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  qtyUnitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  commonUnitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  unitPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  unitPillTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  amountCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  amountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  unitRateBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  unitRateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803D',
  },
  amountLargeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    paddingVertical: 8,
  },
  amountInWords: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  supplierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  supplierChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  supplierChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  supplierChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  paymentTermsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentOptionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
    borderWidth: 1.5,
  },
  paymentOptionCredit: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  paymentOptionCreditActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  paymentOptionPaid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  paymentOptionPaidActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  paymentOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  paymentOptionSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  dueDateSection: {
    backgroundColor: '#FFFDF5',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  dueDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dueDateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  paidMethodSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
  },
  paidModePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paidModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  paidModePillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  paidModePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  paidModePillTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
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
    backgroundColor: '#D97706',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
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
