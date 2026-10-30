import React, { useState, useEffect, useRef } from 'react';
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
  BackHandler,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar, formatNameInitials } from '../../components/common/TopNavBar';
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
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
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
  onRefresh,
  refreshing = false,
}: ProfilePageProps) {
  const { lang, t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const scrollRef = useRef<ScrollView>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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
      } catch { }
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

  // Handle hardware back button in Profile
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (statePickerOpen) {
        setStatePickerOpen(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => backSub.remove();
  }, [statePickerOpen, onBack]);

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
          ? 'फर्म और प्रोफ़ाइल की जानकारी सुरक्षित हो गई है।'
          : 'Firm and contractor profile saved successfully.'
      );

      // Auto-scroll smoothly to top so user sees the confirmation popup banner
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e: any) {
      setSuccessMsg(`❌ Error: ${e.message}`);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  const contractorDisplayName =
    form.contractorName || data.user.name || data.organization.name || 'ThekaBook';
  const avatarLetters = formatNameInitials(contractorDisplayName, '');

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title={t('businessProfile', 'Business & Firm Profile')}
        subtitle={form.firmName || data.organization.name}
        onBack={onBack}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
          {/* Notification Banner */}
          {successMsg ? (
            <View style={styles.notificationBanner}>
              <AppIcon
                name={successMsg.includes('❌') || successMsg.toLowerCase().includes('error') ? 'alert-circle' : 'checkmark-circle'}
                size={17}
                color={successMsg.includes('❌') || successMsg.toLowerCase().includes('error') ? '#DC2626' : '#059669'}
              />
              <Text
                style={[
                  styles.notificationText,
                  (successMsg.includes('❌') || successMsg.toLowerCase().includes('error')) && styles.notificationTextError,
                ]}
              >
                {successMsg}
              </Text>
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
                  {avatarLetters ? (
                    <Text style={styles.avatarText}>{avatarLetters}</Text>
                  ) : (
                    <AppIcon name="person" size={26} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.avatarActiveDot} />
              </View>

              <View style={styles.heroMainInfo}>
                <View style={styles.firmTitleRow}>
                  <Text style={styles.firmTitle} numberOfLines={2}>
                    {form.firmName || data.organization.name || 'ThekaBook Business'}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <AppIcon name="shield-checkmark" size={12} color="#15803D" />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.proprietorRow}>
                  <AppIcon name="person-outline" size={13} color="#475569" />
                  <Text style={styles.proprietorText} numberOfLines={1}>
                    {form.contractorName || data.user.name || 'Contractor / Owner'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  {form.city ? (
                    <View style={styles.metaPill}>
                      <AppIcon name="location-outline" size={11} color="#2563EB" />
                      <Text style={styles.metaPillText} numberOfLines={1}>{form.city}, {form.state}</Text>
                    </View>
                  ) : (
                    <View style={styles.metaPill}>
                      <AppIcon name="location-outline" size={11} color="#2563EB" />
                      <Text style={styles.metaPillText} numberOfLines={1}>{form.state}</Text>
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
          {/* BUSINESS & FIRM PROFILE DETAILS                           */}
          {/* ========================================================= */}
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
                  {/* Phone & Email (Responsive: column on mobile, row on desktop) */}
                  <View style={[styles.responsiveGridRow, !isDesktop && styles.responsiveGridCol]}>
                    <View style={styles.flexFieldItem}>
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

                    <View style={styles.flexFieldItem}>
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
                  <View style={[styles.responsiveGridRow, !isDesktop && styles.responsiveGridCol]}>
                    <View style={styles.flexFieldItem}>
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

                    <View style={styles.flexFieldItem}>
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
                    <View style={[styles.inputWrapper, { alignItems: 'flex-start', height: 'auto', minHeight: 50, paddingVertical: 6 }]}>
                      <AppIcon name="home-outline" size={16} color="#64748B" style={[styles.inputIcon, { marginTop: 2 }]} />
                      <TextInput
                        style={[styles.fieldInput, { height: 42, textAlignVertical: 'top' }]}
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
                  <View style={[styles.responsiveGridRow, !isDesktop && styles.responsiveGridCol]}>
                    {/* GSTIN */}
                    <View style={styles.flexFieldItem}>
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
                    <View style={styles.flexFieldItem}>
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
              <View style={styles.primarySaveBtnWrap}>
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.primarySaveBtn,
                    isDesktop && styles.primarySaveBtnDesktop,
                    saving && { opacity: 0.65 },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {saving ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.primarySaveBtnText}>
                        {lang === 'hi' ? 'सुरक्षित हो रहा है...' : 'Saving Profile...'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <AppIcon name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.primarySaveBtnText}>
                        {t('saveBusinessProfile', 'Save Business Profile')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
          </View>
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
    paddingBottom: 90,
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
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  notificationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    textAlign: 'center',
  },
  notificationTextError: {
    color: '#991B1B',
  },

  /* ========================================================= */
  /* 1. Ultra-Premium Executive Hero Card */
  /* ========================================================= */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    fontSize: 21,
    fontWeight: '900',
    color: '#1D4ED8',
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
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  verifiedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
  proprietorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  proprietorText: {
    fontSize: 13,
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
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  statusPill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },

  /* ========================================================= */
  /* Form & Cards Styling */
  /* ========================================================= */
  tabContentBlock: {
    gap: 16,
  },
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardHeaderMainTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },

  fieldsContainer: {
    gap: 11,
  },
  fieldItem: {
    gap: 4,
    width: '100%',
  },
  flexFieldItem: {
    flex: 1,
    gap: 4,
    width: '100%',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  copyHelperText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '900',
  },
  responsiveGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  responsiveGridCol: {
    flexDirection: 'column',
    gap: 10,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    minHeight: 38,
    gap: 7,
  },
  inputIcon: {
    marginLeft: 1,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 0,
    height: 36,
    fontSize: 13,
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
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    minHeight: 38,
  },
  stateSelectTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  stateSelectText: {
    fontSize: 13,
    fontWeight: '600',
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
  primarySaveBtnWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  primarySaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#1E40AF',
    width: '100%',
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primarySaveBtnDesktop: {
    maxWidth: 420,
    alignSelf: 'center',
  },
  primarySaveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

