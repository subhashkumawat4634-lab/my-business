import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { money, workerSummary } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';

export interface WagePaymentPageProps {
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenProfile?: () => void;
  siteId?: string;
  workerId?: string;
}

const PAYMENT_MODES = [
  { key: 'ALL', label: 'All Modes' },
  { key: 'CASH', label: 'Cash (Nokad)' },
  { key: 'UPI', label: 'UPI / Online' },
  { key: 'BANK', label: 'Bank / Cheque' },
];

export function WagePaymentPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
  workerId: initialWorkerId,
}: WagePaymentPageProps) {
  const { t, lang } = useLanguage();

  // Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || 'ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(initialWorkerId || 'ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Add Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formWorkerId, setFormWorkerId] = useState<string>(
    initialWorkerId || (data.workers[0]?.id ? String(data.workers[0].id) : '')
  );
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('CASH');
  const [formNotes, setFormNotes] = useState('');
  const [isFormCalendarOpen, setIsFormCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  const activeEntries = useMemo(
    () => data.entries.filter((e) => !e.voided_at && e.kind === 'WAGE_PAYMENT'),
    [data.entries]
  );

  // Worker live financial calculations
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === formWorkerId),
    [data.workers, formWorkerId]
  );

  const workerFinance = useMemo(() => {
    if (!selectedWorker) return null;
    return workerSummary(selectedWorker, data.attendance, data.entries);
  }, [data, selectedWorker]);

  const dueBalance = workerFinance ? workerFinance.closing : 0;
  const isDue = dueBalance > 0;
  const isAdv = dueBalance < 0;

  // Statistics
  const stats = useMemo(() => {
    let totalPaid = 0;
    let thisMonthPaid = 0;
    const nowMonth = today().slice(0, 7);
    let totalWorkerDues = 0;

    for (const e of activeEntries) {
      const amt = Number(e.amount || 0);
      totalPaid += amt;
      const entryMonth = String(e.date || '').slice(0, 7);
      if (entryMonth === nowMonth) {
        thisMonthPaid += amt;
      }
    }

    for (const w of data.workers) {
      if (w.active) {
        const sm = workerSummary(w, data.attendance, data.entries);
        if (sm.closing > 0) totalWorkerDues += sm.closing;
      }
    }

    return {
      totalPaid,
      thisMonthPaid,
      activeWorkersCount: data.workers.filter((w) => w.active).length,
      totalWorkerDues,
    };
  }, [activeEntries, data]);

  // Filtered List
  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeEntries.filter((e) => {
      if (selectedSiteId !== 'ALL' && String(e.site_id) !== String(selectedSiteId)) {
        return false;
      }
      if (selectedWorkerId !== 'ALL' && String(e.worker_id) !== String(selectedWorkerId)) {
        return false;
      }
      if (selectedDate && String(e.date).slice(0, 10) !== selectedDate) {
        return false;
      }
      if (selectedMode !== 'ALL') {
        const mode = String(e.description || '').toUpperCase();
        if (!mode.includes(selectedMode)) return false;
      }
      if (q) {
        const worker = data.workers.find((w) => w.id === e.worker_id);
        const site = data.sites.find((s) => s.id === e.site_id);
        const matchWorker = worker ? worker.name.toLowerCase().includes(q) : false;
        const matchSite = site ? site.name.toLowerCase().includes(q) : false;
        const matchDesc = String(e.description || '').toLowerCase().includes(q);
        if (!matchWorker && !matchSite && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [activeEntries, selectedSiteId, selectedWorkerId, selectedDate, selectedMode, search, data.workers, data.sites]);

  const handleSavePayment = () => {
    setLocalError('');
    if (!formWorkerId) {
      setLocalError('Please select a worker');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError('Please enter a valid payment amount');
      return;
    }

    const descParts = [`Mode: ${formMode}`];
    if (formNotes.trim()) descParts.push(formNotes.trim());

    onSave({
      worker_id: formWorkerId,
      site_id: formSiteId,
      date: formDate,
      amount: String(Math.round(Number(formAmount) * 100)),
      description: descParts.join(' • '),
    });

    // Reset Form
    setIsFormOpen(false);
    setFormAmount('');
    setFormNotes('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title={t('labourWage', 'Labour Wage Register')}
        subtitle={t('wageSubtitle', 'Worker wage payments, daily kharcha & advance ledger')}
        icon="cash"
        userInitials={data.user?.name}
        organizationName={data.organization?.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          ) : undefined
        }
      >
        <View style={styles.container}>
          {/* 2. STATS SUMMARY CARDS (Like AttendancePage) */}
          <View style={styles.statsSummaryGrid}>
            <View style={[styles.statKpiCard, styles.statKpiTotal]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <AppIcon name="wallet" size={16} color="#15803D" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#166534' }]}>Total Paid</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#15803D' }]}>
                {money(stats.totalPaid)}
              </Text>
              <Text style={styles.statKpiFoot}>All-time paid</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiMonth]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="calendar" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#1E40AF' }]}>This Month</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#1D4ED8' }]}>
                {money(stats.thisMonthPaid)}
              </Text>
              <Text style={styles.statKpiFoot}>Current month</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiDues]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <AppIcon name="alert-circle" size={16} color="#D97706" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>Pending Dues</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                {money(stats.totalWorkerDues)}
              </Text>
              <Text style={styles.statKpiFoot}>To be settled</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiWorkers]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#F3E8FF' }]}>
                  <AppIcon name="people" size={16} color="#7C3AED" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#6D28D9' }]}>Active Karigars</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#7C3AED' }]}>
                {stats.activeWorkersCount}
              </Text>
              <Text style={styles.statKpiFoot}>On roll team</Text>
            </View>
          </View>

          {/* 3. PRIMARY ACTION & CREATION DRAWER */}
          <View style={styles.actionBox}>
            {!isFormOpen ? (
              <Pressable
                onPress={() => setIsFormOpen(true)}
                style={({ pressed }) => [
                  styles.primaryAddBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={styles.addBtnIconBox}>
                  <AppIcon name="add" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryAddBtnTitle}>+ Record Wage / Advance Payment</Text>
                  <Text style={styles.primaryAddBtnSub}>Pay karigar via Cash, UPI, or Bank settlement</Text>
                </View>
                <AppIcon name="chevron-forward" size={18} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Card style={styles.inlineFormCard}>
                <View style={styles.formCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>                    <View style={styles.formHeaderIcon}>
                      <AppIcon name="cash" size={18} color="#2563EB" />
                    </View>
                    <View>
                      <Text style={styles.formTitle}>Record Wage Payment</Text>
                      <Text style={styles.formSubtitle}>Pay wages or daily kharcha advance</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setIsFormOpen(false)}
                    style={styles.formCloseBtn}
                  >
                    <AppIcon name="close" size={16} color="#64748B" />
                  </Pressable>
                </View>

                {localError || error ? (
                  <View style={styles.formErrorBox}>
                    <AppIcon name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.formErrorText}>{localError || error}</Text>
                  </View>
                ) : null}

                {/* Form Fields */}
                <View style={styles.formBody}>
                  {/* Worker Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Select Karigar / Worker *</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={formWorkerId}
                        onValueChange={(val) => setFormWorkerId(String(val))}
                        style={styles.picker}
                      >
                        {data.workers.map((w) => (
                          <Picker.Item
                            key={w.id}
                            label={`👤 ${w.name}${w.skill ? ` (${w.skill})` : ''}`}
                            value={w.id}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {/* Worker Live Status Card */}
                  {selectedWorker && workerFinance ? (
                    <View style={styles.workerLiveCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerLiveName}>{selectedWorker.name}</Text>
                        <Text style={styles.workerLiveSkill}>
                          {selectedWorker.skill || 'Worker'} • {money(selectedWorker.daily_rate)}/day
                        </Text>
                      </View>
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
                          {isDue ? `${money(dueBalance)} Due` : isAdv ? `${money(-dueBalance)} Adv` : 'Settled'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Site & Date Row */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Work Site</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={formSiteId}
                          onValueChange={(val) => setFormSiteId(String(val))}
                          style={styles.picker}
                        >
                          {data.sites.map((s) => (
                            <Picker.Item key={s.id} label={`🏢 ${s.name}`} value={s.id} />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Payment Date *</Text>
                      <Pressable
                        onPress={() => setIsFormCalendarOpen(true)}
                        style={styles.datePickerBtn}
                      >
                        <Text style={styles.datePickerBtnText}>{formDate}</Text>
                        <AppIcon name="calendar" size={16} color="#2563EB" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Amount with Quick Chips */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Amount (₹) *</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="e.g. 1500"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={[styles.textInput, { fontSize: 20, fontWeight: '800', color: '#2563EB' }]}
                    />          />

                    {/* Quick Amount Suggestion Chips */}
                    <View style={styles.quickChipsRow}>
                      {isDue && dueBalance > 0 ? (
                        <Pressable
                          onPress={() => setFormAmount(String(Math.round(dueBalance / 100)))}
                          style={styles.fullDueChip}
                        >
                          <Text style={styles.fullDueChipText}>Full Due: {money(dueBalance)}</Text>
                        </Pressable>
                      ) : null}
                      {[500, 1000, 2000, 5000].map((amt) => (
                        <Pressable
                          key={amt}
                          onPress={() => setFormAmount(String(amt))}
                          style={styles.presetChip}
                        >
                          <Text style={styles.presetChipText}>₹{amt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Payment Mode Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Mode</Text>
                    <View style={styles.modeTabsRow}>
                      {[
                        { key: 'CASH', label: '💵 Cash' },
                        { key: 'UPI', label: '📱 UPI' },
                        { key: 'BANK', label: '🏦 Bank' },
                      ].map((m) => (
                        <Pressable
                          key={m.key}
                          onPress={() => setFormMode(m.key)}
                          style={[
                            styles.modeTab,
                            formMode === m.key && styles.modeTabActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.modeTabText,
                              formMode === m.key && styles.modeTabTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Note / Reference */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Note / Reason</Text>
                    <TextInput
                      value={formNotes}
                      onChangeText={setFormNotes}
                      placeholder="e.g. Weekly settlement, Medical emergency advance"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.formActionRow}>
                    <Pressable
                      onPress={() => setIsFormOpen(false)}
                      style={styles.formCancelBtn}
                    >
                      <Text style={styles.formCancelBtnText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      onPress={handleSavePayment}
                      disabled={busy}
                      style={[styles.formSaveBtn, busy && { opacity: 0.6 }]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                          <Text style={styles.formSaveBtnText}>
                            {formAmount ? `Pay ${money(Number(formAmount) * 100)}` : 'Save Payment'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </Card>
            )}
          </View>

          {/* 4. SEARCH & FILTER TOOLBAR (Like AttendancePage) */}
          <View style={styles.toolbarBox}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <AppIcon name="search" size={16} color={Colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search worker name, site or mode..."
                placeholderTextColor={Colors.textSubtle}
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <AppIcon name="close-circle" size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Filter Dropdowns Row */}
            <View style={styles.filterDropdownRow}>
              <View style={[styles.dropdownBox, { flex: 1 }]}>
                <AppIcon name="people" size={14} color="#047857" />
                <Picker
                  selectedValue={selectedWorkerId}
                  onValueChange={(val) => setSelectedWorkerId(String(val))}
                  style={styles.filterPicker}
                >
                  <Picker.Item label="👥 All Workers" value="ALL" />
                  {data.workers.map((w) => (
                    <Picker.Item key={w.id} label={`👤 ${w.name}`} value={w.id} />
                  ))}
                </Picker>
              </View>

              <View style={[styles.dropdownBox, { flex: 1 }]}>
                <AppIcon name="business" size={14} color="#0284C7" />
                <Picker
                  selectedValue={selectedSiteId}
                  onValueChange={(val) => setSelectedSiteId(String(val))}
                  style={styles.filterPicker}
                >
                  <Picker.Item label="🏢 All Sites" value="ALL" />
                  {data.sites.map((s) => (
                    <Picker.Item key={s.id} label={`🏢 ${s.name}`} value={s.id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Payment Mode Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsScroll}
            >
              {PAYMENT_MODES.map((m) => {
                const isSelected = selectedMode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setSelectedMode(m.key)}
                    style={[
                      styles.modeChip,
                      isSelected && styles.modeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        isSelected && styles.modeChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. RECORDS LIST SECTION (Like AttendancePage) */}
          <View style={styles.recordsListSection}>
            <View style={styles.recordsHeaderRow}>
              <View>
                <Text style={styles.recordsHeaderTitle}>
                  Wage Payments ({filteredPayments.length})
                </Text>
                <Text style={styles.recordsHeaderSub}>
                  Sorted by date • payments & advance ledger
                </Text>
              </View>
            </View>

            {filteredPayments.length === 0 ? (
              <EmptyState
                icon="cash-outline"
                title="No Wage Payments Recorded"
                description={
                  search || selectedWorkerId !== 'ALL' || selectedSiteId !== 'ALL'
                    ? 'No payments found matching your filter criteria'
                    : 'Tap "+ Record Wage / Advance Payment" above to pay your workers'
                }
              />
            ) : (
              filteredPayments.map((entry) => {
                const worker = data.workers.find((w) => w.id === entry.worker_id);
                const site = data.sites.find((s) => s.id === entry.site_id);
                const entryDate = String(entry.date || '').slice(0, 10);
                const initials = (worker?.name || 'W').slice(0, 2).toUpperCase();

                return (
                  <Card key={entry.id} style={styles.paymentCard}>
                    <View style={styles.paymentCardTop}>
                      {/* Worker Avatar */}
                      <View style={styles.workerAvatar}>
                        <Text style={styles.workerAvatarText}>{initials}</Text>
                      </View>

                      {/* Middle Details */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.workerNameText} numberOfLines={1}>
                            {worker?.name || 'Worker'}
                          </Text>
                          {worker?.skill ? (
                            <View style={styles.skillPill}>
                              <Text style={styles.skillPillText}>{worker.skill}</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.paymentMetaRow}>
                          <AppIcon name="business-outline" size={12} color="#64748B" />
                          <Text style={styles.paymentSiteText} numberOfLines={1}>
                            {site?.name || 'Site'}
                          </Text>
                          <Text style={styles.metaDivider}>•</Text>
                          <Text style={styles.paymentDateText}>{entryDate}</Text>
                        </View>

                        {entry.description ? (
                          <Text style={styles.paymentDescText} numberOfLines={1}>
                            {entry.description}
                          </Text>
                        ) : null}
                      </View>

                      {/* Right Amount Badge */}
                      <View style={styles.paymentAmountBadge}>
                        <Text style={styles.paymentAmountText}>{money(entry.amount)}</Text>
                        <Text style={styles.paymentAmountSub}>Paid Out</Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Date Filter Calendar Modal */}
      {isCalendarOpen && (
        <CalendarPickerModal
          visible={isCalendarOpen}
          title="Select Date"
          selectedDate={selectedDate || today()}
          onSelect={(d) => {
            if (d) setSelectedDate(d);
            setIsCalendarOpen(false);
          }}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}

      {/* Form Date Picker Modal */}
      {isFormCalendarOpen && (
        <CalendarPickerModal
          visible={isFormCalendarOpen}
          title="Select Payment Date"
          selectedDate={formDate}
          onSelect={(d) => {
            if (d) setFormDate(d);
            setIsFormCalendarOpen(false);
          }}
          onClose={() => setIsFormCalendarOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  root: { flex: 1 },
  scroll: { paddingBottom: 50 },
  container: { padding: 16, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },

  // Stats KPI Grid
  statsSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statKpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  statKpiTotal: { borderLeftWidth: 3, borderLeftColor: '#15803D' },
  statKpiMonth: { borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  statKpiDues: { borderLeftWidth: 3, borderLeftColor: '#D97706' },
  statKpiWorkers: { borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  statKpiTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIconBadge: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  statKpiLabel: { fontSize: 11, fontWeight: '700' },
  statKpiValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  statKpiFoot: { fontSize: 10, color: '#94A3B8' },

  // Primary Add Action
  actionBox: { width: '100%' },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAddBtnTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  primaryAddBtnSub: { fontSize: 11, color: '#EFF6FF', marginTop: 1 },

  // Inline Form
  inlineFormCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    gap: 14,
  },
  formCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formHeaderIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  formSubtitle: { fontSize: 11, color: '#64748B' },
  formCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  formErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8 },
  formErrorText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  formBody: { gap: 12 },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  pickerWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: { width: '100%', height: 42, color: '#0F172A' },
  twoColRow: { flexDirection: 'row', gap: 10 },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerBtnText: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  workerLiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  workerLiveName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  workerLiveSkill: { fontSize: 11, color: '#64748B' },
  balanceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  balanceBadgeText: { fontSize: 11, fontWeight: '800' },
  balanceDueBadge: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  balanceDueText: { color: '#D97706' },
  balanceAdvBadge: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  balanceAdvText: { color: '#2563EB' },
  balanceSettledBadge: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  balanceSettledText: { color: '#16A34A' },
  quickChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  fullDueChip: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  fullDueChipText: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  presetChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  presetChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  modeTabsRow: { flexDirection: 'row', gap: 8 },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modeTabActive: { backgroundColor: '#2563EB' },
  modeTabText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  modeTabTextActive: { color: '#FFFFFF' },
  formActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  formCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  formCancelBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  formSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // Toolbar
  toolbarBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', padding: 0 },
  filterDropdownRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dropdownBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingLeft: 8, overflow: 'hidden' },
  filterPicker: { flex: 1, height: 38, color: '#0F172A' },
  filterChipsScroll: { gap: 6, paddingVertical: 2 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  modeChipActive: { backgroundColor: '#2563EB' },
  modeChipText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  modeChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Records List Section
  recordsListSection: { gap: 10 },
  recordsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordsHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  recordsHeaderSub: { fontSize: 11, color: '#64748B' },
  paymentCard: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  paymentCardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  workerAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  workerAvatarText: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
  workerNameText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  skillPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  skillPillText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  paymentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  paymentSiteText: { fontSize: 11, color: '#0284C7', fontWeight: '600' },
  metaDivider: { fontSize: 11, color: '#CBD5E1' },
  paymentDateText: { fontSize: 11, color: '#64748B' },
  paymentDescText: { fontSize: 11, color: '#64748B', marginTop: 3 },
  paymentAmountBadge: { alignItems: 'flex-end' },
  paymentAmountText: { fontSize: 16, fontWeight: '800', color: '#2563EB' },
  paymentAmountSub: { fontSize: 10, color: '#2563EB', fontWeight: '600', marginTop: 1 },
});
