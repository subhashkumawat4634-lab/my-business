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

interface SiteFormModalProps {
  spec: FormSpec;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const COMMON_UNITS = [
  { label: 'Sq Ft', value: 'sq ft' },
  { label: 'Sq Mtr', value: 'sq mtr' },
  { label: 'Running Ft', value: 'rft' },
  { label: 'Brass', value: 'brass' },
  { label: 'Days', value: 'days' },
  { label: 'Job / Lumpsum', value: 'job' },
];

const SITE_SUGGESTIONS = [
  'Residence Renovation',
  'Interior & Painting',
  'Civil Construction',
  'Tile & Flooring Work',
  'Commercial Renovation',
];

const AGREEMENT_TERMS_PRESETS = [
  'Payment: 25% Advance, 50% Mid-way, 25% Handover',
  'Labour Only contract; client supplies all materials',
  'Full Labour + Material; contractor procures supplies',
  'Includes 6 months quality & waterproofing warranty',
  'Penalty clause applies for delays beyond scheduled completion',
];

const DOC_MARKER = '--- ATTACHED DOCUMENTS ---';

export function parseSiteNotesAndDocs(rawNotes: string = '') {
  if (!rawNotes) return { userNotes: '', documents: [] as SiteDocument[] };
  const idx = rawNotes.indexOf(DOC_MARKER);
  if (idx === -1) {
    return { userNotes: rawNotes.trim(), documents: [] as SiteDocument[] };
  }
  const userNotes = rawNotes.slice(0, idx).trim();
  const docPart = rawNotes.slice(idx + DOC_MARKER.length).trim();
  try {
    const parsed = JSON.parse(docPart);
    if (Array.isArray(parsed)) {
      return { userNotes, documents: parsed as SiteDocument[] };
    }
  } catch (e) {
    // Ignore JSON parse errors
  }
  return { userNotes, documents: [] as SiteDocument[] };
}

export function serializeSiteNotesAndDocs(
  userNotes: string,
  documents: SiteDocument[]
): string {
  const cleanNotes = userNotes.trim();
  if (!documents.length) return cleanNotes;
  const docJson = JSON.stringify(
    documents.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      date: d.date,
      size: d.size || undefined,
      refNo: d.refNo || undefined,
      terms: d.terms || undefined,
    }))
  );
  return cleanNotes
    ? `${cleanNotes}\n\n${DOC_MARKER}\n${docJson}`
    : `${DOC_MARKER}\n${docJson}`;
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
  const isDesktop = width > 768;

  // Initial parsed notes and documents
  const initialData = useMemo(() => {
    return parseSiteNotesAndDocs(spec.initial.notes || '');
  }, [spec.initial.notes]);

  const [name, setName] = useState(spec.initial.name || '');
  const [ownerName, setOwnerName] = useState(spec.initial.owner_name || '');
  const [phone, setPhone] = useState(spec.initial.phone || '');
  const [address, setAddress] = useState(spec.initial.address || '');

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
    if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)} Thousand`;
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
      alert('Please enter a document or file name.');
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
      } catch (err) {
        // Fallback to manual entry
      }
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
      setLocalError('Please enter the client / owner name.');
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
        setLocalError('Please enter an agreed lumpsum contract amount.');
        return;
      }
    } else {
      if (!unitRate.trim() || parseFloat(unitRate) <= 0) {
        setLocalError('Please enter a valid unit or daily rate.');
        return;
      }
      if (!quantity.trim() || parseFloat(quantity) <= 0) {
        setLocalError('Please enter agreed quantity or working days.');
        return;
      }
    }

    // Serialize notes and attached documents
    const finalNotes = serializeSiteNotesAndDocs(notes, documents);

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <AppIcon
                  name={isEdit ? 'create' : 'business'}
                  size={22}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>
                    {isEdit ? 'Edit Work Site' : 'New Work Site'}
                  </Text>
                  <View style={styles.thekaBadge}>
                    <Text style={styles.thekaBadgeText}>
                      {pricing === 'FIXED'
                        ? 'Lumpsum'
                        : pricing === 'UNIT'
                        ? 'Unit Rate'
                        : 'Daily Wage'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  {isEdit
                    ? 'Update project scope, pricing model and timeline'
                    : 'Configure contract pricing, client details & scope'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => !busy && onClose()}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              accessibilityLabel="Close form"
            >
              <AppIcon name="close" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Error Banner */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <AppIcon name="alert-circle" size={20} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{displayError}</Text>
            </View>
          ) : null}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              isDesktop && styles.desktopContainer,
            ]}
          >
            {/* Quick Section Tabs */}
            <View style={styles.navChipsRow}>
              {[
                { id: 1, label: '1. Client & Site' },
                { id: 2, label: '2. Scope & Pricing' },
                { id: 3, label: '3. Budget & Profit' },
                { id: 4, label: '4. Timeline & Status' },
                { id: 5, label: `5. Agreements (${documents.length})` },
              ].map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setActiveSection(s.id)}
                  style={[
                    styles.navChip,
                    activeSection === s.id && styles.navChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.navChipText,
                      activeSection === s.id && styles.navChipTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* SECTION 1: Client & Site Identity */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeNum}>01</Text>
                </View>
                <View>
                  <Text style={styles.sectionHeading}>
                    Client & Work Site Details
                  </Text>
                  <Text style={styles.sectionSub}>
                    Client information and project site location
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
                    size={19}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Sharma Residence · Interior Painting"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>
                {/* Suggestions */}
                {!isEdit && !name && (
                  <View style={styles.suggestionsRow}>
                    <Text style={styles.suggestionTitle}>Suggestions:</Text>
                    {SITE_SUGGESTIONS.slice(0, 3).map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setName(item)}
                        style={styles.suggestionPill}
                      >
                        <Text style={styles.suggestionPillText}>+ {item}</Text>
                      </Pressable>
                    ))}
                  </View>
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
                    size={19}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={ownerName}
                    onChangeText={setOwnerName}
                    placeholder="e.g. Rajesh Gupta"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Client Phone & Address in two columns on desktop */}
              <View style={isDesktop ? styles.desktopRow : { gap: 14 }}>
                <View style={[styles.fieldGroup, isDesktop && { flex: 1 }]}>
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
                      maxLength={12}
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, isDesktop && { flex: 1.4 }]}>
                  <Text style={styles.fieldLabel}>Site Address / Location</Text>
                  <View style={styles.inputWrapper}>
                    <AppIcon
                      name="location-outline"
                      size={19}
                      color={Colors.textMuted}
                    />
                    <TextInput
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Plot No., Colony, Street, City"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.textInput}
                    />
                  </View>
                </View>
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
                    02
                  </Text>
                </View>
                <View>
                  <Text style={styles.sectionHeading}>
                    Scope & Pricing Model
                  </Text>
                  <Text style={styles.sectionSub}>
                    Contract inclusions and calculation structure
                  </Text>
                </View>
              </View>

              {/* Contract Scope Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  What does the contract cover?
                </Text>
                <View style={styles.scopeCardsGrid}>
                  <Pressable
                    onPress={() => setWorkType('LABOUR')}
                    style={[
                      styles.scopeCard,
                      workType === 'LABOUR' && styles.scopeCardSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.scopeIconBox,
                        workType === 'LABOUR' && {
                          backgroundColor: Colors.accentLight,
                        },
                      ]}
                    >
                      <AppIcon
                        name="hammer-outline"
                        size={22}
                        color={
                          workType === 'LABOUR'
                            ? Colors.accent
                            : Colors.textMuted
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.scopeTitle,
                          workType === 'LABOUR' && { color: Colors.primary },
                        ]}
                      >
                        Labour Only
                      </Text>
                      <Text style={styles.scopeDesc}>
                        Contractor provides skilled & unskilled labour. Client
                        procures all materials.
                      </Text>
                    </View>
                    {workType === 'LABOUR' && (
                      <AppIcon
                        name="checkmark-circle"
                        size={20}
                        color={Colors.accent}
                      />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => setWorkType('MATERIAL')}
                    style={[
                      styles.scopeCard,
                      workType === 'MATERIAL' && styles.scopeCardSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.scopeIconBox,
                        workType === 'MATERIAL' && {
                          backgroundColor: Colors.primarySurface,
                        },
                      ]}
                    >
                      <AppIcon
                        name="construct-outline"
                        size={22}
                        color={
                          workType === 'MATERIAL'
                            ? Colors.primary
                            : Colors.textMuted
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.scopeTitle,
                          workType === 'MATERIAL' && { color: Colors.primary },
                        ]}
                      >
                        Labour + Material
                      </Text>
                      <Text style={styles.scopeDesc}>
                        Contractor is responsible for material procurement and
                        complete execution.
                      </Text>
                    </View>
                    {workType === 'MATERIAL' && (
                      <AppIcon
                        name="checkmark-circle"
                        size={20}
                        color={Colors.primary}
                      />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Pricing Basis Tabs */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Agreed Pricing Basis</Text>
                <View style={styles.pricingTabsContainer}>
                  {[
                    {
                      id: 'FIXED',
                      label: 'Fixed Contract',
                      desc: 'Lumpsum Amount',
                      icon: 'lock-closed-outline',
                    },
                    {
                      id: 'UNIT',
                      label: 'Unit / Area Rate',
                      desc: 'Sq Ft / Brass / Unit',
                      icon: 'cube-outline',
                    },
                    {
                      id: 'DAILY',
                      label: 'Daily Wage',
                      desc: 'Per Working Day',
                      icon: 'calendar-outline',
                    },
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
                          styles.pricingTab,
                          isSelected && styles.pricingTabSelected,
                        ]}
                      >
                        <AppIcon
                          name={p.icon}
                          size={18}
                          color={isSelected ? '#FFFFFF' : Colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.pricingTabTitle,
                            isSelected && styles.pricingTabTitleSelected,
                          ]}
                        >
                          {p.label}
                        </Text>
                        <Text
                          style={[
                            styles.pricingTabDesc,
                            isSelected && { color: '#E0E7FF' },
                          ]}
                        >
                          {p.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Dynamic Pricing Inputs */}
              {pricing === 'FIXED' ? (
                <View style={styles.highlightInputBox}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>
                      Total Agreed Contract Amount (₹)
                    </Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <View style={styles.bigCurrencyInputWrapper}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      value={contractAmount}
                      onChangeText={(t) =>
                        setContractAmount(t.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="0"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.bigCurrencyInput}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {parseFloat(contractAmount) > 0 && (
                    <View style={styles.amountHelperBox}>
                      <AppIcon
                        name="sparkles-outline"
                        size={15}
                        color={Colors.accent}
                      />
                      <Text style={styles.amountHelperText}>
                        Total Contract Value:{' '}
                        <Text style={{ fontWeight: '800' }}>
                          {formatIndianWords(parseFloat(contractAmount))}
                        </Text>{' '}
                        (₹{' '}
                        {parseFloat(contractAmount).toLocaleString('en-IN')})
                      </Text>
                    </View>
                  )}
                </View>
              ) : pricing === 'UNIT' ? (
                <View style={styles.highlightInputBox}>
                  <View style={isDesktop ? styles.desktopRow : { gap: 12 }}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Rate Per Unit (₹) *</Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputCurrencyPrefix}>₹</Text>
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

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
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

                  {/* Unit Pills */}
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.smallSubLabel}>
                      Select Measurement Unit:
                    </Text>
                    <View style={styles.unitPillsRow}>
                      {COMMON_UNITS.map((u) => (
                        <Pressable
                          key={u.value}
                          onPress={() => setUnit(u.value)}
                          style={[
                            styles.unitPill,
                            unit === u.value && styles.unitPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitPillText,
                              unit === u.value && styles.unitPillTextActive,
                            ]}
                          >
                            {u.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Live Calculation Preview */}
                  <View style={styles.calculatedValueCard}>
                    <View style={styles.calculatedLeft}>
                      <Text style={styles.calcTitle}>
                        Calculated Total Contract Value
                      </Text>
                      <Text style={styles.calcFormula}>
                        {quantity || '0'} {unit} × ₹ {unitRate || '0'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.calcBigAmount}>
                        ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.calcWords}>
                        {formatIndianWords(effectiveContractAmount)}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                /* DAILY */
                <View style={styles.highlightInputBox}>
                  <View style={isDesktop ? styles.desktopRow : { gap: 12 }}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>
                        Daily Wage Rate (₹) *
                      </Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputCurrencyPrefix}>₹</Text>
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

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
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

                  <View style={styles.calculatedValueCard}>
                    <View style={styles.calculatedLeft}>
                      <Text style={styles.calcTitle}>
                        Estimated Total Daily Billing
                      </Text>
                      <Text style={styles.calcFormula}>
                        {quantity || '0'} days × ₹ {unitRate || '0'} / day
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.calcBigAmount}>
                        ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.calcWords}>
                        {formatIndianWords(effectiveContractAmount)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* SECTION 3: Cost Budget & Profit Margin Preview */}
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
                    03
                  </Text>
                </View>
                <View>
                  <Text style={styles.sectionHeading}>
                    Budget & Profit Margin Forecast
                  </Text>
                  <Text style={styles.sectionSub}>
                    Anticipate remaining costs to forecast net contractor margin
                  </Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Estimated Remaining Expenses to Incur (₹)
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputCurrencyPrefix}>₹</Text>
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
                  Anticipated pending costs for labour wages, materials, and
                  subcontractor bills.
                </Text>
              </View>

              {/* LIVE PROFIT PREVIEW CARD */}
              <View style={styles.profitForecastCard}>
                <View style={styles.profitCardHeader}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <AppIcon name="trending-up" size={20} color="#FFFFFF" />
                    <Text style={styles.profitCardTitle}>
                      Projected Profit Margin
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.marginBadge,
                      {
                        backgroundColor:
                          projectedMargin >= 0 ? '#10B981' : Colors.danger,
                      },
                    ]}
                  >
                    <Text style={styles.marginBadgeText}>
                      {projectedMargin >= 0
                        ? `${marginPercentage}% Margin`
                        : 'Loss Warning'}
                    </Text>
                  </View>
                </View>

                <View style={styles.profitNumbersRow}>
                  <View style={styles.profitCol}>
                    <Text style={styles.profitColLabel}>Contract Value</Text>
                    <Text style={styles.profitColValue}>
                      ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitColMinus}>−</Text>
                  <View style={styles.profitCol}>
                    <Text style={styles.profitColLabel}>Est. Remaining</Text>
                    <Text style={styles.profitColValue}>
                      ₹ {estRemaining.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitColEquals}>=</Text>
                  <View style={styles.profitCol}>
                    <Text style={styles.profitColLabel}>Projected Profit</Text>
                    <Text
                      style={[
                        styles.profitColValue,
                        {
                          color:
                            projectedMargin >= 0 ? '#6EE7B7' : '#FCA5A5',
                          fontWeight: '800',
                          fontSize: 16,
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
                    04
                  </Text>
                </View>
                <View>
                  <Text style={styles.sectionHeading}>
                    Timeline & Project Status
                  </Text>
                  <Text style={styles.sectionSub}>
                    Schedule key dates, milestones, and project execution status
                  </Text>
                </View>
              </View>

              {/* Status Chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current Project Status</Text>
                <View style={styles.statusChipsGrid}>
                  {[
                    {
                      id: 'ONGOING',
                      label: 'Ongoing (Active)',
                      color: Colors.success,
                      light: Colors.successLight,
                    },
                    {
                      id: 'UPCOMING',
                      label: 'Upcoming (Scheduled)',
                      color: Colors.accent,
                      light: Colors.accentLight,
                    },
                    {
                      id: 'PAUSED',
                      label: 'Paused (On Hold)',
                      color: Colors.warning,
                      light: Colors.warningLight,
                    },
                    {
                      id: 'COMPLETED',
                      label: 'Completed',
                      color: Colors.textSecondary,
                      light: Colors.surfaceSubtle,
                    },
                  ].map((s) => {
                    const isSelected = status === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setStatus(s.id)}
                        style={[
                          styles.statusChip,
                          isSelected && {
                            borderColor: s.color,
                            backgroundColor: s.light,
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
                            styles.statusChipText,
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

              {/* Dates with Interactive Calendar Pickers */}
              <View style={isDesktop ? styles.desktopRow : { gap: 14 }}>
                {/* Start Date */}
                <View style={[styles.fieldGroup, isDesktop && { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Start Date</Text>
                    <Text style={styles.requiredStar}>*</Text>
                    <Pressable
                      onPress={setTodayDate}
                      style={styles.todayQuickBtn}
                    >
                      <Text style={styles.todayQuickBtnText}>Today</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => setIsStartCalendarOpen(true)}
                    style={({ pressed }) => [
                      styles.datePickerTrigger,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={styles.datePickerTriggerLeft}>
                      <View style={styles.datePickerIconBox}>
                        <AppIcon
                          name="calendar"
                          size={18}
                          color={Colors.primary}
                        />
                      </View>
                      <View>
                        <Text style={styles.datePickerValueText}>
                          {formatDatePretty(startDate)}
                        </Text>
                        <Text style={styles.datePickerSubtext}>
                          {startDate || 'Tap to choose date'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.datePickerPill}>
                      <Text style={styles.datePickerPillText}>Select</Text>
                    </View>
                  </Pressable>
                </View>

                {/* Expected End Date */}
                <View style={[styles.fieldGroup, isDesktop && { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>
                      Target Completion Date (Optional)
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setIsEndCalendarOpen(true)}
                    style={({ pressed }) => [
                      styles.datePickerTrigger,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={styles.datePickerTriggerLeft}>
                      <View
                        style={[
                          styles.datePickerIconBox,
                          { backgroundColor: '#EEF2FF' },
                        ]}
                      >
                        <AppIcon
                          name="flag"
                          size={18}
                          color={Colors.accent}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.datePickerValueText,
                            !endDate && { color: Colors.textMuted },
                          ]}
                        >
                          {endDate ? formatDatePretty(endDate) : 'Not Specified'}
                        </Text>
                        <Text style={styles.datePickerSubtext}>
                          {endDate || 'Optional completion target'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.datePickerPill}>
                      <Text style={styles.datePickerPillText}>
                        {endDate ? 'Change' : 'Select'}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Quick End Date shortcuts */}
                  <View style={styles.quickDateRow}>
                    <Pressable
                      onPress={() => addMonthsToEndDate(1)}
                      style={styles.quickDatePill}
                    >
                      <Text style={styles.quickDateText}>+1 Month</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => addMonthsToEndDate(3)}
                      style={styles.quickDatePill}
                    >
                      <Text style={styles.quickDateText}>+3 Months</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => addMonthsToEndDate(6)}
                      style={styles.quickDatePill}
                    >
                      <Text style={styles.quickDateText}>+6 Months</Text>
                    </Pressable>
                    {endDate ? (
                      <Pressable
                        onPress={() => setEndDate('')}
                        style={[
                          styles.quickDatePill,
                          { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickDateText,
                            { color: Colors.danger },
                          ]}
                        >
                          Clear
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Notes & Terms */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Contract Terms, Scope Exclusions & Notes
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Payment milestones: 25% booking, 50% midpoint, 25% handover. Client provides water & electricity."
                  placeholderTextColor={Colors.textSubtle}
                  style={[styles.textInput, styles.multilineInput]}
                  multiline
                  numberOfLines={4}
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
                  <Text
                    style={[styles.sectionBadgeNum, { color: '#7C3AED' }]}
                  >
                    05
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    Work Agreements & Project Documents
                  </Text>
                  <Text style={styles.sectionSub}>
                    Attach signed contracts, quotations, floor plans & site photos
                  </Text>
                </View>
              </View>

              {/* Add Document Action Bar */}
              <View style={styles.docActionBar}>
                <Pressable
                  onPress={triggerWebFilePicker}
                  style={({ pressed }) => [
                    styles.addDocBtn,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <AppIcon name="cloud-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.addDocBtnText}>
                    + Upload Agreement / Document
                  </Text>
                </Pressable>
              </View>

              {/* Attached Documents List */}
              {documents.length > 0 ? (
                <View style={styles.docList}>
                  {documents.map((doc) => {
                    const isAgreement = doc.category === 'AGREEMENT';
                    const isDrawing = doc.category === 'DRAWING';
                    const isQuotation = doc.category === 'QUOTATION';
                    return (
                      <View key={doc.id} style={styles.docCard}>
                        <View style={styles.docCardLeft}>
                          <View
                            style={[
                              styles.docIconBox,
                              {
                                backgroundColor: isAgreement
                                  ? '#DCFCE7'
                                  : isDrawing
                                  ? '#DBEAFE'
                                  : isQuotation
                                  ? '#FEF3C7'
                                  : '#F3E8FF',
                              },
                            ]}
                          >
                            <AppIcon
                              name={
                                isAgreement
                                  ? 'document-text'
                                  : isDrawing
                                  ? 'map'
                                  : isQuotation
                                  ? 'receipt'
                                  : 'image'
                              }
                              size={20}
                              color={
                                isAgreement
                                  ? '#16A34A'
                                  : isDrawing
                                  ? '#2563EB'
                                  : isQuotation
                                  ? '#D97706'
                                  : '#9333EA'
                              }
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.docTitleRow}>
                              <Text style={styles.docName} numberOfLines={1}>
                                {doc.name}
                              </Text>
                              <View
                                style={[
                                  styles.docCatBadge,
                                  {
                                    backgroundColor: isAgreement
                                      ? '#DCFCE7'
                                      : '#EFF6FF',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.docCatBadgeText,
                                    {
                                      color: isAgreement
                                        ? '#16A34A'
                                        : '#2563EB',
                                    },
                                  ]}
                                >
                                  {doc.category}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.docMeta}>
                              {doc.size ? `${doc.size} • ` : ''}
                              Added on {doc.date}
                              {doc.refNo ? ` • Ref: ${doc.refNo}` : ''}
                            </Text>
                            {doc.terms ? (
                              <Text style={styles.docTermsNote} numberOfLines={2}>
                                Terms: {doc.terms}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <Pressable
                          onPress={() => handleRemoveDocument(doc.id)}
                          style={({ pressed }) => [
                            styles.docDeleteBtn,
                            pressed && { opacity: 0.6 },
                          ]}
                          accessibilityLabel="Delete document"
                        >
                          <AppIcon
                            name="trash-outline"
                            size={18}
                            color={Colors.danger}
                          />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.docEmptyPlaceholder}>
                  <AppIcon
                    name="document-attach-outline"
                    size={28}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.docEmptyTitle}>
                    No agreements or documents attached yet
                  </Text>
                  <Text style={styles.docEmptyDesc}>
                    Keep signed stamp paper agreements, rate quotes, and drawings
                    securely organized for this work site.
                  </Text>
                </View>
              )}
            </View>

            <View style={{ height: 90 }} />
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <View
              style={[
                styles.bottomBarInner,
                isDesktop && styles.desktopContainer,
              ]}
            >
              <Pressable
                onPress={() => !busy && onClose()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={busy}
                style={({ pressed }) => [
                  styles.submitButton,
                  busy && { opacity: 0.6 },
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon
                      name="checkmark-circle"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.submitButtonText}>
                      {isEdit ? 'Update Site' : 'Save Site'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* START DATE CALENDAR PICKER MODAL */}
      <CalendarPickerModal
        visible={isStartCalendarOpen}
        title="Select Start Date"
        selectedDate={startDate}
        onSelect={(newDate) => {
          if (newDate) setStartDate(newDate);
        }}
        onClose={() => setIsStartCalendarOpen(false)}
      />

      {/* END DATE CALENDAR PICKER MODAL */}
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
          <View style={styles.docModalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsDocModalOpen(false)}
            />
            <View
              style={[
                styles.docModalCard,
                isDesktop && { maxWidth: 480 },
              ]}
            >
              <View style={styles.docModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docModalTitle}>
                    Attach Agreement / Document
                  </Text>
                  <Text style={styles.docModalSub}>
                    Record work contracts, drawings or estimates
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsDocModalOpen(false)}
                  style={styles.closeIconBtn}
                >
                  <AppIcon name="close" size={18} color={Colors.textPrimary} />
                </Pressable>
              </View>

              {/* Document Category Selector */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.smallSubLabel}>Document Category:</Text>
                <View style={styles.docCatRow}>
                  {[
                    { id: 'AGREEMENT', label: 'Agreement' },
                    { id: 'QUOTATION', label: 'Quotation' },
                    { id: 'DRAWING', label: 'Drawing' },
                    { id: 'PHOTO', label: 'Photo' },
                    { id: 'OTHER', label: 'Other' },
                  ].map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setNewDocCategory(cat.id as any)}
                      style={[
                        styles.docCatChip,
                        newDocCategory === cat.id && styles.docCatChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.docCatChipText,
                          newDocCategory === cat.id &&
                            styles.docCatChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Title / Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Document / File Name *</Text>
                <View style={styles.inputWrapper}>
                  <AppIcon
                    name="document-outline"
                    size={18}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={newDocName}
                    onChangeText={setNewDocName}
                    placeholder="e.g. Work_Agreement_Signed.pdf"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Ref No */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Agreement / Reference Number (Optional)
                </Text>
                <View style={styles.inputWrapper}>
                  <AppIcon
                    name="bookmark-outline"
                    size={18}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    value={newDocRef}
                    onChangeText={setNewDocRef}
                    placeholder="e.g. AGR-2026-09"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Agreement Terms Presets */}
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.smallSubLabel}>
                  Quick Terms / Conditions:
                </Text>
                <View style={{ gap: 6 }}>
                  {AGREEMENT_TERMS_PRESETS.slice(0, 3).map((term) => (
                    <Pressable
                      key={term}
                      onPress={() => setNewDocTerms(term)}
                      style={styles.termPresetPill}
                    >
                      <Text style={styles.termPresetPillText}>+ {term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Terms Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Agreement Terms & Scope</Text>
                <TextInput
                  value={newDocTerms}
                  onChangeText={setNewDocTerms}
                  placeholder="Key agreement clauses, advance % or warranty terms..."
                  placeholderTextColor={Colors.textSubtle}
                  style={[styles.textInput, { height: 60 }]}
                  multiline
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.docModalActions}>
                <Pressable
                  onPress={() => setIsDocModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddDocument}
                  style={styles.confirmBtn}
                >
                  <AppIcon name="checkmark" size={17} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>Add Document</Text>
                </Pressable>
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
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  thekaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.primarySurface,
  },
  thekaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  errorBannerText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  desktopContainer: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  navChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  navChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  navChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  navChipTextActive: {
    color: '#FFFFFF',
  },
  cardSection: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeNum: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  requiredStar: {
    color: Colors.danger,
    fontWeight: '800',
  },
  fieldHelper: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  countryCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceSubtle,
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  suggestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  suggestionTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  suggestionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 14,
  },
  scopeCardsGrid: {
    gap: 10,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  scopeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F8FAFF',
  },
  scopeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scopeDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  pricingTabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pricingTab: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    gap: 4,
  },
  pricingTabSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pricingTabTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  pricingTabTitleSelected: {
    color: '#FFFFFF',
  },
  pricingTabDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  highlightInputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  bigCurrencyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 16,
    height: 56,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    marginRight: 8,
  },
  bigCurrencyInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  amountHelperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  amountHelperText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  inputCurrencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  smallSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  unitPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitPillActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  unitPillTextActive: {
    color: Colors.primary,
  },
  calculatedValueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 6,
  },
  calculatedLeft: {
    flex: 1,
  },
  calcTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  calcFormula: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  calcBigAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
  calcWords: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  profitForecastCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  profitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profitCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  marginBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  marginBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profitNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
  },
  profitCol: {
    flex: 1,
    alignItems: 'center',
  },
  profitColLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  profitColValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  profitColMinus: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '800',
  },
  profitColEquals: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '800',
  },
  statusChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  todayQuickBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.primarySurface,
  },
  todayQuickBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  datePickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePickerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerValueText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  datePickerSubtext: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  datePickerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
  },
  datePickerPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  quickDatePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  // Document Upload Styles
  docActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addDocBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  docList: {
    gap: 10,
    marginTop: 6,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 12,
    gap: 10,
  },
  docCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  docCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  docCatBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  docMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  docTermsNote: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  docDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docEmptyPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#FDFBFF',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8B4FE',
    gap: 6,
  },
  docEmptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  docEmptyDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 16,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomBarInner: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // Doc modal styles
  docModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  docModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  docModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  docModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  docModalSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  docCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docCatChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  docCatChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  docCatChipTextActive: {
    color: '#FFFFFF',
  },
  termPresetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termPresetPillText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  docModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
