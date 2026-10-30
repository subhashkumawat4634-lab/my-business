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
import { request, saveRememberedEmail, UserInfo } from '../../api';
import { RedirectingScreen } from '../../components/common/RedirectingScreen';
import { Colors } from '../../theme/colors';

interface LoginPageProps {
  onLogin: (token: string, user?: UserInfo) => Promise<void>;
  onNavigateToSignUp: () => void;
  onNavigateToForgotPassword?: () => void;
}

export function LoginPage({ onLogin, onNavigateToSignUp, onNavigateToForgotPassword }: LoginPageProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Email starts empty - no auto-fill
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Ensure no stale remembered email lingers
  useEffect(() => {
    saveRememberedEmail(null).catch(() => { });
  }, []);

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

  async function handleSignIn() {
    if (busy || isRedirecting) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await request('/auth/login', null, {
        email: cleanEmail,
        password,
      });

      setIsRedirecting(true);
      await new Promise((r) => setTimeout(r, 350));
      await onLogin(result.token, result.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
      setIsRedirecting(false);
      setBusy(false);
    }
  }

  if (isRedirecting) {
    return (
      <RedirectingScreen
        title="Welcome Back!"
        subtitle="Opening your contractor workspace and financial ledger..."
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Background Decorative Aura */}
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
            {/* Top Accent Blue Stripe */}
            <View style={styles.accentBar} />

            {/* Brand Emblem & Logo */}
            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <AppIcon name="shield-checkmark" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.brandTitleWrap}>
                <Text style={styles.brandName}>
                  Theka<Text style={styles.brandNameAccent}>Book</Text>
                </Text>
                <View style={styles.workspacePill}>
                  <AppIcon name="flash" size={10} color="#0284C7" />
                  <Text style={styles.workspacePillText}>CONTRACTOR CLOUD WORKSPACE</Text>
                </View>
              </View>
            </View>

            {/* Page Header */}
            <View style={styles.headerWrap}>
              <Text style={styles.title}>Sign In to Account</Text>
              <Text style={styles.subtitle}>
                Access your sites, daily attendance & contractor financial ledger
              </Text>
            </View>

            {/* Error Banner */}
            {!!error && (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-circle" size={17} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Input Fields */}
            <View style={styles.formFields}>
              {/* Email Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <Pressable
                  onPress={() => {
                    emailInputRef.current?.focus();
                    handleFocus('email', 40);
                  }}
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
                    ref={emailInputRef}
                    style={styles.textInput}
                    placeholder="contractor@business.com"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => handleFocus('email', 40)}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </Pressable>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <View style={styles.passwordHeaderRow}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  {onNavigateToForgotPassword && (
                    <Pressable
                      onPress={onNavigateToForgotPassword}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  onPress={() => {
                    passwordInputRef.current?.focus();
                    handleFocus('password', 150);
                  }}
                  style={[
                    styles.inputField,
                    focusedField === 'password' && styles.inputFieldFocused,
                  ]}
                >
                  <View style={styles.inputIcon}>
                    <AppIcon
                      name="lock-closed-outline"
                      size={18}
                      color={focusedField === 'password' ? Colors.accent : Colors.textSubtle}
                    />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.textInput}
                    placeholder="Enter your password"
                    placeholderTextColor={Colors.textSubtle}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => handleFocus('password', 150)}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="go"
                    onSubmitEditing={handleSignIn}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <AppIcon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={showPassword ? Colors.accent : Colors.textSubtle}
                    />
                  </Pressable>
                </Pressable>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSignIn}
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
                  <Text style={styles.submitBtnText}>Signing In...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.submitBtnText}>Sign In to Workspace</Text>
                  <AppIcon name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              )}
            </Pressable>

            {/* Link to Sign Up */}
            <Pressable onPress={onNavigateToSignUp} style={styles.switchRow}>
              <Text style={styles.switchText}>
                Don't have an account?{' '}
                <Text style={styles.switchLink}>Create Contractor Account</Text>
              </Text>
            </Pressable>

            {/* Trust Badge */}
            <View style={styles.trustBadge}>
              <AppIcon name="shield-checkmark" size={13} color={Colors.success} />
              <Text style={styles.trustBadgeText}>
                100% Safe & Secure • Encrypted Contractor Cloud
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
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 15,
    overflow: 'hidden',
    position: 'relative',
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
    maxWidth: 440,
    paddingHorizontal: 28,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Colors.accent,
  },
  brandContainer: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
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
  brandTitleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  brandNameAccent: {
    color: Colors.accent,
  },
  workspacePill: {
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
  workspacePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.6,
  },
  headerWrap: {
    gap: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  formFields: {
    gap: 13,
  },
  inputGroup: {
    gap: 5,
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  forgotPasswordLink: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.accent,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 48,
  },
  inputFieldFocused: {
    borderColor: Colors.accent,
    backgroundColor: '#FAF5FF00',
  },
  inputIcon: {
    marginRight: 9,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
    outlineStyle: 'none' as any,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  switchLink: {
    color: Colors.accent,
    fontWeight: '800',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  trustBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.success,
    letterSpacing: 0.2,
  },
});

export default LoginPage;
