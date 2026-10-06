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
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { key: 'UPI', label: 'UPI / Online', icon: 'qr-code-outline' },
  { key: 'BANK', label: 'Bank / Cheque', icon: 'business-outline' },
];

const WAGE_PRESETS = [
  'Weekly wage payout',
  'Bi-weekly wage settlement',
  'Overtime compensation',
  'Full & final settlement',
  'Daily wage cash',
];

const ADVANCE_PRESETS = [
  'Advance for personal need',
  'Ration & food advance',
  'Festival / Holiday advance',
  'Travel / Fare advance',
  'Medical emergency',
];

const AVATAR_PALETTES = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#ECFDF5', text: '#047857' },
  { bg: '#F5F3FF', text: '#6D28D9' },
  { bg: '#FFFBEB', text: '#B45309' },
  { bg: '#FFF1F2', text: '#BE123C' },
  { bg: '#F0FDF4', text: '#15803D' },
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

  // Selected Worker Object
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === workerId) || data.workers[0],
    [data.workers, workerId]
  );

  // Selected Site Object
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

  // Real-time Projected Balance calculation
  const projectedBalance = useMemo(() => {
    const curBalanceRupees = workerSummaryData.balance / 100;
    const enterRupees = Number(amount) || 0;
    return curBalanceRupees - enterRupees;
  }, [workerSummaryData.balance, amount]);

  // Filtered workers list
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

  // Filtered sites list
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
      setLocalError('Please select a worker / labour.');
      return;
    }
    if (!siteId) {
      setLocalError('Please select a project site for this payout.');
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
  const activeColor = paymentType === 'WAGE' ? '#16A34A' : '#2563EB';

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
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBadge, { backgroundColor: paymentType === 'WAGE' ? '#DCFCE7' : '#EFF6FF' }]}>
                <AppIcon
                  name={paymentType === 'WAGE' ? 'wallet' : 'cash'}
                  size={18}
                  color={activeColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>
                  {paymentType === 'WAGE' ? 'Labour Wage Payment' : 'Worker Advance'}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {selectedWorker ? `For ${selectedWorker.name}` : 'Record worker payout'}
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
              <AppIcon name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Segmented Control: Wage vs Advance */}
          <View style={styles.segmentContainer}>
            <View style={styles.segmentTrack}>
              <Pressable
                onPress={() => handleSelectPaymentType('WAGE')}
                style={[
                  styles.segmentButton,
                  paymentType === 'WAGE' && styles.segmentButtonActiveWage,
                ]}
              >
                <AppIcon
                  name="cash-outline"
                  size={15}
                  color={paymentType === 'WAGE' ? '#16A34A' : '#64748B'}
                />
                <Text
                  style={[
                    styles.segmentText,
                    paymentType === 'WAGE' && styles.segmentTextActiveWage,
                  ]}
                >
                  Wage Payment
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSelectPaymentType('ADVANCE')}
                style={[
                  styles.segmentButton,
                  paymentType === 'ADVANCE' && styles.segmentButtonActiveAdvance,
                ]}
              >
                <AppIcon
                  name="arrow-forward-outline"
                  size={15}
                  color={paymentType === 'ADVANCE' ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.segmentText,
                    paymentType === 'ADVANCE' && styles.segmentTextActiveAdvance,
                  ]}
                >
                  Give Advance
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Body Form */}
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
                  <AppIcon name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{localError || error}</Text>
                </View>
              ) : null}

              {/* 1. HERO AMOUNT INPUT CARD */}
              <View style={styles.heroAmountCard}>
                <View style={styles.heroAmountTop}>
                  <Text style={styles.cardLabel}>
                    {paymentType === 'ADVANCE' ? 'ADVANCE AMOUNT' : 'PAYOUT AMOUNT'}
                  </Text>
                  {Number(amount) > 0 ? (
                    <View style={styles.projectedPill}>
                      <Text style={styles.projectedPillText}>
                        {projectedBalance > 0
                          ? `New Due: ₹${Math.round(projectedBalance)}`
                          : projectedBalance < 0
                          ? `New Adv: ₹${Math.round(-projectedBalance)}`
                          : '₹0 Settled'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.amountInputRow}>
                  <Text style={[styles.currencyPrefix, { color: activeColor }]}>₹</Text>
                  <TextInput
                    value={amount}
                    onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
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
                  {isPendingWage && workerSummaryData.balance > 0 ? (
                    <Pressable
                      onPress={() => handleQuickAmount(workerSummaryData.balance / 100)}
                      style={[styles.quickChip, styles.quickChipFullDue]}
                    >
                      <AppIcon name="flash" size={12} color="#B45309" />
                      <Text style={styles.quickChipTextFullDue}>
                        Full Due ({money(workerSummaryData.balance)})
                      </Text>
                    </Pressable>
                  ) : null}
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => handleQuickAmount(amt)}
                      style={styles.quickChip}
                    >
                      <Text style={styles.quickChipText}>+₹{amt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 2. WORKER & LIVE BALANCE CARD */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.cardLabel}>WORKER / EMPLOYEE</Text>
                  {selectedWorker?.skill ? (
                    <View style={styles.skillBadge}>
                      <AppIcon name={getSkillIcon(selectedWorker.skill)} size={11} color="#1E40AF" />
                      <Text style={styles.skillBadgeText}>{selectedWorker.skill}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Worker Selector Button / Select Bar */}
                <View
                  style={[
                    styles.selectorTrigger,
                    { position: 'relative' },
                  ]}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: avatarTheme.bg }]}>
                    <Text style={[styles.avatarInitials, { color: avatarTheme.text }]}>
                      {getInitials(selectedWorker?.name)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectorTitle} numberOfLines={1}>
                      {selectedWorker?.name || 'Select Worker'}
                    </Text>
                    <Text style={styles.selectorSubtitle}>
                      {selectedWorker
                        ? `${money(selectedWorker.daily_rate)}/day${
                            selectedWorker.phone ? ` • ${selectedWorker.phone}` : ''
                          }`
                        : 'Select worker'}
                    </Text>
                  </View>

                  <AppIcon
                    name="chevron-down"
                    size={16}
                    color="#64748B"
                  />

                  {/* Native HTML Select Bar for direct Worker selection */}
                  {Platform.OS === 'web' && (
                    <select
                      value={workerId}
                      onChange={(e: any) => setWorkerId(e.target.value)}
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
                      title="Select Worker"
                    >
                      {data.workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          👷 {w.name} {w.skill ? `(${w.skill})` : ''} — ₹{w.daily_rate}/day
                        </option>
                      ))}
                    </select>
                  )}
                </View>

                {/* Inline Worker Dropdown */}
                {isWorkerDropdownOpen && (
                  <View style={styles.dropdownBox}>
                    {data.workers.length > 4 ? (
                      <View style={styles.searchBar}>
                        <AppIcon name="search" size={13} color="#94A3B8" />
                        <TextInput
                          value={workerSearch}
                          onChangeText={setWorkerSearch}
                          placeholder="Search worker by name, skill, phone..."
                          placeholderTextColor="#94A3B8"
                          style={[
                            styles.searchInput,
                            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                          ]}
                        />
                      </View>
                    ) : null}

                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
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
                            style={[
                              styles.dropdownRow,
                              isSelected && styles.dropdownRowActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.avatarCircleSmall,
                                { backgroundColor: wAvatar.bg },
                              ]}
                            >
                              <Text style={[styles.avatarInitialsSmall, { color: wAvatar.text }]}>
                                {getInitials(w.name)}
                              </Text>
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.dropdownRowTitle,
                                  isSelected && { color: '#0F2851', fontWeight: '800' },
                                ]}
                                numberOfLines={1}
                              >
                                {w.name}
                              </Text>
                              <Text style={styles.dropdownRowSubtitle} numberOfLines={1}>
                                {w.skill || 'Worker'} • {money(w.daily_rate)}/day
                              </Text>
                            </View>

                            {hasDue ? (
                              <View style={styles.dueBadgeMini}>
                                <Text style={styles.dueBadgeMiniText}>{money(wSum.balance)} Due</Text>
                              </View>
                            ) : hasAdv ? (
                              <View style={styles.advBadgeMini}>
                                <Text style={styles.advBadgeMiniText}>{money(-wSum.balance)} Adv</Text>
                              </View>
                            ) : null}

                            {isSelected && (
                              <AppIcon name="checkmark-circle" size={16} color="#16A34A" />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Worker Financials Mini Strip */}
                {selectedWorker ? (
                  <View style={styles.balanceSummaryBox}>
                    <View style={styles.balanceSummaryTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.balanceStatusTitle}>CURRENT BALANCE</Text>
                        <Text
                          style={[
                            styles.balanceStatusValue,
                            {
                              color: isPendingWage
                                ? '#D97706'
                                : isAdvanceTaken
                                ? '#2563EB'
                                : '#16A34A',
                            },
                          ]}
                        >
                          {isPendingWage
                            ? `${money(workerSummaryData.balance)} Due`
                            : isAdvanceTaken
                            ? `${money(-workerSummaryData.balance)} Advance`
                            : '₹0 Settled'}
                        </Text>
                      </View>

                      {isPendingWage ? (
                        <Pressable
                          onPress={() => handleQuickAmount(workerSummaryData.balance / 100)}
                          style={styles.payFullBtn}
                        >
                          <AppIcon name="flash" size={11} color="#FFFFFF" />
                          <Text style={styles.payFullBtnText}>Fill Full Due</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.balanceSummaryBottom}>
                      <Text style={styles.summaryMetric}>
                        Haziri: <Text style={styles.summaryMetricVal}>{workerSummaryData.daysWorked} Days</Text>
                      </Text>
                      <Text style={styles.summaryDot}>•</Text>
                      <Text style={styles.summaryMetric}>
                        Earned: <Text style={styles.summaryMetricVal}>{money(workerSummaryData.earned)}</Text>
                      </Text>
                      <Text style={styles.summaryDot}>•</Text>
                      <Text style={styles.summaryMetric}>
                        Paid: <Text style={styles.summaryMetricVal}>{money(workerSummaryData.paid)}</Text>
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* 3. WORK SITE SELECTOR / SELECT BAR */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>WORK SITE / PROJECT</Text>

                <View
                  style={[
                    styles.selectorTrigger,
                    { position: 'relative' },
                  ]}
                >
                  <View style={styles.siteIconWrap}>
                    <AppIcon name="business" size={15} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectorTitle} numberOfLines={1}>
                      {selectedSite?.name || 'Select Work Site'}
                    </Text>
                    {selectedSite?.owner_name ? (
                      <Text style={styles.selectorSubtitle} numberOfLines={1}>
                        Client: {selectedSite.owner_name}
                      </Text>
                    ) : (
                      <Text style={styles.selectorSubtitle}>Select site</Text>
                    )}
                  </View>
                  <AppIcon
                    name="chevron-down"
                    size={16}
                    color="#64748B"
                  />

                  {/* Native HTML Select Bar for direct Site selection */}
                  {Platform.OS === 'web' && (
                    <select
                      value={siteId}
                      onChange={(e: any) => setSiteId(e.target.value)}
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
                                color={isSelected ? '#0284C7' : '#64748B'}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.dropdownRowTitle,
                                  isSelected && { color: '#0284C7', fontWeight: '800' },
                                ]}
                                numberOfLines={1}
                              >
                                {s.name}
                              </Text>
                              {s.owner_name ? (
                                <Text style={styles.dropdownRowSubtitle} numberOfLines={1}>
                                  Client: {s.owner_name}
                                </Text>
                              ) : null}
                            </View>
                            {isSelected && (
                              <AppIcon name="checkmark-circle" size={16} color="#0284C7" />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 4. PAYMENT DATE & MODE */}
              <View style={styles.sectionCard}>
                {/* Date Picker Row First */}
                <Text style={styles.cardLabel}>PAYMENT DATE</Text>
                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
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

                {/* Mode Pill Row Below Date */}
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.cardLabel}>PAYMENT MODE</Text>
                  <View style={styles.modePillRow}>
                    {PAYMENT_MODES.map((m) => {
                      const isSelected = mode === m.key;
                      return (
                        <Pressable
                          key={m.key}
                          onPress={() => setMode(m.key as any)}
                          style={[
                            styles.modePill,
                            isSelected && styles.modePillActive,
                          ]}
                        >
                          <AppIcon
                            name={m.icon as any}
                            size={14}
                            color={isSelected ? activeColor : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.modePillText,
                              isSelected && { color: activeColor, fontWeight: '800' },
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* 5. DESCRIPTION PRESETS & NOTE */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardLabel}>REASON / DESCRIPTION</Text>

                {/* Presets */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetsList}
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

                {/* Custom Note & Reference */}
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Enter payment note..."
                    placeholderTextColor="#94A3B8"
                    style={[
                      styles.inputBox,
                      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                    ]}
                  />

                  <TextInput
                    value={reference}
                    onChangeText={setReference}
                    placeholder="Reference / Receipt No. (Optional)"
                    placeholderTextColor="#94A3B8"
                    style={[
                      styles.inputBox,
                      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                    ]}
                  />
                </View>
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View style={styles.footerBar}>
              <Pressable
                onPress={() => !busy && onClose()}
                style={styles.footerCancelBtn}
                disabled={busy}
              >
                <Text style={styles.footerCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                style={[
                  styles.footerSubmitBtn,
                  { backgroundColor: activeColor },
                  busy && { opacity: 0.6 },
                ]}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.footerSubmitText}>
                      {amount.trim() && Number(amount) > 0
                        ? `Record ${paymentType === 'ADVANCE' ? 'Advance' : 'Payment'} (${money(
                            (Number(amount) || 0) * 100
                          )})`
                        : `Save ${paymentType === 'ADVANCE' ? 'Advance' : 'Payment'}`}
                    </Text>
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
              onSelect={(pickedDate) => {
                setDate(pickedDate);
                setIsCalendarOpen(false);
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
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentButtonActiveWage: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentButtonActiveAdvance: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActiveWage: {
    color: '#16A34A',
    fontWeight: '800',
  },
  segmentTextActiveAdvance: {
    color: '#2563EB',
    fontWeight: '800',
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
  projectedPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  projectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
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
  quickChipFullDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  quickChipTextFullDue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
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
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
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
  avatarCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsSmall: {
    fontSize: 11,
    fontWeight: '800',
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
  dueBadgeMini: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dueBadgeMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  advBadgeMini: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  advBadgeMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  balanceSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 6,
    marginTop: 2,
  },
  balanceSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceStatusTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  balanceStatusValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  payFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  payFullBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceSummaryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
  },
  summaryMetric: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryMetricVal: {
    color: '#0F172A',
    fontWeight: '700',
  },
  summaryDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  siteIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteIconWrapSmall: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  modePillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#94A3B8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  datePickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  todayTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  presetsList: {
    gap: 6,
    paddingVertical: 2,
  },
  presetChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 7,
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
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
  },
  footerSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
