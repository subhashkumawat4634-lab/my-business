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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';

export interface SiteDocument {
  id: string;
  name: string;
  category: 'AGREEMENT' | 'QUOTATION' | 'DRAWING' | 'PHOTO' | 'OTHER';
  date: string;
  size?: string;
  refNo?: string;
  terms?: string;
}

export interface SiteMetadata {
  userNotes: string;
  documents: SiteDocument[];
  gstin?: string;
  state?: string;
  stateCode?: string;
  businessName?: string;
}

interface SiteFormModalProps {
  spec: FormSpec;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

export const INDIAN_STATES: Array<{ code: string; name: string }> = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

const GST_STATE_MAP = INDIAN_STATES.reduce((acc, curr) => {
  acc[curr.code] = curr.name;
  return acc;
}, {} as Record<string, string>);

const COMMON_UNITS = [
  { label: 'Sq Ft', value: 'sq ft' },
  { label: 'Sq Mtr', value: 'sq mtr' },
  { label: 'Running Ft', value: 'rft' },
  { label: 'Brass', value: 'brass' },
  { label: 'Days', value: 'days' },
  { label: 'Job', value: 'job' },
];

const SITE_SUGGESTIONS = [
  'Residence Renovation',
  'Interior & Painting',
  'Civil Construction',
  'Tile & Flooring Work',
  'Commercial Renovation',
];

const AGREEMENT_TERMS_PRESETS = [
  '25% Advance, 50% Mid-way, 25% Handover',
  'Labour Only contract; client supplies materials',
  'Full Labour + Material; contractor procures supplies',
  'Includes 6 months waterproofing warranty',
];

const META_MARKER = '--- SITE_METADATA_JSON ---';
const DOC_MARKER = '--- ATTACHED DOCUMENTS ---';

export function parseSiteNotesAndDocs(rawNotes: string = ''): SiteMetadata {
  if (!rawNotes) {
    return {
      userNotes: '',
      documents: [],
      gstin: '',
      state: '',
      stateCode: '',
      businessName: '',
    };
  }

  // Check for META_MARKER
  const metaIdx = rawNotes.indexOf(META_MARKER);
  if (metaIdx !== -1) {
    const userNotes = rawNotes.slice(0, metaIdx).trim();
    const jsonPart = rawNotes.slice(metaIdx + META_MARKER.length).trim();
    try {
      const parsed = JSON.parse(jsonPart);
      return {
        userNotes,
        documents: (parsed.documents || []) as SiteDocument[],
        gstin: parsed.gstin || '',
        state: parsed.state || '',
        stateCode: parsed.stateCode || '',
        businessName: parsed.businessName || '',
      };
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Fallback to legacy DOC_MARKER
  const docIdx = rawNotes.indexOf(DOC_MARKER);
  if (docIdx !== -1) {
    const userNotes = rawNotes.slice(0, docIdx).trim();
    const docPart = rawNotes.slice(docIdx + DOC_MARKER.length).trim();
    try {
      const parsed = JSON.parse(docPart);
      if (Array.isArray(parsed)) {
        return {
          userNotes,
          documents: parsed as SiteDocument[],
          gstin: '',
          state: '',
          stateCode: '',
          businessName: '',
        };
      }
    } catch (e) {}
  }

  return {
    userNotes: rawNotes.trim(),
    documents: [],
    gstin: '',
    state: '',
    stateCode: '',
    businessName: '',
  };
}

export function serializeSiteNotesAndDocs(
  userNotes: string,
  documents: SiteDocument[],
  gstin?: string,
  state?: string,
  stateCode?: string,
  businessName?: string
): string {
  const cleanNotes = userNotes.trim();
  const metaObj: Record<string, any> = {};

  if (documents && documents.length) {
    metaObj.documents = documents.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      date: d.date,
      size: d.size || undefined,
      refNo: d.refNo || undefined,
      terms: d.terms || undefined,
    }));
  }

  if (gstin && gstin.trim()) metaObj.gstin = gstin.trim().toUpperCase();
  if (state && state.trim()) metaObj.state = state.trim();
  if (stateCode && stateCode.trim()) metaObj.stateCode = stateCode.trim();
  if (businessName && businessName.trim())
    metaObj.businessName = businessName.trim();

  if (Object.keys(metaObj).length === 0) {
    return cleanNotes;
  }

  const jsonStr = JSON.stringify(metaObj);
  return cleanNotes
    ? `${cleanNotes}\n\n${META_MARKER}\n${jsonStr}`
    : `${META_MARKER}\n${jsonStr}`;
}

const formatDatePretty = (isoDate: string) => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'Select Date';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function SiteFormModal({
  spec,
  busy,
  error,
  onClose,
  onSave,
}: SiteFormModalProps) {
  const isEdit = spec.action === 'site.update';
  const { width } = useWindowDimensions();
  const isMobile = width <= 600;

  // Initial parsed notes and documents
  const initialData = useMemo(() => {
    return parseSiteNotesAndDocs(spec.initial.notes || '');
  }, [spec.initial.notes]);

  const [name, setName] = useState(spec.initial.name || '');
  const [ownerName, setOwnerName] = useState(spec.initial.owner_name || '');
  const [phone, setPhone] = useState(spec.initial.phone || '');
  const [address, setAddress] = useState(spec.initial.address || '');

  // GST & State
  const [isGstRegistered, setIsGstRegistered] = useState(
    Boolean(initialData.gstin)
  );
  const [gstin, setGstin] = useState(initialData.gstin || '');
  const [selectedState, setSelectedState] = useState(initialData.state || '');
  const [selectedStateCode, setSelectedStateCode] = useState(
    initialData.stateCode || ''
  );
  const [businessName, setBusinessName] = useState(
    initialData.businessName || ''
  );
  const [isStatePickerOpen, setIsStatePickerOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const [workType, setWorkType] = useState<'LABOUR' | 'MATERIAL'>(
    (spec.initial.work_type as any) || 'LABOUR'
  );
  const [pricing, setPricing] = useState<'FIXED' | 'UNIT' | 'DAILY'>(
    (spec.initial.pricing as any) || 'FIXED'
  );

  const [contractAmount, setContractAmount] = useState(
    spec.initial.contract_amount || ''
  );
  const [quantity, setQuantity] = useState(spec.initial.quantity || '1');
  const [unit, setUnit] = useState(
    spec.initial.unit || (pricing === 'DAILY' ? 'days' : 'sq ft')
  );
  const [unitRate, setUnitRate] = useState(spec.initial.unit_rate || '');

  const [remainingEstimate, setRemainingEstimate] = useState(
    spec.initial.remaining_estimate || ''
  );
  const [startDate, setStartDate] = useState(
    spec.initial.start_date ||
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [endDate, setEndDate] = useState(spec.initial.end_date || '');
  const [status, setStatus] = useState(spec.initial.status || 'ONGOING');
  const [notes, setNotes] = useState(initialData.userNotes);

  // Documents state
  const [documents, setDocuments] = useState<SiteDocument[]>(
    initialData.documents
  );
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<
    'AGREEMENT' | 'QUOTATION' | 'DRAWING' | 'PHOTO' | 'OTHER'
  >('AGREEMENT');
  const [newDocRef, setNewDocRef] = useState('');
  const [newDocTerms, setNewDocTerms] = useState('');

  // Calendar Pickers state
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);

  const [localError, setLocalError] = useState('');
  const [activeSection, setActiveSection] = useState<number>(1);

  // Handle GSTIN change with auto state detection
  const handleGstinChange = (text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    setGstin(clean);

    if (clean.length >= 2) {
      const code = clean.slice(0, 2);
      const stateName = GST_STATE_MAP[code];
      if (stateName) {
        setSelectedState(stateName);
        setSelectedStateCode(code);
      }
    }
  };

  // Financial calculations
  const effectiveContractAmount = useMemo(() => {
    if (pricing === 'FIXED') {
      return parseFloat(contractAmount) || 0;
    }
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(unitRate) || 0;
    return Math.round(q * r);
  }, [pricing, contractAmount, quantity, unitRate]);

  const estRemaining = useMemo(() => {
    return parseFloat(remainingEstimate) || 0;
  }, [remainingEstimate]);

  const projectedMargin = useMemo(() => {
    return effectiveContractAmount - estRemaining;
  }, [effectiveContractAmount, estRemaining]);

  const marginPercentage = useMemo(() => {
    if (effectiveContractAmount <= 0) return 0;
    return Math.round((projectedMargin / effectiveContractAmount) * 100);
  }, [effectiveContractAmount, projectedMargin]);

  // Helper formatting for currency
  const formatIndianWords = (val: number) => {
    if (!val || isNaN(val) || val <= 0) return '';
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)} K`;
    return `₹ ${val.toLocaleString('en-IN')}`;
  };

  const setTodayDate = () => {
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
    setStartDate(today);
  };

  const addMonthsToEndDate = (months: number) => {
    const start = startDate ? new Date(startDate) : new Date();
    if (isNaN(start.getTime())) return;
    start.setMonth(start.getMonth() + months);
    setEndDate(start.toISOString().slice(0, 10));
  };

  // Add Document handler
  const handleAddDocument = () => {
    if (!newDocName.trim()) {
      alert('Please enter a document name.');
      return;
    }
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
    const doc: SiteDocument = {
      id: `doc-${Date.now()}`,
      name: newDocName.trim(),
      category: newDocCategory,
      date: today,
      size: '1.2 MB',
      refNo: newDocRef.trim() || undefined,
      terms: newDocTerms.trim() || undefined,
    };
    setDocuments((prev) => [...prev, doc]);
    setNewDocName('');
    setNewDocRef('');
    setNewDocTerms('');
    setIsDocModalOpen(false);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Web File Picker Trigger
  const triggerWebFilePicker = () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,image/*,.doc,.docx';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const today = new Date().toLocaleDateString('en-CA', {
              timeZone: 'Asia/Kolkata',
            });
            const sizeInMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
            const cat = file.name.toLowerCase().includes('agreement')
              ? 'AGREEMENT'
              : file.name.toLowerCase().includes('drawing')
              ? 'DRAWING'
              : file.name.toLowerCase().includes('quote')
              ? 'QUOTATION'
              : 'OTHER';
            const doc: SiteDocument = {
              id: `doc-${Date.now()}`,
              name: file.name,
              category: cat,
              date: today,
              size: sizeInMb,
            };
            setDocuments((prev) => [...prev, doc]);
          }
        };
        input.click();
        return;
      } catch (err) {}
    }
    setIsDocModalOpen(true);
  };

  const handleSave = () => {
    setLocalError('');
    if (!name.trim()) {
      setLocalError('Please enter a site / project name.');
      return;
    }
    if (!ownerName.trim()) {
      setLocalError('Please enter client / owner name.');
      return;
    }
    if (!startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      setLocalError('Please enter a valid start date (YYYY-MM-DD).');
      return;
    }
    if (endDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      setLocalError('Expected end date must follow YYYY-MM-DD format.');
      return;
    }
    if (endDate.trim() && endDate.trim() < startDate.trim()) {
      setLocalError('End date cannot precede start date.');
      return;
    }

    if (pricing === 'FIXED') {
      if (!contractAmount.trim() || parseFloat(contractAmount) < 0) {
        setLocalError('Please enter agreed lumpsum contract amount.');
        return;
      }
    } else {
      if (!unitRate.trim() || parseFloat(unitRate) <= 0) {
        setLocalError('Please enter a valid rate.');
        return;
      }
      if (!quantity.trim() || parseFloat(quantity) <= 0) {
        setLocalError('Please enter agreed quantity or working days.');
        return;
      }
    }

    // Serialize notes, GSTIN, State and documents
    const finalNotes = serializeSiteNotesAndDocs(
      notes,
      documents,
      isGstRegistered ? gstin : '',
      isGstRegistered ? selectedState : '',
      isGstRegistered ? selectedStateCode : '',
      isGstRegistered ? businessName : ''
    );

    const payload: Record<string, string> = {
      name: name.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      work_type: workType,
      pricing: pricing,
      contract_amount:
        pricing === 'FIXED'
          ? contractAmount.trim()
          : String(effectiveContractAmount),
      quantity: quantity.trim() || '1',
      unit: unit.trim() || (pricing === 'DAILY' ? 'days' : 'job'),
      unit_rate: pricing === 'FIXED' ? '0' : unitRate.trim(),
      remaining_estimate: remainingEstimate.trim() || '0',
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      status: status,
      notes: finalNotes,
    };

    onSave(payload);
  };

  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return INDIAN_STATES;
    const q = stateSearch.toLowerCase();
    return INDIAN_STATES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.includes(q)
    );
  }, [stateSearch]);

  const displayError = localError || error;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => !busy && onClose()}
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Mobile Optimized Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => !busy && onClose()}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Close form"
            >
              <AppIcon name="close" size={18} color={Colors.textPrimary} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isEdit ? 'Edit Work Site' : 'New Work Site'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {pricing === 'FIXED'
                  ? 'Lumpsum'
                  : pricing === 'UNIT'
                  ? 'Unit Rate'
                  : 'Daily Rate'}{' '}
                • {workType === 'LABOUR' ? 'Labour' : 'Material'}
              </Text>
            </View>

            <View style={styles.headerRightPlaceholder} />
          </View>

          {/* Error Banner */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <AppIcon name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{displayError}</Text>
            </View>
          ) : null}

          {/* Horizontal Section Indicator Tabs */}
          <View style={styles.tabBarContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBarScroll}
            >
              {[
                { id: 1, label: 'Client & Site', icon: 'business' },
                { id: 2, label: 'Scope & Rate', icon: 'calculator' },
                { id: 3, label: 'Profit Forecast', icon: 'trending-up' },
                { id: 4, label: 'Schedule', icon: 'calendar' },
                {
                  id: 5,
                  label: `Documents (${documents.length})`,
                  icon: 'document-text',
                },
              ].map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setActiveSection(s.id)}
                    style={[
                      styles.sectionTab,
                      isActive && styles.sectionTabActive,
                    ]}
                  >
                    <AppIcon
                      name={s.icon as any}
                      size={13}
                      color={isActive ? '#FFFFFF' : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.sectionTabText,
                        isActive && styles.sectionTabTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* SECTION 1: Client & Site Identity with GST Support */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeNum}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    Client & Site Details
                  </Text>
                  <Text style={styles.sectionSub}>
                    Basic project identity, address and tax details
                  </Text>
                </View>
              </View>

              {/* Site Name */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Project / Site Name</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <AppIcon
                    name="business-outline"
                    size={16}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Sharma Villa · Interior"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>
                {!isEdit && !name && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestionsScroll}
                  >
                    {SITE_SUGGESTIONS.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setName(item)}
                        style={styles.suggestionPill}
                      >
                        <Text style={styles.suggestionPillText}>+ {item}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Client / Owner Name */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Client / Owner Name</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <AppIcon
                    name="person-outline"
                    size={16}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={ownerName}
                    onChangeText={setOwnerName}
                    placeholder="e.g. Rajesh Sharma"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Client Mobile Number</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Site Address */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Site Address / Location</Text>
                <View style={styles.inputWrapper}>
                  <AppIcon
                    name="location-outline"
                    size={16}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Plot No., Colony, City"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* GST & State Tax Option Card */}
              <View style={styles.gstCard}>
                <View style={styles.gstToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gstToggleTitle}>
                      Client is GST Registered
                    </Text>
                    <Text style={styles.gstToggleSub}>
                      Enable for commercial clients, builder firms & GST bills
                    </Text>
                  </View>
                  <Switch
                    value={isGstRegistered}
                    onValueChange={(val) => setIsGstRegistered(val)}
                    trackColor={{ false: '#CBD5E1', true: Colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {isGstRegistered && (
                  <View style={styles.gstInputsBlock}>
                    {/* GSTIN */}
                    <View style={styles.fieldGroup}>
                      <View style={styles.labelRow}>
                        <Text style={styles.fieldLabel}>GSTIN Number</Text>
                        {selectedState ? (
                          <View style={styles.detectedStateBadge}>
                            <Text style={styles.detectedStateText}>
                              {selectedState} ({selectedStateCode})
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.inputWrapper}>
                        <AppIcon
                          name="card-outline"
                          size={16}
                          color={Colors.textMuted}
                        />
                        <TextInput
                          value={gstin}
                          onChangeText={handleGstinChange}
                          placeholder="e.g. 07AAAAA0000A1Z5"
                          placeholderTextColor={Colors.textSubtle}
                          style={[
                            styles.textInput,
                            { fontWeight: '700', letterSpacing: 0.5 },
                          ]}
                          autoCapitalize="characters"
                          maxLength={15}
                        />
                      </View>
                    </View>

                    {/* State Selector */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        State / Union Territory
                      </Text>
                      <Pressable
                        onPress={() => setIsStatePickerOpen(true)}
                        style={styles.stateSelectBtn}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <AppIcon
                            name="map-outline"
                            size={16}
                            color={Colors.primary}
                          />
                          <Text
                            style={[
                              styles.stateSelectText,
                              !selectedState && { color: Colors.textSubtle },
                            ]}
                          >
                            {selectedState
                              ? `${selectedState} (${selectedStateCode})`
                              : 'Select State / UT'}
                          </Text>
                        </View>
                        <AppIcon
                          name="chevron-forward"
                          size={16}
                          color={Colors.textMuted}
                        />
                      </Pressable>
                    </View>

                    {/* Business Name */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Firm / Legal Business Name (Optional)
                      </Text>
                      <View style={styles.inputWrapper}>
                        <AppIcon
                          name="briefcase-outline"
                          size={16}
                          color={Colors.textMuted}
                        />
                        <TextInput
                          value={businessName}
                          onChangeText={setBusinessName}
                          placeholder="e.g. Rajesh Infrastructure Pvt Ltd"
                          placeholderTextColor={Colors.textSubtle}
                          style={styles.textInput}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* SECTION 2: Scope & Pricing */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionBadge,
                    { backgroundColor: Colors.accentLight },
                  ]}
                >
                  <Text
                    style={[styles.sectionBadgeNum, { color: Colors.accent }]}
                  >
                    2
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    Scope & Pricing Model
                  </Text>
                  <Text style={styles.sectionSub}>
                    What's included and how contract rates are calculated
                  </Text>
                </View>
              </View>

              {/* Scope Radio Cards */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Contract Inclusions</Text>
                <View style={styles.mobileScopeGrid}>
                  <Pressable
                    onPress={() => setWorkType('LABOUR')}
                    style={[
                      styles.mobileScopeCard,
                      workType === 'LABOUR' && styles.mobileScopeCardActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioDotCircle,
                        workType === 'LABOUR' && styles.radioDotCircleActive,
                      ]}
                    >
                      {workType === 'LABOUR' && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mobileScopeTitle}>Labour Only</Text>
                      <Text style={styles.mobileScopeDesc}>
                        Worker & mistri wages only. Client buys all materials.
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => setWorkType('MATERIAL')}
                    style={[
                      styles.mobileScopeCard,
                      workType === 'MATERIAL' && styles.mobileScopeCardActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioDotCircle,
                        workType === 'MATERIAL' && styles.radioDotCircleActive,
                      ]}
                    >
                      {workType === 'MATERIAL' && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mobileScopeTitle}>
                        Labour + Material
                      </Text>
                      <Text style={styles.mobileScopeDesc}>
                        Contractor handles labour and material procurement.
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>

              {/* Pricing Tabs */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Pricing Basis</Text>
                <View style={styles.pricingPillsRow}>
                  {[
                    { id: 'FIXED', label: 'Fixed Lumpsum' },
                    { id: 'UNIT', label: 'Unit Rate' },
                    { id: 'DAILY', label: 'Daily Wage' },
                  ].map((p) => {
                    const isSelected = pricing === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setPricing(p.id as any);
                          if (p.id === 'DAILY') setUnit('days');
                          else if (p.id === 'UNIT' && unit === 'days')
                            setUnit('sq ft');
                        }}
                        style={[
                          styles.pricingPillBtn,
                          isSelected && styles.pricingPillBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pricingPillText,
                            isSelected && styles.pricingPillTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Dynamic Rates */}
              {pricing === 'FIXED' ? (
                <View style={styles.highlightBox}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Total Contract Amount (₹)</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <View style={styles.currencyInputRow}>
                    <Text style={styles.currencyPrefixText}>₹</Text>
                    <TextInput
                      value={contractAmount}
                      onChangeText={(t) =>
                        setContractAmount(t.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="0"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.currencyInput}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {parseFloat(contractAmount) > 0 && (
                    <Text style={styles.wordsPreviewText}>
                      ≈ {formatIndianWords(parseFloat(contractAmount))}
                    </Text>
                  )}
                </View>
              ) : pricing === 'UNIT' ? (
                <View style={styles.highlightBox}>
                  <View style={{ gap: 10 }}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Rate Per Unit (₹) *</Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.currencyPrefixTextSmall}>₹</Text>
                        <TextInput
                          value={unitRate}
                          onChangeText={(t) =>
                            setUnitRate(t.replace(/[^0-9.]/g, ''))
                          }
                          placeholder="e.g. 150"
                          placeholderTextColor={Colors.textSubtle}
                          style={styles.textInput}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Total Quantity / Measurement *
                      </Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          value={quantity}
                          onChangeText={(t) =>
                            setQuantity(t.replace(/[^0-9.]/g, ''))
                          }
                          placeholder="e.g. 1200"
                          placeholderTextColor={Colors.textSubtle}
                          style={styles.textInput}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.fieldLabelSmall}>Measurement Unit:</Text>
                    <View style={styles.unitPillsRow}>
                      {COMMON_UNITS.map((u) => (
                        <Pressable
                          key={u.value}
                          onPress={() => setUnit(u.value)}
                          style={[
                            styles.unitChip,
                            unit === u.value && styles.unitChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitChipText,
                              unit === u.value && styles.unitChipTextActive,
                            ]}
                          >
                            {u.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.calcPreviewRow}>
                    <Text style={styles.calcFormulaText}>
                      {quantity || '0'} {unit} × ₹ {unitRate || '0'}
                    </Text>
                    <Text style={styles.calcTotalText}>
                      = ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              ) : (
                /* DAILY */
                <View style={styles.highlightBox}>
                  <View style={{ gap: 10 }}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Daily Wage Rate (₹) *
                      </Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.currencyPrefixTextSmall}>₹</Text>
                        <TextInput
                          value={unitRate}
                          onChangeText={(t) =>
                            setUnitRate(t.replace(/[^0-9.]/g, ''))
                          }
                          placeholder="e.g. 800"
                          placeholderTextColor={Colors.textSubtle}
                          style={styles.textInput}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        Estimated Working Days *
                      </Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          value={quantity}
                          onChangeText={(t) =>
                            setQuantity(t.replace(/[^0-9.]/g, ''))
                          }
                          placeholder="e.g. 30"
                          placeholderTextColor={Colors.textSubtle}
                          style={styles.textInput}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.calcPreviewRow}>
                    <Text style={styles.calcFormulaText}>
                      {quantity || '0'} days × ₹ {unitRate || '0'}
                    </Text>
                    <Text style={styles.calcTotalText}>
                      = ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* SECTION 3: Budget & Margin Forecast */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionBadge,
                    { backgroundColor: Colors.successLight },
                  ]}
                >
                  <Text
                    style={[styles.sectionBadgeNum, { color: Colors.success }]}
                  >
                    3
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    Budget & Margin Forecast
                  </Text>
                  <Text style={styles.sectionSub}>
                    Anticipated costs to project contractor profitability
                  </Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Estimated Remaining Expenses to Incur (₹)
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefixTextSmall}>₹</Text>
                  <TextInput
                    value={remainingEstimate}
                    onChangeText={(t) =>
                      setRemainingEstimate(t.replace(/[^0-9.]/g, ''))
                    }
                    placeholder="e.g. 45000"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.fieldHelper}>
                  Anticipated costs for pending wages, materials, and transport.
                </Text>
              </View>

              {/* Dark Mobile Profit Card */}
              <View style={styles.mobileProfitCard}>
                <View style={styles.mobileProfitTop}>
                  <Text style={styles.mobileProfitTitle}>Projected Profit</Text>
                  <View
                    style={[
                      styles.marginPill,
                      {
                        backgroundColor:
                          projectedMargin >= 0 ? '#0D8A58' : Colors.danger,
                      },
                    ]}
                  >
                    <Text style={styles.marginPillText}>
                      {projectedMargin >= 0
                        ? `${marginPercentage}% Margin`
                        : 'Loss Warning'}
                    </Text>
                  </View>
                </View>

                <View style={styles.mobileProfitStatsRow}>
                  <View>
                    <Text style={styles.profitStatLabel}>Contract</Text>
                    <Text style={styles.profitStatVal}>
                      ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitStatDivider}>−</Text>
                  <View>
                    <Text style={styles.profitStatLabel}>Est. Cost</Text>
                    <Text style={styles.profitStatVal}>
                      ₹ {estRemaining.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitStatDivider}>=</Text>
                  <View>
                    <Text style={styles.profitStatLabel}>Net Profit</Text>
                    <Text
                      style={[
                        styles.profitStatVal,
                        {
                          color:
                            projectedMargin >= 0 ? '#6EE7B7' : '#FCA5A5',
                        },
                      ]}
                    >
                      ₹ {projectedMargin.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* SECTION 4: Timeline & Status */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionBadge,
                    { backgroundColor: Colors.warningLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionBadgeNum,
                      { color: Colors.warningText },
                    ]}
                  >
                    4
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    Timeline & Project Status
                  </Text>
                  <Text style={styles.sectionSub}>
                    Start dates, completion targets and execution status
                  </Text>
                </View>
              </View>

              {/* Status Chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current Status</Text>
                <View style={styles.mobileStatusGrid}>
                  {[
                    { id: 'ONGOING', label: 'Ongoing', color: Colors.success },
                    { id: 'UPCOMING', label: 'Upcoming', color: Colors.accent },
                    { id: 'PAUSED', label: 'Paused', color: Colors.warning },
                    {
                      id: 'COMPLETED',
                      label: 'Completed',
                      color: Colors.textMuted,
                    },
                  ].map((s) => {
                    const isSelected = status === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setStatus(s.id)}
                        style={[
                          styles.mobileStatusPill,
                          isSelected && {
                            borderColor: s.color,
                            backgroundColor: '#FFFFFF',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: s.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.mobileStatusText,
                            isSelected && {
                              color: s.color,
                              fontWeight: '800',
                            },
                          ]}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Start Date */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Start Date</Text>
                  <Text style={styles.requiredStar}>*</Text>
                  <Pressable onPress={setTodayDate} style={styles.todaySmallBtn}>
                    <Text style={styles.todaySmallBtnText}>Today</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setIsStartCalendarOpen(true)}
                  style={styles.mobileDateTrigger}
                >
                  <View style={styles.mobileDateTriggerLeft}>
                    <AppIcon name="calendar" size={16} color={Colors.primary} />
                    <Text style={styles.mobileDateValText}>
                      {formatDatePretty(startDate)}
                    </Text>
                  </View>
                  <View style={styles.dateChangeBadge}>
                    <Text style={styles.dateChangeBadgeText}>Pick Date</Text>
                  </View>
                </Pressable>
              </View>

              {/* Expected End Date */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Target Completion Date (Optional)
                </Text>
                <Pressable
                  onPress={() => setIsEndCalendarOpen(true)}
                  style={styles.mobileDateTrigger}
                >
                  <View style={styles.mobileDateTriggerLeft}>
                    <AppIcon name="flag" size={16} color={Colors.accent} />
                    <Text
                      style={[
                        styles.mobileDateValText,
                        !endDate && { color: Colors.textSubtle },
                      ]}
                    >
                      {endDate ? formatDatePretty(endDate) : 'Not Specified'}
                    </Text>
                  </View>
                  <View style={styles.dateChangeBadge}>
                    <Text style={styles.dateChangeBadgeText}>
                      {endDate ? 'Change' : 'Pick Date'}
                    </Text>
                  </View>
                </Pressable>

                {/* Quick Date Shortcuts */}
                <View style={styles.mobileShortcutsRow}>
                  <Pressable
                    onPress={() => addMonthsToEndDate(1)}
                    style={styles.shortcutChip}
                  >
                    <Text style={styles.shortcutChipText}>+1M</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => addMonthsToEndDate(3)}
                    style={styles.shortcutChip}
                  >
                    <Text style={styles.shortcutChipText}>+3M</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => addMonthsToEndDate(6)}
                    style={styles.shortcutChip}
                  >
                    <Text style={styles.shortcutChipText}>+6M</Text>
                  </Pressable>
                  {endDate ? (
                    <Pressable
                      onPress={() => setEndDate('')}
                      style={[styles.shortcutChip, { backgroundColor: '#FEE2E2' }]}
                    >
                      <Text
                        style={[
                          styles.shortcutChipText,
                          { color: Colors.danger },
                        ]}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Contract Terms & Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. 25% booking, 50% midpoint, 25% handover..."
                  placeholderTextColor={Colors.textSubtle}
                  style={[styles.textInput, styles.multilineInput]}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            {/* SECTION 5: Agreements & Documents Upload */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionBadge,
                    { backgroundColor: '#EDE9FE' },
                  ]}
                >
                  <Text style={[styles.sectionBadgeNum, { color: '#7C3AED' }]}>
                    5
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    Agreements & Documents
                  </Text>
                  <Text style={styles.sectionSub}>
                    Signed contracts, floor plans, quotations & site photos
                  </Text>
                </View>
              </View>

              {/* Upload Button */}
              <Pressable
                onPress={triggerWebFilePicker}
                style={({ pressed }) => [
                  styles.mobileUploadBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <AppIcon name="cloud-upload" size={16} color="#FFFFFF" />
                <Text style={styles.mobileUploadBtnText}>
                  + Upload Agreement / Document
                </Text>
              </Pressable>

              {/* Attached List */}
              {documents.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {documents.map((doc) => {
                    const isAgreement = doc.category === 'AGREEMENT';
                    return (
                      <View key={doc.id} style={styles.mobileDocCard}>
                        <View style={styles.mobileDocLeft}>
                          <AppIcon
                            name={isAgreement ? 'document-text' : 'image'}
                            size={18}
                            color={isAgreement ? '#16A34A' : '#7C3AED'}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.mobileDocName} numberOfLines={1}>
                              {doc.name}
                            </Text>
                            <Text style={styles.mobileDocMeta}>
                              {doc.category} • {doc.date}
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveDocument(doc.id)}
                          style={styles.mobileDocDeleteBtn}
                        >
                          <AppIcon
                            name="trash-outline"
                            size={15}
                            color={Colors.danger}
                          />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.mobileDocEmpty}>
                  <Text style={styles.mobileDocEmptyText}>
                    No agreements or blueprints attached yet.
                  </Text>
                </View>
              )}
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={styles.bottomBar}>
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
                pressed && { opacity: 0.9 },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppIcon name="checkmark" size={17} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {isEdit ? 'Update Site' : 'Save Site'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* START DATE CALENDAR PICKER */}
      <CalendarPickerModal
        visible={isStartCalendarOpen}
        title="Select Start Date"
        selectedDate={startDate}
        onSelect={(newDate) => {
          if (newDate) setStartDate(newDate);
        }}
        onClose={() => setIsStartCalendarOpen(false)}
      />

      {/* END DATE CALENDAR PICKER */}
      <CalendarPickerModal
        visible={isEndCalendarOpen}
        title="Target Completion Date"
        selectedDate={endDate}
        minDate={startDate}
        allowClear
        onSelect={(newDate) => {
          setEndDate(newDate);
        }}
        onClose={() => setIsEndCalendarOpen(false)}
      />

      {/* STATE PICKER MODAL */}
      {isStatePickerOpen && (
        <Modal
          visible={isStatePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsStatePickerOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsStatePickerOpen(false)}
            />
            <View style={styles.stateModalSheet}>
              <View style={styles.modalSheetHeader}>
                <Text style={styles.modalSheetTitle}>
                  Select State / Union Territory
                </Text>
                <Pressable
                  onPress={() => setIsStatePickerOpen(false)}
                  style={styles.sheetCloseBtn}
                >
                  <AppIcon name="close" size={16} color={Colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.stateSearchBox}>
                <AppIcon name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  value={stateSearch}
                  onChangeText={setStateSearch}
                  placeholder="Search state or code..."
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.stateSearchInput}
                />
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                {filteredStates.map((st) => {
                  const isSelected = selectedStateCode === st.code;
                  return (
                    <Pressable
                      key={st.code}
                      onPress={() => {
                        setSelectedState(st.name);
                        setSelectedStateCode(st.code);
                        setIsStatePickerOpen(false);
                        setStateSearch('');
                      }}
                      style={[
                        styles.stateRowItem,
                        isSelected && styles.stateRowItemActive,
                      ]}
                    >
                      <View style={styles.stateCodePill}>
                        <Text style={styles.stateCodePillText}>{st.code}</Text>
                      </View>
                      <Text
                        style={[
                          styles.stateRowName,
                          isSelected && styles.stateRowNameActive,
                        ]}
                      >
                        {st.name}
                      </Text>
                      {isSelected && (
                        <AppIcon
                          name="checkmark"
                          size={16}
                          color={Colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* MANUAL ATTACH DOCUMENT MODAL */}
      {isDocModalOpen && (
        <Modal
          visible={isDocModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsDocModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsDocModalOpen(false)}
            />
            <View style={styles.docModalSheet}>
              <View style={styles.modalSheetHeader}>
                <Text style={styles.modalSheetTitle}>
                  Attach Project Document
                </Text>
                <Pressable
                  onPress={() => setIsDocModalOpen(false)}
                  style={styles.sheetCloseBtn}
                >
                  <AppIcon name="close" size={16} color={Colors.textPrimary} />
                </Pressable>
              </View>

              <View style={{ gap: 10, marginTop: 8 }}>
                {/* Category Chips */}
                <View style={styles.docCatRow}>
                  {['AGREEMENT', 'QUOTATION', 'DRAWING', 'PHOTO', 'OTHER'].map(
                    (cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setNewDocCategory(cat as any)}
                        style={[
                          styles.docCatChip,
                          newDocCategory === cat && styles.docCatChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.docCatChipText,
                            newDocCategory === cat &&
                              styles.docCatChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Document / File Name *</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={newDocName}
                      onChangeText={setNewDocName}
                      placeholder="e.g. Work_Agreement_Signed.pdf"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Reference No. (Optional)</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={newDocRef}
                      onChangeText={setNewDocRef}
                      placeholder="e.g. AGR-2026-01"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Notes / Terms</Text>
                  <TextInput
                    value={newDocTerms}
                    onChangeText={setNewDocTerms}
                    placeholder="Key terms or description..."
                    placeholderTextColor={Colors.textSubtle}
                    style={[styles.textInput, { height: 48 }]}
                  />
                </View>

                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={() => setIsDocModalOpen(false)}
                    style={styles.sheetCancelBtn}
                  >
                    <Text style={styles.sheetCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAddDocument}
                    style={styles.sheetSaveBtn}
                  >
                    <Text style={styles.sheetSaveText}>Attach</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  errorBannerText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBarScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  sectionTabActive: {
    backgroundColor: Colors.primary,
  },
  sectionTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  sectionTabTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 12,
    gap: 12,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeNum: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  fieldGroup: {
    gap: 5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  fieldLabelSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  requiredStar: {
    color: Colors.danger,
    fontWeight: '800',
  },
  fieldHelper: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    paddingVertical: 6,
  },
  multilineInput: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  countryCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  countryCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 4,
  },
  suggestionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  suggestionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  // GST Section styles
  gstCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 10,
  },
  gstToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstToggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  gstToggleSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  gstInputsBlock: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  detectedStateBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#DCFCE7',
  },
  detectedStateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  stateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  stateSelectText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // Scope Cards (Mobile optimized)
  mobileScopeGrid: {
    gap: 8,
  },
  mobileScopeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  mobileScopeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  radioDotCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDotCircleActive: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  mobileScopeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  mobileScopeDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  // Pricing Pills
  pricingPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pricingPillBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  pricingPillBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pricingPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  pricingPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  highlightBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    height: 48,
  },
  currencyPrefixText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    marginRight: 6,
  },
  currencyPrefixTextSmall: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  currencyInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  wordsPreviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    paddingLeft: 4,
  },
  unitPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  unitChipActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  unitChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  unitChipTextActive: {
    color: Colors.primary,
  },
  calcPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  calcFormulaText: {
    fontSize: 11,
    color: '#3730A3',
    fontWeight: '600',
  },
  calcTotalText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#312E81',
  },
  // Mobile Profit Card
  mobileProfitCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  mobileProfitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileProfitTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  marginPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  marginPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mobileProfitStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profitStatLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  profitStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  profitStatDivider: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  // Mobile Status Grid
  mobileStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mobileStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mobileStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  todaySmallBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.primarySurface,
  },
  todaySmallBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  mobileDateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  mobileDateTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileDateValText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dateChangeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dateChangeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  mobileShortcutsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  shortcutChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  shortcutChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  // Mobile Document Styles
  mobileUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  mobileUploadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mobileDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  mobileDocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  mobileDocName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  mobileDocMeta: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  mobileDocDeleteBtn: {
    padding: 6,
  },
  mobileDocEmpty: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  mobileDocEmptyText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // Sticky Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Modal Backdrop & Sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  stateModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '80%',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalSheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stateSearchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  stateRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateRowItemActive: {
    backgroundColor: '#F0F9FF',
  },
  stateCodePill: {
    width: 28,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCodePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  stateRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  stateRowNameActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  // Doc Modal Sheet
  docModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  docCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  docCatChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  docCatChipActive: {
    backgroundColor: '#7C3AED',
  },
  docCatChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  docCatChipTextActive: {
    color: '#FFFFFF',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  sheetCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  sheetCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  sheetSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#7C3AED',
  },
  sheetSaveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
