import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { useLanguage } from '../../i18n';
import { ReceivePaymentPage } from '../Entries/ReceivePaymentPage';
import { PaymentOutPage } from '../Entries/PaymentOutPage';

export interface PaymentsPageProps {
  data: Snapshot;
  onOpenEntry?: (kind: string, siteId?: string, workerId?: string) => void;
  onSaveEntry: (
    kind: string,
    values: Record<string, string>,
    siteId?: string,
    workerId?: string
  ) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  defaultView?: 'MENU' | 'RECEIVED' | 'PAYMENT';
  refreshing: boolean;
  onRefresh: () => void;
  busy: boolean;
  error: string;
  initialSiteId?: string;
}

export function PaymentsPage({
  data,
  onSaveEntry,
  onOpenProfile,
  onBack,
  defaultView = 'MENU',
  refreshing,
  onRefresh,
  busy,
  error,
  initialSiteId,
}: PaymentsPageProps) {
  const { t, lang } = useLanguage();
  const [subpage, setSubpage] = useState<'MENU' | 'RECEIVED' | 'PAYMENT'>(defaultView);

  // If user selected Received Payment (पैसा आया)
  if (subpage === 'RECEIVED') {
    return (
      <ReceivePaymentPage
        data={data}
        busy={busy}
        error={error}
        onBack={() => setSubpage('MENU')}
        onSave={(vals) => onSaveEntry('RECEIPT', vals, vals.site_id)}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onOpenProfile={onOpenProfile}
        siteId={initialSiteId}
      />
    );
  }

  // If user selected Payment Out (पैसा दिया)
  if (subpage === 'PAYMENT') {
    return (
      <PaymentOutPage
        data={data}
        busy={busy}
        error={error}
        onBack={() => setSubpage('MENU')}
        onSave={(kind, vals, wId) => onSaveEntry(kind, vals, vals.site_id, wId)}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onOpenProfile={onOpenProfile}
        siteId={initialSiteId}
      />
    );
  }

  // =========================================================================
  // PAYMENTS SELECTION SCREEN (Exact same clean design as Attendance page)
  // =========================================================================
  const menuOptions = [
    {
      id: 'received',
      title: 'Received Payment',
      icon: 'arrow-down-circle',
      iconColor: '#2563EB',
      onPress: () => setSubpage('RECEIVED'),
    },
    {
      id: 'payment',
      title: 'Payment',
      icon: 'arrow-up-circle',
      iconColor: '#2563EB',
      onPress: () => setSubpage('PAYMENT'),
    },
  ];

  return (
    <View style={styles.pageWrapper}>
      {/* Top Header matching Attendance exactly */}
      <TopNavBar
        title="Payment"
        subtitle="Payment & client receipts"
        userInitials={data.user?.name}
        organizationName={data.organization?.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.container}>
          {menuOptions.map((item) => (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuCard,
                pressed && styles.menuCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={styles.cardLeftContent}>
                <View style={styles.iconWrap}>
                  <AppIcon name={item.icon as any} size={22} color={item.iconColor} />
                </View>
                <Text style={styles.cardTitleText}>{item.title}</Text>
              </View>

              <AppIcon name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  container: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        elevation: 1,
      },
    }),
  },
  menuCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
    backgroundColor: '#F8FAFC',
  },
  cardLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
});
