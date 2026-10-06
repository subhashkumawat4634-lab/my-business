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

export interface ReceivePaymentModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const PAYMENT_MODES = [
  { key: 'UPI', label: 'UPI / GPay / PhonePe', icon: 'phone-portrait-outline', badge: 'Fastest' },
  { key: 'CASH', label: 'Cash (Nokad)', icon: 'cash-outline', badge: 'Direct' },
  { key: 'BANK', label: 'Bank / Cheque / NEFT', icon: 'business-outline', badge: 'Traceable' },
];

const STAGE_PRESETS = [
  'Advance Payment',
  'Plinth / Foundation Stage',
  'Lanter / Slab Casting',
  'Brickwork & Plaster Stage',
  'Flooring & Tile Work',
  'Painting & Finishing',
  'Final Settlement',
];

export function ReceivePaymentModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: ReceivePaymentModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Form State
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>(spec.initial.amount || '');
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [mode, setMode] = useState<'UPI' | 'CASH' | 'BANK'>('UPI');
  const [description, setDescription] = useState<string>(spec.initial.description || '');

  // Currently selected site
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );

  // Party / Payer name (default to site client)
  const [party, setParty] = useState<string>(
    spec.initial.party || selectedSite?.owner_name || ''
  );
  const [reference, setReference] = useState<string>(spec.initial.reference || '');

  // UI state
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Site financials & balance calculation
  const siteFinancials = useMemo(() => {
    if (!selectedSite) return { totalContract: 0, received: 0, pending: 0 };

    const contractAmount = Number(selectedSite.contract_amount) || 0;

    // Extra work approved on this site
    const extraTotal = data.entries
      .filter((e) => e.site_id === selectedSite.id && e.kind === 'EXTRA' && !e.voided_at)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const totalContract = contractAmount + extraTotal;

    // Total payments already received from client
    const received = data.entries
      .filter((e) => e.site_id === selectedSite.id && e.kind === 'RECEIPT' && !e.voided_at)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const pending = Math.max(0, totalContract - received);

    return { totalContract, received, pending };
  }, [selectedSite, data.entries]);

  // Projected remaining balance after current payment
  const remainingAfterPayment = useMemo(() => {
    const paymentPaise = (Number(amount) || 0) * 100;
    return Math.max(0, siteFinancials.pending - paymentPaise);
  }, [siteFinancials.pending, amount]);

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

  const handleQuickAmount = (rupees: number) => {
    setAmount(String(rupees));
  };

  const handleSave = () => {
    setLocalError('');
    if (!siteId) {
      setLocalError('Please select a work site.');
      return;
    }
    if (!amount.trim() || Number(amount) <= 0) {
      setLocalError('Please enter a valid payment amount received.');
      return;
    }
    if (!date) {
      setLocalError('Please select payment date.');
      return;
    }

    onSave({
      site_id: siteId,
      amount: amount.trim(),
      date,
      description: description.trim() || 'Client payment received',
      party: party.trim() || (selectedSite?.owner_name || ''),
      mode,
      reference: reference.trim(),
      due_date: '',
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
                <AppIcon name="arrow-down-circle" size={20} color="#15803D" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Receive Payment</Text>
                <Text style={styles.headerSubtitle}>
                  Record client payment, milestone receipt & cash in
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
            {/* 1. WORK SITE SELECTOR & FINANCIAL OVERVIEW CARD */}
            <View style={[styles.sectionCard, { zIndex: 20 }]}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="business-outline" size={16} color="#0284C7" />
                <Text style={styles.sectionTitle}>Work Site & Client</Text>
              </View>

                {/* Work Site Selector Dropdown / Select Bar */}
                <View style={{ gap: 4 }}>
                  <Text style={styles.fieldLabel}>Receiving for Site *</Text>
                  <View
                    style={[
                      styles.siteDropdownBtn,
                      { position: 'relative' },
                    ]}
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
                        <Text style={styles.siteSubText}>Select work site</Text>
                      )}
                    </View>
                    <AppIcon
                      name="chevron-down"
                      size={16}
                      color="#64748B"
                    />

                    {/* Native HTML Select Bar for direct dropdown selection */}
                    {Platform.OS === 'web' && (
                      <select
                        value={siteId}
                        onChange={(e: any) => {
                          const newSiteId = e.target.value;
                          setSiteId(newSiteId);
                          const s = data.sites.find((item) => item.id === newSiteId);
                          if (s?.owner_name) {
                            setParty(s.owner_name);
                          }
                        }}
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
                                {s.owner_name ? `Client: ${s.owner_name}` : 'No client specified'}
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

              {/* Outstanding Balance Banner */}
              {selectedSite && (
                <View style={styles.financialsBanner}>
                  <View style={styles.financialCol}>
                    <Text style={styles.financialLabel}>Total Contract</Text>
                    <Text style={styles.financialValue}>
                      {money(siteFinancials.totalContract)}
                    </Text>
                  </View>

                  <View style={styles.financialDivider} />

                  <View style={styles.financialCol}>
                    <Text style={styles.financialLabel}>Already Received</Text>
                    <Text style={[styles.financialValue, { color: '#15803D' }]}>
                      {money(siteFinancials.received)}
                    </Text>
                  </View>

                  <View style={styles.financialDivider} />

                  <View style={styles.financialCol}>
                    <Text style={styles.financialLabel}>Pending Due</Text>
                    <Text style={[styles.financialValue, { color: '#B45309' }]}>
                      {money(siteFinancials.pending)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 2. AMOUNT RECEIVED CARD */}
            <View style={styles.amountCard}>
              <View style={styles.amountTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="cash" size={17} color="#15803D" />
                  <Text style={styles.amountHeading}>Amount Received (₹) *</Text>
                </View>
                {Number(amount) > 0 && (
                  <View style={styles.remainingPill}>
                    <Text style={styles.remainingPillText}>
                      Bal Due: {money(remainingAfterPayment)}
                    </Text>
                  </View>
                )}
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

              {/* Quick Amount Suggestion Chips */}
              <View style={styles.quickAmountRow}>
                {siteFinancials.pending > 0 && (
                  <Pressable
                    onPress={() => handleQuickAmount(siteFinancials.pending / 100)}
                    style={styles.quickAmountChip}
                  >
                    <Text style={styles.quickAmountChipText}>
                      Full Due ({money(siteFinancials.pending)})
                    </Text>
                  </Pressable>
                )}
                {[10000, 25000, 50000, 100000].map((amt) => (
                  <Pressable
                    key={amt}
                    onPress={() => handleQuickAmount(amt)}
                    style={styles.quickAmountChip}
                  >
                    <Text style={styles.quickAmountChipText}>
                      +{money(amt * 100)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* 3. PAYMENT MODE SELECTION */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="wallet-outline" size={16} color="#15803D" />
                <Text style={styles.sectionTitle}>Payment Mode *</Text>
              </View>

              <View style={styles.modeCardsRow}>
                {PAYMENT_MODES.map((m) => {
                  const isSelected = mode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMode(m.key as any)}
                      style={[
                        styles.modeCard,
                        isSelected && styles.modeCardActive,
                      ]}
                    >
                      <View style={styles.modeTop}>
                        <AppIcon
                          name={m.icon as any}
                          size={18}
                          color={isSelected ? '#15803D' : '#64748B'}
                        />
                        <View
                          style={[
                            styles.modeBadge,
                            isSelected && { backgroundColor: '#DCFCE7' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modeBadgeText,
                              isSelected && { color: '#15803D' },
                            ]}
                          >
                            {m.badge}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.modeTitle,
                          isSelected && styles.modeTitleActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. RECEIPT DATE & PAYMENT DETAILS */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                <Text style={styles.sectionTitle}>Receipt Date & Stage</Text>
              </View>

              {/* Receipt Date */}
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>Payment Date *</Text>
                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
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
                    <AppIcon name="calendar" size={16} color="#15803D" />
                  </View>
                </Pressable>
              </View>

              {/* Milestone / Stage Presets */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldSubNotice}>Payment Stage (Quick select):</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.stageScroll}
                >
                  {STAGE_PRESETS.map((stage) => {
                    const isSelected = description.includes(stage);
                    return (
                      <Pressable
                        key={stage}
                        onPress={() => setDescription(stage)}
                        style={[
                          styles.stageChip,
                          isSelected && styles.stageChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stageChipText,
                            isSelected && styles.stageChipTextActive,
                          ]}
                        >
                          {stage}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Description Input */}
              <View style={{ gap: 4, marginTop: 2 }}>
                <Text style={styles.fieldLabel}>Payment Note / Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. 2nd milestone payment, slab completion cash"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* 5. PAYER & TRANSACTION REFERENCE */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AppIcon name="receipt-outline" size={16} color="#475569" />
                <Text style={styles.sectionTitle}>Payer & Transaction Reference</Text>
              </View>

              {/* Received From (Payer) */}
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>Received From (Payer Name)</Text>
                <TextInput
                  value={party}
                  onChangeText={setParty}
                  placeholder="e.g. Client name, Sharma Ji, builder"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>

              {/* Reference / UTR Number */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>
                  {mode === 'UPI'
                    ? 'UPI UTR / Transaction ID (Optional)'
                    : mode === 'BANK'
                    ? 'Cheque / NEFT Reference (Optional)'
                    : 'Receipt No. / Voucher Ref (Optional)'}
                </Text>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  placeholder={
                    mode === 'UPI'
                      ? 'e.g. UTR 428941098234'
                      : mode === 'BANK'
                      ? 'e.g. Cheque #492810'
                      : 'e.g. Cash Receipt #04'
                  }
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.textInput}
                />
              </View>
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
                  <Text style={styles.saveBtnText}>Save Payment</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* Calendar Picker Modal */}
        {isCalendarOpen && (
          <CalendarPickerModal
            visible={isCalendarOpen}
            title="Select Payment Date"
            selectedDate={date}
            onSelect={(newDate) => {
              if (newDate) setDate(newDate);
            }}
            onClose={() => setIsCalendarOpen(false)}
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
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
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
  financialsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  financialCol: {
    flex: 1,
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  financialValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  financialDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
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
  remainingPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  remainingPillText: {
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
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  quickAmountChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  quickAmountChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  modeCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  modeCardActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  modeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  modeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modeTitleActive: {
    color: '#15803D',
    fontWeight: '800',
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

  stageScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  stageChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stageChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  stageChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  stageChipTextActive: {
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
    backgroundColor: '#16A34A',
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
