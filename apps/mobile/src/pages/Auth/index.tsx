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
            {/* App Logo & Header */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <AppIcon name="shield-checkmark" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.brandTitle}>ThekaBook</Text>
              <View style={styles.brandTag}>
                <Text style={styles.brandTagText}>CONTRACTOR WORKSPACE</Text>
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
                  size={17}
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
                  name="person-add-outline"
                  size={17}
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
                  ? 'Set up your contractor profile to start managing sites.'
                  : 'Enter your credentials to access your contractor ledger.'}
              </Text>
            </View>

            {/* Error Message Box */}
            {error ? (
              <View style={styles.errorAlert}>
                <AppIcon name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorAlertText}>{error}</Text>
              </View>
            ) : null}

            {/* Input Form Fields */}
            <View style={styles.fieldsContainer}>
              {isRegister && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>YOUR FULL NAME</Text>
                    <View style={styles.inputBox}>
                      <View style={styles.inputIconWrap}>
                        <AppIcon name="person-outline" size={18} color={Colors.textMuted} />
                      </View>
                      <TextInput
                        accessibilityLabel="Your full name"
                        style={styles.textInput}
                        placeholder="e.g. Rajesh Sharma"
                        placeholderTextColor={Colors.textSubtle}
                        value={name}
                        onChangeText={setName}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>BUSINESS / FIRM NAME</Text>
                    <View style={styles.inputBox}>
                      <View style={styles.inputIconWrap}>
                        <AppIcon name="business-outline" size={18} color={Colors.textMuted} />
                      </View>
                      <TextInput
                        accessibilityLabel="Business name"
                        style={styles.textInput}
                        placeholder="e.g. Sharma Infrastructure"
                        placeholderTextColor={Colors.textSubtle}
                        value={org}
                        onChangeText={setOrg}
                      />
                    </View>
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconWrap}>
                    <AppIcon name="mail-outline" size={18} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    accessibilityLabel="Email address"
                    style={styles.textInput}
                    placeholder="contractor@business.com"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  {isRegister && (
                    <Text style={styles.labelHint}>Min. 10 characters</Text>
                  )}
                </View>
                <View style={styles.inputBox}>
                  <View style={styles.inputIconWrap}>
                    <AppIcon name="lock-closed-outline" size={18} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    accessibilityLabel="Password"
                    style={styles.textInput}
                    placeholder={isRegister ? 'Minimum 10 characters' : 'Enter your password'}
                    placeholderTextColor={Colors.textSubtle}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={submit}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggleBtn}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <AppIcon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.textMuted}
                    />
                  </Pressable>
                </View>
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitBtnText}>
                    {isRegister ? 'Create Account' : 'Sign In'}
                  </Text>
                  <AppIcon name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              )}
            </Pressable>

            {/* Quick Toggle Link */}
            <Pressable
              onPress={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={styles.toggleFooter}
            >
              <Text style={styles.toggleFooterText}>
                {isRegister ? 'Already have an account? ' : 'New contractor? '}
                <Text style={styles.toggleFooterLink}>
                  {isRegister ? 'Sign In' : 'Create an account'}
                </Text>
              </Text>
            </Pressable>

            {/* Security Trust Footnote */}
            <View style={styles.securityRow}>
              <AppIcon name="shield-checkmark-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.securityText}>
                256-Bit SSL Encrypted • Private Workspace
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
    backgroundColor: '#F1F5F9',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    gap: 18,
  },

  /* Brand Header */
  brandHeader: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  brandTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 0.8,
  },

  /* Segmented Tab Switcher */
  segmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  segmentLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  /* Form Header */
  formIntro: {
    gap: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorAlertText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },

  /* Fields */
  fieldsContainer: {
    gap: 14,
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
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  labelHint: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIconWrap: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    height: '100%',
  },
  passwordToggleBtn: {
    padding: 6,
    marginLeft: 4,
  },

  /* Submit Button */
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Footer */
  toggleFooter: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleFooterText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  toggleFooterLink: {
    color: Colors.accent,
    fontWeight: '700',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  securityText: {
    fontSize: 10,
    color: Colors.textSubtle,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
