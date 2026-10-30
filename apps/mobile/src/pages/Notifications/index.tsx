import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { money } from '../../finance';

export interface NotificationItem {
  id: string;
  type: 'payment' | 'haziri' | 'site' | 'wage' | 'system';
  title: string;
  message: string;
  timeAgo: string;
  read: boolean;
  actionTab?: string;
  targetId?: string;
  amount?: number;
}

export interface NotificationsPageProps {
  data?: Snapshot | null;
  onBack: () => void;
  onNavigateTab: (tabKey: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function NotificationsPage({
  data,
  onBack,
  onNavigateTab,
  onRefresh,
  refreshing = false,
}: NotificationsPageProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'payment' | 'haziri' | 'system'>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Generate dynamic contextual notifications from current snapshot data
  const rawNotifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];

    // 1. Recent Client Payments In
    const recentPayments = (data?.entries || [])
      .filter((e) => e.kind === 'RECEIPT' && !e.is_void)
      .slice(-3)
      .reverse();

    recentPayments.forEach((entry, idx) => {
      const site = data?.sites.find((s) => s.id === entry.site_id);
      const siteName = site?.name || 'Work Site';
      list.push({
        id: `entry-${entry.id}`,
        type: 'payment',
        title: `Payment Received: ${money(entry.amount || 0)}`,
        message: `Client payment received for ${siteName}. Added to hisaab ledger.`,
        timeAgo: idx === 0 ? 'Just now' : `${idx * 2}h ago`,
        read: false,
        actionTab: 'ledger',
        targetId: entry.id,
        amount: entry.amount,
      });
    });

    // 2. Wage Payments
    const recentWages = (data?.entries || [])
      .filter((e) => e.kind === 'WAGE_PAYMENT' && !e.is_void)
      .slice(-2)
      .reverse();

    recentWages.forEach((wEntry, idx) => {
      const worker = data?.workers.find((w) => w.id === wEntry.worker_id);
      const workerName = worker?.name || 'Worker';
      list.push({
        id: `wage-${wEntry.id}`,
        type: 'wage',
        title: `Wage Paid: ${money(wEntry.amount || 0)}`,
        message: `Payment disbursed to ${workerName}. Balance updated.`,
        timeAgo: `${(idx + 1) * 3}h ago`,
        read: false,
        actionTab: 'team',
        targetId: wEntry.worker_id,
        amount: wEntry.amount,
      });
    });

    // 3. Haziri / Attendance Reminder
    const workerCount = data?.workers?.length || 0;
    list.push({
      id: 'haziri-daily-reminder',
      type: 'haziri',
      title: 'Daily Haziri Reminder',
      message: workerCount > 0 
        ? `Don't forget to mark attendance for today's ${workerCount} active workers.`
        : 'Add your team members and mark daily haziri to track attendance.',
      timeAgo: 'Today, 08:00 AM',
      read: false,
      actionTab: 'attendance',
    });

    // 4. Sites Status Alert
    const activeSites = (data?.sites || []).filter((s) => s.status !== 'COMPLETED');
    if (activeSites.length > 0) {
      const firstSite = activeSites[0];
      list.push({
        id: `site-alert-${firstSite.id}`,
        type: 'site',
        title: `Site Active: ${firstSite.name}`,
        message: 'Review client progress, material invoices and upcoming contractor margins.',
        timeAgo: 'Yesterday',
        read: true,
        actionTab: 'sites',
        targetId: firstSite.id,
      });
    }

    // 5. System & Cloud Sync Notification
    list.push({
      id: 'system-cloud-sync',
      type: 'system',
      title: '100% Cloud Ledger Protected',
      message: 'All your work sites, attendance registers and billing records are securely backed up.',
      timeAgo: '2 days ago',
      read: true,
      actionTab: 'profile',
    });

    return list;
  }, [data]);

  // Handle Mark All Read
  const handleMarkAllRead = () => {
    const allIds = new Set(rawNotifications.map((n) => n.id));
    setReadIds(allIds);
  };

  // Toggle Single Read
  const handleItemPress = (item: NotificationItem) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    if (item.actionTab) {
      onNavigateTab(item.actionTab);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return rawNotifications.filter((item) => {
      const isRead = item.read || readIds.has(item.id);
      if (selectedFilter === 'unread') return !isRead;
      if (selectedFilter === 'payment') return item.type === 'payment' || item.type === 'wage';
      if (selectedFilter === 'haziri') return item.type === 'haziri';
      if (selectedFilter === 'system') return item.type === 'system' || item.type === 'site';
      return true;
    });
  }, [rawNotifications, selectedFilter, readIds]);

  const unreadCount = useMemo(() => {
    return rawNotifications.filter((n) => !n.read && !readIds.has(n.id)).length;
  }, [rawNotifications, readIds]);

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'payment':
        return { name: 'arrow-down-circle' as const, color: '#16A34A', bg: '#DCFCE7' };
      case 'wage':
        return { name: 'cash-outline' as const, color: '#D97706', bg: '#FEF3C7' };
      case 'haziri':
        return { name: 'calendar-outline' as const, color: '#2563EB', bg: '#EFF6FF' };
      case 'site':
        return { name: 'business-outline' as const, color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { name: 'shield-checkmark-outline' as const, color: '#059669', bg: '#ECFDF5' };
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* 1. STANDARDIZED PAGE HEADER (Used across all app pages) */}
      <TopNavBar
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
        onBack={onBack}
        actions={
          unreadCount > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.markAllBtn, pressed && styles.btnPressed]}
              onPress={handleMarkAllRead}
            >
              <Ionicons name="checkmark-done" size={15} color="#059669" />
              <Text style={styles.markAllText}>Mark Read</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* 2. CATEGORY PILL TABS */}
      <View style={styles.filterBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          <Pressable
            style={[styles.filterPill, selectedFilter === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'all' && styles.filterPillTextActive]}>
              All ({rawNotifications.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterPill, selectedFilter === 'unread' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('unread')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'unread' && styles.filterPillTextActive]}>
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterPill, selectedFilter === 'payment' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('payment')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'payment' && styles.filterPillTextActive]}>
              💰 Payments
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterPill, selectedFilter === 'haziri' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('haziri')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'haziri' && styles.filterPillTextActive]}>
              📋 Haziri
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterPill, selectedFilter === 'system' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('system')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'system' && styles.filterPillTextActive]}>
              🔔 System
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 3. NOTIFICATION LIST CONTENT */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#162032" />
          ) : undefined
        }
      >
        {filteredList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={38} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySub}>
              {selectedFilter === 'unread'
                ? 'You have read all your notifications! Great job.'
                : 'No alerts found for this category. New updates will appear here.'}
            </Text>
          </View>
        ) : (
          filteredList.map((item) => {
            const isRead = item.read || readIds.has(item.id);
            const iconConfig = getIconForType(item.type);

            return (
              <Pressable
                key={item.id}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => [
                  styles.notificationCard,
                  !isRead && styles.unreadCard,
                  pressed && styles.cardPressed,
                ]}
              >
                {/* Type Icon */}
                <View style={[styles.iconBox, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.name} size={18} color={iconConfig.color} />
                </View>

                {/* Content Info */}
                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.itemTitle, !isRead && styles.unreadTitleText]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.timeAndDotRow}>
                      <Text style={styles.timeText}>{item.timeAgo}</Text>
                      {!isRead && <View style={styles.unreadBlueDot} />}
                    </View>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.itemMessage} numberOfLines={1}>
                      {item.message}
                    </Text>
                    {item.actionTab && (
                      <Ionicons name="chevron-forward" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* 1. Header Action & Filter Pills */
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  filterBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  filterBar: {
    paddingHorizontal: 12,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  /* 3. List Content */
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 30,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)' },
      default: { elevation: 1 },
    }),
  },
  unreadCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BFDBFE',
    borderLeftWidth: 3.5,
    borderLeftColor: '#2563EB',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
    marginRight: 6,
  },
  unreadTitleText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  timeAndDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  unreadBlueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemMessage: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 15,
    flex: 1,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },

  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
