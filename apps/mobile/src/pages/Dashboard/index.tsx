import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
  RefreshControl,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { useAuth } from '../../context/AuthContext';
import { Snapshot, Row } from '../../types';
import { money, siteSummary } from '../../finance';
import { SidebarDrawer } from '../../components/common/SidebarDrawer';
import { useLanguage } from '../../i18n';

export interface DashboardPageProps {
  data?: Snapshot | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onNavigateTab: (tabKey: string) => void;
  onOpenEntry: (kind: string, siteId?: string, workerId?: string) => void;
  onSelectSite?: (siteId: string) => void;
  onOpenNewSite?: () => void;
  onOpenAttendance?: (siteId?: string) => void;
  onShareReport?: () => void;
  onOpenProfile?: () => void;
  onOpenNotifications?: () => void;
  onLogout?: () => void;
  onShowToast?: (msg: string, type?: string) => void;
}

export function DashboardPage({
  data,
  refreshing = false,
  onRefresh,
  onNavigateTab,
  onOpenEntry,
  onSelectSite,
  onOpenNewSite,
  onOpenAttendance,
  onShareReport,
  onOpenProfile,
  onOpenNotifications,
  onLogout,
  onShowToast,
}: DashboardPageProps) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [localFirmName, setLocalFirmName] = useState<string>('');
  const [localContractorName, setLocalContractorName] = useState<string>('');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  useEffect(() => {
    async function loadSavedProfileInfo() {
      try {
        let storedAvatar: string | null = null;
        let profStr: string | null = null;

        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          storedAvatar =
            localStorage.getItem('thekabook_contractor_avatar') ||
            localStorage.getItem('contractor_avatar') ||
            localStorage.getItem('thekabook_user_avatar');

          profStr =
            localStorage.getItem('thekabook_contractor_profile_v3') ||
            localStorage.getItem('thekabook_contractor_profile_v2');
        } else {
          storedAvatar = await SecureStore.getItemAsync('thekabook_contractor_avatar');
          profStr =
            (await SecureStore.getItemAsync('thekabook_contractor_profile_v3')) ||
            (await SecureStore.getItemAsync('thekabook_contractor_profile_v2'));
        }

        if (profStr) {
          try {
            const p = JSON.parse(profStr);
            if (p.firmName) setLocalFirmName(p.firmName);
            if (p.contractorName) setLocalContractorName(p.contractorName);
            if (!storedAvatar && (p.avatar || p.photo || p.image)) {
              storedAvatar = p.avatar || p.photo || p.image;
            }
          } catch { }
        }

        if (storedAvatar) setLocalAvatar(storedAvatar);
      } catch { }
    }
    loadSavedProfileInfo();
  }, [user, data]);

  const firmName =
    data?.organization?.name ||
    localFirmName ||
    (user as any)?.organization_name ||
    (user as any)?.firmName ||
    data?.user?.firmName ||
    'ThekaBook Business';

  const rawName =
    localContractorName ||
    data?.user?.name ||
    user?.name ||
    'Contractor';

  const contractorDisplayName = rawName;

  // Dynamic Greeting based on time of day (Good Morning / Good Afternoon / Good Evening)
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 17) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  }, []);

  // Contractor Initials fallback
  const initials = useMemo(() => {
    const parts = rawName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (rawName.slice(0, 2) || 'CB').toUpperCase();
  }, [rawName]);

  // Resolved base64 / uri
  const avatarUri = useMemo(() => {
    const raw =
      user?.avatar ||
      user?.photo ||
      user?.image ||
      data?.user?.avatar ||
      data?.user?.photo ||
      localAvatar;

    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;
    if (str.startsWith('data:') || str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }
    return `data:image/jpeg;base64,${str}`;
  }, [user, data, localAvatar]);

  // Current month string e.g. "Oct 2026"
  const currentMonthStr = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // Compute live financial totals from snapshot
  const stats = useMemo(() => {
    if (!data) {
      return {
        totalToCollect: 18450000, // ₹1,84,500 demo/default if empty
        totalToPay: 6230000,     // ₹62,300 demo/default if empty
        weeklyEarnings: 3820000,  // ₹38,200 demo/default if empty
        netCash: 12220000,
        totalSites: 3,
        runningSitesCount: 3,
        totalWorkers: 48,
        todayPresent: 0,
      };
    }

    const activeEntries = (data.entries || []).filter((e) => !e.voided_at);
    let totalInflow = 0;
    let totalMaterial = 0;
    let totalLabour = 0;
    let totalExpense = 0;
    let totalSupplierPaid = 0;

    for (const e of activeEntries) {
      const amt = Number(e.amount || 0);
      if (e.kind === 'RECEIPT') totalInflow += amt;
      else if (e.kind === 'MATERIAL') totalMaterial += amt;
      else if (e.kind === 'WAGE_PAYMENT') totalLabour += amt;
      else if (e.kind === 'EXPENSE') totalExpense += amt;
      else if (e.kind === 'SUPPLIER_PAYMENT') totalSupplierPaid += amt;
    }

    // Site summaries
    let totalContract = 0;
    let totalReceived = 0;
    for (const s of data.sites || []) {
      const sum = siteSummary(s, data.attendance || [], data.entries || []);
      totalContract += sum.contract;
      totalReceived += sum.received;
    }

    const computedToCollect = Math.max(0, totalContract - totalReceived);
    const computedToPay = Math.max(0, totalMaterial + totalExpense - totalSupplierPaid);
    const netCash = totalInflow - (totalLabour + totalSupplierPaid);

    // Fallback to sample figures if brand new empty account so UI doesn't look blank
    const hasData = (data.sites?.length || 0) > 0 || (data.entries?.length || 0) > 0;
    const totalToCollect = hasData ? computedToCollect : 18450000;
    const totalToPay = hasData ? computedToPay : 6230000;
    const weeklyEarnings = hasData ? Math.max(0, netCash) : 3820000;

    return {
      totalToCollect,
      totalToPay,
      weeklyEarnings,
      netCash,
      totalSites: hasData ? (data.sites || []).length : 3,
      runningSitesCount: hasData ? (data.sites || []).filter((s) => s.status !== 'COMPLETED').length : 3,
      totalWorkers: hasData ? (data.workers || []).filter((w) => w.active).length : 48,
      todayPresent: (data.attendance || []).filter(
        (a) => String(a.date).slice(0, 10) === new Date().toISOString().slice(0, 10)
      ).length,
    };
  }, [data]);

  // Top 5 running sites (with mock fallback if user has no sites yet)
  const runningSites = useMemo(() => {
    const raw = (data?.sites || []).filter((s) => s.status !== 'COMPLETED');
    if (raw.length > 0) {
      let filtered = raw;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = raw.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
            (s.address && s.address.toLowerCase().includes(q))
        );
      }
      return filtered.slice(0, 5);
    }

    // High quality initial sample sites matching the user's screenshot
    return [
      {
        id: 'sample-1',
        name: 'Sharma ji',
        work_type: '3BHK Painting',
        address: 'Malviya Nagar',
        contract_amount: 15000000, // ₹1,50,000
        spent: 10500000,           // ₹1,05,000 (70%)
        workers_count: 4,
        pending_balance: 4500000,  // ₹45,000
        progress: 70,
        status: 'In Progress',
      },
      {
        id: 'sample-2',
        name: 'Gupta Villa',
        work_type: 'POP & Putty',
        address: 'Mansarovar',
        contract_amount: 22000000, // ₹2,20,000
        spent: 13200000,           // ₹1,32,000 (60%)
        workers_count: 6,
        pending_balance: 8800000,  // ₹88,000
        progress: 60,
        status: 'In Progress',
      },
      {
        id: 'sample-3',
        name: 'Civil Lines Duplex',
        work_type: 'Structure & Tile Work',
        address: 'Civil Lines',
        contract_amount: 38000000, // ₹3,80,000
        spent: 32300000,           // ₹3,23,000 (85%)
        workers_count: 8,
        pending_balance: 5700000,  // ₹57,000
        progress: 85,
        status: 'In Progress',
      },
    ];
  }, [data?.sites, searchQuery]);

  // Primary reminder calculation (highest pending party)
  const reminderInfo = useMemo(() => {
    if (data?.sites && data.sites.length > 0) {
      for (const s of data.sites) {
        const sum = siteSummary(s, data.attendance || [], data.entries || []);
        if (sum.ownerBalance > 0) {
          return {
            title: `${money(sum.ownerBalance)} pending from ${s.owner_name || s.name}`,
            sub: 'Payment overdue • Pending for 3 days',
            rawAmount: money(sum.ownerBalance),
            partyName: s.owner_name || s.name,
          };
        }
      }
    }
    return {
      title: '₹30,000 pending from Verma ji',
      sub: 'Overdue by 3 days',
      rawAmount: '₹30,000',
      partyName: 'Verma ji',
    };
  }, [data]);

  // WhatsApp Reminder Handler
  const handleSendReminder = () => {
    const text = `Hello ${reminderInfo.partyName}, payment reminder from ThekaBook: Your payment of ${reminderInfo.rawAmount} is pending. Please settle at your earliest convenience. Thank you!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        onShowToast?.('Payment reminder text copied!', 's');
      });
    }
  };

  // WhatsApp Refer & Earn Handler
  const handleShareReferral = () => {
    const msg = `Manage your work sites, labour attendance, and material bills effortlessly with ThekaBook! Download here: https://thekabook.com/invite?ref=${user?.phone || 'contractor'}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        onShowToast?.('Referral link copied to clipboard!', 's');
      });
    }
  };

  // 3x3 Circular Quick Actions Grid (Retained as requested!)
  const actionRows = [
    // Row 1: Attendance, Material, Wage
    [
      {
        id: 'attendance',
        label: 'Attendance',
        icon: 'calendar-outline',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        iconColor: '#2563EB',
        onPress: () => onNavigateTab('attendance'),
      },
      {
        id: 'material',
        label: 'Material Bill',
        icon: 'cube-outline',
        bg: '#FEF9C3',
        border: '#FDE047',
        iconColor: '#A16207',
        onPress: () => onOpenEntry('MATERIAL'),
      },
      {
        id: 'wage',
        label: 'Labour Wage',
        icon: 'cash-outline',
        bg: '#D1FAE5',
        border: '#6EE7B7',
        iconColor: '#065F46',
        onPress: () => onOpenEntry('WAGE_PAYMENT'),
      },
    ],
    // Row 2: Payments & Bills
    [
      {
        id: 'receipt',
        label: lang === 'hi' ? 'पेमेंट / लेन-देन' : 'Payment / Received',
        icon: 'card-outline',
        bg: '#DCFCE7',
        border: '#86EFAC',
        iconColor: '#166534',
        onPress: () => onNavigateTab('payments'),
      },
      {
        id: 'expense',
        label: 'Other Expense',
        icon: 'receipt-outline',
        bg: '#FFE4E6',
        border: '#FDA4AF',
        iconColor: '#9F1239',
        onPress: () => onOpenEntry('EXPENSE'),
      },
      {
        id: 'extra',
        label: 'Extra Work',
        icon: 'add-circle-outline',
        bg: '#EDE9FE',
        border: '#C4B5FD',
        iconColor: '#5B21B6',
        onPress: () => onOpenEntry('EXTRA'),
      },
    ],
    // Row 3: Management & Reports
    [
      {
        id: 'sites',
        label: 'Work Sites',
        icon: 'business-outline',
        bg: '#E0F2FE',
        border: '#7DD3FC',
        iconColor: '#0369A1',
        onPress: () => onNavigateTab('sites'),
      },
      {
        id: 'team',
        label: 'Labour / Workers',
        icon: 'people-outline',
        bg: '#FAE8FF',
        border: '#F0ABFC',
        iconColor: '#86198F',
        onPress: () => onNavigateTab('team'),
      },
      {
        id: 'reports',
        label: 'P&L Reports',
        icon: 'bar-chart-outline',
        bg: '#CCFBF1',
        border: '#5EEAD4',
        iconColor: '#115E59',
        onPress: () => onNavigateTab('reports'),
      },
    ],
  ];

  return (
    <View style={styles.pageWrapper}>
      {/* 1. FIXED TOP HEADER (Logo, Greeting, Bell - zIndex 100) */}
      <View style={styles.fixedHeaderOuter}>
        <View style={styles.headerCard}>
          <View style={styles.topBarRow}>
            {/* Profile Identity Block (Avatar is pressable to open sidebar drawer) */}
            <View style={styles.leftProfileRow}>
              {/* Profile Avatar (Base64 Image / Initials) - Tapping opens Sidebar */}
              <Pressable
                onPress={() => setSidebarOpen(true)}
                style={({ pressed }) => [
                  styles.appLogoBox,
                  pressed && styles.avatarPressed,
                ]}
                accessibilityLabel="Open Sidebar Menu"
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarInitialsBox}>
                    <Text style={styles.avatarInitialsText}>{initials}</Text>
                  </View>
                )}
                {/* Active Online Indicator */}
                <View style={styles.onlineBadgeDot} />
              </Pressable>

              {/* Greeting Title & Contractor Name (Non-clickable pure info) */}
              <View style={styles.greetingTextWrap}>
                <Text style={styles.greetingTitle} numberOfLines={1}>
                  {greetingText}
                </Text>
                <View style={styles.nameRow}>
                  <Text style={styles.contractorNameText} numberOfLines={1}>
                    {contractorDisplayName}
                  </Text>
                </View>
              </View>
            </View>

            {/* Notification Bell Button */}
            <Pressable
              onPress={() => (onOpenNotifications ? onOpenNotifications() : onNavigateTab('notifications'))}
              style={({ pressed }) => [
                styles.bellBtn,
                pressed && styles.itemPressed,
              ]}
              accessibilityLabel="Notifications"
            >
              <AppIcon name="notifications-outline" size={20} color="#0F172A" />
              <View style={styles.bellBadgeDot} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. SCROLLABLE CONTENT */}
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F59E0B', Colors.primary]}
              tintColor="#F59E0B"
            />
          ) : undefined
        }
      >
        <View style={styles.bodyContainer}>
          {/* Sites & Active Workers Two Separate Cards */}
          <View style={[styles.summaryCardsRow, isDesktop && styles.desktopCard]}>
            {/* Card 1: Total Sites */}
            <View style={[styles.whiteCard, styles.statCardItem]}>
              <Text style={styles.statCardLabel}>Total Sites</Text>
              <Text style={styles.statCardValue}>{stats.totalSites}</Text>
            </View>

            {/* Card 2: Active Workers */}
            <View style={[styles.whiteCard, styles.statCardItem]}>
              <Text style={styles.statCardLabel}>Active Workers</Text>
              <Text style={styles.statCardValue}>{stats.totalWorkers}</Text>
            </View>
          </View>

          {/* ------------------------------------------------------- */}
          {/* 2B. QUICK ACTIONS (Our full 3x3 grid above Reminder)     */}
          {/* ------------------------------------------------------- */}
          <View style={[styles.whiteCard, styles.hubCard, isDesktop && styles.desktopCard]}>
            {actionRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.hubGridRow}>
                {row.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      styles.hubActionItem,
                      pressed && styles.itemPressed,
                    ]}
                    accessibilityLabel={item.label}
                  >
                    <View
                      style={[
                        styles.quickIconCircle,
                        {
                          backgroundColor: item.bg,
                          borderColor: item.border,
                        },
                      ]}
                    >
                      <AppIcon name={item.icon} size={25} color={item.iconColor} />
                    </View>
                    <Text style={styles.quickActionLabel} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* ------------------------------------------------------- */}
          {/* 2C. REMINDER CARD ("Yaad dilao")                        */}
          {/* ------------------------------------------------------- */}
          <View style={[styles.reminderCard, isDesktop && styles.desktopCard]}>
            <View style={styles.reminderTextWrap}>
              <Text style={styles.reminderTitle} numberOfLines={1}>
                {reminderInfo.title}
              </Text>
              <Text style={styles.reminderSub}>
                {reminderInfo.sub}
              </Text>
            </View>

            <Pressable
              onPress={handleSendReminder}
              style={({ pressed }) => [
                styles.yaadDilaoBtn,
                pressed && styles.itemPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reminder"
            >
              <Text style={styles.yaadDilaoBtnText}>Reminder</Text>
            </Pressable>
          </View>

          {/* ------------------------------------------------------- */}
          {/* 2D. CHALU SITES (Running Sites List - Top 5)            */}
          {/* ------------------------------------------------------- */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleText}>Running Sites</Text>
            <Pressable
              onPress={() => onNavigateTab('sites')}
              style={({ pressed }) => [styles.sabDekhoBtn, pressed && styles.itemPressed]}
            >
              <Text style={styles.sabDekhoText}>View More</Text>
            </Pressable>
          </View>

          <View style={styles.sitesListContainer}>
            {runningSites.map((site: any) => {
              const isSample = site.id.startsWith('sample-');
              let sum = null;
              if (!isSample && data) {
                sum = siteSummary(site, data.attendance || [], data.entries || []);
              }

              const contractVal = isSample ? site.contract_amount : (sum?.contract || Number(site.contract_amount || 0));
              const spentVal = isSample ? site.spent : (sum?.cost || 0);
              const progressPercent = isSample
                ? site.progress
                : contractVal > 0
                  ? Math.min(100, Math.round((spentVal / contractVal) * 100))
                  : 0;

              const workersCount = isSample
                ? site.workers_count
                : (data?.attendance || []).filter((a) => a.site_id === site.id).length || 2;

              const pendingBalance = isSample
                ? site.pending_balance
                : Math.max(0, contractVal - (sum?.received || 0));

              const workType = site.work_type || site.owner_name || 'Construction Work';
              const locationStr = site.address || site.owner_name || 'Project Site';

              return (
                <Pressable
                  key={site.id}
                  onPress={() => {
                    if (isSample) {
                      onOpenNewSite?.() || onNavigateTab('sites');
                    } else {
                      onSelectSite?.(site.id) || onNavigateTab('sites');
                    }
                  }}
                  style={({ pressed }) => [
                    styles.siteItemCard,
                    pressed && styles.itemPressed,
                    isDesktop && styles.desktopCard,
                  ]}
                >
                  {/* Top: Name — Work Type + Status Badge */}
                  <View style={styles.siteTopRow}>
                    <Text style={styles.siteTitleName} numberOfLines={1}>
                      {site.name} — <Text style={styles.siteWorkType}>{workType}</Text>
                    </Text>
                    <View style={styles.chalRahaHaiBadge}>
                      <Text style={styles.chalRahaHaiText}>In Progress</Text>
                    </View>
                  </View>

                  {/* Location / Area */}
                  <Text style={styles.siteLocationText} numberOfLines={1}>
                    {locationStr}
                  </Text>

                  {/* Golden Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarGoldenFill,
                        { width: `${progressPercent}%` },
                      ]}
                    />
                  </View>

                  {/* Bottom: Progress % • Workers + Pending Amount */}
                  <View style={styles.siteBottomRow}>
                    <Text style={styles.siteProgressMeta}>
                      {progressPercent}% completed • {workersCount} workers
                    </Text>
                    <Text style={styles.sitePendingAmount}>
                      {money(pendingBalance)} pending
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ------------------------------------------------------- */}
          {/* 2E. REFER & EARN CARD (Matching User Reference Image)   */}
          {/* ------------------------------------------------------- */}
          <View style={[styles.referContainerCard, isDesktop && styles.desktopCard]}>
            {/* Top Heading */}
            <Text style={styles.referMainHeading}>Refer and Earn ₹600</Text>
            <Text style={styles.referSubHeading}>
              ₹120/referral | Up to 5 referrals/month
            </Text>

            {/* Center Graphic Illustration */}
            <View style={styles.referIllustrationWrap}>
              {/* Floating Coin 1 (Left) */}
              <View style={styles.floatingCoinLeft}>
                <Text style={styles.coinRupeeText}>₹</Text>
              </View>

              {/* Floating Speech Bubble 1 (Top Left) */}
              <View style={styles.speechBubble1}>
                <View style={styles.bubbleAvatarInner}>
                  <AppIcon name="person" size={13} color="#FFFFFF" />
                </View>
              </View>

              {/* Floating Speech Bubble 2 (Top Right) */}
              <View style={styles.speechBubble2}>
                <View style={styles.bubbleAvatarInner}>
                  <AppIcon name="person" size={15} color="#FFFFFF" />
                </View>
              </View>

              {/* Floating Coin 2 (Right) */}
              <View style={styles.floatingCoinRight}>
                <Text style={styles.coinRupeeText}>₹</Text>
              </View>

              {/* Center Gift Box Illustration */}
              <View style={styles.giftBoxWrapper}>
                {/* Ribbon Bow Loops */}
                <View style={styles.bowContainer}>
                  <View style={styles.bowLoopLeft} />
                  <View style={styles.bowLoopRight} />
                  <View style={styles.bowCenterKnot} />
                </View>

                {/* Gift Box Lid */}
                <View style={styles.boxLid}>
                  <View style={styles.lidRibbonVertical} />
                </View>

                {/* Gift Box Body */}
                <View style={styles.boxBody}>
                  <View style={styles.boxRibbonVertical} />
                </View>
              </View>

              {/* Floating Paper Airplane (Bottom Left) */}
              <View style={styles.paperPlaneBox}>
                <AppIcon name="paper-plane" size={24} color="#C7D2FE" />
              </View>

              {/* Sparkle Dots */}
              <View style={[styles.sparkleDot, { top: 38, left: 24 }]} />
              <View style={[styles.sparkleDot, { bottom: 12, right: 38 }]} />
            </View>

            {/* How it works details directly inside single Refer & Earn card */}
            <View style={styles.howItWorksSection}>
              <View style={styles.howItWorksHeader}>
                <Text style={styles.howItWorksTitle}>How it works?</Text>
                <Pressable
                  onPress={() => onShowToast?.('Each referral gets ₹120 when they create their first work site.', 'i')}
                  hitSlop={8}
                >
                  <Text style={styles.termsLinkText}>Terms & Conditions</Text>
                </Pressable>
              </View>

              {/* 3-Step Horizontal Process */}
              <View style={styles.stepsRow}>
                {/* Step 1: Share invite link */}
                <View style={styles.stepItem}>
                  <View style={styles.stepIconCircle}>
                    <AppIcon name="chatbubble-ellipses-outline" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.stepLabelText}>Share{'\n'}invite link</Text>
                </View>

                {/* Dashed Connector 1 */}
                <View style={styles.stepDashedLine} />

                {/* Step 2: Your friend signs up */}
                <View style={styles.stepItem}>
                  <View style={styles.stepIconCircle}>
                    <AppIcon name="checkmark-done" size={19} color="#2563EB" />
                  </View>
                  <Text style={styles.stepLabelText}>Your friend{'\n'}signs up</Text>
                </View>

                {/* Dashed Connector 2 */}
                <View style={styles.stepDashedLine} />

                {/* Step 3: Get reward */}
                <View style={styles.stepItem}>
                  <View style={styles.stepIconCircle}>
                    <AppIcon name="cash-outline" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.stepLabelText}>Get{'\n'}reward</Text>
                </View>
              </View>

              {/* WhatsApp Share Button */}
              <Pressable
                onPress={handleShareReferral}
                style={({ pressed }) => [
                  styles.referWhatsappBtn,
                  pressed && styles.itemPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Share on WhatsApp"
              >
                <AppIcon name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.referWhatsappBtnText}>Invite Friends on WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Custom Fintech Sidebar Drawer */}
      <SidebarDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        firmName={firmName}
        contractorName={contractorDisplayName}
        avatarUri={avatarUri}
        initials={initials}
        onNavigateTab={onNavigateTab}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
        onShareReport={onShareReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background like screenshot
  },
  root: {
    flex: 1,
    zIndex: 10,
    ...Platform.select({
      web: { position: 'relative' } as any,
      default: { elevation: 2 },
    }),
  },
  scroll: {
    paddingBottom: 110,
  },

  /* 1. Premium Light Top Header (Fixed at top - Logo, Greeting, Bell on zIndex 100) */
  fixedHeaderOuter: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 100,
    width: '100%',
    alignItems: 'center',
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    maxWidth: 600,
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  appLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
    overflow: 'visible',
    borderWidth: 2,
    borderColor: '#FEF3C7',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)' },
      default: { elevation: 2 },
    }),
  },
  avatarPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitialsBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingTextWrap: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 2,
  },
  contractorNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)' },
      default: { elevation: 1 },
    }),
  },
  bellBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    position: 'absolute',
    top: 10,
    right: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  /* 2. Body Container (Sits cleanly below fixed header on light background) */
  bodyContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    zIndex: 10,
    ...Platform.select({
      web: { position: 'relative' } as any,
      default: { elevation: 2 },
    }),
  },
  desktopCard: {
    maxWidth: 600,
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.04)' },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },

  /* 2A. Two Separate Stat Cards Row */
  summaryCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  statCardItem: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    gap: 4,
  },
  statCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  statCardValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  monthCard: {
    padding: 16,
    marginBottom: 16,
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  splitDuesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dueBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  dueBoxGreen: {
    backgroundColor: '#EBFBF2',
    borderColor: '#D1FAE5',
  },
  dueBoxRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  dueBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  dueLabelGreen: {
    color: '#047857',
  },
  dueLabelRed: {
    color: '#B91C1C',
  },
  dueBoxAmount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dueAmountGreen: {
    color: '#047857',
  },
  dueAmountRed: {
    color: '#B91C1C',
  },
  weekEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  weekEarningsLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  weekEarningsAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* 2B. Hub Card (Our full 3x3 Grid) */
  hubCard: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  hubGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 5,
  },
  hubActionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  quickIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 8,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
      default: { elevation: 2 },
    }),
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 14,
  },

  /* 2C. Reminder Card (Yaad dilao) */
  reminderCard: {
    backgroundColor: '#FEF3C7', // Soft warm yellow
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(245, 158, 11, 0.12)' },
      default: { elevation: 2 },
    }),
  },
  reminderTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    lineHeight: 18,
  },
  reminderSub: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
    marginTop: 2,
  },
  yaadDilaoBtn: {
    backgroundColor: '#1E293B', // Dark button from screenshot
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yaadDilaoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* 2D. Chalu Sites Header & List */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sabDekhoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  sabDekhoText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706', // Golden amber link text
  },
  sitesListContainer: {
    gap: 10,
    marginBottom: 18,
  },
  siteItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.03)' },
      default: { elevation: 1 },
    }),
  },
  siteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  siteTitleName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    paddingRight: 8,
  },
  siteWorkType: {
    fontWeight: '500',
    color: '#475569',
  },
  chalRahaHaiBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  chalRahaHaiText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  siteLocationText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarGoldenFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#F59E0B', // Golden amber progress bar
  },
  siteBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  siteProgressMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sitePendingAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C', // baaki amount in red
  },

  /* 2E. Refer & Earn Card (Matching User Screenshot) */
  referContainerCard: {
    backgroundColor: '#F3EEFF', // Soft pastel lavender background
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    paddingTop: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
    marginBottom: 20,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(139, 92, 246, 0.08)' },
      default: { elevation: 3 },
    }),
  },
  referMainHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4C1D95', // Deep purple
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  referSubHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  referIllustrationWrap: {
    height: 140,
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBoxWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 100,
  },
  bowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -4,
    zIndex: 2,
    position: 'relative',
  },
  bowLoopLeft: {
    width: 28,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#818CF8',
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-25deg' }],
    marginRight: -4,
  },
  bowLoopRight: {
    width: 28,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#818CF8',
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '25deg' }],
    marginLeft: -4,
  },
  bowCenterKnot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#818CF8',
    zIndex: 3,
  },
  boxLid: {
    width: 110,
    height: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#818CF8',
    borderRadius: 6,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(129, 140, 248, 0.15)' },
      default: { elevation: 1 },
    }),
  },
  lidRibbonVertical: {
    width: 16,
    height: '100%',
    backgroundColor: '#C7D2FE',
  },
  boxBody: {
    width: 98,
    height: 60,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#818CF8',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(129, 140, 248, 0.15)' },
      default: { elevation: 2 },
    }),
  },
  boxRibbonVertical: {
    width: 16,
    height: '100%',
    backgroundColor: '#C7D2FE',
  },
  floatingCoinLeft: {
    position: 'absolute',
    top: 24,
    left: 28,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F97316', // Orange coin like image
    borderWidth: 2,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)' },
      default: { elevation: 2 },
    }),
  },
  floatingCoinRight: {
    position: 'absolute',
    bottom: 22,
    right: 32,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F97316',
    borderWidth: 2,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '15deg' }],
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)' },
      default: { elevation: 2 },
    }),
  },
  coinRupeeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  speechBubble1: {
    position: 'absolute',
    top: 12,
    right: 88,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)' },
      default: { elevation: 2 },
    }),
  },
  speechBubble2: {
    position: 'absolute',
    top: 16,
    right: 42,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)' },
      default: { elevation: 2 },
    }),
  },
  bubbleAvatarInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6', // Blue avatar circle like image
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperPlaneBox: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    transform: [{ rotate: '-18deg' }],
  },
  sparkleDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#818CF8',
  },

  /* Details directly inside single Refer & Earn card (No inner card) */
  howItWorksSection: {
    width: '100%',
    marginTop: 10,
    paddingTop: 8,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  howItWorksTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3B1E78', // Deep purple matching heading
  },
  termsLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6366F1', // Indigo link text
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stepItem: {
    alignItems: 'center',
    width: 82,
  },
  stepIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF', // Clean white icon circles on lavender card
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(124, 58, 237, 0.12)' },
      default: { elevation: 1 },
    }),
  },
  stepLabelText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
  },
  stepDashedLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD', // Soft lavender dash
    marginTop: -18,
    marginHorizontal: 2,
  },
  referWhatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E', // WhatsApp emerald green
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)' },
      default: { elevation: 2 },
    }),
  },
  referWhatsappBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  itemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
