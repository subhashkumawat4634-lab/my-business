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
import { today } from '../../forms';
import { money } from '../../finance';

export interface ExtraWorkModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const EXTRA_WORK_CATEGORIES = [
  { label: 'Extra Wall / Demolition', icon: 'grid-outline' },
  { label: 'Texture / Enamel Paint', icon: 'color-palette-outline' },
  { label: 'Balcony / Bath Tiles', icon: 'apps-outline' },
  { label: 'Electrical Wiring / Points', icon: 'flash-outline' },
  { label: 'Plumbing Shift', icon: 'water-outline' },
  { label: 'False Ceiling Molding', icon: 'layers-outline' },
  { label: 'Waterproofing Addition', icon: 'shield-checkmark-outline' },
  { label: 'Granite Counter / Polish', icon: 'cube-outline' },
];

const APPROVAL_PRESETS = [
  'WhatsApp message confirmation',
  'Client verbal approval on site',
  'Signed drawing / site slip',
  'Phone call confirmation',
];

export function ExtraWorkModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: ExtraWorkModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Form State
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [amount, setAmount] = useState<string>(spec.initial.amount || '');
  const [description, setDescription] = useState<string>(spec.initial.description || '');

  // Selected site
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );

  // Party / Client name (default to site client name)
  const [party, setParty] = useState<string>(
    spec.initial.party || selectedSite?.owner_name || ''
  );

  // Approval Reference (Required for extra work to prevent client dispute)
  const [reference, setReference] = useState<string>(
    spec.initial.reference || 'WhatsApp approval by client'
  );

  // Payment Mode: 'RECORD' (Added to client bill / pay later) vs 'CASH' | 'UPI' | 'BANK' (Paid on spot)
  const initialMode = spec.initial.mode || 'RECORD';
  const [paymentType, setPaymentType] = useState<'RECORD' | 'PAID'>(
    initialMode === 'RECORD' ? 'RECORD' : 'PAID'
  );
  const [paidMode, setPaidMode] = useState<'CASH' | 'UPI' | 'BANK'>(
    ['CASH', 'UPI', 'BANK'].includes(initialMode) ? (initialMode as any) : 'CASH'
  );
  const [dueDate, setDueDate] = useState<string>(spec.initial.due_date || '');

  // UI pickers state
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [calendarTarget, setCalendarTarget] = useState<'workDate' | 'dueDate' | null>(null);
  const [localError, setLocalError] = useState('');

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

  const isToday = date === today();

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

  // Category select handler
  const handleSelectCategory = (cat: typeof EXTRA_WORK_CATEGORIES[0]) => {
    if (!description.trim()) {
      setDescription(cat.label);
    } else if (!description.toLowerCase().includes(cat.label.toLowerCase())) {
      setDescription(`${cat.label} - ${description}`);
    }
  };

  const handleSave = () => {
    setLocalError('');
    if (!siteId) {
      setLocalError('Please select a work site.');
      return;
    }
    if (!amount.trim() || Number(amount) <= 0) {
      setLocalError('Please enter a valid extra work amount.');
      return;
    }
    if (!description.trim()) {
      setLocalError('Please describe the extra work done.');
      return;
    }
    if (!reference.trim()) {
      setLocalError('Please provide client approval reference or agreement.');
      return;
    }

    const mode = paymentType === 'RECORD' ? 'RECORD' : paidMode;

    onSave({
      site_id: siteId,
      amount: amount.trim(),
      date,
      description: description.trim(),
      party: party.trim() || (selectedSite?.owner_name || ''),
      mode,
      reference: reference.trim(),
      due_date: paymentType === 'RECORD' ? dueDate : '',
      quantity: '',
      unit: '',
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
                <AppIcon name="add-circle" size={20} color="#7C3AED" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Add Extra Work (Extra Kaam)</Text>
                <Text style={styles.headerSubtitle}>
                  Record client-approved additional work & billable scope
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
            {/* 1. WORK SITE & DATE SECTION */}
            <View style={[styles.sectionCard, { zIndex: 20 }]}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="business-outline" size={16} color="#0284C7" />
                <Text style={styles.sectionTitle}>Site & Date</Text>
              </View>

              {/* Work Site Selector Dropdown */}
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>Work Site *</Text>
                <Pressable
                  onPress={() => setIsSiteDropdownOpen((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.siteDropdownBtn,
                    isSiteDropdownOpen && { borderColor: '#0284C7', backgroundColor: '#EFF6FF' },
                    pressed && { opacity: 0.85 },
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
                    <Text style={styles.siteSubText} numberOfLines={1}>
                      {selectedSite?.name ? 'Work Site' : 'Tap to change work site'}
                    </Text>
                  </View>
                  <AppIcon
                    name={isSiteDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#64748B"
                  />
                </Pressable>

                {/* Inline Work Site Dropdown Menu */}
                {isSiteDropdownOpen && (
                  <View style={styles.siteDropdownMenu}>
                    {data.sites.length > 5 && (
                      <View style={styles.inlineSearchBox}>
                        <AppIcon name="search" size={13} color={Colors.textMuted} />
                        <TextInput
                          value={siteSearch}
                          onChangeText={setSiteSearch}
                          placeholder="Search site or client..."
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
                              if (s.owner_name && !party) {
                                setParty(s.owner_name);
                              }
                              setIsSiteDropdownOpen(false);
                            }}
                            style={({ pressed }) => [
                              styles.siteMenuItem,
                              isSelected && styles.siteMenuItemActive,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <View
                              style={[
                                styles.siteMenuItemIcon,
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
                                  styles.siteMenuItemTitle,
                                  isSelected && { color: '#0284C7', fontWeight: '800' },
                                ]}
                                numberOfLines={1}
                              >
                                {s.name}
                              </Text>
                              <Text style={styles.siteMenuItemDesc} numberOfLines={1}>
                                Work Site
                              </Text>
                            </View>
                            {isSelected && (
                              <AppIcon name="checkmark" size={14} color="#0284C7" />
                            )}
                          </Pressable>
                        );
                      })}
                      {!filteredSites.length && (
                        <Text style={styles.pickerEmptyText}>No sites found.</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Work Date */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Work Date *</Text>
                <Pressable
                  onPress={() => setCalendarTarget('workDate')}
                  style={({ pressed }) => [
                    styles.datePickerBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.datePickerText}>{formatDateDisplay(date)}</Text>
                  {isToday ? (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>Today</Text>
                    </View>
                  ) : null}
                  <View style={{ marginLeft: 'auto' }}>
                    <AppIcon name="calendar" size={16} color="#7C3AED" />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* 2. EXTRA WORK SCOPE & DESCRIPTION */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="hammer-outline" size={16} color="#D97706" />
                <Text style={styles.sectionTitle}>Extra Work Details</Text>
              </View>

              {/* Quick Categories Bar */}
              <View style={{ gap: 6 }}>
                <Text style={styles.fieldSubNotice}>Quick Select Extra Work Category:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {EXTRA_WORK_CATEGORIES.map((cat) => {
                    const isSelected = description
                      .toLowerCase()
                      .includes(cat.label.toLowerCase());
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
                          color={isSelected ? '#7C3AED' : '#64748B'}
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
                <Text style={styles.fieldLabel}>Extra Work Description *</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. Master bedroom wall Royal texture paint + balcony tile work"
                  placeholderTextColor={Colors.textSubtle}
                  multiline
                  style={styles.notesInput}
                />
              </View>
            </View>

            {/* 3. AGREED EXTRA AMOUNT CARD */}
            <View style={styles.amountCard}>
              <View style={styles.amountTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="cash" size={17} color="#15803D" />
                  <Text style={styles.amountHeading}>Agreed Extra Amount (₹) *</Text>
                </View>
                <View style={styles.billableBadge}>
                  <Text style={styles.billableBadgeText}>Billable to Client</Text>
                </View>
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
                  Adds {money(Number(amount) * 100)} to total site contract value
                </Text>
              )}
            </View>

            {/* 4. CLIENT APPROVAL REFERENCE (Proof & Protection) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="shield-checkmark-outline" size={16} color="#15803D" />
                <Text style={styles.sectionTitle}>Client Approval & Reference *</Text>
              </View>

              <Text style={styles.approvalNoticeText}>
                Adding proof prevents client disputes at final settlement.
              </Text>

              {/* Quick Approval Proof Chips */}
              <View style={styles.presetChipsWrap}>
                {APPROVAL_PRESETS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setReference(p)}
                    style={[
                      styles.approvalChip,
                      reference === p && styles.approvalChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.approvalChipText,
                        reference === p && styles.approvalChipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Reference Input */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Approval Reference / Details *</Text>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  placeholder="e.g. WhatsApp message dated 28 Sep by Sharma Ji"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>

              {/* Client / Approver Name */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Approved By (Client / Party)</Text>
                <TextInput
                  value={party}
                  onChangeText={setParty}
                  placeholder="Client name or site supervisor..."
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* 5. PAYMENT STATUS / LEDGER IMPACT */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="wallet-outline" size={16} color="#7C3AED" />
                <Text style={styles.sectionTitle}>Payment Terms</Text>
              </View>

              {/* Two Big Tactile Cards: Add to Ledger vs Paid Now */}
              <View style={styles.paymentTermsRow}>
                {/* Add to Final Bill / Ledger (RECORD) */}
                <Pressable
                  onPress={() => setPaymentType('RECORD')}
                  style={[
                    styles.paymentOptionCard,
                    styles.paymentOptionCredit,
                    paymentType === 'RECORD' && styles.paymentOptionCreditActive,
                  ]}
                >
                  <View style={styles.paymentOptionTop}>
                    <AppIcon
                      name="document-text"
                      size={18}
                      color={paymentType === 'RECORD' ? '#B45309' : '#D97706'}
                    />
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        paymentType === 'RECORD' && { color: '#B45309' },
                      ]}
                    >
                      Add to Client Ledger
                    </Text>
                  </View>
                  <Text style={styles.paymentOptionSub}>
                    Receive with final settlement
                  </Text>
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
                      Paid on Spot
                    </Text>
                  </View>
                  <Text style={styles.paymentOptionSub}>
                    Client paid advance / full
                  </Text>
                </Pressable>
              </View>

              {/* If Add to Ledger: Optional Due Date */}
              {paymentType === 'RECORD' && (
                <View style={styles.dueDateSection}>
                  <Text style={styles.fieldLabel}>Expected Payment Date (Optional):</Text>

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

              {/* If Paid on Spot: Payment Mode */}
              {paymentType === 'PAID' && (
                <View style={styles.paidMethodSection}>
                  <Text style={styles.fieldLabel}>Payment Mode Received:</Text>
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
                  <Text style={styles.saveBtnText}>Save Extra Work</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* Calendar Picker Modal */}
        {calendarTarget !== null && (
          <CalendarPickerModal
            visible={calendarTarget !== null}
            title={calendarTarget === 'dueDate' ? 'Select Payment Due Date' : 'Select Work Date'}
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
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
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
  approvalNoticeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  presetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  approvalChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  approvalChipActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  approvalChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  approvalChipTextActive: {
    color: '#15803D',
    fontWeight: '800',
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
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 64,
    textAlignVertical: 'top',
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
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickDateChipTextActive: {
    color: '#6D28D9',
    fontWeight: '800',
  },
  pickCalendarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginLeft: 'auto',
  },
  pickCalendarChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
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
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#6D28D9',
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
  billableBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  billableBadgeText: {
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
    backgroundColor: '#7C3AED',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  siteDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
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
    margin: 6,
    marginBottom: 4,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  siteMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  siteMenuItemActive: {
    backgroundColor: '#F0F9FF',
  },
  siteMenuItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteMenuItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  siteMenuItemDesc: {
    fontSize: 10,
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
