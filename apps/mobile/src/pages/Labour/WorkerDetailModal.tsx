import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Badge } from '../../components/common/Badge';
import { Row, Snapshot } from '../../types';
import { money, workerSummary } from '../../finance';

export interface WorkerDetailModalProps {
  worker: Row | null;
  data: Snapshot;
  visible: boolean;
  onClose: () => void;
  onOpenPaymentModal: (workerId: string) => void;
  onOpenWorkerModal: (worker: Row) => void;
}

type ModalTab = 'OVERVIEW' | 'ATTENDANCE' | 'PAYMENTS';

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'W';
}

function formatDateSafely(dateVal: any) {
  if (!dateVal) return { day: '--', month: '' };
  const str = String(dateVal);
  try {
    const d = new Date(str.length === 10 ? str + 'T00:00:00' : str);
    if (isNaN(d.getTime())) return { day: str.slice(-2) || '--', month: '' };
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
    };
  } catch {
    return { day: str.slice(-2) || '--', month: '' };
  }
}

export function WorkerDetailModal({
  worker,
  data,
  visible,
  onClose,
  onOpenPaymentModal,
  onOpenWorkerModal,
}: WorkerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('OVERVIEW');
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Compute financial summary
  const summary = useMemo(() => {
    if (!worker) return { earned: 0, paid: 0, balance: 0, attendanceCount: 0, paymentCount: 0 };
    return workerSummary(worker, data.attendance, data.entries);
  }, [worker, data.attendance, data.entries]);

  const isPending = summary.balance > 0;
  const isAdvance = summary.balance < 0;

  // Attendance analytics
  const workerAttendance = useMemo(() => {
    if (!worker) return [];
    return data.attendance
      .filter((a) => a.worker_id === worker.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [data.attendance, worker?.id]);

  const totalUnits = useMemo(() => {
    return workerAttendance.reduce((s, a) => s + Number(a.units || 0), 0);
  }, [workerAttendance]);

  const fullDays = useMemo(() => {
    return workerAttendance.filter((a) => Number(a.units) === 1).length;
  }, [workerAttendance]);

  const halfDays = useMemo(() => {
    return workerAttendance.filter((a) => Number(a.units) === 0.5).length;
  }, [workerAttendance]);

  const totalOtMinutes = useMemo(() => {
    return workerAttendance.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0);
  }, [workerAttendance]);

  const totalOtHours = (totalOtMinutes / 60).toFixed(1).replace(/\.0$/, '');

  const otEarnings = useMemo(() => {
    if (!worker) return 0;
    const otRate = Number(worker.overtime_rate || 0);
    return Math.round((totalOtMinutes * otRate) / 60);
  }, [totalOtMinutes, worker?.overtime_rate]);

  const avgDayEarning =
    totalUnits > 0
      ? Math.round(summary.earned / totalUnits)
      : Number(worker?.daily_rate || 0);

  // Site Contribution Breakdown
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

  // Payment History
  const workerPayments = useMemo(() => {
    if (!worker) return [];
    return data.entries
      .filter((e) => e.worker_id === worker.id && e.kind === 'WAGE_PAYMENT' && !e.voided_at)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [data.entries, worker?.id]);

  const handleCall = () => {
    if (worker?.phone) {
      const cleaned = worker.phone.replace(/[^0-9+]/g, '');
      if (cleaned) {
        Linking.openURL(`tel:${cleaned}`).catch(() => {});
      }
    }
  };

  if (!worker || !visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent={isDesktop}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <SafeAreaView
          style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}
          edges={['top', 'bottom']}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerProfileRow}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{getInitials(worker.name)}</Text>
                <View
                  style={[
                    styles.activeRing,
                    { backgroundColor: worker.active ? '#16A34A' : '#94A3B8' },
                  ]}
                />
              </View>

              <View style={styles.profileTextCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.workerName} numberOfLines={1}>
                    {worker.name}
                  </Text>
                  {!worker.active && <Badge label="INACTIVE" tone="gray" />}
                </View>

                <View style={styles.designationRow}>
                  <View style={styles.designationBadge}>
                    <AppIcon name={getSkillIcon(worker.skill)} size={12} color="#1E40AF" />
                    <Text style={styles.designationBadgeText}>
                      {worker.skill || 'General Labour'}
                    </Text>
                  </View>
                  <Text style={styles.rateBadgeText}>
                    {money(worker.daily_rate)}/day
                    {worker.overtime_rate ? ` • OT ${money(worker.overtime_rate)}/hr` : ''}
                  </Text>
                </View>

                {worker.phone ? (
                  <Pressable onPress={handleCall} style={styles.phoneRow}>
                    <AppIcon name="call" size={12} color="#16A34A" />
                    <Text style={styles.phoneText}>{worker.phone}</Text>
                    <View style={styles.callPill}>
                      <Text style={styles.callPillText}>Call</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
              ]}
              accessibilityLabel="Close worker details"
            >
              <AppIcon name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          {/* Navigation Segment Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab('OVERVIEW')}
              style={[styles.tabItem, activeTab === 'OVERVIEW' && styles.tabItemActive]}
            >
              <AppIcon
                name="bar-chart-outline"
                size={14}
                color={activeTab === 'OVERVIEW' ? '#0F2851' : '#64748B'}
              />
              <Text
                style={[styles.tabItemText, activeTab === 'OVERVIEW' && styles.tabItemTextActive]}
              >
                Performance
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('ATTENDANCE')}
              style={[styles.tabItem, activeTab === 'ATTENDANCE' && styles.tabItemActive]}
            >
              <AppIcon
                name="calendar-outline"
                size={14}
                color={activeTab === 'ATTENDANCE' ? '#0F2851' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'ATTENDANCE' && styles.tabItemTextActive,
                ]}
              >
                Haziri ({workerAttendance.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('PAYMENTS')}
              style={[styles.tabItem, activeTab === 'PAYMENTS' && styles.tabItemActive]}
            >
              <AppIcon
                name="wallet-outline"
                size={14}
                color={activeTab === 'PAYMENTS' ? '#0F2851' : '#64748B'}
              />
              <Text
                style={[styles.tabItemText, activeTab === 'PAYMENTS' && styles.tabItemTextActive]}
              >
                Payments ({workerPayments.length})
              </Text>
            </Pressable>
          </View>

          {/* Modal Scroll Content */}
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'OVERVIEW' && (
              <>
                {/* Hero Balance Card */}
                <View
                  style={[
                    styles.balanceCard,
                    isPending
                      ? styles.balanceCardPending
                      : isAdvance
                      ? styles.balanceCardAdvance
                      : styles.balanceCardSettled,
                  ]}
                >
                  <View style={styles.balanceHeaderRow}>
                    <View style={styles.balanceStatusGroup}>
                      <Text style={styles.balanceCardLabel}>
                        {isPending
                          ? 'Unpaid Wage Balance'
                          : isAdvance
                          ? 'Advance Taken'
                          : 'Settled Balance'}
                      </Text>
                      <Text
                        style={[
                          styles.balanceCardValue,
                          {
                            color: isPending
                              ? '#B45309'
                              : isAdvance
                              ? '#1D4ED8'
                              : '#15803D',
                          },
                        ]}
                      >
                        {isPending
                          ? `${money(summary.balance)} Due`
                          : isAdvance
                          ? `${money(-summary.balance)} Advance`
                          : '₹0 Settled (Clear)'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => {
                        onClose();
                        onOpenPaymentModal(worker.id);
                      }}
                      style={({ pressed }) => [
                        styles.payCtaBtn,
                        isPending ? styles.payCtaBtnPending : styles.payCtaBtnDefault,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <AppIcon
                        name="wallet-outline"
                        size={15}
                        color={isPending ? '#FFFFFF' : '#0F2851'}
                      />
                      <Text
                        style={[
                          styles.payCtaBtnText,
                          isPending ? { color: '#FFFFFF' } : { color: '#0F2851' },
                        ]}
                      >
                        {isPending ? 'Pay Wages' : 'Give Advance'}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.balanceSubStatsRow}>
                    <View style={styles.balanceSubStat}>
                      <Text style={styles.subStatLabel}>Total Wages Earned</Text>
                      <Text style={styles.subStatVal}>{money(summary.earned)}</Text>
                    </View>
                    <View style={styles.subStatDivider} />
                    <View style={styles.balanceSubStat}>
                      <Text style={styles.subStatLabel}>Total Wages Paid</Text>
                      <Text style={styles.subStatVal}>{money(summary.paid)}</Text>
                    </View>
                  </View>
                </View>

                {/* Overall Attendance & Work Performance Grid */}
                <Text style={styles.sectionHeading}>Overall Work & Attendance</Text>
                <View style={styles.perfGrid}>
                  <View style={styles.perfItem}>
                    <View style={styles.perfIconBox}>
                      <AppIcon name="calendar" size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.perfItemLabel}>Total Haziri</Text>
                    <Text style={styles.perfItemValue}>
                      {totalUnits} <Text style={styles.perfItemUnit}>Days</Text>
                    </Text>
                    <Text style={styles.perfItemFoot}>
                      {fullDays} Full • {halfDays} Half
                    </Text>
                  </View>

                  <View style={styles.perfItem}>
                    <View style={styles.perfIconBox}>
                      <AppIcon name="time" size={16} color="#D97706" />
                    </View>
                    <Text style={styles.perfItemLabel}>Total Overtime</Text>
                    <Text style={styles.perfItemValue}>
                      {totalOtHours} <Text style={styles.perfItemUnit}>Hours</Text>
                    </Text>
                    <Text style={styles.perfItemFoot}>{money(otEarnings)} OT earned</Text>
                  </View>

                  <View style={styles.perfItem}>
                    <View style={styles.perfIconBox}>
                      <AppIcon name="business" size={16} color="#059669" />
                    </View>
                    <Text style={styles.perfItemLabel}>Sites Worked</Text>
                    <Text style={styles.perfItemValue}>
                      {sitesBreakdown.length} <Text style={styles.perfItemUnit}>Sites</Text>
                    </Text>
                    <Text style={styles.perfItemFoot}>Active contributor</Text>
                  </View>

                  <View style={styles.perfItem}>
                    <View style={styles.perfIconBox}>
                      <AppIcon name="trending-up" size={16} color="#7C3AED" />
                    </View>
                    <Text style={styles.perfItemLabel}>Avg. Day Rate</Text>
                    <Text style={styles.perfItemValue}>{money(avgDayEarning)}</Text>
                    <Text style={styles.perfItemFoot}>Incl. overtime</Text>
                  </View>
                </View>

                {/* Project Site Contributions */}
                <Text style={styles.sectionHeading}>Site Contributions</Text>
                {sitesBreakdown.length > 0 ? (
                  <View style={styles.siteListCard}>
                    {sitesBreakdown.map((s, idx) => (
                      <View
                        key={s.siteName + idx}
                        style={[
                          styles.siteRow,
                          idx === sitesBreakdown.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={styles.siteRowLeft}>
                          <AppIcon name="location-outline" size={16} color="#475569" />
                          <View>
                            <Text style={styles.siteRowName}>{s.siteName}</Text>
                            <Text style={styles.siteRowDays}>{s.days} Days Worked</Text>
                          </View>
                        </View>
                        <Text style={styles.siteRowEarned}>{money(s.earned)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyInlineBox}>
                    <Text style={styles.emptyInlineText}>No site attendance recorded yet.</Text>
                  </View>
                )}
              </>
            )}

            {activeTab === 'ATTENDANCE' && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Haziri Log ({workerAttendance.length} Entries)</Text>
                  <Text style={styles.sectionSubHeading}>Shift & Overtime Records</Text>
                </View>

                {workerAttendance.length > 0 ? (
                  <View style={styles.logList}>
                    {workerAttendance.map((a) => {
                      const site = data.sites.find((s) => s.id === a.site_id);
                      const isFull = Number(a.units) === 1;
                      const hasOt = Number(a.overtime_minutes || 0) > 0;
                      const otHoursStr = (Number(a.overtime_minutes || 0) / 60).toFixed(1).replace(/\.0$/, '');

                      const dateInfo = formatDateSafely(a.date);

                      return (
                        <View key={a.id} style={styles.logCard}>
                          <View style={styles.logCardLeft}>
                            <View style={styles.logDateBox}>
                              <Text style={styles.logDateDay}>{dateInfo.day}</Text>
                              <Text style={styles.logDateMonth}>{dateInfo.month}</Text>
                            </View>

                            <View style={styles.logMetaCol}>
                              <Text style={styles.logSiteTitle}>{site?.name || 'Project Site'}</Text>
                              <View style={styles.logBadgeRow}>
                                <View
                                  style={[
                                    styles.shiftBadge,
                                    isFull ? styles.shiftBadgeFull : styles.shiftBadgeHalf,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.shiftBadgeText,
                                      isFull ? styles.shiftBadgeTextFull : styles.shiftBadgeTextHalf,
                                    ]}
                                  >
                                    {isFull ? '1.0 Full Day' : '0.5 Half Day'}
                                  </Text>
                                </View>

                                {hasOt && (
                                  <View style={styles.otBadge}>
                                    <AppIcon name="time" size={10} color="#D97706" />
                                    <Text style={styles.otBadgeText}>+{otHoursStr}h OT</Text>
                                  </View>
                                )}
                              </View>
                              {a.notes ? (
                                <Text style={styles.logNotesText}>Note: {a.notes}</Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.logCardRight}>
                            <Text style={styles.logAmountText}>{money(a.amount)}</Text>
                            <Text style={styles.logAmountLabel}>Earned</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyInlineBox}>
                    <Text style={styles.emptyInlineText}>No attendance records found for this worker.</Text>
                  </View>
                )}
              </>
            )}

            {activeTab === 'PAYMENTS' && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Payment Ledger ({workerPayments.length} Payments)</Text>
                  <Text style={styles.sectionSubHeading}>Cash, UPI & Advance Settlements</Text>
                </View>

                {workerPayments.length > 0 ? (
                  <View style={styles.logList}>
                    {workerPayments.map((p) => (
                      <View key={p.id} style={styles.logCard}>
                        <View style={styles.logCardLeft}>
                          <View style={styles.paymentIconBox}>
                            <AppIcon
                              name={p.mode === 'UPI' ? 'qr-code' : p.mode === 'BANK' ? 'business' : 'cash'}
                              size={18}
                              color="#15803D"
                            />
                          </View>

                          <View style={styles.logMetaCol}>
                            <Text style={styles.logSiteTitle}>
                              {p.description || 'Labour Wage Payment'}
                            </Text>
                            <Text style={styles.paymentMetaDate}>
                              Date: {p.date} • Mode: {p.mode || 'CASH'}
                              {p.reference ? ` • Ref: ${p.reference}` : ''}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.logCardRight}>
                          <Text style={styles.paymentAmountText}>{money(p.amount)}</Text>
                          <Text style={styles.paymentAmountLabel}>Paid Out</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyInlineBox}>
                    <Text style={styles.emptyInlineText}>No payments recorded yet for this worker.</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Modal Action Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onClose();
                onOpenWorkerModal(worker);
              }}
              style={({ pressed }) => [
                styles.footerSecondaryBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <AppIcon name="create-outline" size={15} color="#334155" />
              <Text style={styles.footerSecondaryBtnText}>Edit Profile</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                onOpenPaymentModal(worker.id);
              }}
              style={({ pressed }) => [
                styles.footerPrimaryBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <AppIcon name="wallet-outline" size={15} color="#FFFFFF" />
              <Text style={styles.footerPrimaryBtnText}>
                {isPending ? 'Pay Balance' : 'Pay / Advance'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  modalCardDesktop: {
    maxWidth: 680,
    width: '100%',
    maxHeight: '92%',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLargeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E40AF',
  },
  activeRing: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileTextCol: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  designationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  designationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  designationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  rateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  callPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  callPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0F2851',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActive: {
    fontWeight: '800',
    color: '#0F2851',
  },
  modalBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalBodyContent: {
    padding: 16,
    gap: 16,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  balanceCardPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  balanceCardAdvance: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  balanceCardSettled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  balanceStatusGroup: {
    flex: 1,
    gap: 2,
  },
  balanceCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceCardValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  payCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payCtaBtnPending: {
    backgroundColor: '#0F2851',
  },
  payCtaBtnDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  payCtaBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  balanceSubStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  balanceSubStat: {
    flex: 1,
    gap: 2,
  },
  subStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  subStatVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  subStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeaderRow: {
    marginBottom: 4,
    gap: 2,
  },
  sectionSubHeading: {
    fontSize: 12,
    color: '#64748B',
  },
  perfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  perfItem: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  perfIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  perfItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  perfItemValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  perfItemUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  perfItemFoot: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  siteListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  siteRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  siteRowName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  siteRowDays: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  siteRowEarned: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  emptyInlineBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyInlineText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logList: {
    gap: 8,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logDateBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  logDateDay: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D4ED8',
    lineHeight: 18,
  },
  logDateMonth: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  logMetaCol: {
    flex: 1,
    gap: 2,
  },
  logSiteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  logBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  shiftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shiftBadgeFull: {
    backgroundColor: '#DCFCE7',
  },
  shiftBadgeHalf: {
    backgroundColor: '#FEF3C7',
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  shiftBadgeTextFull: {
    color: '#15803D',
  },
  shiftBadgeTextHalf: {
    color: '#B45309',
  },
  otBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  otBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  logNotesText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  logCardRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  logAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  logAmountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  paymentIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paymentMetaDate: {
    fontSize: 11,
    color: '#64748B',
  },
  paymentAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  paymentAmountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  footerSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  footerSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  footerPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#0F2851',
  },
  footerPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
