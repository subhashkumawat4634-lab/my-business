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
  Platform,
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

export interface ExtraWorkPageProps {
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenProfile?: () => void;
  siteId?: string;
}

const EXTRA_CATEGORIES = [
  { label: 'All', icon: 'apps-outline' },
  { label: 'Wall & Civil', icon: 'grid-outline' },
  { label: 'Paint & Texture', icon: 'color-palette-outline' },
  { label: 'Tiles & Marble', icon: 'layers-outline' },
  { label: 'Electrical', icon: 'flash-outline' },
  { label: 'Plumbing', icon: 'water-outline' },
  { label: 'Ceiling & Molding', icon: 'cube-outline' },
  { label: 'Waterproofing', icon: 'shield-checkmark-outline' },
  { label: 'Other Extra', icon: 'construct-outline' },
];

const APPROVAL_PRESETS = [
  'WhatsApp message confirmation',
  'Client verbal approval on site',
  'Signed drawing / site slip',
  'Phone call confirmation',
];

export function ExtraWorkPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: ExtraWorkPageProps) {
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
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formParty, setFormParty] = useState('');
  const [formReference, setFormReference] = useState('WhatsApp message confirmation');
  const [paymentType, setPaymentType] = useState<'RECORD' | 'PAID'>('RECORD');
  const [paidMode, setPaidMode] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDocId, setFormDocId] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formPhotoName, setFormPhotoName] = useState('');
  const [formCalendarTarget, setFormCalendarTarget] = useState<'workDate' | 'dueDate' | null>(null);
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
    () => data.entries.filter((e) => !e.voided_at && e.kind === 'EXTRA'),
    [data.entries]
  );

  // Statistics
  const stats = useMemo(() => {
    let totalExtra = 0;
    let thisMonthExtra = 0;
    const nowMonth = today().slice(0, 7);
    const siteIds = new Set<string>();

    for (const e of activeEntries) {
      const amt = Number(e.amount || 0);
      totalExtra += amt;
      const entryMonth = String(e.date || '').slice(0, 7);
      if (entryMonth === nowMonth) {
        thisMonthExtra += amt;
      }
      if (e.site_id) siteIds.add(String(e.site_id));
    }

    return {
      totalExtra,
      thisMonthExtra,
      totalJobs: activeEntries.length,
      sitesCount: siteIds.size,
    };
  }, [activeEntries]);

  // Filtered List
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeEntries.filter((e) => {
      if (selectedSiteId !== 'ALL' && String(e.site_id) !== String(selectedSiteId)) {
        return false;
      }
      if (selectedDate && String(e.date).slice(0, 10) !== selectedDate) {
        return false;
      }
      if (selectedCategory !== 'All') {
        const desc = (e.description || '').toLowerCase();
        if (!desc.includes(selectedCategory.toLowerCase())) {
          return false;
        }
      }
      if (q) {
        const site = data.sites.find((s) => s.id === e.site_id);
        const sName = (site?.name || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        const party = (e.party || '').toLowerCase();
        const ref = (e.reference || '').toLowerCase();
        return (
          sName.includes(q) ||
          desc.includes(q) ||
          party.includes(q) ||
          ref.includes(q)
        );
      }
      return true;
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [activeEntries, selectedSiteId, selectedDate, selectedCategory, search, data.sites]);

  const handleSelectScopePreset = (scope: string) => {
    if (!formDescription.trim()) {
      setFormDescription(scope);
    } else if (!formDescription.toLowerCase().includes(scope.toLowerCase())) {
      setFormDescription(`${scope} - ${formDescription}`);
    }
  };

  const handleOpenPhotoViewer = async (docId: string, item: Row) => {
    try {
      const doc = await getDocFromIndexedDB(docId);
      let url = doc ? doc.dataUrl : '';
      if (!url) {
        const res = await fetchDocFromServer(docId);
        if (res && res.blobUrl) url = res.blobUrl;
      }
      if (url) {
        setViewingDoc({
          url,
          title: item.description || 'Extra Work Attachment',
          date: item.date || '',
          amount: item.amount || 0,
          party: item.party || 'Client',
        });
      }
    } catch (err) {
      console.warn('Failed to load document preview:', err);
    }
  };

  const handleSaveForm = async () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError(lang === 'hi' ? 'कृपया साइट चुनें' : 'Please select a work site');
      return;
    }
    if (!formAmount.trim() || Number(formAmount) <= 0) {
      setLocalError(lang === 'hi' ? 'कृपया सही राशि दर्ज करें' : 'Please enter a valid amount');
      return;
    }
    if (!formDescription.trim()) {
      setLocalError(lang === 'hi' ? 'कृपया काम का विवरण लिखें' : 'Please describe the extra work');
      return;
    }

    let finalDocId = formDocId;
    if (formPhotoUrl && !formDocId) {
      try {
        finalDocId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await saveDocToIndexedDB(
          finalDocId,
          formPhotoName || 'extra.jpg',
          formPhotoUrl,
          'image/jpeg'
        );
        uploadDocToServer(
          finalDocId,
          formPhotoName || 'extra.jpg',
          formPhotoUrl,
          'image/jpeg'
        ).catch((err) => console.warn('Background upload failed:', err));
      } catch (err) {
        console.warn('Failed to store doc locally:', err);
      }
    }

    const currentSite = data.sites.find((s) => s.id === formSiteId);
    const clientParty = formParty.trim() || currentSite?.owner_name || '';
    const finalMode = paymentType === 'RECORD' ? 'RECORD' : paidMode;

    onSave({
      site_id: formSiteId,
      amount: formAmount.trim(),
      date: formDate,
      description: formDescription.trim(),
      party: clientParty,
      mode: finalMode,
      reference: formReference.trim(),
      due_date: paymentType === 'RECORD' ? formDueDate : '',
      quantity: '',
      unit: '',
      doc_id: finalDocId,
    });

    // Reset Form
    setIsFormOpen(false);
    setFormAmount('');
    setFormDescription('');
    setFormParty('');
    setFormReference('WhatsApp message confirmation');
    setPaymentType('RECORD');
    setFormDueDate('');
    setFormDocId('');
    setFormPhotoUrl('');
    setFormPhotoName('');
  };

  const displayError = localError || error;

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar matching AttendancePage */}
      <TopNavBar
        title={lang === 'hi' ? 'एक्स्ट्रा काम रजिस्टर' : 'Extra Work Register'}
        subtitle={lang === 'hi' ? 'क्लाइंट चेंज ऑर्डर्स और अतिरिक्त काम' : 'Client Change Orders & Additional Work Ledger'}
        userInitials={data.user.name}
        organizationName={data.organization.name}
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
          {/* ========================================================= */}
          {/* 1. 4 KPI SUMMARY CARDS (Matching AttendancePage)          */}
          {/* ========================================================= */}
          <View style={styles.statsSummaryGrid}>
            <View style={[styles.statKpiCard, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
                  <AppIcon name="construct" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#1D4ED8' }]}>
                  {lang === 'hi' ? 'कुल एक्स्ट्रा काम' : 'Total Extra Work'}
                </Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#2563EB' }]}>
                {money(stats.totalExtra)}
              </Text>
              <Text style={styles.statKpiFoot}>
                {lang === 'hi' ? 'सभी साइट्स का कुल' : 'All approved change orders'}
              </Text>
            </View>

            <View style={[styles.statKpiCard, { borderColor: '#DCFCE7', backgroundColor: '#F0FDF4' }]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <AppIcon name="calendar" size={16} color="#16A34A" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#166534' }]}>
                  {lang === 'hi' ? 'इस महीने का काम' : 'This Month'}
                </Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#15803D' }]}>
                {money(stats.thisMonthExtra)}
              </Text>
              <Text style={styles.statKpiFoot}>
                {today().slice(0, 7)}
              </Text>
            </View>

            <View style={[styles.statKpiCard, { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' }]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <AppIcon name="receipt" size={16} color="#D97706" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>
                  {lang === 'hi' ? 'कुल ऑर्डर्स' : 'Total Orders'}
                </Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                {stats.totalJobs}
              </Text>
              <Text style={styles.statKpiFoot}>
                {lang === 'hi' ? 'रिकॉर्ड किए गए काम' : 'Work items'}
              </Text>
            </View>

            <View style={[styles.statKpiCard, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#E2E8F0' }]}>
                  <AppIcon name="business" size={16} color="#475569" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#334155' }]}>
                  {lang === 'hi' ? 'साइट्स' : 'Active Sites'}
                </Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#0F172A' }]}>
                {stats.sitesCount}
              </Text>
              <Text style={styles.statKpiFoot}>
                {lang === 'hi' ? 'साइट्स शामिल हैं' : 'Sites with extra work'}
              </Text>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 2. PRIMARY ACTION CTA (+ Add Extra Work / Close)         */}
          {/* ========================================================= */}
          <View style={styles.actionHeaderBox}>
            <Pressable
              onPress={() => setIsFormOpen(!isFormOpen)}
              style={({ pressed }) => [
                styles.primaryAddBtn,
                isFormOpen && styles.primaryAddBtnClose,
                pressed && { opacity: 0.85 },
              ]}
            >
              <AppIcon
                name={isFormOpen ? 'close-circle' : 'add-circle'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.primaryAddBtnText}>
                {isFormOpen
                  ? (lang === 'hi' ? 'फॉर्म बंद करें' : 'Close Form')
                  : (lang === 'hi' ? '+ नया एक्स्ट्रा काम जोड़ें' : '+ Record New Extra Work')}
              </Text>
            </Pressable>
          </View>

          {/* ========================================================= */}
          {/* 3. INLINE CREATION DRAWER CARD                           */}
          {/* ========================================================= */}
          {isFormOpen && (
            <Card style={styles.formContainerCard}>
              <View style={styles.formHeaderRow}>
                <View style={styles.formHeaderTitleWrap}>
                  <View style={styles.formHeaderIconBadge}>
                    <AppIcon name="construct" size={18} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={styles.formTitle}>
                      {lang === 'hi' ? 'नया एक्स्ट्रा काम दर्ज करें' : 'Record New Extra Work'}
                    </Text>
                    <Text style={styles.formSubtitle}>
                      {lang === 'hi' ? 'क्लाइंट की सहमति और चेंज ऑर्डर का विवरण' : 'Client change order agreement details'}
                    </Text>
                  </View>
                </View>
              </View>

              {displayError ? (
                <View style={styles.errorAlert}>
                  <AppIcon name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorAlertText}>{displayError}</Text>
                </View>
              ) : null}

              {/* Row 1: Site Picker & Date */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'साइट चुनें *' : 'Select Work Site *'}
                  </Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={formSiteId}
                      onValueChange={(val: any) => setFormSiteId(String(val))}
                      style={styles.pickerInput}
                    >
                      {data.sites.map((s) => (
                        <Picker.Item key={s.id} label={s.name} value={s.id} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'काम की तारीख *' : 'Work Date *'}
                  </Text>
                  <Pressable
                    onPress={() => setFormCalendarTarget('workDate')}
                    style={styles.datePickerInput}
                  >
                    <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                    <Text style={styles.datePickerInputText}>{formDate}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Quick Scope Presets Chips */}
              <View style={styles.scopePresetsContainer}>
                <Text style={styles.miniSectionLabel}>
                  {lang === 'hi' ? 'त्वरित काम प्रकार (Quick Select)' : 'Quick Scope Suggestions:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                  {EXTRA_CATEGORIES.filter((c) => c.label !== 'All').map((cat) => (
                    <Pressable
                      key={cat.label}
                      onPress={() => handleSelectScopePreset(cat.label)}
                      style={styles.presetChip}
                    >
                      <AppIcon name={cat.icon as any} size={13} color="#2563EB" />
                      <Text style={styles.presetChipText}>{cat.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Description Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'काम का विवरण (Work Description) *' : 'Work Description / Scope of Work *'}
                </Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder={
                    lang === 'hi'
                      ? 'उदा. मास्टर बेडरूम में दीवार तोड़ना, बालकोनी में अतिरिक्त टाइल फिटिंग...'
                      : 'e.g. Wall demolition in balcony, extra texture painting in hall...'
                  }
                  placeholderTextColor="#94A3B8"
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Row 2: Amount & Party (Client Name) */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'एक्स्ट्रा काम की राशि (₹) *' : 'Extra Work Amount (₹) *'}
                  </Text>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                      style={styles.amountInput}
                    />
                  </View>
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'क्लाइंट का नाम (Party Name)' : 'Client / Party Name'}
                  </Text>
                  <TextInput
                    value={formParty}
                    onChangeText={setFormParty}
                    placeholder={
                      data.sites.find((s) => s.id === formSiteId)?.owner_name ||
                      (lang === 'hi' ? 'क्लाइंट नाम' : 'Client name')
                    }
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Approval Reference / Agreement */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'सहमति संदर्भ (Client Approval Reference) *' : 'Client Approval Reference / Agreement *'}
                </Text>
                <TextInput
                  value={formReference}
                  onChangeText={setFormReference}
                  placeholder="e.g. WhatsApp confirmation / Verbal agreement"
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
                <View style={styles.approvalChipsWrap}>
                  {APPROVAL_PRESETS.map((refPreset) => (
                    <Pressable
                      key={refPreset}
                      onPress={() => setFormReference(refPreset)}
                      style={[
                        styles.refChip,
                        formReference === refPreset && styles.refChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.refChipText,
                          formReference === refPreset && styles.refChipTextActive,
                        ]}
                      >
                        {refPreset}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Payment Settlement Options */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'भुगतान स्थिति (Payment Settlement)' : 'Payment Settlement / Status'}
                </Text>
                <View style={styles.paymentTypeRow}>
                  <Pressable
                    onPress={() => setPaymentType('RECORD')}
                    style={[
                      styles.paymentTypeBtn,
                      paymentType === 'RECORD' && styles.paymentTypeBtnActive,
                    ]}
                  >
                    <AppIcon
                      name="receipt-outline"
                      size={16}
                      color={paymentType === 'RECORD' ? '#2563EB' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.paymentTypeBtnText,
                        paymentType === 'RECORD' && styles.paymentTypeBtnTextActive,
                      ]}
                    >
                      {lang === 'hi' ? 'बिल में जोड़ें (Pay Later)' : 'Add to Client Bill (Pay Later)'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPaymentType('PAID')}
                    style={[
                      styles.paymentTypeBtn,
                      paymentType === 'PAID' && styles.paymentTypeBtnActive,
                    ]}
                  >
                    <AppIcon
                      name="checkmark-circle-outline"
                      size={16}
                      color={paymentType === 'PAID' ? '#16A34A' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.paymentTypeBtnText,
                        paymentType === 'PAID' && styles.paymentTypeBtnTextActive,
                      ]}
                    >
                      {lang === 'hi' ? 'तुरंत प्राप्त हुआ (Paid on Spot)' : 'Paid on Spot'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Conditional: Paid Mode or Due Date */}
              {paymentType === 'PAID' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'भुगतान का माध्यम (Payment Mode)' : 'Payment Mode Received'}
                  </Text>
                  <View style={styles.modeChipsRow}>
                    {(['CASH', 'UPI', 'BANK'] as const).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setPaidMode(m)}
                        style={[
                          styles.modeChip,
                          paidMode === m && styles.modeChipActive,
                        ]}
                      >
                        <AppIcon
                          name={m === 'CASH' ? 'cash-outline' : m === 'UPI' ? 'phone-portrait-outline' : 'business-outline'}
                          size={15}
                          color={paidMode === m ? '#FFFFFF' : '#475569'}
                        />
                        <Text
                          style={[
                            styles.modeChipText,
                            paidMode === m && styles.modeChipTextActive,
                          ]}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'अपेक्षित भुगतान तिथि (Due Date - Optional)' : 'Expected Due Date (Optional)'}
                  </Text>
                  <Pressable
                    onPress={() => setFormCalendarTarget('dueDate')}
                    style={styles.datePickerInput}
                  >
                    <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                    <Text style={styles.datePickerInputText}>
                      {formDueDate || (lang === 'hi' ? 'तारीख चुनें (वैकल्पिक)' : 'Select due date (optional)')}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Photo / Slip Attachment */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'फोटो या साइट स्लिप (वैकल्पिक)' : 'Photo / Drawing / Slip (Optional)'}
                </Text>
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
                />
              </View>

              {/* Submit Buttons */}
              <View style={styles.formActionsRow}>
                <Pressable
                  onPress={() => setIsFormOpen(false)}
                  style={styles.cancelFormBtn}
                >
                  <Text style={styles.cancelFormBtnText}>
                    {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveForm}
                  disabled={busy}
                  style={[styles.saveFormBtn, busy && { opacity: 0.7 }]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.saveFormBtnText}>
                        {lang === 'hi' ? 'एक्स्ट्रा काम सुरक्षित करें' : 'Save Extra Work'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Card>
          )}

          {/* ========================================================= */}
          {/* 4. SEARCH & FILTER TOOLBAR (Matching AttendancePage)      */}
          {/* ========================================================= */}
          <View style={styles.toolbarBox}>
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <AppIcon name="search" size={16} color="#64748B" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={lang === 'hi' ? 'काम, पार्टी या साइट खोजें...' : 'Search scope, client, or site...'}
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')}>
                    <AppIcon name="close-circle" size={16} color="#94A3B8" />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={() => setIsCalendarOpen(true)}
                style={[
                  styles.calendarFilterBtn,
                  selectedDate && styles.calendarFilterBtnActive,
                ]}
              >
                <AppIcon
                  name="calendar"
                  size={16}
                  color={selectedDate ? '#2563EB' : '#475569'}
                />
                <Text
                  style={[
                    styles.calendarFilterBtnText,
                    selectedDate && styles.calendarFilterBtnTextActive,
                  ]}
                >
                  {selectedDate ? selectedDate.slice(5) : (lang === 'hi' ? 'तारीख' : 'Date')}
                </Text>
                {selectedDate && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedDate(null);
                    }}
                    hitSlop={8}
                  >
                    <AppIcon name="close-circle" size={14} color="#2563EB" />
                  </Pressable>
                )}
              </Pressable>
            </View>

            {/* Site Picker & Categories */}
            <View style={styles.filterControlsRow}>
              <View style={styles.siteFilterPickerWrap}>
                <Picker
                  selectedValue={selectedSiteId}
                  onValueChange={(val: any) => setSelectedSiteId(String(val))}
                  style={styles.sitePickerStyle}
                >
                  <Picker.Item label={lang === 'hi' ? '🏢 सभी साइट्स (All Sites)' : '🏢 All Sites'} value="ALL" />
                  {data.sites.map((s) => (
                    <Picker.Item key={s.id} label={`📍 ${s.name}`} value={s.id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Scope Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {EXTRA_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.label;
                return (
                  <Pressable
                    key={cat.label}
                    onPress={() => setSelectedCategory(cat.label)}
                    style={[
                      styles.categoryFilterChip,
                      isActive && styles.categoryFilterChipActive,
                    ]}
                  >
                    <AppIcon
                      name={cat.icon as any}
                      size={14}
                      color={isActive ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      style={[
                        styles.categoryFilterChipText,
                        isActive && styles.categoryFilterChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ========================================================= */}
          {/* 5. RECORDS LIST SECTION                                  */}
          {/* ========================================================= */}
          <View style={styles.recordsSection}>
            <View style={styles.recordsSectionHeader}>
              <Text style={styles.recordsSectionTitle}>
                {lang === 'hi' ? 'एक्स्ट्रा काम प्रविष्टियाँ' : 'Extra Work Entries'}
              </Text>
              <Text style={styles.recordsCountBadge}>
                {filteredEntries.length} {lang === 'hi' ? 'काम' : 'items'}
              </Text>
            </View>

            {filteredEntries.length === 0 ? (
              <EmptyState
                icon="construct-outline"
                title={lang === 'hi' ? 'कोई एक्स्ट्रा काम नहीं मिला' : 'No Extra Work Found'}
                description={
                  search || selectedCategory !== 'All' || selectedDate
                    ? (lang === 'hi' ? 'फिल्टर बदलकर पुनः प्रयास करें' : 'Try adjusting your search or filters')
                    : (lang === 'hi' ? 'ऊपर दिए गए बटन से नया एक्स्ट्रा काम जोड़ें' : 'Click "+ Record New Extra Work" above to add the first item.')
                }
              />
            ) : (
              filteredEntries.map((item) => {
                const site = data.sites.find((s) => s.id === item.site_id);
                const hasAttachment = Boolean(item.doc_id);
                const isPaid = item.mode && item.mode !== 'RECORD';

                return (
                  <Card key={item.id} style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <View style={styles.recordSiteBadge}>
                        <AppIcon name="business-outline" size={13} color="#475569" />
                        <Text style={styles.recordSiteText} numberOfLines={1}>
                          {site?.name || 'Site'}
                        </Text>
                      </View>

                      <View style={styles.recordRightBadges}>
                        <View style={styles.recordDateBadge}>
                          <AppIcon name="calendar-outline" size={12} color="#64748B" />
                          <Text style={styles.recordDateText}>{item.date}</Text>
                        </View>
                        <View
                          style={[
                            styles.recordStatusBadge,
                            isPaid ? styles.recordStatusPaid : styles.recordStatusDue,
                          ]}
                        >
                          <Text
                            style={isPaid ? styles.recordStatusPaidText : styles.recordStatusDueText}
                          >
                            {isPaid ? `Paid (${item.mode})` : 'Added to Bill'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.recordMainRow}>
                      <View style={styles.recordInfoCol}>
                        <Text style={styles.recordDescriptionText}>
                          {item.description || 'Extra Work Scope'}
                        </Text>
                        {item.party ? (
                          <View style={styles.recordPartyRow}>
                            <AppIcon name="person-outline" size={13} color="#64748B" />
                            <Text style={styles.recordPartyText}>
                              {lang === 'hi' ? 'क्लाइंट: ' : 'Client: '}{item.party}
                            </Text>
                          </View>
                        ) : null}
                        {item.reference ? (
                          <View style={styles.recordRefRow}>
                            <AppIcon name="checkmark-done-outline" size={13} color="#2563EB" />
                            <Text style={styles.recordRefText}>
                              {item.reference}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.recordAmountCol}>
                        <Text style={styles.recordAmountText}>
                          {money(item.amount)}
                        </Text>
                      </View>
                    </View>

                    {/* Footer with Attachment button */}
                    {hasAttachment && (
                      <View style={styles.recordFootRow}>
                        <Pressable
                          onPress={() => handleOpenPhotoViewer(String(item.doc_id), item)}
                          style={styles.attachmentViewBtn}
                        >
                          <AppIcon name="image-outline" size={14} color="#2563EB" />
                          <Text style={styles.attachmentViewBtnText}>
                            {lang === 'hi' ? 'स्लिप / फोटो देखें' : 'View Attachment'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Filter Calendar Modal */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        selectedDate={selectedDate || today()}
        onSelect={(d) => {
          setSelectedDate(d);
          setIsCalendarOpen(false);
        }}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* Form Calendar Modal */}
      <CalendarPickerModal
        visible={formCalendarTarget !== null}
        selectedDate={formCalendarTarget === 'dueDate' ? (formDueDate || today()) : formDate}
        onSelect={(d) => {
          if (formCalendarTarget === 'workDate') {
            setFormDate(d);
          } else if (formCalendarTarget === 'dueDate') {
            setFormDueDate(d);
          }
          setFormCalendarTarget(null);
        }}
        onClose={() => setFormCalendarTarget(null)}
      />

      {/* Document/Photo Fullscreen Viewer */}
      {viewingDoc && (
        <BillImageViewerModal
          visible={true}
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
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingBottom: 40,
  },
  container: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // KPI Summary Grid
  statsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statKpiCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
      default: { elevation: 1 },
    }),
  },
  statKpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statKpiLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statKpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statKpiFoot: {
    fontSize: 11,
    color: '#64748B',
  },

  // Action CTA
  actionHeaderBox: {
    marginBottom: 16,
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)' },
      default: { elevation: 2 },
    }),
  },
  primaryAddBtnClose: {
    backgroundColor: '#64748B',
  },
  primaryAddBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Form Card
  formContainerCard: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
      default: { elevation: 3 },
    }),
  },
  formHeaderRow: {
    marginBottom: 14,
  },
  formHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  formSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorAlertText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
    minWidth: 140,
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pickerInput: {
    height: 44,
  },
  datePickerInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  datePickerInputText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Presets & Scope Chips
  scopePresetsContainer: {
    marginBottom: 12,
  },
  miniSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  approvalChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  refChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  refChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  refChipTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },

  // Payment Settlement
  paymentTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  paymentTypeBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  paymentTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentTypeBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  modeChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modeChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },

  // Form Action Buttons
  formActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelFormBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  saveFormBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
  },
  saveFormBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Toolbar & Filter Styles
  toolbarBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
      default: { elevation: 1 },
    }),
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  calendarFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 40,
  },
  calendarFilterBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  calendarFilterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  calendarFilterBtnTextActive: {
    color: '#2563EB',
  },
  filterControlsRow: {
    marginBottom: 10,
  },
  siteFilterPickerWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  sitePickerStyle: {
    height: 40,
  },
  categoriesScroll: {
    flexDirection: 'row',
  },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  categoryFilterChipActive: {
    backgroundColor: '#2563EB',
  },
  categoryFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryFilterChipTextActive: {
    color: '#FFFFFF',
  },

  // Records List Styles
  recordsSection: {
    marginBottom: 20,
  },
  recordsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  recordsCountBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  recordCard: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
      default: { elevation: 1 },
    }),
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordSiteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '50%',
  },
  recordSiteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  recordRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  recordDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  recordStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recordStatusDue: {
    backgroundColor: '#EFF6FF',
  },
  recordStatusDueText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
  },
  recordStatusPaid: {
    backgroundColor: '#DCFCE7',
  },
  recordStatusPaidText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '700',
  },
  recordMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordInfoCol: {
    flex: 1,
  },
  recordDescriptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  recordPartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  recordPartyText: {
    fontSize: 12,
    color: '#64748B',
  },
  recordRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  recordRefText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '500',
  },
  recordAmountCol: {
    alignItems: 'flex-end',
  },
  recordAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordFootRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  attachmentViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attachmentViewBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
});
