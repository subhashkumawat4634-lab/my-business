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
import { downloadSiteDocument, viewSiteDocument } from '../../report';
import { siteForm } from '../../forms';
import { TopNavBar } from '../common/TopNavBar';
import { saveDocToIndexedDB, uploadDocToServer } from '../../storage/docStorage';

export interface SiteDocument {
  id: string;
  name: string;
  category: 'AGREEMENT' | 'QUOTATION' | 'DRAWING' | 'PHOTO' | 'OTHER';
  date: string;
  size?: string;
  refNo?: string;
  terms?: string;
  dataUrl?: string;
}

export interface SiteMetadata {
  userNotes: string;
  documents: SiteDocument[];
  gstin?: string;
  state?: string;
  stateCode?: string;
  businessName?: string;
}

export interface SiteFormModalProps {
  spec?: FormSpec;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
  asPage?: boolean;
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
    } catch (e) { }
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
  asPage = false,
}: SiteFormModalProps) {
  const activeSpec = spec || siteForm();
  const isEdit = activeSpec.action === 'site.update';
  const { width } = useWindowDimensions();
  const isMobile = width <= 600;

  // Initial parsed notes and documents
  const initialData = useMemo(() => {
    return parseSiteNotesAndDocs(activeSpec.initial.notes || '');
  }, [activeSpec.initial.notes]);

  const [name, setName] = useState(activeSpec.initial.name || '');
  const [ownerName, setOwnerName] = useState(activeSpec.initial.owner_name || '');
  const [phone, setPhone] = useState(activeSpec.initial.phone || '');
  const [address, setAddress] = useState(activeSpec.initial.address || '');

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
    (activeSpec.initial.work_type as any) || 'LABOUR'
  );
  const [pricing, setPricing] = useState<'FIXED' | 'UNIT' | 'DAILY'>(
    (activeSpec.initial.pricing as any) || 'FIXED'
  );

  const [contractAmount, setContractAmount] = useState(
    activeSpec.initial.contract_amount || ''
  );
  const [quantity, setQuantity] = useState(activeSpec.initial.quantity || '1');
  const [unit, setUnit] = useState(
    activeSpec.initial.unit || (pricing === 'DAILY' ? 'days' : 'sq ft')
  );
  const [unitRate, setUnitRate] = useState(activeSpec.initial.unit_rate || '');

  const [remainingEstimate, setRemainingEstimate] = useState(
    activeSpec.initial.remaining_estimate || ''
  );
  const [startDate, setStartDate] = useState(
    activeSpec.initial.start_date ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [endDate, setEndDate] = useState(activeSpec.initial.end_date || '');
  const [status, setStatus] = useState(activeSpec.initial.status || 'ONGOING');
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

  // Handle GSTIN change with auto state detection
  const handleGstinChange = (text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    setGstin(clean);

    if (clean.length >= 2) {
      const code = clean.slice(0, 2);
      const stateName = GST_STATE_MAP[code];
      if (stateName && !selectedStateCode) {
        setSelectedState(stateName);
        setSelectedStateCode(code);
      }
    }
  };

  // Real-time GST State & Format Validation
  const gstValidation = useMemo(() => {
    if (!isGstRegistered || !gstin.trim()) return null;
    const clean = gstin.trim().toUpperCase();
    const code = clean.slice(0, 2);
    const gstStateName = GST_STATE_MAP[code];

    let mismatchError = '';
    if (clean.length >= 2) {
      if (!gstStateName) {
        mismatchError = `GST code "${code}" is not a valid Indian state code.`;
      } else if (selectedStateCode && selectedStateCode !== code) {
        mismatchError = 'State code does not match GSTIN';
      }
    }

    let formatError = '';
    if (clean.length > 0 && clean.length < 15) {
      formatError = `GSTIN must be 15 characters (${clean.length}/15 entered).`;
    } else if (clean.length === 15) {
      const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!pattern.test(clean)) {
        formatError = 'Invalid GSTIN format (e.g. 08AAAAA0000A1Z5).';
      }
    }

    return {
      isValid: !mismatchError && !formatError && clean.length === 15,
      mismatchError,
      formatError,
      gstStateCode: code,
      gstStateName,
    };
  }, [isGstRegistered, gstin, selectedState, selectedStateCode]);

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

  // View Document handler
  const handleViewDoc = async (doc: SiteDocument) => {
    try {
      await viewSiteDocument(doc, {
        name: name || 'Site Project',
        owner_name: ownerName || 'Client',
        phone,
        address,
        gstin: isGstRegistered ? gstin : '',
        state: isGstRegistered ? selectedState : '',
        stateCode: isGstRegistered ? selectedStateCode : '',
        businessName: isGstRegistered ? businessName : '',
        work_type: workType,
        pricing,
      });
    } catch (err: any) {
      alert(err?.message || 'Could not view document.');
    }
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

            const reader = new FileReader();
            reader.onload = async () => {
              const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
              const docId = `doc-${Date.now()}`;
              const doc: SiteDocument = {
                id: docId,
                name: file.name,
                category: cat,
                date: today,
                size: sizeInMb,
                dataUrl: dataUrl,
              };
              setDocuments((prev) => [...prev, doc]);

              if (dataUrl) {
                await saveDocToIndexedDB(docId, file.name, dataUrl, file.type);
                uploadDocToServer(docId, file.name, dataUrl, file.type).catch(() => { });
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      } catch (err) { }
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

    if (isGstRegistered) {
      if (!gstin.trim()) {
        setLocalError('Please enter client GSTIN number or turn off GST registration.');
        return;
      }
      if (gstValidation?.mismatchError) {
        setLocalError(gstValidation.mismatchError);
        return;
      }
      if (gstValidation?.formatError) {
        setLocalError(gstValidation.formatError);
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

  const content = (
    <>
      <SafeAreaView
        style={[styles.safeArea, asPage && styles.pageSafeArea]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Mobile / Page Header */}
          {asPage ? (
            <TopNavBar
              title={isEdit ? 'Edit Work Site' : 'Create New Work Site'}
              subtitle={
                isEdit
                  ? `${pricing === 'FIXED' ? 'Lumpsum' : pricing === 'UNIT' ? 'Unit Rate' : 'Daily Rate'} • ${workType === 'LABOUR' ? 'Labour' : 'Material'}`
                  : 'Add a new project or construction contract'
              }
              icon="business-outline"
            />
          ) : (
            <View style={styles.header}>
              <Pressable
                onPress={() => !busy && onClose()}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel="Close form"
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={Colors.textPrimary}
                />
              </Pressable>

              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {isEdit ? 'Edit Work Site' : 'New Work Site'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {`${pricing === 'FIXED' ? 'Lumpsum' : pricing === 'UNIT' ? 'Unit Rate' : 'Daily Rate'} • ${workType === 'LABOUR' ? 'Labour' : 'Material'}`}
                </Text>
              </View>

              <View style={styles.headerRightPlaceholder} />
            </View>
          )}

          {/* Error Banner */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <AppIcon name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{displayError}</Text>
            </View>
          ) : null}

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
                        <Text style={styles.fieldLabel}>Client GSTIN Number</Text>
                        {selectedState ? (
                          <View
                            style={[
                              styles.detectedStateBadge,
                              Boolean(gstValidation?.mismatchError) && styles.detectedStateBadgeError,
                            ]}
                          >
                            <Text
                              style={[
                                styles.detectedStateText,
                                Boolean(gstValidation?.mismatchError) && styles.detectedStateTextError,
                              ]}
                            >
                              {selectedState} ({selectedStateCode})
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.inputWrapper,
                          Boolean(gstValidation?.mismatchError) && styles.inputWrapperError,
                          Boolean(gstValidation?.isValid) && styles.inputWrapperSuccess,
                        ]}
                      >
                        <AppIcon
                          name="card-outline"
                          size={16}
                          color={
                            gstValidation?.mismatchError
                              ? Colors.danger
                              : gstValidation?.isValid
                                ? '#16A34A'
                                : Colors.textMuted
                          }
                        />
                        <TextInput
                          value={gstin}
                          onChangeText={handleGstinChange}
                          placeholder="e.g. 08AAAAA0000A1Z5"
                          placeholderTextColor={Colors.textSubtle}
                          style={[
                            styles.textInput,
                            { fontWeight: '700', letterSpacing: 0.5 },
                            Boolean(gstValidation?.mismatchError) && { color: Colors.danger },
                          ]}
                          autoCapitalize="characters"
                          maxLength={15}
                        />
                        {Boolean(gstValidation?.isValid) && (
                          <AppIcon name="checkmark-circle" size={18} color="#16A34A" />
                        )}
                      </View>

                      {/* Simple Red Indication - No popup/notification banner */}
                      {Boolean(gstValidation?.mismatchError) && (
                        <Text style={styles.simpleRedNotice}>
                          {gstValidation!.mismatchError}
                        </Text>
                      )}

                      {/* Verified Badge */}
                      {Boolean(gstValidation?.isValid) && (
                        <View style={styles.gstValidNotice}>
                          <AppIcon name="shield-checkmark" size={14} color="#16A34A" />
                          <Text style={styles.gstValidNoticeText}>
                            GSTIN Verified for {gstValidation!.gstStateName} (State Code {gstValidation!.gstStateCode})
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* State Selector */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        State / Union Territory
                      </Text>
                      <Pressable
                        onPress={() => {
                          setIsStatePickerOpen(!isStatePickerOpen);
                          setStateSearch('');
                        }}
                        style={[
                          styles.stateSelectBtn,
                          isStatePickerOpen && { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
                          Boolean(gstValidation?.mismatchError) && styles.stateSelectBtnWarn,
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            flex: 1,
                          }}
                        >
                          <AppIcon
                            name="map-outline"
                            size={16}
                            color={
                              Boolean(gstValidation?.mismatchError)
                                ? Colors.danger
                                : Colors.primary
                            }
                          />
                          <Text
                            style={[
                              styles.stateSelectText,
                              !selectedState && { color: Colors.textSubtle },
                              Boolean(gstValidation?.mismatchError) && { color: Colors.danger },
                            ]}
                            numberOfLines={1}
                          >
                            {selectedState
                              ? `${selectedState} (${selectedStateCode})`
                              : 'Select State / UT'}
                          </Text>
                        </View>
                        <AppIcon
                          name={isStatePickerOpen ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={
                            Boolean(gstValidation?.mismatchError)
                              ? Colors.danger
                              : Colors.textMuted
                          }
                        />
                      </Pressable>

                      {/* In-place Downward-Opening Dropdown Menu */}
                      {isStatePickerOpen && (
                        <View style={styles.stateDownwardDropdown}>
                          <View style={styles.stateDropdownSearchBox}>
                            <AppIcon name="search" size={14} color="#64748B" />
                            <TextInput
                              value={stateSearch}
                              onChangeText={setStateSearch}
                              placeholder="Search state or code..."
                              placeholderTextColor="#94A3B8"
                              style={styles.stateDropdownSearchInput}
                              autoFocus
                            />
                            {stateSearch ? (
                              <Pressable onPress={() => setStateSearch('')}>
                                <AppIcon name="close-circle" size={14} color="#94A3B8" />
                              </Pressable>
                            ) : null}
                          </View>

                          <ScrollView
                            style={{ maxHeight: 200 }}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                          >
                            {filteredStates.map((s) => {
                              const isSelected = selectedStateCode === s.code;
                              return (
                                <Pressable
                                  key={s.code}
                                  onPress={() => {
                                    setSelectedState(s.name);
                                    setSelectedStateCode(s.code);
                                    setIsStatePickerOpen(false);
                                    setStateSearch('');
                                  }}
                                  style={[
                                    styles.stateDropdownItem,
                                    isSelected && styles.stateDropdownItemActive,
                                  ]}
                                >
                                  <View style={[styles.stateCodeBadge, isSelected && styles.stateCodeBadgeActive]}>
                                    <Text style={[styles.stateCodeBadgeText, isSelected && styles.stateCodeBadgeTextActive]}>
                                      {s.code}
                                    </Text>
                                  </View>
                                  <Text style={[styles.stateDropdownItemText, isSelected && styles.stateDropdownItemTextActive]}>
                                    {s.name}
                                  </Text>
                                  {isSelected && (
                                    <AppIcon name="checkmark" size={15} color={Colors.primary} />
                                  )}
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      {Boolean(gstValidation?.mismatchError) && (
                        <Text style={styles.simpleRedNotice}>
                          {gstValidation!.mismatchError}
                        </Text>
                      )}
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

              {/* Scope Select Bar */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Contract Inclusions</Text>
                <View
                  style={[
                    styles.scopeSelectBarBtn,
                    { position: 'relative' },
                  ]}
                >
                  <View style={styles.scopeIconWrap}>
                    <AppIcon
                      name={workType === 'LABOUR' ? 'hammer-outline' : 'construct-outline'}
                      size={18}
                      color="#2563EB"
                    />
                  </View>

                  <Text style={styles.scopeSelectTitle} numberOfLines={1}>
                    {workType === 'LABOUR' ? 'Labour Only' : 'Labour + Material'}
                  </Text>

                  <View style={{ marginLeft: 'auto' }}>
                    <AppIcon name="chevron-down" size={16} color="#64748B" />
                  </View>

                  {/* Native HTML Select Bar for direct dropdown selection */}
                  {Platform.OS === 'web' && (
                    <select
                      value={workType}
                      onChange={(e: any) => setWorkType(e.target.value)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 10,
                        fontSize: 16,
                      }}
                      title="Select Contract Inclusions"
                    >
                      <option value="LABOUR">🔨 Labour Only</option>
                      <option value="MATERIAL">🏗️ Labour + Material</option>
                    </select>
                  )}
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

            {/* SECTION 3: Timeline & Project Status */}
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
                    3
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
                  style={styles.fintechDateInput}
                  accessibilityLabel="Pick start date from calendar"
                >
                  <View style={styles.fintechDateLeft}>
                    <Text style={styles.fintechDateSub}>Project Start Date</Text>
                    <Text style={styles.fintechDateMain}>
                      {formatDatePretty(startDate)}
                    </Text>
                  </View>
                  <View style={styles.calendarActionBtn}>
                    <AppIcon name="calendar-outline" size={18} color={Colors.primary} />
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
                  style={styles.fintechDateInput}
                  accessibilityLabel="Pick target completion date from calendar"
                >
                  <View style={styles.fintechDateLeft}>
                    <Text style={styles.fintechDateSub}>Target Handover</Text>
                    <Text
                      style={[
                        styles.fintechDateMain,
                        !endDate && { color: Colors.textSubtle },
                      ]}
                    >
                      {endDate ? formatDatePretty(endDate) : 'Tap calendar to select date'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.calendarActionBtn,
                      endDate && { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
                    ]}
                  >
                    <AppIcon
                      name="calendar-outline"
                      size={18}
                      color={endDate ? '#16A34A' : Colors.primary}
                    />
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
                      style={[
                        styles.shortcutChip,
                        { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
                      ]}
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

            {/* SECTION 4: Budget & Margin Forecast */}
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
                    4
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

              {/* Modern Light Budget & Profit Forecast Card */}
              <View
                style={[
                  styles.mobileProfitCard,
                  projectedMargin >= 0
                    ? styles.mobileProfitCardProfit
                    : styles.mobileProfitCardLoss,
                ]}
              >
                <View style={styles.mobileProfitTop}>
                  <View style={styles.mobileProfitHeadingRow}>
                    <AppIcon
                      name={projectedMargin >= 0 ? 'trending-up' : 'trending-down'}
                      size={17}
                      color={projectedMargin >= 0 ? '#16A34A' : Colors.danger}
                    />
                    <Text style={styles.mobileProfitTitle}>Projected Profit</Text>
                  </View>
                  <View
                    style={[
                      styles.marginPill,
                      projectedMargin >= 0
                        ? styles.marginPillProfit
                        : styles.marginPillLoss,
                    ]}
                  >
                    <Text
                      style={[
                        styles.marginPillText,
                        projectedMargin >= 0
                          ? styles.marginPillTextProfit
                          : styles.marginPillTextLoss,
                      ]}
                    >
                      {projectedMargin >= 0
                        ? `${marginPercentage}% Margin`
                        : 'Loss Warning'}
                    </Text>
                  </View>
                </View>

                <View style={styles.mobileProfitStatsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profitStatLabel}>Contract</Text>
                    <Text style={styles.profitStatVal}>
                      ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitStatDivider}>−</Text>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.profitStatLabel}>Est. Cost</Text>
                    <Text style={styles.profitStatVal}>
                      ₹ {estRemaining.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitStatDivider}>=</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.profitStatLabel}>Net Profit</Text>
                    <Text
                      style={[
                        styles.profitStatVal,
                        {
                          color:
                            projectedMargin >= 0 ? '#15803D' : Colors.danger,
                        },
                      ]}
                    >
                      ₹ {projectedMargin.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
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
                          <View
                            style={[
                              styles.docBadgeBox,
                              {
                                backgroundColor: isAgreement
                                  ? '#DCFCE7'
                                  : '#EDE9FE',
                              },
                            ]}
                          >
                            <AppIcon
                              name={isAgreement ? 'document-text' : 'image'}
                              size={18}
                              color={isAgreement ? '#16A34A' : '#7C3AED'}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.mobileDocName} numberOfLines={1}>
                              {doc.name}
                            </Text>
                            <Text style={styles.mobileDocMeta}>
                              {doc.category} • {doc.date}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.mobileDocActions}>
                          <Pressable
                            onPress={() => handleViewDoc(doc)}
                            style={styles.docDownloadBtn}
                            accessibilityLabel={`View ${doc.name}`}
                          >
                            <AppIcon
                              name="eye-outline"
                              size={14}
                              color="#7C3AED"
                            />
                            <Text style={styles.docDownloadBtnText}>View</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveDocument(doc.id)}
                            style={styles.mobileDocDeleteBtn}
                            accessibilityLabel={`Delete ${doc.name}`}
                          >
                            <AppIcon
                              name="trash-outline"
                              size={15}
                              color={Colors.danger}
                            />
                          </Pressable>
                        </View>
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
          <View style={[styles.bottomBar, asPage && styles.pageActionBar]}>
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
                    {isEdit ? 'Save Changes' : 'Save Site'}
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
    </>
  );

  if (asPage) {
    return <View style={styles.pageRoot}>{content}</View>;
  }

  const isDesktop = width > 768;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => !busy && onClose()}
      presentationStyle="pageSheet"
      transparent={isDesktop}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
          {content}
        </View>
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
    maxWidth: 780,
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
  pageRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pageSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pageBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pageBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  pageActionBar: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
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
  // Scope Select Bar Styles
  scopeSelectBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  scopeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeSelectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
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
  // Mobile Profit Card - Modern Light UI
  mobileProfitCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },
  mobileProfitCardProfit: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  mobileProfitCardLoss: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  mobileProfitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileProfitHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileProfitTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  marginPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  marginPillProfit: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  marginPillLoss: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  marginPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  marginPillTextProfit: {
    color: '#15803D',
  },
  marginPillTextLoss: {
    color: '#B91C1C',
  },
  mobileProfitStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profitStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  profitStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  profitStatDivider: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
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
  // Fintech Date Input & Calendar Trigger
  fintechDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  fintechDateLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  fintechDateSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fintechDateMain: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  calendarActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 6,
  },
  shortcutChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  // GST Section styles & Real-time validation
  inputWrapperError: {
    borderColor: Colors.danger,
    backgroundColor: '#FEF2F2',
  },
  inputWrapperSuccess: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  simpleRedNotice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 2,
  },
  detectedStateBadgeError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  detectedStateTextError: {
    color: Colors.danger,
  },
  stateSelectBtnWarn: {
    borderColor: Colors.danger,
    backgroundColor: '#FEF2F2',
  },
  gstFormatNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 4,
  },
  gstFormatNoteText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
  },
  gstValidNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 4,
  },
  gstValidNoticeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  // Mobile Document Styles
  mobileUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  mobileUploadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mobileDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mobileDocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 6,
  },
  docBadgeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDocName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  mobileDocMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  mobileDocActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  docDownloadBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
  },
  mobileDocDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  mobileDocEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  mobileDocEmptyText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // Sticky Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 14.5,
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
  stateDownwardDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginTop: 6,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 100,
  },
  stateDropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 6,
  },
  stateDropdownSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  stateDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  stateDropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  stateDropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  stateDropdownItemTextActive: {
    fontWeight: '800',
    color: Colors.primary,
  },
  stateCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  stateCodeBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  stateCodeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  stateCodeBadgeTextActive: {
    color: '#1D4ED8',
  },
});
