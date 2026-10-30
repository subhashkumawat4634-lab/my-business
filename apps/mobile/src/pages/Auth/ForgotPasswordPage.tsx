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
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/icons/AppIcon';
import { request } from '../../api';
import { Colors } from '../../theme/colors';

interface ForgotPasswordPageProps {
  onNavigateToLogin: () => void;
}

export function ForgotPasswordPage({ onNavigateToLogin }: ForgotPasswordPageProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Step: 1 = Request OTP, 2 = Verify & Set Password, 3 = Success
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Status & Timers
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const otpInputRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: any = null;
    if (step === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  useEffect(() => {
    // 1. Native Keyboard listeners (iOS / Android)
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        const h = e.endCoordinates?.height;
        setKeyboardHeight(h && h > 0 ? h : 280);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    // 2. Web VisualViewport listener (Mobile Chrome / Safari)
    let removeVpListener: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.visualViewport) {
      const onResize = () => {
        const winH = window.innerHeight;
        const vpH = window.visualViewport?.height || winH;
        const diff = winH - vpH;
        if (diff > 120) {
          setKeyboardVisible(true);
          setKeyboardHeight(diff);
        } else {
          setKeyboardVisible(false);
          setKeyboardHeight(0);
        }
      };
      window.visualViewport.addEventListener('resize', onResize);
      removeVpListener = () => window.visualViewport?.removeEventListener('resize', onResize);
    }

    return () => {
      showSub.remove();
      hideSub.remove();
      removeVpListener?.();
    };
  }, []);

  const handleFocus = (field: string, yOffset = 0) => {
    setFocusedField(field);
    if (yOffset > 0) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: yOffset, animated: true }), 80);
      setTimeout(() => scrollRef.current?.scrollTo({ y: yOffset, animated: true }), 260);
    }
  };

  // STEP 1: Request OTP
  async function handleRequestOtp() {
    if (busy) return;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await request('/auth/forgot-password', null, { email: cleanEmail });
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
      setStep(2);
      setResendTimer(30);
      setCanResend(false);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err: any) {
      setError(err.message || 'Unable to find an account with this email.');
    } finally {
      setBusy(false);
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    if (!canResend || busy) return;
    setBusy(true);
    setError('');

    try {
      const res = await request('/auth/forgot-password', null, { email: email.trim().toLowerCase() });
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
      setResendTimer(30);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // STEP 2: Verify & Reset
  async function handleResetPassword() {
    if (busy) return;

    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await request('/auth/reset-password', null, {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });

      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Password reset failed. Please check the code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Background Decorative Auras */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.scrollContainer,
            isDesktop && styles.desktopScrollContainer,
            {
              paddingBottom: keyboardHeight > 0
                ? keyboardHeight + 80
                : (keyboardVisible ? 280 : 40),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, isDesktop && styles.desktopCard]}>
            {/* Top Accent Strip */}
            <View style={styles.accentBar} />

            {/* Header: Back & Brand */}
            <View style={styles.topNavRow}>
              <Pressable
                onPress={onNavigateToLogin}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && styles.backBtnPressed,
                ]}
                hitSlop={12}
              >
                <AppIcon name="arrow-back" size={20} color={Colors.primary} />
                <Text style={styles.backBtnText}>Sign In</Text>
              </Pressable>

              <View style={styles.brandTitleWrap}>
                <Text style={styles.brandName}>
                  Theka<Text style={styles.brandNameAccent}>Book</Text>
                </Text>
              </View>
            </View>

            {/* Error Banner */}
            {!!error && (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-circle" size={17} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* ================= STEP 1: Enter Email ================= */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.iconEmblem}>
                  <AppIcon name="key-outline" size={30} color={Colors.accent} />
                </View>

                <View style={styles.headerWrap}>
                  <Text style={styles.title}>Forgot Password?</Text>
                  <Text style={styles.subtitle}>
                    Enter your registered email address. We will generate a secure 6-digit OTP verification code to reset your password.
                  </Text>
                </View>

                <View style={styles.formFields}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>REGISTERED EMAIL ADDRESS</Text>
                    <View
                      style={[
                        styles.inputField,
                        focusedField === 'email' && styles.inputFieldFocused,
                      ]}
                    >
                      <View style={styles.inputIcon}>
                        <AppIcon
                          name="mail-outline"
                          size={18}
                          color={focusedField === 'email' ? Colors.accent : Colors.textSubtle}
                        />
                      </View>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. contractor@business.com"
                        placeholderTextColor={Colors.textSubtle}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => handleFocus('email')}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="done"
                        onSubmitEditing={handleRequestOtp}
                      />
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={handleRequestOtp}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    busy && styles.submitBtnDisabled,
                    pressed && styles.submitBtnPressed,
                  ]}
                >
                  {busy ? (
                    <View style={styles.btnRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Generating OTP...</Text>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      <Text style={styles.submitBtnText}>Send Verification Code</Text>
                      <AppIcon name="arrow-forward" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            {/* ================= STEP 2: Verify OTP & Reset ================= */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.iconEmblem}>
                  <AppIcon name="shield-checkmark-outline" size={30} color={Colors.accent} />
                </View>

                <View style={styles.headerWrap}>
                  <Text style={styles.title}>Enter Verification Code</Text>
                  <Text style={styles.subtitle}>
                    Enter the 6-digit OTP code sent to{' '}
                    <Text style={styles.emailHighlight}>{email}</Text>
                  </Text>
                </View>

                {/* Dev quick-fill helper */}
                {devOtp && (
                  <Pressable
                    onPress={() => setOtp(devOtp)}
                    style={styles.devOtpChip}
                  >
                    <AppIcon name="flash" size={13} color="#0284C7" />
                    <Text style={styles.devOtpText}>
                      Test OTP: <Text style={styles.devOtpBold}>{devOtp}</Text> (Tap to auto-fill)
                    </Text>
                  </Pressable>
                )}

                <View style={styles.formFields}>
                  {/* OTP Code */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>6-DIGIT VERIFICATION CODE (OTP)</Text>
                      <Pressable
                        onPress={() => {
                          setStep(1);
                          setError('');
                        }}
                      >
                        <Text style={styles.changeEmailLink}>Change Email</Text>
                      </Pressable>
                    </View>
                    <View
                      style={[
                        styles.inputField,
                        focusedField === 'otp' && styles.inputFieldFocused,
                      ]}
                    >
                      <View style={styles.inputIcon}>
                        <AppIcon
                          name="keypad-outline"
                          size={18}
                          color={focusedField === 'otp' ? Colors.accent : Colors.textSubtle}
                        />
                      </View>
                      <TextInput
                        ref={otpInputRef}
                        style={[styles.textInput, styles.otpTextInput]}
                        placeholder="••••••"
                        placeholderTextColor={Colors.textSubtle}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={setOtp}
                        onFocus={() => handleFocus('otp')}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="next"
                        onSubmitEditing={() => newPasswordRef.current?.focus()}
                      />
                    </View>
                  </View>

                  {/* Resend Timer */}
                  <View style={styles.resendRow}>
                    {canResend ? (
                      <Pressable onPress={handleResendOtp} disabled={busy}>
                        <Text style={styles.resendActiveText}>Resend Verification Code</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.resendTimerText}>
                        Resend code in <Text style={styles.timerBold}>{resendTimer}s</Text>
                      </Text>
                    )}
                  </View>

                  {/* New Password */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>NEW PASSWORD (MIN. 8 CHARS)</Text>
                    <View
                      style={[
                        styles.inputField,
                        focusedField === 'newPassword' && styles.inputFieldFocused,
                      ]}
                    >
                      <View style={styles.inputIcon}>
                        <AppIcon
                          name="lock-closed-outline"
                          size={18}
                          color={focusedField === 'newPassword' ? Colors.accent : Colors.textSubtle}
                        />
                      </View>
                      <TextInput
                        ref={newPasswordRef}
                        style={styles.textInput}
                        placeholder="Enter new strong password"
                        placeholderTextColor={Colors.textSubtle}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        onFocus={() => handleFocus('newPassword', 50)}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="next"
                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                      />
                      <Pressable
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeBtn}
                        hitSlop={10}
                      >
                        <AppIcon
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={19}
                          color={showPassword ? Colors.accent : Colors.textSubtle}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
                    <View
                      style={[
                        styles.inputField,
                        focusedField === 'confirmPassword' && styles.inputFieldFocused,
                        confirmPassword.length > 0 &&
                          newPassword === confirmPassword &&
                          styles.inputFieldSuccess,
                      ]}
                    >
                      <View style={styles.inputIcon}>
                        <AppIcon
                          name="checkmark-circle-outline"
                          size={18}
                          color={
                            confirmPassword.length > 0 && newPassword === confirmPassword
                              ? Colors.success
                              : focusedField === 'confirmPassword'
                              ? Colors.accent
                              : Colors.textSubtle
                          }
                        />
                      </View>
                      <TextInput
                        ref={confirmPasswordRef}
                        style={styles.textInput}
                        placeholder="Re-enter new password"
                        placeholderTextColor={Colors.textSubtle}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        onFocus={() => handleFocus('confirmPassword', 100)}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="done"
                        onSubmitEditing={handleResetPassword}
                      />
                    </View>
                  </View>
                </View>

                {/* Reset CTA */}
                <Pressable
                  onPress={handleResetPassword}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    busy && styles.submitBtnDisabled,
                    pressed && styles.submitBtnPressed,
                  ]}
                >
                  {busy ? (
                    <View style={styles.btnRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Updating Password...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitBtnText}>Set New Password</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* ================= STEP 3: Success ================= */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <View style={styles.successIconBadge}>
                  <AppIcon name="checkmark" size={38} color="#FFFFFF" />
                </View>

                <View style={styles.headerWrap}>
                  <Text style={styles.title}>Password Reset Successfully!</Text>
                  <Text style={styles.subtitle}>
                    Your account password has been updated securely. You can now sign in using your new credentials.
                  </Text>
                </View>

                <Pressable
                  onPress={onNavigateToLogin}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    styles.successBtn,
                    pressed && styles.submitBtnPressed,
                  ]}
                >
                  <View style={styles.btnRow}>
                    <Text style={styles.submitBtnText}>Proceed to Sign In</Text>
                    <AppIcon name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            )}

            {/* Security Assurance Badge */}
            <View style={styles.trustBadge}>
              <AppIcon name="shield-checkmark" size={13} color={Colors.success} />
              <Text style={styles.trustBadgeText}>
                Fintech-Grade 256-Bit Cryptographic Security
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
    backgroundColor: Colors.background,
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
    pointerEvents: 'none',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#DBEAFE',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  desktopScrollContainer: {
    paddingVertical: 48,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 30px rgba(15, 40, 81, 0.08)',
      },
      default: {
        elevation: 4,
        shadowColor: Colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
    }),
  },
  desktopCard: {
    paddingHorizontal: 30,
    paddingTop: 26,
    paddingBottom: 32,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Colors.accent,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceSubtle,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.primarySurface,
    gap: 4,
  },
  backBtnPressed: {
    opacity: 0.8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  brandTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  brandNameAccent: {
    color: Colors.accent,
  },
  stepContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconEmblem: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(13, 138, 88, 0.35)',
      },
      default: {
        elevation: 6,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
    }),
  },
  headerWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  emailHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  devOtpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    gap: 6,
  },
  devOtpText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
  },
  devOtpBold: {
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  errorText: {
    fontSize: 12.5,
    color: Colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  formFields: {
    width: '100%',
    gap: 14,
    marginBottom: 20,
  },
  inputGroup: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  changeEmailLink: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.accent,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputFieldFocused: {
    borderColor: Colors.accent,
    backgroundColor: '#FAF5FF00',
  },
  inputFieldSuccess: {
    borderColor: Colors.success,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
    outlineStyle: 'none' as any,
  },
  otpTextInput: {
    fontSize: 18,
    letterSpacing: 8,
    fontWeight: '700',
  },
  eyeBtn: {
    padding: 6,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -6,
  },
  resendTimerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  timerBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  resendActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  submitBtn: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(15, 40, 81, 0.25)',
      },
      default: {
        elevation: 3,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
    }),
  },
  successBtn: {
    backgroundColor: Colors.success,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(13, 138, 88, 0.25)',
      },
      default: {
        elevation: 3,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
    }),
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  trustBadgeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
