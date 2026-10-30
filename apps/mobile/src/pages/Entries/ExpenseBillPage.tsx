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
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { BillAttachmentPicker } from '../../components/bills/BillAttachmentPicker';
import { getDocFromIndexedDB, fetchDocFromServer, saveDocToIndexedDB, uploadDocToServer } from '../../storage/docStorage';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';

export interface ExpenseBillPageProps {
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenProfile?: () => void;
  siteId?: string;
  bill?: Row;
}

const EXPENSE_CATEGORIES = [
  { label: 'All', icon: 'apps-outline' },
  { label: 'Fuel & Petrol', icon: 'speedometer-outline' },
  { label: 'Tea & Refreshment', icon: 'cafe-outline' },
  { label: 'Machine Rent', icon: 'cog-outline' },
  { label: 'Transport / Freight', icon: 'car-outline' },
  { label: 'Tools & Hardware', icon: 'build-outline' },
  { label: 'Repairs & Maint.', icon: 'hammer-outline' },
  { label: 'Other Misc.', icon: 'receipt-outline' },
];

export function ExpenseBillPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: ExpenseBillPageProps) {
  const { t, lang } = useLanguage();

  // Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Add Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formCategory, setFormCategory] = useState('Fuel & Petrol');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('CASH');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formPhotoName, setFormPhotoName] = useState('');
  const [formDocId, setFormDocId] = useState('');
  const [isFormCalendarOpen, setIsFormCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Photo viewer state
  const [viewingDoc, setViewingDoc] = useState<{
    url: string;
    title: string;
    date: string;
    amount: number | string;
    party: string;
  } | null>(null);

  const activeEntries = useMemo(
    () => data.entries.filter((e) => !e.voided_at && e.kind === 'EXPENSE'),
    [data.entries]
  );

  // Statistics
  const stats = useMemo(() => {
    let totalExpense = 0;
    let thisMonthExpense = 0;
    const nowMonth = today().slice(0, 7);
    const siteIds = new Set<string>();

    for (const e of activeEntries) {
      const amt = Number(e.amount || 0);
      totalExpense += amt;
      const entryMonth = String(e.date || '').slice(0, 7);
      if (entryMonth === nowMonth) {
        thisMonthExpense += amt;
      }
      if (e.site_id) siteIds.add(String(e.site_id));
    }

    return {
      totalExpense,
      thisMonthExpense,
      totalBills: activeEntries.length,
      sitesCount: siteIds.size,
    };
  }, [activeEntries]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeEntries.filter((e) => {
      if (selectedSiteId !== 'ALL' && String(e.site_id) !== String(selectedSiteId)) {
        return false;
      }
      if (selectedDate && String(e.date).slice(0, 10) !== selectedDate) {
        return false;
      }
      if (selectedCategory !== 'All') {
        const desc = String(e.description || '').toLowerCase();
        const cat = selectedCategory.toLowerCase();
        if (!desc.includes(cat) && !desc.includes(cat.split(' ')[0])) {
          return false;
        }
      }
      if (q) {
        const site = data.sites.find((s) => s.id === e.site_id);
        const matchSite = site ? site.name.toLowerCase().includes(q) : false;
        const matchDesc = String(e.description || '').toLowerCase().includes(q);
        if (!matchSite && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [activeEntries, selectedSiteId, selectedDate, selectedCategory, search, data.sites]);

  const handleOpenDoc = async (docId: string, entry: Row) => {
    try {
      const local = await getDocFromIndexedDB(docId);
      if (local && local.dataUrl) {
        setViewingDoc({
          url: local.dataUrl,
          title: entry.description || 'Expense Receipt',
          date: String(entry.date).slice(0, 10),
          amount: entry.amount,
          party: entry.party || '',
        });
        return;
      }
      const remote = await fetchDocFromServer(docId);
      if (remote && remote.blobUrl) {
        setViewingDoc({
          url: remote.blobUrl,
          title: entry.description || 'Expense Receipt',
          date: String(entry.date).slice(0, 10),
          amount: entry.amount,
          party: entry.party || '',
        });
      }
    } catch (err) {
      console.warn('Could not open doc:', err);
    }
  };

  const handleSaveExpense = async () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError('Please select a work site');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError('Please enter a valid amount');
      return;
    }

    let finalDocId = formDocId;
    if (formPhotoUrl && !formDocId) {
      const genId = 'doc_' + Date.now();
      try {
        await saveDocToIndexedDB(
          genId,
          formPhotoName || 'expense.jpg',
          formPhotoUrl,
          'image/jpeg'
        );
        uploadDocToServer(
          genId,
          formPhotoName || 'expense.jpg',
          formPhotoUrl,
          'image/jpeg'
        ).catch(() => {});
        finalDocId = genId;
      } catch (e) {
        // Continue
      }
    }

    const descParts = [`[${formCategory}]`];
    if (formDescription.trim()) descParts.push(formDescription.trim());
    descParts.push(`Mode: ${formMode}`);

    onSave({
      site_id: formSiteId,
      date: formDate,
      category: formCategory,
      description: descParts.join(' • '),
      amount: String(Math.round(Number(formAmount) * 100)),
      doc_id: finalDocId,
    });

    // Reset Form
    setIsFormOpen(false);
    setFormDescription('');
    setFormAmount('');
    setFormPhotoUrl('');
    setFormPhotoName('');
    setFormDocId('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title={t('otherExpenses', 'Other Expenses Register')}
        subtitle={t('expenseSubtitle', 'Fuel, tea, machine rent, transport & petty cash ledger')}
        icon="receipt"
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
            <View style={[styles.statKpiCard, styles.statKpiExpense]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                  <AppIcon name="receipt" size={16} color="#DC2626" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#991B1B' }]}>Total Expenses</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B91C1C' }]}>
                {money(stats.totalExpense)}
              </Text>
              <Text style={styles.statKpiFoot}>All other expenses</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiMonth]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="calendar" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#1E40AF' }]}>This Month</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#1D4ED8' }]}>
                {money(stats.thisMonthExpense)}
              </Text>
              <Text style={styles.statKpiFoot}>Current month spend</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiBills]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <AppIcon name="document-text" size={16} color="#D97706" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>Total Entries</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                {stats.totalBills}
              </Text>
              <Text style={styles.statKpiFoot}>Recorded bills</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiSites]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#F3E8FF' }]}>
                  <AppIcon name="business" size={16} color="#7C3AED" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#6D28D9' }]}>Work Sites</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#7C3AED' }]}>
                {stats.sitesCount}
              </Text>
              <Text style={styles.statKpiFoot}>Sites incurring expense</Text>
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
                  <Text style={styles.primaryAddBtnTitle}>+ Add Other Expense Bill</Text>
                  <Text style={styles.primaryAddBtnSub}>Record fuel, tea kharcha, machine rent & transport</Text>
                </View>
                <AppIcon name="chevron-forward" size={18} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Card style={styles.inlineFormCard}>
                <View style={styles.formCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.formHeaderIcon}>
                      <AppIcon name="receipt" size={18} color="#2563EB" />
                    </View>
                    <View>
                      <Text style={styles.formTitle}>New Expense Bill Entry</Text>
                      <Text style={styles.formSubtitle}>Record chai, fuel or site kharcha</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setIsFormOpen(false)}
                    style={styles.formCloseBtn}
                  >
                    <AppIcon name="close" size={18} color="#64748B" />
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
                  {/* Site & Category Row */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Work Site *</Text>
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
                      <Text style={styles.inputLabel}>Category</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={formCategory}
                          onValueChange={(val) => setFormCategory(String(val))}
                          style={styles.picker}
                        >
                          {EXPENSE_CATEGORIES.filter((c) => c.label !== 'All').map((c) => (
                            <Picker.Item key={c.label} label={c.label} value={c.label} />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  </View>

                  {/* Date & Amount Row */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Expense Date *</Text>
                      <Pressable
                        onPress={() => setIsFormCalendarOpen(true)}
                        style={styles.datePickerBtn}
                      >
                        <Text style={styles.datePickerBtnText}>{formDate}</Text>
                        <AppIcon name="calendar" size={16} color="#2563EB" />
                      </Pressable>
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Amount (₹) *</Text>
                      <TextInput
                        value={formAmount}
                        onChangeText={setFormAmount}
                        placeholder="e.g. 750"
                        keyboardType="numeric"
                        placeholderTextColor="#94A3B8"
                        style={[styles.textInput, { fontSize: 18, fontWeight: '800', color: '#B91C1C' }]}
                      />
                    </View>
                  </View>

                  {/* Description */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Expense Reason / Item Description</Text>
                    <TextInput
                      value={formDescription}
                      onChangeText={setFormDescription}
                      placeholder="e.g. Diesel 10L for mixer machine, Site visitors tea"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                    />
                  </View>

                  {/* Mode */}
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

                  {/* Photo Attachment */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Receipt / Bill Photo (Optional)</Text>
                    <BillAttachmentPicker
                      photoUrl={formPhotoUrl}
                      photoName={formPhotoName}
                      onPhotoSelected={(url, name) => {
                        setFormPhotoUrl(url);
                        setFormPhotoName(name);
                      }}
                      onPhotoRemoved={() => {
                        setFormPhotoUrl('');
                        setFormPhotoName('');
                        setFormDocId('');
                      }}
                      lang={lang}
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
                      onPress={handleSaveExpense}
                      disabled={busy}
                      style={[styles.formSaveBtn, busy && { opacity: 0.6 }]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                          <Text style={styles.formSaveBtnText}>
                            {formAmount ? `Save ${money(Number(formAmount) * 100)}` : 'Save Expense'}
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
                placeholder="Search expense description, reason or site..."
                placeholderTextColor={Colors.textSubtle}
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <AppIcon name="close-circle" size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Site & Date Filter Row */}
            <View style={styles.filterDropdownRow}>
              <View style={[styles.dropdownBox, { flex: 1 }]}>
                <AppIcon name="business" size={14} color="#0284C7" />
                <Picker
                  selectedValue={selectedSiteId}
                  onValueChange={(val) => setSelectedSiteId(String(val))}
                  style={styles.filterPicker}
                >
                  <Picker.Item label="🏢 All Work Sites" value="ALL" />
                  {data.sites.map((s) => (
                    <Picker.Item key={s.id} label={`🏢 ${s.name}`} value={s.id} />
                  ))}
                </Picker>
              </View>

              <Pressable
                onPress={() => setIsCalendarOpen(true)}
                style={[styles.dateFilterBtn, selectedDate && styles.dateFilterBtnActive]}
              >
                <AppIcon name="calendar" size={14} color={selectedDate ? '#2563EB' : '#64748B'} />
                <Text style={[styles.dateFilterText, selectedDate && { color: '#2563EB', fontWeight: '700' }]}>
                  {selectedDate ? selectedDate : 'All Dates'}
                </Text>
                {selectedDate ? (
                  <Pressable onPress={() => setSelectedDate(null)} hitSlop={6}>
                    <AppIcon name="close" size={12} color="#2563EB" />
                  </Pressable>
                ) : null}
              </Pressable>
            </View>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsScroll}
            >
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <Pressable
                    key={cat.label}
                    onPress={() => setSelectedCategory(cat.label)}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipActive,
                    ]}
                  >
                    <AppIcon
                      name={cat.icon}
                      size={14}
                      color={isSelected ? '#FFFFFF' : '#64748B'}
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

          {/* 5. RECORDS LIST SECTION (Like AttendancePage) */}
          <View style={styles.recordsListSection}>
            <View style={styles.recordsHeaderRow}>
              <View>
                <Text style={styles.recordsHeaderTitle}>
                  Other Expenses ({filteredExpenses.length})
                </Text>
                <Text style={styles.recordsHeaderSub}>
                  Sorted by date • fuel, tea, maintenance & petty cash
                </Text>
              </View>
            </View>

            {filteredExpenses.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No Expenses Recorded"
                description={
                  search || selectedCategory !== 'All' || selectedSiteId !== 'ALL'
                    ? 'No expenses found matching your filter criteria'
                    : 'Tap "+ Add Other Expense Bill" above to record site petty cash or fuel'
                }
              />
            ) : (
              filteredExpenses.map((entry) => {
                const site = data.sites.find((s) => s.id === entry.site_id);
                const entryDate = String(entry.date || '').slice(0, 10);
                const hasDoc = Boolean(entry.doc_id);

                return (
                  <Card key={entry.id} style={styles.expenseCard}>
                    <View style={styles.expenseCardTop}>
                      {/* Category Icon Badge */}
                      <View style={styles.expenseIconBadge}>
                        <AppIcon name="receipt" size={18} color="#DC2626" />
                      </View>

                      {/* Middle Details */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.expenseTitleText} numberOfLines={1}>
                          {entry.description || 'Site Expense'}
                        </Text>

                        <View style={styles.expenseMetaRow}>
                          <AppIcon name="business-outline" size={12} color="#0284C7" />
                          <Text style={styles.expenseSiteText} numberOfLines={1}>
                            {site?.name || 'Site'}
                          </Text>
                          <Text style={styles.metaDivider}>•</Text>
                          <Text style={styles.expenseDateText}>{entryDate}</Text>
                        </View>
                      </View>

                      {/* Right Amount Badge */}
                      <View style={styles.expenseAmountBadge}>
                        <Text style={styles.expenseAmountText}>- {money(entry.amount)}</Text>
                        <Text style={styles.expenseAmountSub}>Expense</Text>
                      </View>
                    </View>

                    {/* Footer Row: Photo Attachment */}
                    {hasDoc ? (
                      <View style={styles.expenseCardBottom}>
                        <Pressable
                          onPress={() => entry.doc_id && handleOpenDoc(entry.doc_id, entry)}
                          style={({ pressed }) => [
                            styles.viewDocChip,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <AppIcon name="image" size={13} color="#2563EB" />
                          <Text style={styles.viewDocChipText}>View Receipt Photo</Text>
                        </Pressable>
                      </View>
                    ) : null}
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
          title="Select Expense Date"
          selectedDate={formDate}
          onSelect={(d) => {
            if (d) setFormDate(d);
            setIsFormCalendarOpen(false);
          }}
          onClose={() => setIsFormCalendarOpen(false)}
        />
      )}

      {/* Full Photo Viewer Modal */}
      {viewingDoc && (
        <BillImageViewerModal
          visible={Boolean(viewingDoc)}
          imageUrl={viewingDoc.url}
          title={viewingDoc.title}
          date={viewingDoc.date}
          amount={viewingDoc.amount}
          party={viewingDoc.party}
          onClose={() => setViewingDoc(null)}
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
  statKpiExpense: { borderLeftWidth: 3, borderLeftColor: '#DC2626' },
  statKpiMonth: { borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  statKpiBills: { borderLeftWidth: 3, borderLeftColor: '#D97706' },
  statKpiSites: { borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
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
  modeTabsRow: { flexDirection: 'row', gap: 6 },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modeTabActive: { backgroundColor: '#2563EB' },
  modeTabText: { fontSize: 11, fontWeight: '700', color: '#475569' },
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
  dateFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 8 },
  dateFilterBtnActive: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  dateFilterText: { fontSize: 12, color: '#64748B' },
  filterChipsScroll: { gap: 6, paddingVertical: 2 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  categoryChipActive: { backgroundColor: '#2563EB' },
  categoryChipText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Records List Section
  recordsListSection: { gap: 10 },
  recordsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordsHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  recordsHeaderSub: { fontSize: 11, color: '#64748B' },
  expenseCard: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  expenseCardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  expenseIconBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  expenseTitleText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  expenseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  expenseSiteText: { fontSize: 11, color: '#0284C7', fontWeight: '600' },
  metaDivider: { fontSize: 11, color: '#CBD5E1' },
  expenseDateText: { fontSize: 11, color: '#64748B' },
  expenseAmountBadge: { alignItems: 'flex-end' },
  expenseAmountText: { fontSize: 16, fontWeight: '800', color: '#B91C1C' },
  expenseAmountSub: { fontSize: 10, color: '#DC2626', fontWeight: '600', marginTop: 1 },
  expenseCardBottom: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  viewDocChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  viewDocChipText: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
});
