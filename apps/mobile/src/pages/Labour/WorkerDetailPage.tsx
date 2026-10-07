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
import { useLanguage } from '../../i18n';

export interface WorkerDetailPageProps {
  worker: Row;
  data: Snapshot;
  onBack: () => void;
  onOpenPaymentModal: (workerId: string) => void;
  onOpenWorkerModal: (worker: Row) => void;
}

type PageTab = 'OVERVIEW' | 'ATTENDANCE' | 'PAYMENTS';

const AVATAR_PALETTES = [
  { bg: '#1E40AF', text: '#FFFFFF' },
  { bg: '#065F46', text: '#FFFFFF' },
  { bg: '#5B21B6', text: '#FFFFFF' },
  { bg: '#92400E', text: '#FFFFFF' },
  { bg: '#9F1239', text: '#FFFFFF' },
  { bg: '#166534', text: '#FFFFFF' },
  { bg: '#0F2851', text: '#FFFFFF' },
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

function formatDateSafely(dateVal: any, lang: string = 'en') {
  if (!dateVal) return { day: '--', month: '', full: '', weekday: '' };
  const str = String(dateVal);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  try {
    const d = new Date(str.length === 10 ? str + 'T00:00:00' : str);
    if (isNaN(d.getTime())) return { day: str.slice(-2) || '--', month: '', full: str, weekday: '' };
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: d.toLocaleDateString(locale, { month: 'short' }),
      full: d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
      weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
    };
  } catch {
    return { day: str.slice(-2) || '--', month: '', full: str, weekday: '' };
  }
}

export function WorkerDetailPage({
  worker,
  data,
  onBack,
  onOpenPaymentModal,
  onOpenWorkerModal,
}: WorkerDetailPageProps) {
  const { t, lang } = useLanguage();
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
    totalUnits > 0 ? Math.round(summary.earned / totalUnits) : Number(worker.daily_rate || 0);

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
      if (cleaned) Linking.openURL(`tel:${cleaned}`).catch(() => {});
    }
  };

  const TABS = [
    { key: 'OVERVIEW' as PageTab, icon: 'bar-chart', label: t('overview', 'Overview') },
    { key: 'ATTENDANCE' as PageTab, icon: 'calendar', label: t('tabHaziriCount', 'Haziri ({count})').replace('{count}', String(workerAttendance.length)) },
    { key: 'PAYMENTS' as PageTab, icon: 'wallet', label: t('tabPaymentsCount', 'Payments ({count})').replace('{count}', String(workerPayments.length)) },
  ];

  const balanceColor = isPending ? '#D97706' : isAdvance ? '#2563EB' : '#16A34A';
  const balanceBg = isPending ? '#FFFBEB' : isAdvance ? '#EFF6FF' : '#F0FDF4';
  const balanceBorder = isPending ? '#FDE68A' : isAdvance ? '#BFDBFE' : '#BBF7D0';

  return (
    <SafeAreaView style={styles.pageRoot} edges={['top', 'bottom']}>
      <View style={styles.topBarWrapper}>
        <View style={[styles.topBar, isDesktop && styles.topBarDesktop]}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
            accessibilityLabel="Go back"
          >
            <AppIcon name="arrow-back" size={18} color="#0F2851" />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>{t('workerProfile', 'Worker Profile')}</Text>
          <Pressable
            onPress={() => onOpenWorkerModal(worker)}
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.75 }]}
            accessibilityLabel="Edit worker"
          >
            <AppIcon name="create-outline" size={15} color="#0F2851" />
            <Text style={styles.editBtnText}>{t('edit', 'Edit')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.heroWrapper}>
        <View style={[styles.heroCard, isDesktop && styles.heroCardDesktop]}>
          <View style={styles.heroTop}>
            <View style={[styles.avatar, { backgroundColor: avatarTheme.bg }]}>
              <Text style={[styles.avatarText, { color: avatarTheme.text }]}>
                {getInitials(worker.name)}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: worker.active ? '#22C55E' : '#94A3B8' }]} />
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1}>{worker.name}</Text>
                {!worker.active && <Badge label={t('inactive', 'INACTIVE')} tone="gray" />}
              </View>
              <View style={styles.heroBadgeRow}>
                <View style={styles.skillChip}>
                  <AppIcon name={getSkillIcon(worker.skill) as any} size={11} color="#1E40AF" />
                  <Text style={styles.skillChipText}>{worker.skill || 'General Labour'}</Text>
                </View>
                <Text style={styles.rateChip}>{money(worker.daily_rate)}/{t('daily', 'day')}</Text>
                {worker.overtime_rate ? (
                  <Text style={styles.otChip}>OT: {money(worker.overtime_rate)}/hr</Text>
                ) : null}
              </View>
              {worker.phone ? (
                <Pressable onPress={handleCall} style={({ pressed }) => [styles.phoneRow, pressed && { opacity: 0.75 }]}>
                  <AppIcon name="call" size={12} color="#16A34A" />
                  <Text style={styles.phoneText}>{worker.phone}</Text>
                  <View style={styles.callBadge}><Text style={styles.callBadgeText}>{t('call', 'Call')}</Text></View>
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={[styles.balanceRow, { backgroundColor: balanceBg, borderColor: balanceBorder }]}>
            <View style={styles.balanceLeft}>
              <View style={[styles.balanceDot, { backgroundColor: balanceColor }]} />
              <View>
                <Text style={styles.balanceLabel}>
                  {isPending ? t('unpaidBalance', 'Unpaid Balance') : isAdvance ? t('advanceGiven', 'Advance Given') : t('accountSettled', 'Account Settled')}
                </Text>
                <Text style={[styles.balanceAmount, { color: balanceColor }]}>
                  {isPending ? `${money(summary.balance)} ${t('due', 'Due')}` : isAdvance ? `${money(-summary.balance)} ${t('advance', 'Advance')}` : t('settled', 'Settled')}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => onOpenPaymentModal(worker.id)}
              style={({ pressed }) => [
                styles.payBtn,
                isPending ? styles.payBtnPrimary : styles.payBtnSecondary,
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
            >
              <AppIcon name="wallet" size={14} color={isPending ? '#FFF' : '#0F2851'} />
              <Text style={[styles.payBtnText, { color: isPending ? '#FFF' : '#0F2851' }]}>
                {isPending ? t('payNow', 'Pay Now') : t('advance', 'Advance')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabItem,
                  isActive && styles.tabItemActive,
                ]}
              >
                <AppIcon name={tab.icon as any} size={14} color={isActive ? '#0F2851' : '#94A3B8'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isDesktop && styles.bodyContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'OVERVIEW' ? (
          <>
            <View style={styles.statsGrid}>
              {[
                { bg: '#EFF6FF', iconBg: '#DBEAFE', icon: 'calendar', iconColor: '#2563EB', value: `${totalUnits}`, unit: t('days', 'Days'), label: t('totalHaziri', 'Total Haziri'), sub: t('fullAndHalfDays', '{full} Full + {half} Half').replace('{full}', String(fullDays)).replace('{half}', String(halfDays)) },
                { bg: '#FFFBEB', iconBg: '#FDE68A', icon: 'time', iconColor: '#D97706', value: totalOtHours || '0', unit: t('hrsOt', 'Hrs OT'), label: t('overtime', 'Overtime'), sub: t('earnedSub', '{amount} earned').replace('{amount}', money(otEarnings)) },
                { bg: '#F0FDF4', iconBg: '#BBF7D0', icon: 'business', iconColor: '#16A34A', value: `${sitesBreakdown.length}`, unit: t('navSites', 'Sites'), label: t('sitesWorked', 'Sites Worked'), sub: t('contributed', 'Contributed') },
                { bg: '#F5F3FF', iconBg: '#DDD6FE', icon: 'trending-up', iconColor: '#7C3AED', value: money(avgDayEarning), unit: '', label: t('avgDayRate', 'Avg Day Rate'), sub: t('inclOt', 'incl. OT') },
              ].map((card, i) => (
                <View key={i} style={[styles.statCard, { backgroundColor: card.bg }]}>
                  <View style={[styles.statIconBox, { backgroundColor: card.iconBg }]}>
                    <AppIcon name={card.icon as any} size={16} color={card.iconColor} />
                  </View>
                  <Text style={styles.statValue}>
                    {card.value}
                    {card.unit ? <Text style={styles.statUnit}> {card.unit}</Text> : null}
                  </Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                  <Text style={styles.statSub}>{card.sub}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}><AppIcon name="cash" size={14} color="#0F2851" /></View>
                <Text style={styles.cardTitle}>{t('financialSummary', 'Financial Summary')}</Text>
              </View>
              <View style={styles.finGrid}>
                {[
                  { label: t('totalEarned', 'Total Earned'), value: money(summary.earned), color: '#0F2851' },
                  { label: t('totalPaid', 'Total Paid'), value: money(summary.paid), color: '#16A34A' },
                  { label: isPending ? t('balanceDue', 'Balance Due') : isAdvance ? t('advance', 'Advance') : t('balance', 'Balance'), value: isPending ? money(summary.balance) : isAdvance ? money(-summary.balance) : '₹0', color: balanceColor },
                ].map((item, i, arr) => (
                  <React.Fragment key={item.label}>
                    <View style={styles.finItem}>
                      <Text style={styles.finLabel}>{item.label}</Text>
                      <Text style={[styles.finValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={styles.finDivider} />}
                  </React.Fragment>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}><AppIcon name="business" size={14} color="#0F2851" /></View>
                <Text style={styles.cardTitle}>{t('siteContributions', 'Site Contributions')}</Text>
                <View style={styles.countBadge}><Text style={styles.countBadgeText}>{sitesBreakdown.length}</Text></View>
              </View>
              {sitesBreakdown.length > 0 ? (
                sitesBreakdown.map((s, idx) => (
                  <View key={s.siteName + idx} style={[styles.siteRow, idx < sitesBreakdown.length - 1 && styles.siteRowBorder]}>
                    <View style={styles.siteIconWrap}><AppIcon name="location" size={15} color="#0284C7" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.siteName} numberOfLines={1}>{s.siteName}</Text>
                      <Text style={styles.siteDays}>{s.days} {t('daysWorked', 'days worked')}</Text>
                    </View>
                    <View style={styles.siteEarnedBox}><Text style={styles.siteEarned}>{money(s.earned)}</Text></View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <AppIcon name="business-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>{t('noSitesYet', 'No Sites Yet')}</Text>
                  <Text style={styles.emptyDesc}>{t('noSitesYetDesc', 'Attendance records will appear here.')}</Text>
                </View>
              )}
            </View>
          </>
        ) : null}

        {activeTab === 'ATTENDANCE' ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}><AppIcon name="calendar" size={14} color="#0F2851" /></View>
              <Text style={styles.cardTitle}>{t('haziriLog', 'Haziri Log')}</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{workerAttendance.length}</Text></View>
            </View>
            {workerAttendance.length > 0 ? (
              workerAttendance.map((a, idx) => {
                const site = data.sites.find((s) => s.id === a.site_id);
                const isFull = Number(a.units) === 1;
                const hasOt = Number(a.overtime_minutes || 0) > 0;
                const otHoursStr = (Number(a.overtime_minutes || 0) / 60).toFixed(1).replace(/\.0$/, '');
                const dateInfo = formatDateSafely(a.date, lang);
                return (
                  <View key={a.id} style={[styles.logRow, idx < workerAttendance.length - 1 && styles.logRowBorder]}>
                    <View style={styles.dateBox}>
                      <Text style={styles.dateDay}>{dateInfo.day}</Text>
                      <Text style={styles.dateMonth}>{dateInfo.month}</Text>
                    </View>
                    <View style={styles.logMeta}>
                      <Text style={styles.logSite} numberOfLines={1}>{site?.name || t('workSite', 'Project Site')}</Text>
                      <View style={styles.logBadges}>
                        <View style={[styles.shiftBadge, isFull ? styles.shiftFull : styles.shiftHalf]}>
                          <Text style={[styles.shiftText, isFull ? styles.shiftTextFull : styles.shiftTextHalf]}>
                            {isFull ? t('present', 'Full Day') : t('halfDay', 'Half Day')}
                          </Text>
                        </View>
                        {hasOt ? (
                          <View style={styles.otBadge}>
                            <AppIcon name="time" size={10} color="#D97706" />
                            <Text style={styles.otText}>+{otHoursStr}h OT</Text>
                          </View>
                        ) : null}
                      </View>
                      {a.notes ? <Text style={styles.noteText} numberOfLines={1}>{a.notes}</Text> : null}
                    </View>
                    <View style={styles.logAmount}>
                      <Text style={styles.logAmountVal}>{money(a.amount)}</Text>
                      <Text style={styles.logAmountLabel}>{t('earnedLabel', 'Earned')}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <AppIcon name="calendar-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>{t('noAttendanceYet', 'No Attendance Yet')}</Text>
                <Text style={styles.emptyDesc}>{t('noAttendanceYetDesc', 'Mark daily attendance to see records here.')}</Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'PAYMENTS' ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}><AppIcon name="wallet" size={14} color="#0F2851" /></View>
              <Text style={styles.cardTitle}>{t('paymentLedger', 'Payment Ledger')}</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{workerPayments.length}</Text></View>
            </View>
            {workerPayments.length > 0 ? (
              workerPayments.map((p, idx) => {
                const dateInfo = formatDateSafely(p.date, lang);
                const modeIcon = p.mode === 'UPI' ? 'qr-code' : p.mode === 'BANK' ? 'business' : 'cash';
                const modeBg = p.mode === 'UPI' ? '#F5F3FF' : p.mode === 'BANK' ? '#EFF6FF' : '#F0FDF4';
                const modeColor = p.mode === 'UPI' ? '#7C3AED' : p.mode === 'BANK' ? '#1D4ED8' : '#16A34A';
                return (
                  <View key={p.id} style={[styles.logRow, idx < workerPayments.length - 1 && styles.logRowBorder]}>
                    <View style={[styles.modeBox, { backgroundColor: modeBg }]}>
                      <AppIcon name={modeIcon as any} size={17} color={modeColor} />
                    </View>
                    <View style={styles.logMeta}>
                      <Text style={styles.logSite} numberOfLines={1}>{p.description || t('labourWage', 'Wage Payment')}</Text>
                      <Text style={styles.payMeta}>
                        {dateInfo.full}{p.mode ? ` · ${p.mode}` : ''}{p.reference ? ` · ${t('ref', 'Ref')}: ${p.reference}` : ''}
                      </Text>
                    </View>
                    <View style={styles.logAmount}>
                      <Text style={styles.payAmountVal}>{money(p.amount)}</Text>
                      <Text style={styles.logAmountLabel}>{t('paidLabel', 'Paid')}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <AppIcon name="wallet-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>{t('noPaymentsYet', 'No Payments Yet')}</Text>
                <Text style={styles.emptyDesc}>{t('noPaymentsYetDesc', 'Record the first wage payment for this worker.')}</Text>
                <Pressable
                  onPress={() => onOpenPaymentModal(worker.id)}
                  style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
                >
                  <AppIcon name="add" size={14} color="#FFF" />
                  <Text style={styles.emptyBtnText}>{t('recordPayment', 'Record Payment')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  topBarWrapper: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', width: '100%' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  topBarDesktop: { maxWidth: 860, alignSelf: 'center', width: '100%' },
  backBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#0F2851' },
  heroWrapper: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', width: '100%' },
  heroCard: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 12 },
  heroCardDesktop: { maxWidth: 860, alignSelf: 'center', width: '100%' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  avatarText: { fontSize: 21, fontWeight: '900' },
  statusDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#FFFFFF' },
  heroInfo: { flex: 1, gap: 5 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroName: { fontSize: 19, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  skillChipText: { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  rateChip: { fontSize: 12, fontWeight: '700', color: '#475569' },
  otChip: { fontSize: 11, fontWeight: '600', color: '#D97706', backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: '#FDE68A' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  phoneText: { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  callBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#BBF7D0' },
  callBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1 },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  balanceDot: { width: 8, height: 8, borderRadius: 4 },
  balanceLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  balanceAmount: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, borderWidth: 1 },
  payBtnPrimary: { backgroundColor: '#D97706', borderColor: '#D97706' },
  payBtnSecondary: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  payBtnText: { fontSize: 13, fontWeight: '700' },
  tabBarWrapper: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', width: '100%', alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', maxWidth: 640, width: '100%', paddingHorizontal: 12 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#0F2851' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabLabelActive: { color: '#0F2851', fontWeight: '800' },
  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 12 },
  bodyContentDesktop: { maxWidth: 860, alignSelf: 'center', width: '100%' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '46%', borderRadius: 14, padding: 14, gap: 3 },
  statIconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  statUnit: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  statSub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cardHeaderIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  countBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#DBEAFE' },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: '#1E40AF' },
  finGrid: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 14 },
  finItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  finLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  finValue: { fontSize: 15, fontWeight: '900' },
  finDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  siteRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  siteIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  siteName: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  siteDays: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  siteEarnedBox: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: '#BBF7D0' },
  siteEarned: { fontSize: 13, fontWeight: '800', color: '#15803D' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dateBox: { width: 44, height: 50, borderRadius: 11, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: '900', color: '#1E40AF', lineHeight: 20 },
  dateMonth: { fontSize: 10, fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase' },
  modeBox: { width: 44, height: 50, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  logMeta: { flex: 1, gap: 4 },
  logSite: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  logBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftBadge: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 5, borderWidth: 1 },
  shiftFull: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  shiftHalf: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  shiftText: { fontSize: 10, fontWeight: '700' },
  shiftTextFull: { color: '#15803D' },
  shiftTextHalf: { color: '#B45309' },
  otBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 5, borderWidth: 1, borderColor: '#FDE68A' },
  otText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  noteText: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  payMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  logAmount: { alignItems: 'flex-end', gap: 2 },
  logAmountVal: { fontSize: 14, fontWeight: '900', color: '#0F2851' },
  logAmountLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  payAmountVal: { fontSize: 14, fontWeight: '900', color: '#16A34A' },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#334155' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#0F2851', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9 },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});