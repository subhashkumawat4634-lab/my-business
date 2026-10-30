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
import { Snapshot, Row } from '../../types';
import { DailyHaziriPage, DailyHaziriPageProps } from './DailyHaziriPage';
import { MonthlyAttendancePage, MonthlyAttendancePageProps } from './MonthlyAttendancePage';
import { BulkAttendancePage, BulkAttendancePageProps } from './BulkAttendancePage';

export { DailyHaziriPage } from './DailyHaziriPage';
export type { DailyHaziriPageProps } from './DailyHaziriPage';
export { DailyHaziriPage as DailyAttendancePage } from './DailyHaziriPage';

export { MonthlyAttendancePage } from './MonthlyAttendancePage';
export type { MonthlyAttendancePageProps } from './MonthlyAttendancePage';
export { MonthlyAttendancePage as MonthlyRegisterPage } from './MonthlyAttendancePage';

export { BulkAttendancePage } from './BulkAttendancePage';
export type { BulkAttendancePageProps } from './BulkAttendancePage';

export interface AttendancePageProps {
  data: Snapshot;
  onOpenAttendanceModal: (siteId?: string, workerId?: string, existing?: Row) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  defaultView?: 'MENU' | 'DAILY' | 'MONTHLY' | 'BULK';
  refreshing: boolean;
  onRefresh: () => void;
}

export function AttendancePage({
  data,
  onOpenAttendanceModal,
  onOpenProfile,
  onBack,
  defaultView = 'MENU',
  refreshing,
  onRefresh,
}: AttendancePageProps) {
  const [subpage, setSubpage] = useState<'MENU' | 'DAILY' | 'MONTHLY' | 'BULK'>(defaultView);

  // If user selected Monthly Attendance page
  if (subpage === 'MONTHLY') {
    return (
      <MonthlyAttendancePage
        data={data}
        onOpenAttendanceModal={onOpenAttendanceModal}
        onOpenProfile={onOpenProfile}
        onBack={() => setSubpage('MENU')}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // If user selected Daily Attendance page
  if (subpage === 'DAILY') {
    return (
      <DailyHaziriPage
        data={data}
        onOpenAttendanceModal={onOpenAttendanceModal}
        onOpenProfile={onOpenProfile}
        onBack={() => setSubpage('MENU')}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // If user selected Bulk Attendance page
  if (subpage === 'BULK') {
    return (
      <BulkAttendancePage
        data={data}
        onBack={() => setSubpage('MENU')}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // =========================================================================
  // ATTENDANCE SELECTION SCREEN (Exact same options design as user screenshot)
  // =========================================================================
  const menuOptions = [
    {
      id: 'bulk',
      title: 'Bulk Attendance',
      icon: 'people',
      iconColor: '#2563EB',
      onPress: () => setSubpage('BULK'),
    },
    {
      id: 'daily',
      title: 'Daily Attendance',
      icon: 'time',
      iconColor: '#D97706',
      onPress: () => setSubpage('DAILY'),
    },
    {
      id: 'monthly',
      title: 'Monthly Attendance',
      icon: 'calendar',
      iconColor: '#C2410C',
      onPress: () => setSubpage('MONTHLY'),
    },
  ];

  return (
    <View style={styles.pageWrapper}>
      {/* Top Header matching user screenshot */}
      <TopNavBar
        title="Attendance"
        subtitle="Worker attendance & registers"
        userInitials={data.user.name}
        organizationName={data.organization.name}
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
