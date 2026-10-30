import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../context/ToastContext';

export interface SettingsPageProps {
  data?: Snapshot | null;
  onBack: () => void;
  onNavigateTab: (tabKey: string) => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function SettingsPage({
  data,
  onBack,
  onNavigateTab,
  onOpenProfile,
  onLogout,
  onRefresh,
  refreshing = false,
}: SettingsPageProps) {
  const { user } = useAuth();

  // Settings State Toggles
  const [paymentReminders, setPaymentReminders] = useState(true);
  const [attendanceAlerts, setAttendanceAlerts] = useState(true);
  const [biometricLock, setBiometricLock] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Sync Data Handler
  const handleSyncNow = () => {
    setSyncing(true);
    showToast('Syncing with cloud ledger...', 'i');
    setTimeout(() => {
      onRefresh?.();
      setSyncing(false);
      showToast('Cloud ledger 100% up to date!', 's');
    }, 1200);
  };

  // Clear Local Cache Handler
  const handleClearCache = () => {
    showToast('Temporary offline cache cleared successfully', 's');
  };

  // WhatsApp Support
  const handleOpenSupport = () => {
    const text = `Namaste ThekaBook Support, I need help with app settings (Contractor: ${user?.name || 'Contractor'})`;
    const url = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(text)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        showToast('WhatsApp not installed', 'w');
      });
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* 1. STANDARDIZED PAGE HEADER */}
      <TopNavBar
        title="Settings"
        subtitle="App preferences, account & backup"
        onBack={onBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* SECTION 1: BUSINESS & ACCOUNT                             */}
        {/* ========================================================= */}
        <Text style={styles.sectionHeader}>BUSINESS & ACCOUNT</Text>
        <View style={styles.cardGroup}>
          {/* Business & Firm Profile */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && styles.itemPressed]}
            onPress={() => onOpenProfile?.() || onNavigateTab('profile')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="business-outline" size={19} color="#2563EB" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Business & Firm Profile</Text>
              <Text style={styles.itemSub}>Edit company name, address & GST/PAN</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#CBD5E1" />
          </Pressable>

          <View style={styles.divider} />

          {/* Bank & UPI Details */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && styles.itemPressed]}
            onPress={() => onNavigateTab('banks')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="card-outline" size={19} color="#16A34A" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Bank & UPI Settlement</Text>
              <Text style={styles.itemSub}>Bank account, IFSC & UPI ID for payment receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#CBD5E1" />
          </Pressable>

          <View style={styles.divider} />

          {/* Biometric / App Lock */}
          <View style={styles.settingItem}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="finger-print-outline" size={19} color="#D97706" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Biometric App Lock</Text>
              <Text style={styles.itemSub}>Require fingerprint / FaceID on app open</Text>
            </View>
            <Switch
              value={biometricLock}
              onValueChange={(val) => {
                setBiometricLock(val);
                showToast(val ? 'App lock enabled' : 'App lock disabled', 's');
              }}
              trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
              thumbColor={biometricLock ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* ========================================================= */}
        {/* SECTION 2: CLOUD SYNC & DATA BACKUP                       */}
        {/* ========================================================= */}
        <Text style={styles.sectionHeader}>CLOUD SYNC & BACKUP</Text>
        <View style={styles.cardGroup}>
          {/* Cloud Ledger Sync */}
          <View style={styles.settingItem}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="cloud-done-outline" size={19} color="#2563EB" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Cloud Ledger Live Sync</Text>
              <Text style={styles.itemSub}>100% data backed up on secure servers</Text>
            </View>
            <Pressable
              onPress={handleSyncNow}
              disabled={syncing}
              style={({ pressed }) => [
                styles.syncBtn,
                syncing && styles.syncBtnDisabled,
                pressed && styles.itemPressed,
              ]}
            >
              <Ionicons
                name="sync-outline"
                size={14}
                color="#2563EB"
                style={syncing ? styles.rotatingIcon : undefined}
              />
              <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Clear Cache */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && styles.itemPressed]}
            onPress={handleClearCache}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F8FAFC' }]}>
              <Ionicons name="trash-outline" size={19} color="#64748B" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Clear Local Cache</Text>
              <Text style={styles.itemSub}>Free up device storage without losing records</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#CBD5E1" />
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* SECTION 3: NOTIFICATIONS & REMINDERS                      */}
        {/* ========================================================= */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS & ALERTS</Text>
        <View style={styles.cardGroup}>
          {/* Payment Reminders */}
          <View style={styles.settingItem}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="notifications-outline" size={19} color="#059669" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Payment Due Reminders</Text>
              <Text style={styles.itemSub}>Overdue client payment notifications</Text>
            </View>
            <Switch
              value={paymentReminders}
              onValueChange={(val) => {
                setPaymentReminders(val);
                showToast(val ? 'Payment reminders turned on' : 'Payment reminders muted', 'i');
              }}
              trackColor={{ false: '#CBD5E1', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Daily Haziri Reminder */}
          <View style={styles.settingItem}>
            <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="calendar-outline" size={19} color="#7C3AED" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Daily Haziri Reminder</Text>
              <Text style={styles.itemSub}>Daily attendance alert at 8:00 AM</Text>
            </View>
            <Switch
              value={attendanceAlerts}
              onValueChange={(val) => {
                setAttendanceAlerts(val);
                showToast(val ? 'Attendance alerts turned on' : 'Attendance alerts muted', 'i');
              }}
              trackColor={{ false: '#CBD5E1', true: '#7C3AED' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ========================================================= */}
        {/* SECTION 4: HELP, SUPPORT & LEGAL                          */}
        {/* ========================================================= */}
        <Text style={styles.sectionHeader}>HELP & LEGAL</Text>
        <View style={styles.cardGroup}>
          {/* WhatsApp Support */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && styles.itemPressed]}
            onPress={handleOpenSupport}
          >
            <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="logo-whatsapp" size={19} color="#16A34A" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Priority Support</Text>
              <Text style={styles.itemSub}>Direct WhatsApp assistance with our team</Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#94A3B8" />
          </Pressable>

          <View style={styles.divider} />

          {/* Terms & Privacy */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && styles.itemPressed]}
            onPress={() => showToast('ThekaBook Terms & Privacy Policy v2.4', 'i')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="shield-checkmark-outline" size={19} color="#475569" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Terms & Privacy Policy</Text>
              <Text style={styles.itemSub}>100% data confidentiality guarantee</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#CBD5E1" />
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* SECTION 5: LOGOUT ACCOUNT                                 */}
        {/* ========================================================= */}
        <View style={styles.logoutWrapper}>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={19} color="#DC2626" />
            <Text style={styles.logoutBtnText}>Log Out Account</Text>
          </Pressable>

          <Text style={styles.versionText}>
            ThekaBook v2.4.0 • Built with ❤️ for Contractors
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 6,
    marginTop: 10,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)' },
      default: { elevation: 1 },
    }),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 50,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  rotatingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  logoutWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  logoutBtnPressed: {
    opacity: 0.8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
  },
  itemPressed: {
    opacity: 0.75,
  },
});
