import React, { useState, useRef, useEffect } from 'react';
import {
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
import { AppIcon } from '../../components/icons/AppIcon';
import { request, getRememberedEmail, saveRememberedEmail } from '../../api';
import { RedirectingScreen } from '../../components/common/RedirectingScreen';
import { useLanguage } from '../../i18n';

interface AuthPageProps {
  onLogin: (token: string) => Promise<void>;
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const { t, lang } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const orgInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Load remembered email on startup
  useEffect(() => {
    getRememberedEmail().then((savedEmail) => {
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    });
  }, []);

  const handleFieldFocus = (fieldName: string, scrollOffsetY = 0) => {
    setFocusedField(fieldName);
    if (scrollOffsetY > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollOffsetY, animated: true });
      }, 100);
    }
  };

  async function submit() {
    if (busy || isRedirecting) return;
    if (!email.trim() || !password) {
      setError(
        lang === 'hi'
          ? 'कृपया ईमेल और पासवर्ड दोनों दर्ज करें।'
          : 'Please enter both your email and password.'
      );
      return;
    }
    if (isRegister) {
      if (!name.trim()) {
        setError(
          lang === 'hi'
            ? 'कृपया अपना पूरा नाम दर्ज करें।'
            : 'Please enter your full name.'
        );
        return;
      }
      if (!org.trim()) {
        setError(
          lang === 'hi'
            ? 'कृपया अपनी फर्म या ठेकेदारी कंपनी का नाम दर्ज करें।'
            : 'Please enter your business or contractor firm name.'
        );
        return;
      }
      if (password.length < 10) {
        setError(
          lang === 'hi'
            ? 'पासवर्ड कम से कम 10 अक्षरों का होना चाहिए।'
            : 'Password must be at least 10 characters long.'
        );
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      if (rememberEmail) {
        await saveRememberedEmail(email.trim());
      } else {
        await saveRememberedEmail(null);
      }

      const endpoint = '/auth/' + (isRegister ? 'register' : 'login');
      const payload = {
        email: email.trim(),
        password,
        ...(isRegister ? { name: name.trim(), organization: org.trim() } : {}),
      };
      const result = await request(endpoint, null, payload);

      setIsRedirecting(true);
      // Hold animation for 3.2 seconds so user can enjoy the smooth transition
      await new Promise((resolve) => setTimeout(resolve, 3200));
      await onLogin(result.token);
    } catch (e: any) {
      setError(
        e.message ||
          (lang === 'hi'
            ? 'प्रमाणीकरण विफल। कृपया अपने क्रेडेंशियल्स जांचें।'
            : 'Authentication failed. Please verify your details.')
      );
      setIsRedirecting(false);
      setBusy(false);
    }
  }

  // Smooth animated redirecting screen on successful login
  if (isRedirecting) {
    return (
      <RedirectingScreen
        title={
          isRegister
            ? lang === 'hi'
              ? 'खाता सफलतापूर्वक बन गया!'
              : 'Account Created Successfully!'
            : lang === 'hi'
            ? 'ठेका-बुक में आपका स्वागत है!'
            : 'Welcome back to ThekaBook'
        }
        subtitle={
          lang === 'hi'
            ? 'आपकी साइट्स, हाजिरी और बहीखाता लोड किया जा रहा है...'
            : 'Loading your contractor workspace & financial ledger...'
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Background Ambient Decorative Aura Glows */}
      <View style={styles.bgGlowTop} pointerEvents="none" />
      <View style={styles.bgGlowBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            styles.scrollContainer,
            isDesktop && styles.desktopScrollContainer,
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.cardContainer, isDesktop && styles.desktopCardContainer]}>
            {/* Top Accent Gradient Bar */}
            <View style={styles.cardAccentBar} />

            {/* Brand Header & Shield Emblem */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadgeContainer}>
                <View style={styles.logoGlow} />
                <View style={styles.logoBadge}>
                  <AppIcon name="shield-checkmark" size={28} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.titleWrap}>
                <Text style={styles.brandTitle}>
                  Theka<Text style={styles.brandTitleAccent}>Book</Text>
                </Text>
                <View style={styles.proPill}>
                  <AppIcon name="flash" size={10} color="#0284C7" />
                  <Text style={styles.proPillText}>
                    {lang === 'hi' ? 'डिजिटल ठेकेदार कार्यक्षेत्र' : 'CONTRACTOR WORKSPACE'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Segmented Switcher (Sign In vs Create Account) */}
            <View style={styles.segmentWrapper}>
              <Pressable
                onPress={() => {
                  setIsRegister(false);
                  setError('');
                }}
                style={[
                  styles.segmentTab,
                  !isRegister && styles.segmentTabActive,
                ]}
              >
                <AppIcon
                  name="log-in-outline"
                  size={15}
                  color={!isRegister ? '#1D4ED8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    !isRegister && styles.segmentLabelActive,
                  ]}
                >
                  {lang === 'hi' ? 'लॉग इन (Sign In)' : 'Sign In'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsRegister(true);
                  setError('');
                }}
                style={[
                  styles.segmentTab,
                  isRegister && styles.segmentTabActive,
                ]}
              >
                <AppIcon
                  name="person-add-outline"
                  size={15}
                  color={isRegister ? '#1D4ED8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    isRegister && styles.segmentLabelActive,
                  ]}
                >
                  {lang === 'hi' ? 'नया खाता (Register)' : 'New Account'}
                </Text>
              </Pressable>
            </View>

            {/* Form Title & Subtitle */}
            <View style={styles.formIntro}>
              <Text style={styles.formTitle}>
                {isRegister
                  ? lang === 'hi'
                    ? 'अपना ठेकेदारी खाता बनाएं'
                    : 'Create Contractor Account'
                  : lang === 'hi'
                  ? 'अपने खाते में लॉग इन करें'
                  : 'Welcome Back'}
              </Text>
              <Text style={styles.formSubtitle}>
                {isRegister
                  ? lang === 'hi'
                    ? 'साइट्स, हाजिरी और खर्चों का पक्का हिसाब रखें'
                    : 'Manage sites, daily haziri & profits with confidence'
                  : lang === 'hi'
                  ? 'अपना सुरक्षित बहीखाता एक्सेस करने के लिए विवरण दर्ज करें'
                  : 'Enter your credentials to access your financial ledger'}
              </Text>
            </View>

            {/* Error Message Alert */}
            {!!error && (
              <View style={styles.errorAlert}>
                <View style={styles.errorIconWrap}>
                  <AppIcon name="alert-circle" size={17} color="#DC2626" />
                </View>
                <Text style={styles.errorAlertText}>{error}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.fieldsContainer}>
              {isRegister && (
                <>
                  {/* Full Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {lang === 'hi' ? 'ठेकेदार का नाम (FULL NAME)' : 'FULL NAME'}
                    </Text>
                    <Pressable
                      onPress={() => {
                        nameInputRef.current?.focus();
                        handleFieldFocus('name', 40);
                      }}
                      style={[
                        styles.inputBox,
                        focusedField === 'name' && styles.inputBoxFocused,
                      ]}
                    >
                      <View style={styles.inputIconWrap} pointerEvents="none">
                        <AppIcon
                          name="person-outline"
                          size={18}
                          color={focusedField === 'name' ? '#2563EB' : '#94A3B8'}
                        />
                      </View>
                      <TextInput
                        ref={nameInputRef}
                        accessibilityLabel="Your full name"
                        style={styles.textInput}
                        placeholder={lang === 'hi' ? 'उदा. राजेश शर्मा' : 'e.g. Rajesh Sharma'}
                        placeholderTextColor="#94A3B8"
                        value={name}
                        onChangeText={setName}
                        onFocus={() => handleFieldFocus('name', 40)}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="next"
                        onSubmitEditing={() => orgInputRef.current?.focus()}
                      />
                    </Pressable>
                  </View>

                  {/* Business / Firm Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {lang === 'hi' ? 'फर्म / कंपनी का नाम (BUSINESS NAME)' : 'BUSINESS / FIRM NAME'}
                    </Text>
                    <Pressable
                      onPress={() => {
                        orgInputRef.current?.focus();
                        handleFieldFocus('org', 80);
                      }}
                      style={[
                        styles.inputBox,
                        focusedField === 'org' && styles.inputBoxFocused,
                      ]}
                    >
                      <View style={styles.inputIconWrap} pointerEvents="none">
                        <AppIcon
                          name="business-outline"
                          size={18}
                          color={focusedField === 'org' ? '#2563EB' : '#94A3B8'}
                        />
                      </View>
                      <TextInput
                        ref={orgInputRef}
                        accessibilityLabel="Business name"
                        style={styles.textInput}
                        placeholder={lang === 'hi' ? 'उदा. शर्मा कंस्ट्रक्शन' : 'e.g. Sharma Constructions & Infra'}
                        placeholderTextColor="#94A3B8"
                        value={org}
                        onChangeText={setOrg}
                        onFocus={() => handleFieldFocus('org', 80)}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="next"
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                      />
                    </Pressable>
                  </View>
                </>
              )}

              {/* Email Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'ईमेल पता (EMAIL ADDRESS)' : 'EMAIL ADDRESS'}
                </Text>
                <Pressable
                  onPress={() => {
                    emailInputRef.current?.focus();
                    handleFieldFocus('email', isRegister ? 140 : 60);
                  }}
                  style={[
                    styles.inputBox,
                    focusedField === 'email' && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputIconWrap} pointerEvents="none">
                    <AppIcon
                      name="mail-outline"
                      size={18}
                      color={focusedField === 'email' ? '#2563EB' : '#94A3B8'}
                    />
                  </View>
                  <TextInput
                    ref={emailInputRef}
                    accessibilityLabel="Email address"
                    style={styles.textInput}
                    placeholder="contractor@business.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => handleFieldFocus('email', isRegister ? 140 : 60)}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </Pressable>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'पासवर्ड (PASSWORD)' : 'PASSWORD'}
                  </Text>
                  {isRegister && (
                    <View style={styles.charBadge}>
                      <Text style={styles.charBadgeText}>
                        {lang === 'hi' ? 'कम से कम 10 अक्षर' : 'Min. 10 chars'}
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => {
                    passwordInputRef.current?.focus();
                    handleFieldFocus('password', isRegister ? 220 : 120);
                  }}
                  style={[
                    styles.inputBox,
                    focusedField === 'password' && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputIconWrap} pointerEvents="none">
                    <AppIcon
                      name="lock-closed-outline"
                      size={18}
                      color={focusedField === 'password' ? '#2563EB' : '#94A3B8'}
                    />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    accessibilityLabel="Password"
                    style={styles.textInput}
                    placeholder={
                      isRegister
                        ? lang === 'hi'
                          ? 'सुरक्षित पासवर्ड बनाएं (10+ अक्षर)'
                          : 'Create secure password (10+ chars)'
                        : lang === 'hi'
                        ? 'अपना पासवर्ड दर्ज करें'
                        : 'Enter your password'
                    }
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => handleFieldFocus('password', isRegister ? 220 : 120)}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={submit}
                    returnKeyType="go"
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggleBtn}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <AppIcon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={showPassword ? '#2563EB' : '#94A3B8'}
                    />
                  </Pressable>
                </Pressable>
              </View>

              {/* Remember Email Checkbox Toggle */}
              <Pressable
                onPress={() => setRememberEmail(!rememberEmail)}
                style={styles.rememberRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    rememberEmail && styles.checkboxBoxChecked,
                  ]}
                >
                  {rememberEmail && (
                    <AppIcon name="checkmark" size={13} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.rememberText}>
                  {lang === 'hi'
                    ? 'मेरा ईमेल याद रखें (Remember Email)'
                    : 'Remember my email on this device'}
                </Text>
              </Pressable>
            </View>

            {/* Submit Primary CTA Button */}
            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.submitBtn,
                busy && styles.submitBtnDisabled,
                pressed && styles.submitBtnPressed,
              ]}
            >
              {busy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    {isRegister
                      ? lang === 'hi'
                        ? 'खाता बनाया जा रहा है...'
                        : 'Creating Account...'
                      : lang === 'hi'
                      ? 'लॉग इन हो रहा है...'
                      : 'Signing In...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegister ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </Pressable>

            {/* Quick Switch Link */}
            <Pressable
              onPress={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={styles.toggleFooter}
            >
              <Text style={styles.toggleFooterText}>
                {isRegister
                  ? lang === 'hi'
                    ? 'पहले से खाता है? '
                    : 'Already have an account? '
                  : lang === 'hi'
                  ? 'नया खाता बनाना चाहते हैं? '
                  : "Don't have an account? "}
                <Text style={styles.toggleFooterLink}>
                  {isRegister
                    ? lang === 'hi'
                      ? 'लॉग इन करें'
                      : 'Sign In'
                    : lang === 'hi'
                    ? 'खाता बनाएं'
                    : 'Create Account'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#DBEAFE',
    opacity: 0.6,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E0E7FF',
    opacity: 0.5,
  },

  /* Scroll container - positioned near top on mobile, centered on desktop */
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 60,
  },
  desktopScrollContainer: {
    justifyContent: 'center',
    paddingTop: 24,
  },

  /* Card Container */
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    gap: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  desktopCardContainer: {
    maxWidth: 440,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#2563EB',
  },

  /* Brand Header */
  brandHeader: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  logoBadgeContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    opacity: 0.35,
  },
  logoBadge: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  titleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    color: '#2563EB',
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  proPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.6,
  },

  /* Segmented Tab Switcher */
  segmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentLabelActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  /* Form Header */
  formIntro: {
    gap: 2,
  },
  formTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },

  /* Error Alert */
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorIconWrap: {
    paddingTop: 1,
  },
  errorAlertText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 15,
  },

  /* Input Fields */
  fieldsContainer: {
    gap: 11,
  },
  inputGroup: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  charBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  charBadgeText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 11,
    minHeight: 45,
  },
  inputBoxFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 1.5,
  },
  inputIconWrap: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    minHeight: 40,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  passwordToggleBtn: {
    padding: 5,
    marginLeft: 4,
  },

  /* Remember Email Checkbox */
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rememberText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* Submit Action Button */
  submitBtn: {
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  arrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Footer Switch */
  toggleFooter: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  toggleFooterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  toggleFooterLink: {
    color: '#2563EB',
    fontWeight: '800',
  },
});
