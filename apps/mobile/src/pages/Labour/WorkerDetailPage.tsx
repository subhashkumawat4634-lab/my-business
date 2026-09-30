import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Badge } from '../../components/common/Badge';
import { Row, Snapshot } from '../../types';
import { money, workerSummary } from '../../finance';

export interface WorkerDetailPageProps {
  worker: Row;
  data: Snapshot;
  onBack: () => void;
  onOpenPaymentModal: (workerId: string) => void;
  onOpenWorkerModal: (worker: Row) => void;
}

type PageTab = 'OVERVIEW' | 'ATTENDANCE' | 'PAYMENTS';

const AVATAR_PALETTES = [
  { bg: '#EFF6FF', text: '#1E40AF' },
  { bg: '#ECFDF5', text: '#065F46' },
  { bg: '#F5F3FF', text: '#5B21B6' },
  { bg: '#FFFBEB', text: '#92400E' },
  { bg: '#FFF1F2', text: '#9F1239' },
  { bg: '#F0FDF4', text: '#166534' },
];

function getAvatarStyle(name: string = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getSkillIcon(skill: string = ''): string {
  const s = skill.toLowerCase();
  if (s.includes('mason') || s.includes('mistri') || s.includes('raj')) return 'construct';
  if (s.includes('paint')) return 'color-palette';
  if (s.includes('carpent') || s.includes('wood')) return 'cut';
  if (s.includes('electr') || s.includes('bijli')) return 'flash';
  if (s.includes('plumb') || s.includes('pipe')) return 'water';
  if (s.includes('weld') || s.includes('loha') || s.includes('steel')) return 'hammer';
  if (s.includes('supervis') || s.includes('thekadar')) return 'briefcase';
  if (s.includes('help') || s.includes('mazdoor') || s.includes('labour')) return 'people';
  return 'person';
}

function getInitials(name: string = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'W';
}

function formatDateSafely(dateVal: any) {
  if (!dateVal) return { day: '--', month: '', full: '' };
  const str = String(dateVal);
  try {
    const d = new Date(str.length === 10 ? str + 'T00:00:00' : str);
    if (isNaN(d.getTime())) return { day: str.slice(-2) || '--', month: '', full: str };
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      full: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  } catch {
    return { day: str.slice(-2) || '--', month: '', full: str };
  }
}

export function WorkerDetailPage({
  worker,
  data,
  onBack,
  onOpenPaymentModal,
  onOpenWorkerModal,
}: WorkerDetailPageProps) {
  const [activeTab, setActiveTab] = useState<PageTab>('OVERVIEW');
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const avatarTheme = getAvatarStyle(worker.name);

  const summary = useMemo(
    () => workerSummary(worker, data.attendance, data.entries),
    [worker, data.attendance, data.entries]
  );

  const isPending = summary.balance > 0;
  const isAdvance = summary.balance < 0;

  const workerAttendance = useMemo(
    () =>
      data.attendance
        .filter((a) => a.worker_id === worker.id)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [data.attendance, worker.id]
  );

  const totalUnits = useMemo(
    () => workerAttendance.reduce((s, a) => s + Number(a.units || 0), 0),
    [workerAttendance]
  );
  const fullDays = useMemo(
    () => workerAttendance.filter((a) => Number(a.units) === 1).length,
    [workerAttendance]
  );
  const halfDays = useMemo(
    () => workerAttendance.filter((a) => Number(a.units) === 0.5).length,
    [workerAttendance]
  );
  const totalOtMinutes = useMemo(
    () => workerAttendance.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0),
    [workerAttendance]
  );

  const totalOtHours = (totalOtMinutes / 60).toFixed(1).replace(/\.0$/, '');
  const otEarnings = useMemo(() => {
    const otRate = Number(worker.overtime_rate || 0);
    return Math.round((totalOtMinutes * otRate) / 60);
  }, [totalOtMinutes, worker.overtime_rate]);

  const avgDayEarning =
    totalUnits > 0
      ? Math.round(summary.earned / totalUnits)
      : Number(worker.daily_rate || 0);

  const sitesBreakdown = useMemo(() => {
    const map = new Map<string, { siteName: string; days: number; earned: number }>();
    for (const a of workerAttendance) {
      const site = data.sites.find((s) => s.id === a.site_id);
      const siteName = site?.name || 'Assigned Site';
      const cur = map.get(a.site_id) || { siteName, days: 0, earned: 0 };
      cur.days += Number(a.units || 0);
      cur.earned += Number(a.amount || 0);
      map.set(a.site_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.days - a.days);
  }, [workerAttendance, data.sites]);

  const workerPayments = useMemo(
    () =>
      data.entries
        .filter((e) => e.worker_id === worker.id && e.kind === 'WAGE_PAYMENT' && !e.voided_at)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [data.entries, worker.id]
  );

  const handleCall = () => {
    if (worker?.phone) {
      const cleaned = worker.phone.replace(/[^0-9+]/g, '');
      if (cleaned) Linking.openURL(	el:).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.pageRoot} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
          ]}
          accessibilityLabel="Go back to Labour list"
        >
          <AppIcon name="arrow-back" size={20} color="#0F2851" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Worker Profile
        </Text>
        <Pressable
          onPress={() => onOpenWorkerModal(worker)}
          style={({ pressed }) => [styles.editTopBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Edit worker profile"
        >
          <AppIcon name="create-outline" size={16} color="#0F2851" />
          <Text style={styles.editTopBtnText}>Edit</Text>
        </Pressable>
      </View>

      <View style={[styles.heroCard, isDesktop && styles.heroCardDesktop]}>
        <View style={styles.heroProfileRow}>
          <View style={[styles.avatarLarge, { backgroundColor: avatarTheme.bg }]}>
            <Text style={[styles.avatarLargeText, { color: avatarTheme.text }]}>
              {getInitials(worker.name)}
            </Text>
            <View
              style={[
                styles.activeRing,
                { backgroundColor: worker.active ? '#16A34A' : '#94A3B8' },
              ]}
            />
          </View>
          <View style={styles.heroTextCol}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroWorkerName} numberOfLines={1}>
                {worker.name}
              </Text>
              {!worker.active ? <Badge label="INACTIVE" tone="gray" /> : null}
            </View>
            <View style={styles.heroDesignationRow}>
              <View style={styles.skillBadge}>
                <AppIcon name={getSkillIcon(worker.skill) as any} size={12} color="#1E40AF" />
                <Text style={styles.skillBadgeText}>
                  {worker.skill || 'General Labour'}
                </Text>
              </View>
              <Text style={styles.rateText}>
                {money(worker.daily_rate)}/day
                {worker.overtime_rate ?  + OT /hr : ''}
              </Text>
            </View>
            {worker.phone ? (
              <Pressable onPress={handleCall} style={styles.phoneRow}>
                <AppIcon name="call" size={12} color="#16A34A" />
                <Text style={styles.phoneText}>{worker.phone}</Text>
                <View style={styles.callPill}>
                  <Text style={styles.callPillText}>Tap to Call</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.balanceStrip,
            isPending
              ? styles.balanceStripPending
              : isAdvance
              ? styles.balanceStripAdvance
              : styles.balanceStripSettled,
          ]}
        >
          <View>
            <Text style={styles.balanceStripLabel}>
              {isPending
                ? 'Unpaid Balance (bkaya)'
                : isAdvance
                ? 'Advance Given (peshgi)'
                : 'Account Clear (chukta)'}
            </Text>
            <Text
              style={[
                styles.balanceStripValue,
                {
                  color: isPending ? '#B45309' : isAdvance ? '#1D4ED8' : '#15803D',
                },
              ]}
            >
              {isPending
                ? ${money(summary.balance)} Due
                : isAdvance
                ? ${money(-summary.balance)} Advance
                : 'Rs.0 Settled'}
            </Text>
          </View>
          <Pressable
            onPress={() => onOpenPaymentModal(worker.id)}
            style={({ pressed }) => [
              styles.payNowBtn,
              isPending ? styles.payNowBtnPending : styles.payNowBtnDefault,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
          >
            <AppIcon
              name="wallet-outline"
              size={14}
              color={isPending ? '#FFFFFF' : '#0F2851'}
            />
            <Text
              style={[
                styles.payNowBtnText,
                isPending ? { color: '#FFFFFF' } : { color: '#0F2851' },
              ]}
            >
              {isPending ? 'Pay Wages' : 'Give Advance'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(
          [
            { key: 'OVERVIEW' as PageTab, icon: 'bar-chart-outline', label: 'Performance' },
            { key: 'ATTENDANCE' as PageTab, icon: 'calendar-outline', label: Haziri () },
            { key: 'PAYMENTS' as PageTab, icon: 'wallet-outline', label: Payments () },
          ]
        ).map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
          >
            <AppIcon
              name={t.icon as any}
              size={14}
              color={activeTab === t.key ? '#0F2851' : '#64748B'}
            />
            <Text style={[styles.tabItemText, activeTab === t.key && styles.tabItemTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isDesktop && styles.bodyContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'OVERVIEW' ? (
          <>
            <View style={styles.perfGrid}>
              {[
                { bg: '#EFF6FF', icon: 'calendar', iconColor: '#2563EB', value: ${totalUnits}, unit: 'Days', label: 'Total Haziri', foot: ${fullDays} Full +  Half },
                { bg: '#FFFBEB', icon: 'time', iconColor: '#D97706', value: ${totalOtHours}, unit: 'Hrs OT', label: 'Overtime', foot: ${money(otEarnings)} OT earned },
                { bg: '#F0FDF4', icon: 'business', iconColor: '#059669', value: ${sitesBreakdown.length}, unit: 'Sites', label: 'Sites Worked', foot: 'Active contributor' },
                { bg: '#F5F3FF', icon: 'trending-up', iconColor: '#7C3AED', value: money(avgDayEarning), unit: '', label: 'Avg Day Rate', foot: 'Incl. overtime' },
              ].map((card, i) => (
                <View key={i} style={styles.perfCard}>
                  <View style={[styles.perfIconBox, { backgroundColor: card.bg }]}>
                    <AppIcon name={card.icon as any} size={18} color={card.iconColor} />
                  </View>
                  <Text style={styles.perfCardValue}>
                    {card.value}
                    {card.unit ? <Text style={styles.perfCardUnit}> {card.unit}</Text> : null}
                  </Text>
                  <Text style={styles.perfCardLabel}>{card.label}</Text>
                  <Text style={styles.perfCardFoot}>{card.foot}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Financial Summary</Text>
              <View style={styles.finRow}>
                <View style={styles.finCol}>
                  <Text style={styles.finColLabel}>Total Earned</Text>
                  <Text style={[styles.finColValue, { color: '#0F2851' }]}>{money(summary.earned)}</Text>
                </View>
                <View style={styles.finDivider} />
                <View style={styles.finCol}>
                  <Text style={styles.finColLabel}>Total Paid</Text>
                  <Text style={[styles.finColValue, { color: '#15803D' }]}>{money(summary.paid)}</Text>
                </View>
                <View style={styles.finDivider} />
                <View style={styles.finCol}>
                  <Text style={styles.finColLabel}>{isPending ? 'Due' : isAdvance ? 'Advance' : 'Balance'}</Text>
                  <Text style={[styles.finColValue, { color: isPending ? '#B45309' : isAdvance ? '#1D4ED8' : '#15803D' }]}>
                    {isPending ? money(summary.balance) : isAdvance ? money(-summary.balance) : 'Rs.0'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Site Contributions</Text>
              {sitesBreakdown.length > 0 ? (
                sitesBreakdown.map((s, idx) => (
                  <View key={s.siteName + idx} style={[styles.siteRow, idx < sitesBreakdown.length - 1 && styles.siteRowBorder]}>
                    <View style={styles.siteIconBox}>
                      <AppIcon name="business" size={16} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.siteRowName} numberOfLines={1}>{s.siteName}</Text>
                      <Text style={styles.siteRowDays}>{s.days} Days Worked</Text>
                    </View>
                    <Text style={styles.siteRowEarned}>{money(s.earned)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <AppIcon name="business-outline" size={24} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No site attendance recorded yet.</Text>
                </View>
              )}
            </View>
          </>
        ) : null}

        {activeTab === 'ATTENDANCE' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Haziri Log</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{workerAttendance.length} Entries</Text>
              </View>
            </View>
            {workerAttendance.length > 0 ? (
              workerAttendance.map((a) => {
                const site = data.sites.find((s) => s.id === a.site_id);
                const isFull = Number(a.units) === 1;
                const hasOt = Number(a.overtime_minutes || 0) > 0;
                const otHoursStr = (Number(a.overtime_minutes || 0) / 60).toFixed(1).replace(/\.0$/, '');
                const dateInfo = formatDateSafely(a.date);
                return (
                  <View key={a.id} style={styles.logCard}>
                    <View style={styles.logDateBox}>
                      <Text style={styles.logDateDay}>{dateInfo.day}</Text>
                      <Text style={styles.logDateMonth}>{dateInfo.month}</Text>
                    </View>
                    <View style={styles.logMetaCol}>
                      <Text style={styles.logSiteTitle} numberOfLines={1}>{site?.name || 'Project Site'}</Text>
                      <View style={styles.logBadgeRow}>
                        <View style={[styles.shiftBadge, isFull ? styles.shiftBadgeFull : styles.shiftBadgeHalf]}>
                          <Text style={[styles.shiftBadgeText, isFull ? styles.shiftBadgeTextFull : styles.shiftBadgeTextHalf]}>
                            {isFull ? '1.0 Full Day' : '0.5 Half Day'}
                          </Text>
                        </View>
                        {hasOt ? (
                          <View style={styles.otBadge}>
                            <AppIcon name="time" size={10} color="#D97706" />
                            <Text style={styles.otBadgeText}>+{otHoursStr}h OT</Text>
                          </View>
                        ) : null}
                      </View>
                      {a.notes ? <Text style={styles.logNotesText}>Note: {a.notes}</Text> : null}
                    </View>
                    <View style={styles.logAmountCol}>
                      <Text style={styles.logAmountText}>{money(a.amount)}</Text>
                      <Text style={styles.logAmountLabel}>Earned</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyBox}>
                <AppIcon name="calendar-outline" size={24} color="#CBD5E1" />
                <Text style={styles.emptyText}>No attendance records found.</Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'PAYMENTS' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Payment Ledger</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{workerPayments.length} Records</Text>
              </View>
            </View>
            {workerPayments.length > 0 ? (
              workerPayments.map((p) => {
                const dateInfo = formatDateSafely(p.date);
                const modeIcon = p.mode === 'UPI' ? 'qr-code' : p.mode === 'BANK' ? 'business' : 'cash';
                return (
                  <View key={p.id} style={styles.logCard}>
                    <View style={styles.payModeBox}>
                      <AppIcon name={modeIcon as any} size={18} color="#15803D" />
                    </View>
                    <View style={styles.logMetaCol}>
                      <Text style={styles.logSiteTitle} numberOfLines={1}>{p.description || 'Labour Wage Payment'}</Text>
                      <Text style={styles.paymentMetaText}>
                        {dateInfo.full}{p.mode ?  +  : ''}{p.reference ?  + Ref:  : ''}
                      </Text>
                    </View>
                    <View style={styles.logAmountCol}>
                      <Text style={styles.payAmountText}>{money(p.amount)}</Text>
                      <Text style={styles.logAmountLabel}>Paid Out</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyBox}>
                <AppIcon name="wallet-outline" size={24} color="#CBD5E1" />
                <Text style={styles.emptyText}>No payments recorded yet.</Text>
                <Pressable
                  onPress={() => onOpenPaymentModal(worker.id)}
                  style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.8 }]}
                >
                  <AppIcon name="add" size={14} color="#FFFFFF" />
                  <Text style={styles.emptyActionBtnText}>Record First Payment</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageRoot: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  editTopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  editTopBtnText: { fontSize: 13, fontWeight: '700', color: '#0F2851' },
  heroCard: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 14 },
  heroCardDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  heroProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarLarge: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: 1.5, borderColor: '#E2E8F0' },
  avatarLargeText: { fontSize: 22, fontWeight: '800' },
  activeRing: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF' },
  heroTextCol: { flex: 1, gap: 4 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroWorkerName: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  heroDesignationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  skillBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  skillBadgeText: { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  rateText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  phoneText: { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  callPill: { backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#BBF7D0' },
  callPillText: { fontSize: 11, fontWeight: '800', color: '#15803D' },
  balanceStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  balanceStripPending: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  balanceStripAdvance: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  balanceStripSettled: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  balanceStripLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  balanceStripValue: { fontSize: 17, fontWeight: '800' },
  payNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, borderWidth: 1 },
  payNowBtnPending: { backgroundColor: '#D97706', borderColor: '#D97706' },
  payNowBtnDefault: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  payNowBtnText: { fontSize: 13, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 8 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#0F2851' },
  tabItemText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabItemTextActive: { fontWeight: '800', color: '#0F2851' },
  body: { flex: 1, backgroundColor: '#F8FAFC' },
  bodyContent: { padding: 16, gap: 14 },
  bodyContentDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  perfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  perfCard: { flex: 1, minWidth: '46%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  perfIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  perfCardValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  perfCardUnit: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  perfCardLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  perfCardFoot: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', letterSpacing: -0.1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countPill: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  countPillText: { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  finRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  finCol: { flex: 1, alignItems: 'center' },
  finColLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  finColValue: { fontSize: 15, fontWeight: '800' },
  finDivider: { width: 1, height: 28, backgroundColor: '#E2E8F0' },
  siteIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  siteRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  siteRowName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  siteRowDays: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 1 },
  siteRowEarned: { fontSize: 14, fontWeight: '800', color: '#0F2851' },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logDateBox: { width: 42, height: 48, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  logDateDay: { fontSize: 17, fontWeight: '800', color: '#1E40AF' },
  logDateMonth: { fontSize: 10, fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase' },
  logMetaCol: { flex: 1, gap: 4 },
  logSiteTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  logBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  shiftBadgeFull: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  shiftBadgeHalf: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  shiftBadgeText: { fontSize: 10, fontWeight: '700' },
  shiftBadgeTextFull: { color: '#15803D' },
  shiftBadgeTextHalf: { color: '#B45309' },
  otBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: '#FDE68A' },
  otBadgeText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  logNotesText: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
  logAmountCol: { alignItems: 'flex-end' },
  logAmountText: { fontSize: 14, fontWeight: '800', color: '#0F2851' },
  logAmountLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 1 },
  payModeBox: { width: 42, height: 48, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center' },
  paymentMetaText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  payAmountText: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '500', textAlign: 'center' },
  emptyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#15803D', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  emptyActionBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
