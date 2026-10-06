import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { request } from '../../api';

interface AuthPageProps {
  onLogin: (token: string) => Promise<void>;
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const nameInputRef = React.useRef<TextInput>(null);
  const orgInputRef = React.useRef<TextInput>(null);
  const emailInputRef = React.useRef<TextInput>(null);
  const passwordInputRef = React.useRef<TextInput>(null);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Please enter both your email and password');
      return;
    }
    if (isRegister) {
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (!org.trim()) {
        setError('Please enter your business or contractor firm name');
        return;
      }
      if (password.length < 10) {
        setError('Password must be at least 10 characters long');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const endpoint = '/auth/' + (isRegister ? 'register' : 'login');
      const payload = {
        email: email.trim(),
        password,
        ...(isRegister ? { name: name.trim(), organization: org.trim() } : {}),
      };
      const result = await request(endpoint, null, payload);
      await onLogin(result.token);
    } catch (e: any) {
      setError(e.message || 'Authentication failed. Please verify your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Background Ambient Decorative Circles */}
      <View style={styles.bgGlowTop} pointerEvents="none" />
      <View style={styles.bgGlowBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardContainer}>
            {/* Top Accent Gradient Line */}
            <View style={styles.cardAccentBar} />

            {/* Brand Emblem & Header */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadgeContainer}>
                <View style={styles.logoGlow} />
                <View style={styles.logoBadge}>
                  <AppIcon name="shield-checkmark" size={30} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.titleWrap}>
                <Text style={styles.brandTitle}>Theka<Text style={styles.brandTitleAccent}>Book</Text></Text>
                <View style={styles.proPill}>
                  <AppIcon name="flash" size={10} color="#0284C7" />
                  <Text style={styles.proPillText}>CONTRACTOR WORKSPACE</Text>
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
                  name={!isRegister ? "log-in" : "log-in-outline"}
                  size={18}
                  color={!isRegister ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    !isRegister && styles.segmentLabelActive,
                  ]}
                >
                  Sign In
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
                  name={isRegister ? "person-add" : "person-add-outline"}
                  size={18}
                  color={isRegister ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    isRegister && styles.segmentLabelActive,
                  ]}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>

            {/* Form Title & Subtitle */}
            <View style={styles.formIntro}>
              <Text style={styles.formTitle}>
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.formSubtitle}>
                {isRegister
                  ? 'Enter your business details to get started.'
                  : 'Enter your credentials to access your account.'}
              </Text>
            </View>

            {/* Error Message Alert */}
            {error ? (
              <View style={styles.errorAlert}>
                <View style={styles.errorIconWrap}>
                  <AppIcon name="alert-circle" size={18} color="#DC2626" />
                </View>
                <Text style={styles.errorAlertText}>{error}</Text>
              </View>
            ) : null}

            {/* Input Form Fields */}
            <View style={styles.fieldsContainer}>
              {isRegister && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>FULL NAME</Text>
                    <Pressable
                      onPress={() => nameInputRef.current?.focus()}
                      style={[
                        styles.inputBox,
                        focusedField === 'name' && styles.inputBoxFocused,
                      ]}
                    >
                      <View style={styles.inputIconWrap} pointerEvents="none">
                        <AppIcon
                          name="person-outline"
                          size={19}
                          color={focusedField === 'name' ? Colors.accent : Colors.textMuted}
                        />
                      </View>
                      <TextInput
                        ref={nameInputRef}
                        accessibilityLabel="Your full name"
                        style={styles.textInput}
                        placeholder="e.g. Rajesh Sharma"
                        placeholderTextColor={Colors.textSubtle}
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="next"
                        onSubmitEditing={() => orgInputRef.current?.focus()}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>BUSINESS / FIRM NAME</Text>
                    <Pressable
                      onPress={() => orgInputRef.current?.focus()}
                      style={[
                        styles.inputBox,
                        focusedField === 'org' && styles.inputBoxFocused,
                      ]}
                    >
                      <View style={styles.inputIconWrap} pointerEvents="none">
                        <AppIcon
                          name="business-outline"
                          size={19}
                          color={focusedField === 'org' ? Colors.accent : Colors.textMuted}
                        />
                      </View>
                      <TextInput
                        ref={orgInputRef}
                        accessibilityLabel="Business name"
                        style={styles.textInput}
                        placeholder="e.g. Sharma Constructions & Infra"
                        placeholderTextColor={Colors.textSubtle}
                        value={org}
                        onChangeText={setOrg}
                        onFocus={() => setFocusedField('org')}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="next"
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                      />
                    </Pressable>
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <Pressable
                  onPress={() => emailInputRef.current?.focus()}
                  style={[
                    styles.inputBox,
                    focusedField === 'email' && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputIconWrap} pointerEvents="none">
                    <AppIcon
                      name="mail-outline"
                      size={19}
                      color={focusedField === 'email' ? Colors.accent : Colors.textMuted}
                    />
                  </View>
                  <TextInput
                    ref={emailInputRef}
                    accessibilityLabel="Email address"
                    style={styles.textInput}
                    placeholder="contractor@business.com"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  {isRegister && (
                    <View style={styles.charBadge}>
                      <Text style={styles.charBadgeText}>Min. 10 chars</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => passwordInputRef.current?.focus()}
                  style={[
                    styles.inputBox,
                    focusedField === 'password' && styles.inputBoxFocused,
                  ]}
                >
                  <View style={styles.inputIconWrap} pointerEvents="none">
                    <AppIcon
                      name="lock-closed-outline"
                      size={19}
                      color={focusedField === 'password' ? Colors.accent : Colors.textMuted}
                    />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    accessibilityLabel="Password"
                    style={styles.textInput}
                    placeholder={isRegister ? 'Create secure password (10+ chars)' : 'Enter your password'}
                    placeholderTextColor={Colors.textSubtle}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
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
                      size={20}
                      color={showPassword ? Colors.primary : Colors.textMuted}
                    />
                  </Pressable>
                </Pressable>
              </View>
            </View>

            {/* Submit Action Button */}
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
                    {isRegister ? 'Creating Account...' : 'Signing In...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitBtnText}>
                    {isRegister ? 'Create Account' : 'Sign In'}
                  </Text>
                  <View style={styles.arrowCircle}>
                    <AppIcon name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>
                </View>
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
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleFooterLink}>
                  {isRegister ? 'Sign In' : 'Create Account'}
                </Text>
              </Text>
            </Pressable>

            {/* Security Trust Footnote */}
            <View style={styles.securityRow}>
              <AppIcon name="shield-checkmark" size={14} color="#059669" />
              <Text style={styles.securityText}>
                256-Bit SSL Encrypted • Private Cloud Ledger
              </Text>
            </View>
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
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#E0F2FE',
    opacity: 0.7,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#EEF2FF',
    opacity: 0.8,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    gap: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#1E40AF',
  },

  /* Brand Header */
  brandHeader: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  logoBadgeContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    opacity: 0.3,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0F2851',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1E40AF',
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  titleWrap: {
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 26,
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
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  proPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.8,
  },

  /* Segmented Tab Switcher */
  segmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentLabelActive: {
    color: '#0F2851',
    fontWeight: '800',
  },

  /* Form Header */
  formIntro: {
    gap: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Error Alert */
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  errorIconWrap: {
    paddingTop: 1,
  },
  errorAlertText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },

  /* Input Fields */
  fieldsContainer: {
    gap: 15,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  charBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  charBadgeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputBoxFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIconWrap: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
    minHeight: 46,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  passwordToggleBtn: {
    padding: 6,
    marginLeft: 4,
  },

  /* Submit Action Button */
  submitBtn: {
    backgroundColor: '#0F2851',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#1E3A8A',
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
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Footer */
  toggleFooter: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleFooterText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  toggleFooterLink: {
    color: '#2563EB',
    fontWeight: '800',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  securityText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

