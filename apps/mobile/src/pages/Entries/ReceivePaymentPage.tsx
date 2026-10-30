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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';

export interface ReceivePaymentPageProps {
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

const PAYMENT_OPTIONS = [
  { key: 'UPI', label: 'UPI' },
  { key: 'BANK', label: 'Bank' },
  { key: 'CASH', label: 'Cash' },
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'ONLINE', label: 'Online' },
];

export function ReceivePaymentPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: ReceivePaymentPageProps) {
  const { t, lang } = useLanguage();

  // Form State
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formParty, setFormParty] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('UPI');
  const [formRef, setFormRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isFormCalendarOpen, setIsFormCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === formSiteId),
    [data.sites, formSiteId]
  );

  const handleSavePayment = () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError('Please select a work site');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError('Please enter a valid amount');
      return;
    }

    const descParts = [`Mode: ${formMode}`];
    if (formRef.trim()) descParts.push(`Ref: ${formRef.trim()}`);
    if (formNotes.trim()) descParts.push(formNotes.trim());

    onSave({
      site_id: formSiteId,
      date: formDate,
      party: formParty.trim() || (selectedSite?.client_name || ''),
      amount: String(Math.round(Number(formAmount) * 100)),
      description: descParts.join(' • '),
    });

    // Reset Form fields
    setFormParty('');
    setFormAmount('');
    setFormRef('');
    setFormNotes('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title={t('receivePayment', 'Payment In Register')}
        subtitle={t('receiveSubtitle', 'Client receipts, milestone payments & incoming cashflow')}
        icon="arrow-down-circle"
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
          {/* 2. DIRECT CLIENT PAYMENT ENTRY FORM */}
          <Card style={styles.inlineFormCard}>
            <View style={styles.formCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formHeaderIcon}>
                  <AppIcon name="arrow-down-circle" size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.formTitle}>
                    {lang === 'hi' ? 'ग्राहक भुगतान प्रविष्टि' : 'Receive Client Payment Entry'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {lang === 'hi'
                      ? 'ग्राहक से प्राप्त राशि को सीधे यहाँ दर्ज करें'
                      : 'Record incoming client payment, milestone or cash in'}
                  </Text>
                </View>
              </View>
            </View>

            {localError || error ? (
              <View style={styles.formErrorBox}>
                <AppIcon name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.formErrorText}>{localError || error}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
            <View style={styles.formBody}>
              {/* Site Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'कार्य स्थल (Work Site) *' : 'Work Site *'}
                </Text>
                <View style={styles.siteBoxContainer}>
                  <AppIcon name="business" size={16} color="#0284C7" />
                  <Text style={styles.siteBoxText} numberOfLines={1}>
                    {selectedSite
                      ? `🏢 ${selectedSite.name}`
                      : (lang === 'hi' ? 'साइट चुनें' : 'Select Work Site')}
                  </Text>
                  <AppIcon name="chevron-down" size={14} color="#64748B" />
                  <Picker
                    selectedValue={formSiteId}
                    onValueChange={(val) => setFormSiteId(String(val))}
                    style={styles.pickerOverlay}
                    dropdownIconColor="transparent"
                    prompt={lang === 'hi' ? 'साइट चुनें' : 'Select Work Site'}
                  >
                    {data.sites.map((s) => (
                      <Picker.Item
                        key={s.id}
                        label={`🏢 ${s.name}`}
                        value={s.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Client & Date Row */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Client / Payer Name</Text>
                  <TextInput
                    value={formParty}
                    onChangeText={setFormParty}
                    placeholder={selectedSite?.client_name || 'Client Name'}
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Receipt Date *</Text>
                  <Pressable
                    onPress={() => setIsFormCalendarOpen(true)}
                    style={styles.datePickerBtn}
                  >
                    <Text style={styles.datePickerBtnText}>{formDate}</Text>
                    <AppIcon name="calendar" size={16} color="#2563EB" />
                  </Pressable>
                </View>
              </View>

              {/* Amount & Payment Mode Row (2 Cards Side by Side) */}
              <View style={styles.twoColRow}>
                {/* 1. Received Amount Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'प्राप्त राशि (₹) *' : 'Received Amount (₹) *'}
                  </Text>
                  <View style={styles.amountBoxContainer}>
                    <Text style={styles.amountCurrencyPrefix}>₹</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="50000"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={styles.amountInput}
                    />
                  </View>
                </View>

                {/* 2. Payment Mode Dropdown Card (Vertical Scroll / Downward List) */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'भुगतान माध्यम (Mode) *' : 'Payment Mode *'}
                  </Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon
                      name={
                        formMode === 'CASH'
                          ? 'cash'
                          : formMode === 'BANK'
                          ? 'business'
                          : formMode === 'CHEQUE'
                          ? 'document-text'
                          : formMode === 'ONLINE'
                          ? 'globe'
                          : 'card'
                      }
                      size={16}
                      color="#2563EB"
                    />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {PAYMENT_OPTIONS.find((p) => p.key === formMode)?.label || formMode}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      selectedValue={formMode}
                      onValueChange={(val) => setFormMode(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                      prompt={lang === 'hi' ? 'भुगतान माध्यम चुनें' : 'Select Payment Mode'}
                    >
                      {PAYMENT_OPTIONS.map((m) => (
                        <Picker.Item key={m.key} label={m.label} value={m.key} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Reference & Notes */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Reference / UTR / Cheque #</Text>
                  <TextInput
                    value={formRef}
                    onChangeText={setFormRef}
                    placeholder="e.g. UTR-982312"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Notes / Milestone</Text>
                  <TextInput
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder="e.g. 2nd Slab Payment"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.formActionRow}>
                <Pressable
                  onPress={() => {
                    setFormParty('');
                    setFormAmount('');
                    setFormRef('');
                    setFormNotes('');
                    setLocalError('');
                  }}
                  style={styles.formCancelBtn}
                >
                  <Text style={styles.formCancelBtnText}>
                    {lang === 'hi' ? 'साफ़ करें' : 'Clear'}
                  </Text>
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
                        {formAmount
                          ? `${lang === 'hi' ? 'प्राप्त करें' : 'Receive'} ${money(Number(formAmount) * 100)}`
                          : (lang === 'hi' ? 'भुगतान दर्ज करें' : 'Save Payment')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>


      {/* Form Date Picker Modal */}
      {isFormCalendarOpen && (
        <CalendarPickerModal
          visible={isFormCalendarOpen}
          title="Select Receipt Date"
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

  // Site Dropdown / Box with No Cut Lines
  siteBoxContainer: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  siteBoxText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginHorizontal: 6,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    zIndex: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

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
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
    width: '100%',
  },
  twoColRow: { flexDirection: 'row', gap: 10, width: '100%' },
  datePickerBtn: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    width: '100%',
  },
  datePickerBtnText: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  amountBoxContainer: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    width: '100%',
  },
  amountCurrencyPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
  },
  amountInput: {
    flex: 1,
    height: 40,
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
    padding: 0,
  },
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
});
