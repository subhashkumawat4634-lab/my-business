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
import { Badge } from '../common/Badge';
import { FormSpec, Row, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { today } from '../../forms';
import { money, workerSummary } from '../../finance';

export interface LabourPaymentModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash (नकद)', icon: 'cash-outline', badge: 'Hand-to-Hand' },
  { key: 'UPI', label: 'UPI / Online', icon: 'phone-portrait-outline', badge: 'Fastest' },
  { key: 'BANK', label: 'Bank / Cheque', icon: 'business-outline', badge: 'Traceable' },
];

const WAGE_PRESETS = [
  'Weekly wage payout',
  'Bi-weekly wage settlement',
  'Overtime compensation',
  'Full & final settlement',
  'Daily wage cash payment',
];

const ADVANCE_PRESETS = [
  'Advance for personal need',
  'Ration & kharcha advance',
  'Festival / Holiday advance',
  'Travel / Fare advance',
  'Emergency medical advance',
];

const AVATAR_PALETTES = [
  { bg: '#EFF6FF', text: '#1E40AF' },
  { bg: '#ECFDF5', text: '#065F46' },
  { bg: '#F5F3FF', text: '#5B21B6' },
  { bg: '#FFFBEB', text: '#92400E' },
  { bg: '#FFF1F2', text: '#9F1239' },
  { bg: '#F0FDF4', text: '#166534' },
];

function getAvatarStyle(name: string = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'W';
}

function getSkillIcon(skill: string = ''): string {
  const s = skill.toLowerCase();
  if (s.includes('mason') || s.includes('mistri') || s.includes('raj')) return 'construct';
  if (s.includes('paint')) return 'color-palette';
  if (s.includes('carpent') || s.includes('wood')) return 'cut';
  if (s.includes('electr') || s.includes('bijli')) return 'flash';
  if (s.includes('plumb') || s.includes('pipe')) return 'water';
  if (s.includes('weld') || s.includes('loha') || s.includes('steel')) return 'hammer';
  if (s.includes('supervis') || s.includes('thekadar')) return 'briefcase';
  if (s.includes('help') || s.includes('mazdoor') || s.includes('labour')) return 'people';
  return 'person';
}

export function LabourPaymentModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: LabourPaymentModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Selected Worker
  const [workerId, setWorkerId] = useState<string>(
    spec.initial.worker_id ||
      data.workers.find((w) => w.active)?.id ||
      data.workers[0]?.id ||
      ''
  );

  // Selected Project Site
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );

  // Payment Type: WAGE vs ADVANCE
  const [paymentType, setPaymentType] = useState<'WAGE' | 'ADVANCE'>('WAGE');

  // Amount & Date
  const [amount, setAmount] = useState<string>(spec.initial.amount || '');
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');

  // Description & Reference
  const [description, setDescription] = useState<string>(
    spec.initial.description || 'Weekly wage payout'
  );
  const [reference, setReference] = useState<string>(spec.initial.reference || '');

  // UI Dropdowns & Modal State
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Currently Selected Worker Object
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === workerId) || data.workers[0],
    [data.workers, workerId]
  );

  // Currently Selected Site Object
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );

  // Worker Financial Summary
  const workerSummaryData = useMemo(() => {
    if (!selectedWorker) {
      return { earned: 0, paid: 0, balance: 0, daysWorked: 0 };
    }
    const sum = workerSummary(selectedWorker, data.attendance, data.entries);
    const days = data.attendance
      .filter((a) => a.worker_id === selectedWorker.id)
      .reduce((s, a) => s + Number(a.units || 0), 0);

    return {
      earned: sum.earned,
      paid: sum.paid,
      balance: sum.balance, // in paise
      daysWorked: days,
    };
  }, [selectedWorker, data.attendance, data.entries]);

  const isPendingWage = workerSummaryData.balance > 0;
  const isAdvanceTaken = workerSummaryData.balance < 0;
  const isSettled = workerSummaryData.balance === 0;

  // Real-time Projected Balance calculation after current transaction
  const projectedBalance = useMemo(() => {
    const curBalanceRupees = workerSummaryData.balance / 100;
    const enterRupees = Number(amount) || 0;
    const after = curBalanceRupees - enterRupees;
    return after;
  }, [workerSummaryData.balance, amount]);

  // Filtered workers list for dropdown
  const filteredWorkers = useMemo(() => {
    if (!workerSearch.trim()) return data.workers;
    const q = workerSearch.toLowerCase();
    return data.workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.skill && w.skill.toLowerCase().includes(q)) ||
        (w.phone && w.phone.includes(q))
    );
  }, [data.workers, workerSearch]);

  // Filtered sites list for dropdown
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

  const handleSelectPaymentType = (type: 'WAGE' | 'ADVANCE') => {
    setPaymentType(type);
    if (type === 'ADVANCE') {
      if (!description || WAGE_PRESETS.includes(description)) {
        setDescription('Advance for personal need');
      }
    } else {
      if (!description || ADVANCE_PRESETS.includes(description)) {
        setDescription('Weekly wage payout');
      }
    }
  };

  const handleSave = () => {
    setLocalError('');
    if (!workerId) {
      setLocalError('Please select an employee / labour.');
      return;
    }
    if (!siteId) {
      setLocalError('Please select the project site for this payout.');
      return;
    }
    const amtNum = Number(amount);
    if (!amount.trim() || isNaN(amtNum) || amtNum <= 0) {
      setLocalError('Please enter a valid payment amount greater than ₹0.');
      return;
    }
    if (!date) {
      setLocalError('Please select a payment date.');
      return;
    }

    onSave({
      site_id: siteId,
      worker_id: workerId,
      amount: amount.trim(),
      date,
      description:
        description.trim() ||
        (paymentType === 'ADVANCE' ? 'Worker advance payment' : 'Labour wage payout'),
      party: selectedWorker?.name || '',
      mode,
      reference: reference.trim(),
    });
  };

  const avatarTheme = getAvatarStyle(selectedWorker?.name || '');

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerBadgeRow}>
                <AppIcon name="wallet" size={17} color="#15803D" />
                <Text style={styles.headerTitle}>Labour Payment / Advance</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {selectedWorker
                  ? `Record wage payout or advance for ${selectedWorker.name}`
                  : 'Record labour wage payment or worker advance'}
              </Text>
            </View>

            <Pressable
              onPress={() => !busy && onClose()}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
              ]}
              accessibilityLabel="Close payment form"
            >
              <AppIcon name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          {/* Payment Type Segmented Tabs: Wage Payout vs Advance */}
          <View style={styles.typeSegmentWrapper}>
            <Pressable
              onPress={() => handleSelectPaymentType('WAGE')}
              style={[
                styles.typeSegmentItem,
                paymentType === 'WAGE' && styles.typeSegmentItemActiveWage,
              ]}
            >
              <AppIcon
                name="cash-outline"
                size={15}
                color={paymentType === 'WAGE' ? '#15803D' : '#64748B'}
              />
              <Text
                style={[
                  styles.typeSegmentText,
                  paymentType === 'WAGE' && styles.typeSegmentTextActiveWage,
                ]}
              >
                Wage Payment (मजदूरी)
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelectPaymentType('ADVANCE')}
              style={[
                styles.typeSegmentItem,
                paymentType === 'ADVANCE' && styles.typeSegmentItemActiveAdvance,
              ]}
            >
              <AppIcon
                name="arrow-forward-outline"
                size={15}
                color={paymentType === 'ADVANCE' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.typeSegmentText,
                  paymentType === 'ADVANCE' && styles.typeSegmentTextActiveAdvance,
                ]}
              >
                Give Advance (पेशगी)
              </Text>
            </Pressable>
          </View>

          {/* Scrollable Form Body */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Error Banner */}
              {Boolean(error || localError) ? (
                <View style={styles.errorBanner}>
                  <AppIcon name="alert-circle" size={17} color="#DC2626" />
                  <Text style={styles.errorText}>{localError || error}</Text>
                </View>
              ) : null}

              {/* 1. WORKER SELECTION & LIVE BALANCE CARD */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="people" size={16} color="#0F2851" />
                  <Text style={styles.sectionTitle}>Employee / Labour *</Text>
                </View>

                {/* Worker Selector Dropdown Button */}
                <Pressable
                  onPress={() => {
                    setIsWorkerDropdownOpen(!isWorkerDropdownOpen);
                    setIsSiteDropdownOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectorBtn,
                    isWorkerDropdownOpen && styles.selectorBtnActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityLabel="Select worker"
                >
                  <View style={[styles.avatarBoxSmall, { backgroundColor: avatarTheme.bg }]}>
                    <Text style={[styles.avatarTextSmall, { color: avatarTheme.text }]}>
                      {getInitials(selectedWorker?.name)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.selectorMainText} numberOfLines={1}>
                        {selectedWorker?.name || 'Select Worker'}
                      </Text>
                      {selectedWorker?.skill ? (
                        <View style={styles.miniSkillBadge}>
                          <AppIcon
                            name={getSkillIcon(selectedWorker.skill)}
                            size={10}
                            color="#1E40AF"
                          />
                          <Text style={styles.miniSkillText}>{selectedWorker.skill}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.selectorSubText}>
                      {selectedWorker
                        ? `${money(selectedWorker.daily_rate)}/day${
                            selectedWorker.phone ? ` • ${selectedWorker.phone}` : ''
                          }`
                        : 'Tap to pick an employee'}
                    </Text>
                  </View>

                  <AppIcon
                    name={isWorkerDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#64748B"
                  />
                </Pressable>

                {/* Inline Worker Dropdown Menu */}
                {isWorkerDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    {data.workers.length > 4 ? (
                      <View style={styles.searchBox}>
                        <AppIcon name="search" size={13} color="#94A3B8" />
                        <TextInput
                          value={workerSearch}
                          onChangeText={setWorkerSearch}
                          placeholder="Search worker by name, skill, phone..."
                          placeholderTextColor="#94A3B8"
                          style={styles.searchInput}
                        />
                      </View>
                    ) : null}

                    <ScrollView
                      style={{ maxHeight: 220 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {filteredWorkers.map((w) => {
                        const isSelected = w.id === workerId;
                        const wAvatar = getAvatarStyle(w.name);
                        const wSum = workerSummary(w, data.attendance, data.entries);
                        const hasDue = wSum.balance > 0;
                        const hasAdv = wSum.balance < 0;

                        return (
                          <Pressable
                            key={w.id}
                            onPress={() => {
                              setWorkerId(w.id);
                              setIsWorkerDropdownOpen(false);
                            }}
                            style={({ pressed }) => [
                              styles.dropdownMenuItem,
                              isSelected && styles.dropdownMenuItemActive,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <View
                              style={[
                                styles.avatarBoxSmall,
                                { backgroundColor: wAvatar.bg, width: 32, height: 32 },
                              ]}
                            >
                              <Text style={[styles.avatarTextSmall, { color: wAvatar.text }]}>
                                {getInitials(w.name)}
                              </Text>
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.dropdownMenuTitle,
                                  isSelected && { color: '#0F2851', fontWeight: '800' },
                                ]}
                                numberOfLines={1}
                              >
                                {w.name}
                              </Text>
                              <Text style={styles.dropdownMenuSubtitle} numberOfLines={1}>
                                {w.skill || 'Worker'} • {money(w.daily_rate)}/day
                              </Text>
                            </View>

                            {hasDue ? (
                              <View style={styles.dueTag}>
                                <Text style={styles.dueTagText}>{money(wSum.balance)} Due</Text>
                              </View>
                            ) : hasAdv ? (
                              <View style={styles.advTag}>
                                <Text style={styles.advTagText}>{money(-wSum.balance)} Adv</Text>
                              </View>
                            ) : null}

                            {isSelected ? (
                              <AppIcon name="checkmark-circle" size={17} color="#15803D" />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Worker Live Financials Card */}
                {selectedWorker ? (
                  <View
                    style={[
                      styles.workerBalanceCard,
                      isPendingWage
                        ? styles.cardPending
                        : isAdvanceTaken
                        ? styles.cardAdvance
                        : styles.cardSettled,
                    ]}
                  >
                    <View style={styles.balanceTopRow}>
                      <View>
                        <Text style={styles.balanceStatusLabel}>Current Account Status</Text>
                        <Text
                          style={[
                            styles.balanceStatusVal,
                            {
                              color: isPendingWage
                                ? '#B45309'
                                : isAdvanceTaken
                                ? '#1D4ED8'
                                : '#15803D',
                            },
                          ]}
                        >
                          {isPendingWage
                            ? `${money(workerSummaryData.balance)} Due (बकाया मजदूरी)`
                            : isAdvanceTaken
                            ? `${money(-workerSummaryData.balance)} Advance Given (पेशगी)`
                            : '₹0 Settled (हिसाब चुकता)'}
                        </Text>
                      </View>

                      {isPendingWage ? (
                        <Pressable
                          onPress={() => handleQuickAmount(workerSummaryData.balance / 100)}
                          style={({ pressed }) => [
                            styles.payFullDueBtn,
                            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                          ]}
                        >
                          <AppIcon name="flash" size={12} color="#FFFFFF" />
                          <Text style={styles.payFullDueBtnText}>Fill Full Due</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.balanceSubRow}>
                      <View style={styles.subCol}>
                        <Text style={styles.subColLabel}>Total Haziri</Text>
                        <Text style={styles.subColVal}>{workerSummaryData.daysWorked} Days</Text>
                      </View>
                      <View style={styles.subDivider} />
                      <View style={styles.subCol}>
                        <Text style={styles.subColLabel}>Total Earned</Text>
                        <Text style={styles.subColVal}>{money(workerSummaryData.earned)}</Text>
                      </View>
                      <View style={styles.subDivider} />
                      <View style={styles.subCol}>
                        <Text style={styles.subColLabel}>Total Paid</Text>
                        <Text style={styles.subColVal}>{money(workerSummaryData.paid)}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* 2. WORK SITE SELECTOR */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="business" size={16} color="#0284C7" />
                  <Text style={styles.sectionTitle}>Work Site (Where Cost Is Billed) *</Text>
                </View>

                <Pressable
                  onPress={() => {
                    setIsSiteDropdownOpen(!isSiteDropdownOpen);
                    setIsWorkerDropdownOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectorBtn,
                    isSiteDropdownOpen && styles.selectorBtnActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityLabel="Select site"
                >
                  <View style={styles.siteIconBox}>
                    <AppIcon name="business" size={16} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectorMainText} numberOfLines={1}>
                      {selectedSite?.name || 'Select Work Site'}
                    </Text>
                    {selectedSite?.owner_name ? (
                      <Text style={styles.selectorSubText} numberOfLines={1}>
                        Client: {selectedSite.owner_name}
                      </Text>
                    ) : (
                      <Text style={styles.selectorSubText}>Tap to change work site</Text>
                    )}
                  </View>
                  <AppIcon
                    name={isSiteDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#64748B"
                  />
                </Pressable>

                {/* Inline Site Dropdown Menu */}
                {isSiteDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    {data.sites.length > 4 ? (
                      <View style={styles.searchBox}>
                        <AppIcon name="search" size={13} color="#94A3B8" />
                        <TextInput
                          value={siteSearch}
                          onChangeText={setSiteSearch}
                          placeholder="Search site or client..."
                          placeholderTextColor="#94A3B8"
                          style={styles.searchInput}
                        />
                      </View>
                    ) : null}
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
                              setIsSiteDropdownOpen(false);
                            }}
                            style={({ pressed }) => [
                              styles.dropdownMenuItem,
                              isSelected && styles.dropdownMenuItemActive,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <View
                              style={[
                                styles.siteIconBox,
                                {
                                  width: 32,
                                  height: 32,
                                  backgroundColor: isSelected ? '#E0F2FE' : '#F1F5F9',
                                },
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
                                  styles.dropdownMenuTitle,
                                  isSelected && { color: '#0284C7', fontWeight: '800' },
                                ]}
                                numberOfLines={1}
                              >
                                {s.name}
                              </Text>
                              {s.owner_name ? (
                                <Text style={styles.dropdownMenuSubtitle} numberOfLines={1}>
                                  Client: {s.owner_name}
                                </Text>
                              ) : null}
                            </View>
                            {isSelected && (
                              <AppIcon name="checkmark-circle" size={17} color="#0284C7" />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 3. PAYMENT AMOUNT (₹) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="cash" size={16} color="#15803D" />
                  <Text style={styles.sectionTitle}>
                    {paymentType === 'ADVANCE' ? 'Advance Amount (₹) *' : 'Payout Amount (₹) *'}
                  </Text>
                  {Number(amount) > 0 ? (
                    <View style={styles.newBalancePill}>
                      <Text style={styles.newBalancePillText}>
                        {projectedBalance > 0
                          ? `New Due: ₹${Math.round(projectedBalance)}`
                          : projectedBalance < 0
                          ? `New Adv: ₹${Math.round(-projectedBalance)}`
                          : '₹0 Clear'}
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
                    autoFocus={!spec.initial.amount}
                  />
                </View>

                {/* Quick Amount Suggestion Chips */}
                <View style={styles.quickAmountRow}>
                  {isPendingWage ? (
                    <Pressable
                      onPress={() => handleQuickAmount(workerSummaryData.balance / 100)}
                      style={styles.quickAmountChip}
                    >
                      <Text style={styles.quickAmountChipText}>
                        Full Due ({money(workerSummaryData.balance)})
                      </Text>
                    </Pressable>
                  ) : null}
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => handleQuickAmount(amt)}
                      style={styles.quickAmountChip}
                    >
                      <Text style={styles.quickAmountChipText}>+₹{amt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 4. PAYMENT MODE */}
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
                        style={[styles.modeCard, isSelected && styles.modeCardActive]}
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
                                isSelected && { color: '#15803D', fontWeight: '800' },
                              ]}
                            >
                              {m.badge}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.modeLabel,
                            isSelected && { color: '#0F2851', fontWeight: '800' },
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 5. PAYMENT DATE (CLEAN RIGHT-ALIGNED CALENDAR) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                  <Text style={styles.sectionTitle}>Payment Date *</Text>
                </View>

                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  style={({ pressed }) => [
                    styles.datePickerBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityLabel="Choose payment date"
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

              {/* 6. DESCRIPTION & PRESETS */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeadingRow}>
                  <AppIcon name="document-text-outline" size={16} color="#475569" />
                  <Text style={styles.sectionTitle}>Description & Purpose</Text>
                </View>

                {/* Quick Presets based on Payment Type */}
                <View style={{ gap: 4 }}>
                  <Text style={styles.fieldSubNotice}>Quick Select Purpose:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetScroll}
                  >
                    {(paymentType === 'ADVANCE' ? ADVANCE_PRESETS : WAGE_PRESETS).map((p) => {
                      const isSelected = description.includes(p);
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setDescription(p)}
                          style={[styles.presetChip, isSelected && styles.presetChipActive]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              isSelected && styles.presetChipTextActive,
                            ]}
                          >
                            {p}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={{ marginTop: 6, gap: 4 }}>
                  <Text style={styles.fieldLabel}>Custom Note</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. 5 days wage for lanter work, cash advance..."
                    placeholderTextColor="#94A3B8"
                    style={styles.textInputStandard}
                  />
                </View>

                <View style={{ marginTop: 6, gap: 4 }}>
                  <Text style={styles.fieldLabel}>Reference / Receipt No. (Optional)</Text>
                  <TextInput
                    value={reference}
                    onChangeText={setReference}
                    placeholder="e.g. UPI Ref / Cash voucher #12 / Cheque 40921"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInputStandard}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View style={styles.footer}>
              <Pressable
                onPress={() => !busy && onClose()}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.8 },
                ]}
                disabled={busy}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  busy && { opacity: 0.6 },
                ]}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>
                      {amount.trim() && Number(amount) > 0
                        ? `Save ${paymentType === 'ADVANCE' ? 'Advance' : 'Payment'} (${money(
                            (Number(amount) || 0) * 100
                          )})`
                        : `Record ${paymentType === 'ADVANCE' ? 'Advance' : 'Wage Payment'}`}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* Interactive Calendar Modal */}
          {isCalendarOpen ? (
            <CalendarPickerModal
              visible={isCalendarOpen}
              title="Select Payment Date"
              selectedDate={date}
              onSelect={(pickedDate) => {
                setDate(pickedDate);
                setIsCalendarOpen(false);
              }}
              onClose={() => setIsCalendarOpen(false)}
            />
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleCol: {
    flex: 1,
    gap: 3,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSegmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    gap: 6,
  },
  typeSegmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  typeSegmentItemActiveWage: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  typeSegmentItemActiveAdvance: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  typeSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  typeSegmentTextActiveWage: {
    color: '#15803D',
    fontWeight: '800',
  },
  typeSegmentTextActiveAdvance: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  selectorBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  avatarBoxSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 13,
    fontWeight: '800',
  },
  selectorMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectorSubText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  miniSkillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  miniSkillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  siteIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 4,
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
  },
  dropdownMenuItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownMenuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dropdownMenuSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  dueTag: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  dueTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  advTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  advTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  workerBalanceCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginTop: 2,
  },
  cardPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  cardAdvance: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  cardSettled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceStatusVal: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  payFullDueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  payFullDueBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  subCol: {
    flex: 1,
    alignItems: 'center',
  },
  subColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  subColVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  subDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '800',
    color: '#15803D',
    marginRight: 6,
  },
  amountLargeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    padding: 0,
  },
  newBalancePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  newBalancePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickAmountChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  quickAmountChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  modeCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  modeCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#15803D',
  },
  modeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  fieldSubNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  presetScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  presetChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  textInputStandard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
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
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#15803D',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
