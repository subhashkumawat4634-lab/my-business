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
  { label: 'Days / Din', value: 'days' },
  { label: 'Job / Lumpsum', value: 'job' },
];

const SITE_SUGGESTIONS = [
  'Residence Renovation',
  'Interior & Painting',
  'Civil Construction',
  'Tile & Flooring Work',
  'Commercial Shop Work',
];

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
  const [notes, setNotes] = useState(spec.initial.notes || '');

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

  // Helper formatting
  const formatIndianWords = (val: number) => {
    if (!val || isNaN(val) || val <= 0) return '';
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)} Hazar`;
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

  const handleSave = () => {
    setLocalError('');
    if (!name.trim()) {
      setLocalError('Kripya theke / site ka naam likhein (Site Name required).');
      return;
    }
    if (!ownerName.trim()) {
      setLocalError('Kripya client / malik ka naam likhein (Client Name required).');
      return;
    }
    if (!startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      setLocalError('Kripya valid start date daalein (YYYY-MM-DD).');
      return;
    }
    if (endDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      setLocalError('End date format YYYY-MM-DD hona chahiye.');
      return;
    }
    if (endDate.trim() && endDate.trim() < startDate.trim()) {
      setLocalError('End date start date se pehle nahi ho sakti.');
      return;
    }

    if (pricing === 'FIXED') {
      if (!contractAmount.trim() || parseFloat(contractAmount) < 0) {
        setLocalError('Kripya fixed theka rashi (contract amount) darj karein.');
        return;
      }
    } else {
      if (!unitRate.trim() || parseFloat(unitRate) <= 0) {
        setLocalError('Kripya unit ya daily rate darj karein.');
        return;
      }
      if (!quantity.trim() || parseFloat(quantity) <= 0) {
        setLocalError('Kripya quantity ya kul din darj karein.');
        return;
      }
    }

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
      notes: notes.trim(),
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
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
                    {isEdit ? 'Theka Edit Karein' : 'Naya Theka Add Karein'}
                  </Text>
                  <View style={styles.thekaBadge}>
                    <Text style={styles.thekaBadgeText}>
                      {pricing === 'FIXED'
                        ? 'Lumpsum'
                        : pricing === 'UNIT'
                        ? 'Rate-Wise'
                        : 'Rojina'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  {isEdit
                    ? 'Theke ki jankari, rate aur scope update karein'
                    : 'Naye project ka hisab, client details & rate setup'}
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
                { id: 1, label: '1. Site & Client' },
                { id: 2, label: '2. Kaam & Rate' },
                { id: 3, label: '3. Kharcha & Profit' },
                { id: 4, label: '4. Samay & Notes' },
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

            {/* SECTION 1: Site & Client Identity */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeNum}>01</Text>
                </View>
                <View>
                  <Text style={styles.sectionHeading}>
                    Site & Client Ki Jankari
                  </Text>
                  <Text style={styles.sectionSub}>
                    Kiske liye kaam ho raha hai aur kahan?
                  </Text>
                </View>
              </View>

              {/* Site Name */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Site / Theke Ka Naam</Text>
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
                    placeholder="Jaise: Sharma Residence · Villa Painting"
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
                  <Text style={styles.fieldLabel}>Client / Malik Ka Naam</Text>
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
                    placeholder="Jaise: Rajesh Gupta"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Client Phone & Address in two columns on desktop or clean stack */}
              <View style={isDesktop ? styles.desktopRow : { gap: 14 }}>
                <View style={[styles.fieldGroup, isDesktop && { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Client Ka Mobile Number</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      value={phone}
                      onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
                      placeholder="10 digit mobile no."
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.textInput}
                      keyboardType="phone-pad"
                      maxLength={12}
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, isDesktop && { flex: 1.4 }]}>
                  <Text style={styles.fieldLabel}>Site Ka Pata / Location</Text>
                  <View style={styles.inputWrapper}>
                    <AppIcon
                      name="location-outline"
                      size={19}
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
                    Kaam Ka Scope Aur Rate Model
                  </Text>
                  <Text style={styles.sectionSub}>
                    Maal kiska hoga aur hisab kaise banega?
                  </Text>
                </View>
              </View>

              {/* Contract Scope Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Theke Me Kya Shamil Hai?</Text>
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
                        Sirf karigar & majdoori aapki. Saara maal client dega.
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
                        Maal khareedna aur kaam karwana dono aapke jimme.
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
                <Text style={styles.fieldLabel}>Rate Kaise Tay Hua Hai?</Text>
                <View style={styles.pricingTabsContainer}>
                  {[
                    {
                      id: 'FIXED',
                      label: 'Lumpsum Theka',
                      desc: 'Fixed Price',
                      icon: 'lock-closed-outline',
                    },
                    {
                      id: 'UNIT',
                      label: 'Unit / Sq Ft Rate',
                      desc: 'Area-wise',
                      icon: 'cube-outline',
                    },
                    {
                      id: 'DAILY',
                      label: 'Rojina / Din',
                      desc: 'Per Day',
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
                      Kul Theka Rashi (Fixed Contract Amount)
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
                        Total Theka Value:{' '}
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
                        Kul Naap / Quantity *
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
                    <Text style={styles.smallSubLabel}>Unit Chunein:</Text>
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
                        Anumanit Total Theka Value
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
                        Per Day / Rojina Rate (₹) *
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
                        Anumanit Din (Expected Days) *
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
                        <Text style={styles.inputUnitSuffix}>Days</Text>
                      </View>
                    </View>
                  </View>

                  {/* Live Calculation */}
                  <View style={styles.calculatedValueCard}>
                    <View style={styles.calculatedLeft}>
                      <Text style={styles.calcTitle}>
                        Total Projected Wage Value
                      </Text>
                      <Text style={styles.calcFormula}>
                        {quantity || '0'} Din × ₹ {unitRate || '0'}/day
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

            {/* SECTION 3: Budget & Projected Profit */}
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
                    Kharcha Budget & Anumanit Munafa
                  </Text>
                  <Text style={styles.sectionSub}>
                    Margin pehle se dekhkar theka plan karein
                  </Text>
                </View>
              </View>

              {/* Remaining Estimate Input */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>
                    Anumanit Bacha Kharcha (Estimated Cost to Incur)
                  </Text>
                </View>
                <Text style={styles.fieldSubHelp}>
                  Material aur Karigar/Labour ka aane wala kul kharcha
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputCurrencyPrefix}>₹</Text>
                  <TextInput
                    value={remainingEstimate}
                    onChangeText={(t) =>
                      setRemainingEstimate(t.replace(/[^0-9.]/g, ''))
                    }
                    placeholder="0 (Agar abhi tay nahi hai toh 0 chhod dein)"
                    placeholderTextColor={Colors.textSubtle}
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* LIVE PROFIT PREVIEW CARD */}
              <View style={styles.profitForecastCard}>
                <View style={styles.profitCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppIcon name="trending-up" size={20} color="#FFFFFF" />
                    <Text style={styles.profitCardTitle}>
                      Projected Munafa (Estimated Profit)
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
                    <Text style={styles.profitColLabel}>Theka Value</Text>
                    <Text style={styles.profitColValue}>
                      ₹ {effectiveContractAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitColMinus}>−</Text>
                  <View style={styles.profitCol}>
                    <Text style={styles.profitColLabel}>Anumanit Kharcha</Text>
                    <Text style={styles.profitColValue}>
                      ₹ {estRemaining.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.profitColEquals}>=</Text>
                  <View style={styles.profitCol}>
                    <Text style={styles.profitColLabel}>Projected Margin</Text>
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

            {/* SECTION 4: Timeline & Notes */}
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
                    Timeline, Status & Notes
                  </Text>
                  <Text style={styles.sectionSub}>
                    Tarikh aur terms record karein
                  </Text>
                </View>
              </View>

              {/* Status Chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Theke Ka Current Status</Text>
                <View style={styles.statusChipsGrid}>
                  {[
                    {
                      id: 'ONGOING',
                      label: 'Ongoing (Chalu)',
                      color: Colors.success,
                      light: Colors.successLight,
                    },
                    {
                      id: 'UPCOMING',
                      label: 'Upcoming (Aane Wala)',
                      color: Colors.accent,
                      light: Colors.accentLight,
                    },
                    {
                      id: 'PAUSED',
                      label: 'Paused (Ruka Hua)',
                      color: Colors.warning,
                      light: Colors.warningLight,
                    },
                    {
                      id: 'COMPLETED',
                      label: 'Completed (Pura)',
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

              {/* Dates */}
              <View style={isDesktop ? styles.desktopRow : { gap: 14 }}>
                <View style={[styles.fieldGroup, isDesktop && { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Shuru Ki Tarikh (Start Date)</Text>
                    <Text style={styles.requiredStar}>*</Text>
                    <Pressable
                      onPress={setTodayDate}
                      style={styles.todayQuickBtn}
                    >
                      <Text style={styles.todayQuickBtnText}>Aaj (Today)</Text>
                    </Pressable>
                  </View>
                  <View style={styles.inputWrapper}>
                    <AppIcon
                      name="calendar-outline"
                      size={19}
                      color={Colors.textMuted}
                    />
                    <TextInput
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, isDesktop && { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>
                      Khatam Hone Ki Tarikh (Optional)
                    </Text>
                  </View>
                  <View style={styles.inputWrapper}>
                    <AppIcon
                      name="flag-outline"
                      size={19}
                      color={Colors.textMuted}
                    />
                    <TextInput
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.textSubtle}
                      style={styles.textInput}
                    />
                  </View>
                  {/* Quick End Date buttons */}
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
                    {endDate ? (
                      <Pressable
                        onPress={() => setEndDate('')}
                        style={[styles.quickDatePill, { backgroundColor: '#FEE2E2' }]}
                      >
                        <Text style={[styles.quickDateText, { color: Colors.danger }]}>
                          Clear
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Shartein, Agreement Reference & Notes
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Jaise: 20% advance mila hai, baaki har chhat per 30% milega. Client material supply karega."
                  placeholderTextColor={Colors.textSubtle}
                  style={[styles.textInput, styles.multilineInput]}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>

            <View style={{ height: 90 }} />
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <View style={[styles.bottomBarInner, isDesktop && styles.desktopContainer]}>
              <Pressable
                onPress={() => !busy && onClose()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.cancelButtonText}>Radd Karein (Cancel)</Text>
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
                      {isEdit ? 'Theka Update Karein' : 'Theka Save Karein'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    elevation: 3,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
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
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
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
    letterSpacing: -0.3,
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
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.danger,
    lineHeight: 18,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  desktopContainer: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  navChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  navChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  navChipTextActive: {
    color: '#FFFFFF',
  },
  cardSection: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    fontWeight: '800',
    color: Colors.primary,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  requiredStar: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '800',
    marginLeft: 3,
  },
  fieldSubHelp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  countryCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: Colors.border,
    borderRadius: 6,
  },
  countryCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  suggestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  suggestionTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  suggestionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primarySurface,
  },
  suggestionPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  scopeCardsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  scopeCard: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  scopeCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: '#F8FAFF',
  },
  scopeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  scopeDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  pricingTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pricingTab: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.2,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  pricingTabSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  pricingTabTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  pricingTabTitleSelected: {
    color: '#FFFFFF',
  },
  pricingTabDesc: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  highlightInputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.accentLight,
    gap: 10,
  },
  bigCurrencyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.accent,
  },
  bigCurrencyInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  amountHelperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  amountHelperText: {
    fontSize: 12,
    color: Colors.accentDark,
    fontWeight: '600',
  },
  inputCurrencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  inputUnitSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  smallSubLabel: {
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitPillActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.accent,
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  unitPillTextActive: {
    color: Colors.accent,
    fontWeight: '800',
  },
  calculatedValueCard: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculatedLeft: {
    flex: 1,
  },
  calcTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calcFormula: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  calcBigAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.accentDark,
  },
  calcWords: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  profitForecastCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  profitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  marginBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
  },
  profitCol: {
    alignItems: 'center',
  },
  profitColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  profitColValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 3,
  },
  profitColMinus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94A3B8',
  },
  profitColEquals: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94A3B8',
  },
  statusChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  todayQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.primarySurface,
  },
  todayQuickBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  quickDatePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickDateText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
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
});
