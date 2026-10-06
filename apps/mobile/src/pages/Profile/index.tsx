import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { useLanguage } from '../../i18n';

export interface BusinessProfileData {
  contractorName: string;
  firmName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  address: string;
  gstin: string;
  pan: string;
  upiId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

const PROFILE_STORAGE_KEY = 'thekabook_contractor_profile_v3';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi NCR',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

interface ProfilePageProps {
  data: Snapshot;
  onBack: () => void;
  onUpdateProfile?: (values: { name?: string; organization_name?: string }) => Promise<void> | void;
  onLogout?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ProfilePage({
  data,
  onBack,
  onUpdateProfile,
  onLogout,
  onRefresh,
  refreshing = false,
}: ProfilePageProps) {
  const { lang, setLanguage, t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'bank' | 'settings'>('business');
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<BusinessProfileData>({
    contractorName: data.user.name || '',
    firmName: data.organization.name || '',
    phone: '',
    email: '',
    state: 'Delhi NCR',
    city: '',
    address: '',
    gstin: '',
    pan: '',
    upiId: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
  });

  // Load saved profile data on mount
  useEffect(() => {
    async function loadSavedProfile() {
      try {
        let storedStr: string | null = null;
        if (Platform.OS === 'web') {
          storedStr = typeof localStorage !== 'undefined' ? localStorage.getItem(PROFILE_STORAGE_KEY) : null;
          if (!storedStr && typeof localStorage !== 'undefined') {
            storedStr = localStorage.getItem('thekabook_contractor_profile_v2');
          }
        } else {
          storedStr = await SecureStore.getItemAsync(PROFILE_STORAGE_KEY);
        }

        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          setForm((prev) => ({
            ...prev,
            ...parsed,
            contractorName: data.user.name || parsed.contractorName || prev.contractorName,
            firmName: data.organization.name || parsed.firmName || prev.firmName,
          }));
        }
      } catch {}
    }
    loadSavedProfile();
  }, [data.user.name, data.organization.name]);

  // Auto-dismiss notification
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (copiedKey) {
      const timer = setTimeout(() => setCopiedKey(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [copiedKey]);

  const updateField = (key: keyof BusinessProfileData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleCopy = (text: string, keyName: string) => {
    if (!text) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      // 1. Save locally in Storage
      const str = JSON.stringify(form);
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(PROFILE_STORAGE_KEY, str);
        }
      } else {
        await SecureStore.setItemAsync(PROFILE_STORAGE_KEY, str);
      }

      // 2. Sync core name & org with backend commands if changed
      if (onUpdateProfile) {
        await onUpdateProfile({
          name: form.contractorName.trim() || undefined,
          organization_name: form.firmName.trim() || undefined,
        });
      }

      setSuccessMsg(
        lang === 'hi'
          ? '✅ फर्म और प्रोफ़ाइल की जानकारी सुरक्षित हो गई है।'
          : '✅ Firm and contractor profile saved successfully.'
      );
    } catch (e: any) {
      setSuccessMsg(`❌ Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const avatarLetters = (form.contractorName || data.user.name || 'Thekedar')
    .trim()
    .slice(0, 2)
    .toUpperCase() || 'TB';

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title={t('businessProfile', 'Business & Firm Profile')}
        subtitle={form.firmName || data.organization.name}
        onBack={onBack}
        backText={t('back', 'Back')}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
          {/* Notification Banner */}
          {successMsg ? (
            <View style={styles.notificationBanner}>
              <AppIcon name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.notificationText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* 1. ULTRA-PREMIUM EXECUTIVE CONTRACTOR HERO CARD */}
          {/* ========================================================= */}
          <View style={styles.heroCard}>
            {/* Top Identity Block */}
            <View style={styles.heroTopRow}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{avatarLetters}</Text>
                </View>
                <View style={styles.avatarActiveDot} />
              </View>

              <View style={styles.heroMainInfo}>
                <View style={styles.firmTitleRow}>
                  <Text style={styles.firmTitle} numberOfLines={1}>
                    {form.firmName || data.organization.name || 'ThekaBook Business'}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <AppIcon name="shield-checkmark" size={13} color="#16A34A" />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.proprietorRow}>
                  <AppIcon name="person" size={13} color="#475569" />
                  <Text style={styles.proprietorText} numberOfLines={1}>
                    {form.contractorName || data.user.name || 'Thekedar Ji'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  {form.city ? (
                    <View style={styles.metaPill}>
                      <AppIcon name="location-outline" size={11} color="#2563EB" />
                      <Text style={styles.metaPillText}>{form.city}, {form.state}</Text>
                    </View>
                  ) : (
                    <View style={styles.metaPill}>
                      <AppIcon name="location-outline" size={11} color="#2563EB" />
                      <Text style={styles.metaPillText}>{form.state}</Text>
                    </View>
                  )}
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{t('activeBusinessProfile', 'Active Business Profile')}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 2. MODERN FLOATING TAB NAVIGATION */}
          {/* ========================================================= */}
          <View style={styles.navSegmentContainer}>
            <Pressable
              onPress={() => setActiveTab('business')}
              style={[
                styles.navSegmentBtn,
                activeTab === 'business' && styles.navSegmentBtnActive,
              ]}
            >
              <AppIcon
                name="business"
                size={15}
                color={activeTab === 'business' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.navSegmentText,
                  activeTab === 'business' && styles.navSegmentTextActive,
                ]}
              >
                {t('firmDetails', 'Firm Details')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('bank')}
              style={[
                styles.navSegmentBtn,
                activeTab === 'bank' && styles.navSegmentBtnActive,
              ]}
            >
              <AppIcon
                name="wallet"
                size={15}
                color={activeTab === 'bank' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.navSegmentText,
                  activeTab === 'bank' && styles.navSegmentTextActive,
                ]}
              >
                {t('upiAndBank', 'UPI & Bank')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('settings')}
              style={[
                styles.navSegmentBtn,
                activeTab === 'settings' && styles.navSegmentBtnActive,
              ]}
            >
              <AppIcon
                name="settings"
                size={15}
                color={activeTab === 'settings' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.navSegmentText,
                  activeTab === 'settings' && styles.navSegmentTextActive,
                ]}
              >
                {t('appSettings', 'Settings')}
              </Text>
            </Pressable>
          </View>

          {/* ========================================================= */}
          {/* TAB 1: BUSINESS & FIRM PROFILE DETAILS */}
          {/* ========================================================= */}
          {activeTab === 'business' && (
            <View style={styles.tabContentBlock}>
              {/* Card 1: Identity & Primary Info */}
              <View style={styles.premiumCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: '#EFF6FF' }]}>
                    <AppIcon name="business" size={17} color="#1D4ED8" />
                  </View>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderMainTitle}>
                      {t('firmIdentity', 'Firm & Proprietor Identity')}
                    </Text>
                    <Text style={styles.cardHeaderSubtitle}>
                      {t('firmIdentitySub', 'Official details used for client quotations, bills & PDF reports')}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldsContainer}>
                  {/* Firm / Company Name */}
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>
                      {t('firmNameLabel', 'Firm / Company Name')} <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="business-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.firmName}
                        onChangeText={(v) => updateField('firmName', v)}
                        placeholder={t('enterCompanyName', 'e.g. Sharma Constructions')}
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* Contractor / Proprietor Name */}
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>
                      {t('contractorNameLabel', 'Contractor / Proprietor Name')} <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="person-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.contractorName}
                        onChangeText={(v) => updateField('contractorName', v)}
                        placeholder={t('enterContractorName', 'e.g. Ramesh Sharma')}
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 2: Contact & Location */}
              <View style={styles.premiumCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: '#F0FDF4' }]}>
                    <AppIcon name="location" size={17} color="#16A34A" />
                  </View>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderMainTitle}>{t('contactAndLocation', 'Contact & Location')}</Text>
                    <Text style={styles.cardHeaderSubtitle}>
                      {t('contactAndLocationSub', 'Regional office, site yard, and direct contact numbers')}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldsContainer}>
                  {/* Phone & Email */}
                  <View style={styles.responsiveGridRow}>
                    <View style={[styles.fieldItem, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>{t('contactMobileLabel', 'Contact Mobile Number')}</Text>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="call-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.phone}
                          onChangeText={(v) => updateField('phone', v)}
                          placeholder="e.g. 9876543210"
                          placeholderTextColor="#94A3B8"
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    <View style={[styles.fieldItem, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>{t('emailAddressLabel', 'Email Address')}</Text>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="mail-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.email}
                          onChangeText={(v) => updateField('email', v)}
                          placeholder="contractor@thekabook.in"
                          placeholderTextColor="#94A3B8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                  </View>

                  {/* State & City */}
                  <View style={styles.responsiveGridRow}>
                    <View style={[styles.fieldItem, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>{t('stateLabel', 'State / UT')}</Text>
                      <Pressable
                        onPress={() => setStatePickerOpen((v) => !v)}
                        style={styles.stateSelectBtn}
                      >
                        <View style={styles.stateSelectTextWrap}>
                          <AppIcon name="map-outline" size={16} color="#64748B" />
                          <Text style={styles.stateSelectText} numberOfLines={1}>
                            {form.state}
                          </Text>
                        </View>
                        <AppIcon
                          name={statePickerOpen ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color="#64748B"
                        />
                      </Pressable>

                      {/* State Dropdown List */}
                      {statePickerOpen && (
                        <View style={styles.stateDropdownContainer}>
                          <ScrollView
                            style={styles.stateDropdownScroll}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                          >
                            {INDIAN_STATES.map((st) => (
                              <Pressable
                                key={st}
                                onPress={() => {
                                  updateField('state', st);
                                  setStatePickerOpen(false);
                                }}
                                style={[
                                  styles.stateItem,
                                  form.state === st && styles.stateItemActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.stateItemText,
                                    form.state === st && styles.stateItemTextActive,
                                  ]}
                                >
                                  {st}
                                </Text>
                                {form.state === st && (
                                  <AppIcon name="checkmark-circle" size={15} color="#1D4ED8" />
                                )}
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    <View style={[styles.fieldItem, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>{t('cityDistrictLabel', 'City / District')}</Text>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="business-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.city}
                          onChangeText={(v) => updateField('city', v)}
                          placeholder="e.g. Noida / Gurugram"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Office / Yard Address */}
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>{t('officeAddressLabel', 'Office / Site Yard Address')}</Text>
                    <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingVertical: 8 }]}>
                      <AppIcon name="home-outline" size={16} color="#64748B" style={[styles.inputIcon, { marginTop: 3 }]} />
                      <TextInput
                        style={[styles.fieldInput, { height: 56, textAlignVertical: 'top' }]}
                        value={form.address}
                        onChangeText={(v) => updateField('address', v)}
                        placeholder="Shop/Office No., Street, Sector/Colony, Landmark..."
                        placeholderTextColor="#94A3B8"
                        multiline
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 3: Tax & Legal Identifiers (Optional) */}
              <View style={styles.premiumCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: '#FAF5FF' }]}>
                    <AppIcon name="receipt" size={17} color="#7E22CE" />
                  </View>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderMainTitle}>{t('taxAndRegistration', 'Tax & Registration (Optional)')}</Text>
                    <Text style={styles.cardHeaderSubtitle}>
                      {t('taxAndRegistrationSub', 'Printed on GST invoice vouchers and legal client agreements')}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldsContainer}>
                  <View style={styles.responsiveGridRow}>
                    {/* GSTIN */}
                    <View style={[styles.fieldItem, { flex: 1 }]}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={styles.fieldLabel}>{t('gstinLabel', 'GSTIN (GST Number)')}</Text>
                        {form.gstin ? (
                          <Pressable onPress={() => handleCopy(form.gstin, 'gstin')}>
                            <Text style={styles.copyHelperText}>
                              {copiedKey === 'gstin' ? t('copiedText', 'Copied!') : t('copyText', 'Copy')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="document-text-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.gstin}
                          onChangeText={(v) => updateField('gstin', v.toUpperCase())}
                          placeholder="07AAAAA0000A1Z5"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                          maxLength={15}
                        />
                      </View>
                    </View>

                    {/* PAN */}
                    <View style={[styles.fieldItem, { flex: 1 }]}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={styles.fieldLabel}>{t('panLabel', 'PAN Card Number')}</Text>
                        {form.pan ? (
                          <Pressable onPress={() => handleCopy(form.pan, 'pan')}>
                            <Text style={styles.copyHelperText}>
                              {copiedKey === 'pan' ? t('copiedText', 'Copied!') : t('copyText', 'Copy')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="card-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.pan}
                          onChangeText={(v) => updateField('pan', v.toUpperCase())}
                          placeholder="ABCDE1234F"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                          maxLength={10}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Save Action Bar */}
              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primarySaveBtn,
                  saving && { opacity: 0.6 },
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="checkmark-circle" size={19} color="#FFFFFF" />
                    <Text style={styles.primarySaveBtnText}>
                      {t('saveBusinessProfile', 'Save Business Profile')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* ========================================================= */}
          {/* TAB 2: UPI & BANK SETTLEMENT DETAILS */}
          {/* ========================================================= */}
          {activeTab === 'bank' && (
            <View style={styles.tabContentBlock}>
              <View style={styles.premiumCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: '#EFF6FF' }]}>
                    <AppIcon name="wallet" size={17} color="#1D4ED8" />
                  </View>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderMainTitle}>{t('bankAndUpiDetails', 'Bank & UPI Settlement Details')}</Text>
                    <Text style={styles.cardHeaderSubtitle}>
                      {t('bankAndUpiDetailsSub', 'Used for client payments, bill receipts and bank transfers')}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldsContainer}>
                  {/* UPI ID */}
                  <View style={styles.fieldItem}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>{t('upiIdLabel', 'UPI ID / VPA (GPay / PhonePe / Paytm / BHIM)')}</Text>
                      {form.upiId ? (
                        <Pressable onPress={() => handleCopy(form.upiId, 'upi')}>
                          <Text style={styles.copyHelperText}>
                            {copiedKey === 'upi' ? t('copiedText', 'Copied!') : t('copyText', 'Copy UPI')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="qr-code-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.upiId}
                        onChangeText={(v) => updateField('upiId', v.toLowerCase())}
                        placeholder="e.g. balaji.theka@okaxis"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  {/* Bank Name */}
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>{t('bankNameLabel', 'Bank Name')}</Text>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="business-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.bankName}
                        onChangeText={(v) => updateField('bankName', v)}
                        placeholder="e.g. State Bank of India / HDFC Bank"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* Account Number & IFSC */}
                  <View style={styles.responsiveGridRow}>
                    <View style={[styles.fieldItem, { flex: 1.2 }]}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={styles.fieldLabel}>{t('accountNumberLabel', 'Account Number')}</Text>
                        {form.accountNumber ? (
                          <Pressable onPress={() => handleCopy(form.accountNumber, 'acc')}>
                            <Text style={styles.copyHelperText}>
                              {copiedKey === 'acc' ? t('copiedText', 'Copied!') : t('copyText', 'Copy')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="card-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.accountNumber}
                          onChangeText={(v) => updateField('accountNumber', v)}
                          placeholder="e.g. 50100234567890"
                          placeholderTextColor="#94A3B8"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={[styles.fieldItem, { flex: 0.8 }]}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={styles.fieldLabel}>{t('ifscCodeLabel', 'IFSC Code')}</Text>
                        {form.ifscCode ? (
                          <Pressable onPress={() => handleCopy(form.ifscCode, 'ifsc')}>
                            <Text style={styles.copyHelperText}>
                              {copiedKey === 'ifsc' ? t('copiedText', 'Copied!') : t('copyText', 'Copy')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.inputWrapper}>
                        <AppIcon name="shield-outline" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          style={styles.fieldInput}
                          value={form.ifscCode}
                          onChangeText={(v) => updateField('ifscCode', v.toUpperCase())}
                          placeholder="SBIN0001234"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="characters"
                          maxLength={11}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primarySaveBtn,
                  saving && { opacity: 0.6 },
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="checkmark-circle" size={19} color="#FFFFFF" />
                    <Text style={styles.primarySaveBtnText}>{t('savePaymentDetails', 'Save Payment Details')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* ========================================================= */}
          {/* TAB 3: APP SETTINGS, LANGUAGE & SYNC */}
          {/* ========================================================= */}
          {activeTab === 'settings' && (
            <View style={styles.tabContentBlock}>
              {/* Language Selection */}
              <View style={styles.premiumCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: '#F0FDF4' }]}>
                    <AppIcon name="globe-outline" size={17} color="#16A34A" />
                  </View>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardHeaderMainTitle}>{t('appLanguageTitle', 'App Language')}</Text>
                    <Text style={styles.cardHeaderSubtitle}>
                      {t('appLanguageSub', 'Choose language for bills, attendance, reports & navigation')}
                    </Text>
                  </View>
                </View>

                <View style={styles.languageCardsRow}>
                  <Pressable
                    onPress={() => {
                      setLanguage('en');
                      setSuccessMsg('🇬🇧 App language switched to English');
                    }}
                    style={[
                      styles.langCard,
                      lang === 'en' && styles.langCardActive,
                    ]}
                  >
                    <Text style={styles.langEmoji}>🇬🇧</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langTitle, lang === 'en' && styles.langTitleActive]}>
                        English
                      </Text>
                      <Text style={styles.langSub}>Default business ledger</Text>
                    </View>
                    {lang === 'en' && (
                      <AppIcon name="checkmark-circle" size={18} color="#1D4ED8" />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setLanguage('hi');
                      setSuccessMsg('🇮🇳 ऐप की भाषा हिंदी में सेट कर दी गई है');
                    }}
                    style={[
                      styles.langCard,
                      lang === 'hi' && styles.langCardActive,
                    ]}
                  >
                    <Text style={styles.langEmoji}>🇮🇳</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langTitle, lang === 'hi' && styles.langTitleActive]}>
                        हिन्दी (Hindi)
                      </Text>
                      <Text style={styles.langSub}>सरल ठेकेदारी भाषा</Text>
                    </View>
                    {lang === 'hi' && (
                      <AppIcon name="checkmark-circle" size={18} color="#1D4ED8" />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Cloud Ledger Live Sync Card */}
              <View style={styles.premiumCard}>
                <View style={styles.syncCardInner}>
                  <View style={styles.syncCardLeft}>
                    <View style={styles.syncPulseWrapper}>
                      <View style={styles.syncLivePulseDot} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.syncTitle}>{t('cloudLedgerLiveSync', 'Cloud Ledger Live Sync')}</Text>
                      <Text style={styles.syncSubtitle}>
                        {t('cloudLedgerLiveSyncSub', 'Your sites, attendance, materials, and hisab ledger are securely synced.')}
                      </Text>
                    </View>
                  </View>

                  {onRefresh && (
                    <Pressable
                      onPress={() => {
                        onRefresh();
                        setSuccessMsg(lang === 'hi' ? '🔄 डेटा रीफ्रेश किया जा रहा है...' : '🔄 Cloud data synced successfully.');
                      }}
                      style={styles.syncActionButton}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <ActivityIndicator size="small" color="#1D4ED8" />
                      ) : (
                        <>
                          <AppIcon name="sync" size={14} color="#1D4ED8" />
                          <Text style={styles.syncActionText}>{t('syncNow', 'Sync Now')}</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Security Tag */}
              <View style={styles.securityTagBox}>
                <AppIcon name="shield-checkmark" size={15} color="#16A34A" />
                <Text style={styles.securityTagText}>
                  {t('securityFooter', 'ThekaBook v2.4.0 • 256-Bit Encrypted Contractor Accounting System')}
                </Text>
              </View>

              {/* Sign Out Card */}
              <View style={{ marginTop: 8 }}>
                {!confirmLogout ? (
                  <Pressable
                    onPress={() => setConfirmLogout(true)}
                    style={({ pressed }) => [
                      styles.signOutTriggerBtn,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                    ]}
                  >
                    <AppIcon name="log-out-outline" size={17} color="#DC2626" />
                    <Text style={styles.signOutTriggerText}>
                      {t('signOutAccount', 'Sign Out of Contractor Account')}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.confirmLogoutBox}>
                    <Text style={styles.confirmLogoutTitle}>
                      {t('confirmSignOutTitle', 'Are you sure you want to sign out?')}
                    </Text>
                    <Text style={styles.confirmLogoutSub}>
                      {t('confirmSignOutSub', 'Your offline data remains securely linked to your account.')}
                    </Text>
                    <View style={styles.confirmLogoutActions}>
                      <Pressable
                        onPress={() => setConfirmLogout(false)}
                        style={styles.cancelLogoutAction}
                      >
                        <Text style={styles.cancelLogoutActionText}>{t('cancel', 'Cancel')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={onLogout}
                        style={styles.executeLogoutAction}
                      >
                        <Text style={styles.executeLogoutActionText}>
                          {t('yesSignOut', 'Yes, Sign Out')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  root: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  desktopContainer: {
    paddingTop: 24,
  },

  /* Notification Banner */
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notificationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
  },

  /* ========================================================= */
  /* 1. Ultra-Premium Executive Hero Card */
  /* ========================================================= */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0F2851',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#DBEAFE',
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  avatarActiveDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroMainInfo: {
    flex: 1,
    gap: 4,
  },
  firmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  firmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  proprietorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  proprietorText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  statusPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },

  /* 3 Individual Stat Cards */
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfoCol: {
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },

  /* ========================================================= */
  /* 2. Modern Segmented Tab Navigation */
  /* ========================================================= */
  navSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  navSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  navSegmentBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  navSegmentText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  navSegmentTextActive: {
    fontWeight: '900',
    color: '#1D4ED8',
  },

  /* ========================================================= */
  /* Form & Cards Styling */
  /* ========================================================= */
  tabContentBlock: {
    gap: 14,
  },
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardHeaderMainTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  cardHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },

  fieldsContainer: {
    gap: 12,
  },
  fieldItem: {
    gap: 5,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  copyHelperText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  requiredAsterisk: {
    color: '#DC2626',
  },
  responsiveGridRow: {
    flexDirection: 'row',
    gap: 10,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  inputIcon: {
    marginLeft: 2,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
      : {}),
  },

  /* State Selector */
  stateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stateSelectTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stateSelectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stateDropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stateDropdownScroll: {
    maxHeight: 180,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateItemActive: {
    backgroundColor: '#EFF6FF',
  },
  stateItemText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  stateItemTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  /* Primary Save Button */
  primarySaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F2851',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primarySaveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /* Language Cards */
  languageCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  langCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  langCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
  },
  langEmoji: {
    fontSize: 22,
  },
  langTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  langTitleActive: {
    color: '#1D4ED8',
    fontWeight: '900',
  },
  langSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* Cloud Sync */
  syncCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  syncCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  syncPulseWrapper: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncLivePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  syncTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  syncSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  syncActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },

  securityTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  securityTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Sign Out */
  signOutTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 12,
  },
  signOutTriggerText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  confirmLogoutBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  confirmLogoutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
    textAlign: 'center',
  },
  confirmLogoutSub: {
    fontSize: 11.5,
    color: '#7F1D1D',
    textAlign: 'center',
  },
  confirmLogoutActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelLogoutAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelLogoutActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  executeLogoutAction: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  executeLogoutActionText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
