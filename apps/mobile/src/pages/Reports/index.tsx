import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar } from '../../components/common/TopNavBar';
import { SearchBar } from '../../components/common/SearchBar';
import { Snapshot } from '../../types';
import { money, siteSummary } from '../../finance';
import { useLanguage } from '../../i18n';

interface ReportsPageProps {
  data: Snapshot;
  onGenerateReport: (pdf: boolean, siteId?: string) => void;
  onOpenProfile?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

type ReportTab = 'sites' | 'costs' | 'audit';

export function ReportsPage({
  data,
  onGenerateReport,
  onOpenProfile,
  refreshing,
  onRefresh,
}: ReportsPageProps) {
  const { t, lang } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [activeTab, setActiveTab] = useState<ReportTab>('sites');
  const [searchQuery, setSearchQuery] = useState('');
  const [siteStatusFilter, setSiteStatusFilter] = useState<string>('ALL');

  // Compute Financial Aggregates
  const siteSummaries = useMemo(() => {
    return data.sites.map((site) => ({
      site,
      ...siteSummary(site, data.attendance, data.entries),
    }));
  }, [data.sites, data.attendance, data.entries]);

  const {
    totalContract,
    totalCost,
    totalLabour,
    totalMaterial,
    totalExpenses,
    totalOwnerBalance,
    totalSupplierBalance,
    totalLabourBalance,
    totalCashMovement,
    totalProfit,
  } = useMemo(() => {
    let contractSum = 0;
    let costSum = 0;
    let labourSum = 0;
    let materialSum = 0;
    let expenseSum = 0;
    let ownerBalSum = 0;
    let supplierBalSum = 0;
    let labourBalSum = 0;
    let cashSum = 0;
    let profitSum = 0;

    for (const s of siteSummaries) {
      contractSum += s.contract;
      costSum += s.cost;
      labourSum += s.labour;
      materialSum += s.material;
      expenseSum += s.expenses;
      ownerBalSum += Math.max(0, s.ownerBalance);
      supplierBalSum += Math.max(0, s.supplierBalance);
      labourBalSum += Math.max(0, s.labourBalance);
      cashSum += s.cash;
      profitSum += s.profit;
    }

    return {
      totalContract: contractSum,
      totalCost: costSum,
      totalLabour: labourSum,
      totalMaterial: materialSum,
      totalExpenses: expenseSum,
      totalOwnerBalance: ownerBalSum,
      totalSupplierBalance: supplierBalSum,
      totalLabourBalance: labourBalSum,
      totalCashMovement: cashSum,
      totalProfit: profitSum,
    };
  }, [siteSummaries]);

  // Filtered sites for Tab 1
  const filteredSites = useMemo(() => {
    return siteSummaries.filter((item) => {
      const matchesStatus =
        siteStatusFilter === 'ALL' || item.site.status === siteStatusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.site.name.toLowerCase().includes(q) ||
        item.site.owner_name.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [siteSummaries, siteStatusFilter, searchQuery]);

  // Cost percentages
  const labourPct = totalCost > 0 ? Math.round((totalLabour / totalCost) * 100) : 0;
  const materialPct = totalCost > 0 ? Math.round((totalMaterial / totalCost) * 100) : 0;
  const expensePct = totalCost > 0 ? Math.max(0, 100 - labourPct - materialPct) : 0;

  // Format audit action icon and human readable text
  const getAuditMeta = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('site.create')) {
      return { label: t('siteCreated', 'New Site Created'), icon: 'business', color: '#16A34A', bg: '#DCFCE7' };
    }
    if (act.includes('site.update')) {
      return { label: t('siteUpdated', 'Site Details Updated'), icon: 'create-outline', color: '#2563EB', bg: '#EFF6FF' };
    }
    if (act.includes('attendance')) {
      return { label: t('attendanceLogged', 'Daily Haziri Logged'), icon: 'people', color: '#2563EB', bg: '#EFF6FF' };
    }
    if (act.includes('entry') || act.includes('payment')) {
      return { label: t('paymentLogged', 'Payment / Entry Recorded'), icon: 'cash-outline', color: '#16A34A', bg: '#DCFCE7' };
    }
    if (act.includes('profile')) {
      return { label: t('profileUpdated', 'Profile Details Saved'), icon: 'person-outline', color: '#7C3AED', bg: '#F5F3FF' };
    }
    if (act.includes('void')) {
      return { label: t('entryVoided', 'Entry Voided'), icon: 'close-circle-outline', color: '#DC2626', bg: '#FEE2E2' };
    }
    return {
      label: action.replace('.', ' • ').toUpperCase(),
      icon: 'time-outline',
      color: '#475569',
      bg: '#F1F5F9',
    };
  };

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title={t('reportsTitle', 'Reports & Statements')}
        subtitle={t('reportsSubtitle', 'Business performance, site margins & audit history')}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
          {/* ========================================================= */}
          {/* 1. CLEAN FINANCIAL OVERVIEW HERO CARD */}
          {/* ========================================================= */}
          <View style={styles.heroCard}>
            {/* Header: Title & Profit */}
            <View style={styles.heroStatsRow}>
              <View style={styles.heroTurnoverCol}>
                <Text style={styles.heroTurnoverLabel}>
                  {t('totalContractValue', 'CONTRACTED VALUE')}
                </Text>
                <Text style={styles.heroTurnoverValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money(totalContract)}
                </Text>
              </View>

              <View style={styles.heroProfitCol}>
                <Text style={styles.heroProfitLabel}>{t('estimatedMargin', 'Est. Profit')}</Text>
                <Text
                  style={[
                    styles.heroProfitValue,
                    { color: totalProfit >= 0 ? '#15803D' : '#DC2626' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {money(totalProfit)}
                </Text>
              </View>
            </View>

            {/* 4 Core Financial KPI Badges */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiBox}>
                <View style={styles.kpiTopLine}>
                  <Text style={styles.kpiLabel}>{t('agreedContract', 'Contract')}</Text>
                  <AppIcon name="business" size={12} color="#2563EB" />
                </View>
                <Text style={styles.kpiValue} numberOfLines={1}>{money(totalContract)}</Text>
                <Text style={styles.kpiFoot}>{data.sites.length} {t('sitesTitle', 'Sites')}</Text>
              </View>

              <View style={styles.kpiBox}>
                <View style={styles.kpiTopLine}>
                  <Text style={styles.kpiLabel}>{t('recordedCosts', 'Direct Costs')}</Text>
                  <AppIcon name="calculator" size={12} color="#E11D48" />
                </View>
                <Text style={[styles.kpiValue, { color: '#BE123C' }]} numberOfLines={1}>{money(totalCost)}</Text>
                <Text style={styles.kpiFoot}>{t('labourMatExp', 'Labour+Mat+Exp')}</Text>
              </View>

              <View style={styles.kpiBox}>
                <View style={styles.kpiTopLine}>
                  <Text style={styles.kpiLabel}>{t('pendingDue', 'Client Dues')}</Text>
                  <AppIcon name="alert-circle" size={12} color="#D97706" />
                </View>
                <Text style={[styles.kpiValue, { color: '#B45309' }]} numberOfLines={1}>{money(totalOwnerBalance)}</Text>
                <Text style={styles.kpiFoot}>{t('pendingToCollect', 'To collect')}</Text>
              </View>

              <View style={styles.kpiBox}>
                <View style={styles.kpiTopLine}>
                  <Text style={styles.kpiLabel}>{t('netCashInHand', 'Net Cash')}</Text>
                  <AppIcon name="wallet" size={12} color="#16A34A" />
                </View>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: totalCashMovement >= 0 ? '#15803D' : '#DC2626' },
                  ]}
                  numberOfLines={1}
                >
                  {money(totalCashMovement)}
                </Text>
                <Text style={styles.kpiFoot}>{t('receivedMinusPayouts', 'Inflow − Outflow')}</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 2. COMPACT EXPORT TOOLBAR */}
          {/* ========================================================= */}
          <View style={styles.exportToolbar}>
            <Pressable
              onPress={() => onGenerateReport(true)}
              style={({ pressed }) => [
                styles.exportBtnPdf,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
            >
              <AppIcon name="document-text" size={14} color="#FFFFFF" />
              <Text style={styles.exportBtnTextPdf}>
                {Platform.OS === 'web' ? t('printPdf', 'Master PDF') : t('exportPdf', 'Master PDF')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onGenerateReport(false)}
              style={({ pressed }) => [
                styles.exportBtnShare,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
            >
              <AppIcon name="logo-whatsapp" size={14} color="#15803D" />
              <Text style={styles.exportBtnTextShare}>
                {Platform.OS === 'web' ? t('copyStatement', 'Copy Text') : t('shareWhatsapp', 'WhatsApp Share')}
              </Text>
            </Pressable>
          </View>

          {/* ========================================================= */}
          {/* 3. MOBILE-OPTIMIZED SEGMENT TABS */}
          {/* ========================================================= */}
          <View style={styles.segmentNavContainer}>
            <Pressable
              onPress={() => setActiveTab('sites')}
              style={[
                styles.segmentNavBtn,
                activeTab === 'sites' && styles.segmentNavBtnActive,
              ]}
            >
              <AppIcon
                name="business"
                size={13}
                color={activeTab === 'sites' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.segmentNavBtnText,
                  activeTab === 'sites' && styles.segmentNavBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {t('sitesTitle', 'Sites')} ({data.sites.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('costs')}
              style={[
                styles.segmentNavBtn,
                activeTab === 'costs' && styles.segmentNavBtnActive,
              ]}
            >
              <AppIcon
                name="pie-chart"
                size={13}
                color={activeTab === 'costs' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.segmentNavBtnText,
                  activeTab === 'costs' && styles.segmentNavBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {t('expenseFilter', 'Expenses')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('audit')}
              style={[
                styles.segmentNavBtn,
                activeTab === 'audit' && styles.segmentNavBtnActive,
              ]}
            >
              <AppIcon
                name="shield-checkmark"
                size={13}
                color={activeTab === 'audit' ? '#1D4ED8' : '#64748B'}
              />
              <Text
                style={[
                  styles.segmentNavBtnText,
                  activeTab === 'audit' && styles.segmentNavBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {t('activityTab', 'Activity')}
              </Text>
            </Pressable>
          </View>

          {/* ========================================================= */}
          {/* TAB 1: SITE PROFITABILITY & CARDS */}
          {/* ========================================================= */}
          {activeTab === 'sites' && (
            <View style={styles.tabContentBlock}>
              {/* Search & Status Filter */}
              <View style={styles.filterSection}>
                <SearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('searchSitePlaceholder', 'Search site or client name…')}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.statusFilterRow}
                >
                  <Pressable
                    onPress={() => setSiteStatusFilter('ALL')}
                    style={[
                      styles.filterPill,
                      siteStatusFilter === 'ALL' && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        siteStatusFilter === 'ALL' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('all', 'All')} ({siteSummaries.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSiteStatusFilter('ONGOING')}
                    style={[
                      styles.filterPill,
                      siteStatusFilter === 'ONGOING' && styles.filterPillActive,
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                    <Text
                      style={[
                        styles.filterPillText,
                        siteStatusFilter === 'ONGOING' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('active', 'Ongoing')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSiteStatusFilter('COMPLETED')}
                    style={[
                      styles.filterPill,
                      siteStatusFilter === 'COMPLETED' && styles.filterPillActive,
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: '#2563EB' }]} />
                    <Text
                      style={[
                        styles.filterPillText,
                        siteStatusFilter === 'COMPLETED' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('completed', 'Completed')}
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* Site Cards List */}
              <View style={styles.sitesCardList}>
                {filteredSites.map((f) => (
                  <View key={f.site.id} style={styles.siteReportCard}>
                    {/* Card Header */}
                    <View style={styles.siteCardHeader}>
                      <View style={styles.siteCardHeaderLeft}>
                        <View style={styles.siteIconBox}>
                          <AppIcon name="business" size={14} color="#1D4ED8" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.siteCardTitle} numberOfLines={1}>
                            {f.site.name}
                          </Text>
                          <Text style={styles.siteCardSub} numberOfLines={1}>
                            {f.site.owner_name} • {f.site.work_type === 'LABOUR' ? t('labour', 'Labour') : t('labourMaterial', 'Labour+Mat')}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.siteStatusBadge,
                          {
                            backgroundColor:
                              f.site.status === 'COMPLETED'
                                ? '#EFF6FF'
                                : f.site.status === 'PAUSED'
                                  ? '#FFFBEB'
                                  : '#F0FDF4',
                            borderColor:
                              f.site.status === 'COMPLETED'
                                ? '#BFDBFE'
                                : f.site.status === 'PAUSED'
                                  ? '#FDE68A'
                                  : '#BBF7D0',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.siteStatusBadgeText,
                            {
                              color:
                                f.site.status === 'COMPLETED'
                                  ? '#1D4ED8'
                                  : f.site.status === 'PAUSED'
                                    ? '#B45309'
                                    : '#15803D',
                            },
                          ]}
                        >
                          {f.site.status === 'COMPLETED'
                            ? t('completed', 'Completed')
                            : f.site.status === 'PAUSED'
                              ? t('paused', 'Paused')
                              : t('active', 'Ongoing')}
                        </Text>
                      </View>
                    </View>

                    {/* Clean Profit Row */}
                    <View style={styles.siteProfitRow}>
                      <Text style={styles.siteProfitLabel}>
                        {f.final
                          ? t('finalRecordedMargin', 'Final Margin')
                          : t('estimatedMargin', 'Est. Margin')}
                      </Text>
                      <Text
                        style={[
                          styles.siteProfitAmount,
                          { color: f.profit >= 0 ? '#15803D' : '#DC2626' },
                        ]}
                        numberOfLines={1}
                      >
                        {money(f.profit)}
                      </Text>
                    </View>

                    {/* 3 Metric Pills */}
                    <View style={styles.siteMiniMetricsRow}>
                      <View style={styles.siteMiniMetricItem}>
                        <Text style={styles.siteMiniMetricLabel}>{t('labour', 'Labour')}</Text>
                        <Text style={styles.siteMiniMetricValue} numberOfLines={1}>{money(f.labour)}</Text>
                      </View>
                      <View style={styles.siteMiniMetricDivider} />
                      <View style={styles.siteMiniMetricItem}>
                        <Text style={styles.siteMiniMetricLabel}>{t('materialFilter', 'Material')}</Text>
                        <Text style={styles.siteMiniMetricValue} numberOfLines={1}>{money(f.material)}</Text>
                      </View>
                      <View style={styles.siteMiniMetricDivider} />
                      <View style={styles.siteMiniMetricItem}>
                        <Text style={styles.siteMiniMetricLabel}>{t('clientBalance', 'Client Due')}</Text>
                        <Text
                          style={[
                            styles.siteMiniMetricValue,
                            { color: f.ownerBalance > 0 ? '#B45309' : '#15803D' },
                          ]}
                          numberOfLines={1}
                        >
                          {money(f.ownerBalance)}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Site Export Footer */}
                    <View style={styles.siteCardActionFooter}>
                      <Pressable
                        onPress={() => onGenerateReport(true, f.site.id)}
                        style={({ pressed }) => [
                          styles.sitePdfActionBtn,
                          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <AppIcon name="document-text-outline" size={13} color="#1D4ED8" />
                        <Text style={styles.sitePdfActionText}>{t('printPdf', 'Site PDF')}</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => onGenerateReport(false, f.site.id)}
                        style={({ pressed }) => [
                          styles.siteShareActionBtn,
                          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <AppIcon name="logo-whatsapp" size={13} color="#15803D" />
                        <Text style={styles.siteShareActionText}>{t('shareWhatsapp', 'WhatsApp')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {!filteredSites.length && (
                  <View style={styles.emptyCard}>
                    <AppIcon name="search-outline" size={26} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>{t('noSitesFound', 'No Sites Found')}</Text>
                    <Text style={styles.emptySub}>
                      {t('noFilterMatchDesc', 'No records match your search.')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* TAB 2: EXPENSES (LABOUR, MATERIAL, KHARCHA) */}
          {/* ========================================================= */}
          {activeTab === 'costs' && (
            <View style={styles.tabContentBlock}>
              {/* Cost Split Proportional Bar */}
              <View style={styles.analyticsCard}>
                <View style={styles.analyticsCardHeader}>
                  <View style={[styles.analyticsIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <AppIcon name="pie-chart" size={14} color="#1D4ED8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analyticsTitle}>{t('costBreakdown', 'Cost Distribution')}</Text>
                    <Text style={styles.analyticsSub}>
                      {t('totalExpenses', 'Total')}: {money(totalCost)}
                    </Text>
                  </View>
                </View>

                {/* Split Segmented Bar */}
                <View style={styles.segmentedCostBar}>
                  <View
                    style={[
                      styles.segmentedBarPart,
                      { width: `${labourPct}%`, backgroundColor: '#2563EB' },
                    ]}
                  />
                  <View
                    style={[
                      styles.segmentedBarPart,
                      { width: `${materialPct}%`, backgroundColor: '#7C3AED' },
                    ]}
                  />
                  <View
                    style={[
                      styles.segmentedBarPart,
                      { width: `${expensePct}%`, backgroundColor: '#EA580C' },
                    ]}
                  />
                </View>

                {/* Legend */}
                <View style={styles.costLegendRow}>
                  <View style={styles.costLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                    <Text style={styles.legendText}>
                      {t('labour', 'Labour')} ({labourPct}%)
                    </Text>
                  </View>
                  <View style={styles.costLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} />
                    <Text style={styles.legendText}>
                      {t('materialFilter', 'Material')} ({materialPct}%)
                    </Text>
                  </View>
                  <View style={styles.costLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
                    <Text style={styles.legendText}>
                      {t('expenseFilter', 'Kharcha')} ({expensePct}%)
                    </Text>
                  </View>
                </View>
              </View>

              {/* 3 Simple Expense Cards */}
              <View style={styles.costDetailCardsWrap}>
                {/* 1. Labour Card */}
                <View style={styles.costDetailCard}>
                  <View style={styles.costDetailHeader}>
                    <View style={[styles.costDetailIcon, { backgroundColor: '#EFF6FF' }]}>
                      <AppIcon name="people" size={14} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.costDetailMainTitle}>{t('labourTitle', 'Labour / Haziri Wages')}</Text>
                      <Text style={styles.costDetailSubTitle}>
                        {data.attendance.length} {t('tabHaziriCount', 'Haziri entries')}
                      </Text>
                    </View>
                    <Text style={styles.costDetailPercentBadge}>{labourPct}%</Text>
                  </View>

                  <View style={styles.costDetailNumbersRow}>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('totalWagesEarned', 'Earned')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>{money(totalLabour)}</Text>
                    </View>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('advancePaid', 'Paid')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>
                        {money(totalLabour - totalLabourBalance)}
                      </Text>
                    </View>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('balanceDue', 'Due')}</Text>
                      <Text
                        style={[
                          styles.costDetailNumVal,
                          { color: totalLabourBalance > 0 ? '#B45309' : '#15803D' },
                        ]}
                        numberOfLines={1}
                      >
                        {money(totalLabourBalance)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Material Card */}
                <View style={styles.costDetailCard}>
                  <View style={styles.costDetailHeader}>
                    <View style={[styles.costDetailIcon, { backgroundColor: '#F5F3FF' }]}>
                      <AppIcon name="cube" size={14} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.costDetailMainTitle}>{t('materialFilter', 'Material & Supplies')}</Text>
                      <Text style={styles.costDetailSubTitle}>
                        Sand, cement, steel, bricks
                      </Text>
                    </View>
                    <Text style={[styles.costDetailPercentBadge, { backgroundColor: '#F5F3FF', color: '#7C3AED' }]}>
                      {materialPct}%
                    </Text>
                  </View>

                  <View style={styles.costDetailNumbersRow}>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('recordedCosts', 'Total')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>{money(totalMaterial)}</Text>
                    </View>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('billPaidFilter', 'Paid')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>
                        {money(totalMaterial - totalSupplierBalance)}
                      </Text>
                    </View>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('supplierDuesPending', 'Pending')}</Text>
                      <Text
                        style={[
                          styles.costDetailNumVal,
                          { color: totalSupplierBalance > 0 ? '#DC2626' : '#15803D' },
                        ]}
                        numberOfLines={1}
                      >
                        {money(totalSupplierBalance)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 3. Expenses Card */}
                <View style={styles.costDetailCard}>
                  <View style={styles.costDetailHeader}>
                    <View style={[styles.costDetailIcon, { backgroundColor: '#FFF7ED' }]}>
                      <AppIcon name="flash" size={14} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.costDetailMainTitle}>{t('expenseFilter', 'Site Kharcha & Fuel')}</Text>
                      <Text style={styles.costDetailSubTitle}>
                        Transport, tools & petty cash
                      </Text>
                    </View>
                    <Text style={[styles.costDetailPercentBadge, { backgroundColor: '#FFF7ED', color: '#EA580C' }]}>
                      {expensePct}%
                    </Text>
                  </View>

                  <View style={styles.costDetailNumbersRow}>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('expenseFilter', 'Total Kharcha')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>{money(totalExpenses)}</Text>
                    </View>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('activeSites', 'Sites')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>{data.sites.length}</Text>
                    </View>
                    <View style={styles.costDetailNumCol}>
                      <Text style={styles.costDetailNumLabel}>{t('cashStatus', 'Mode')}</Text>
                      <Text style={styles.costDetailNumVal} numberOfLines={1}>Cash</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ACTIVITY / AUDIT LOG */}
          {/* ========================================================= */}
          {activeTab === 'audit' && (
            <View style={styles.tabContentBlock}>
              <View style={styles.auditContainerCard}>
                <View style={styles.auditHeaderRow}>
                  <View style={styles.auditHeaderLeft}>
                    <View style={styles.auditShieldIcon}>
                      <AppIcon name="shield-checkmark" size={14} color="#15803D" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditCardTitle}>{t('activityTab', 'Activity History')}</Text>
                      <Text style={styles.auditCardSub}>
                        {t('auditHistorySub', 'Real-time actions timeline')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.auditLiveTag}>
                    <View style={styles.auditLiveDot} />
                    <Text style={styles.auditLiveText}>Live</Text>
                  </View>
                </View>

                {/* Audit Items */}
                <View style={styles.auditListWrap}>
                  {data.audit.slice(0, 20).map((a, i) => {
                    const meta = getAuditMeta(a.action);
                    const formattedDate = new Date(a.created_at).toLocaleString(
                      lang === 'hi' ? 'hi-IN' : 'en-IN',
                      {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    );

                    return (
                      <View key={i} style={styles.auditItemRow}>
                        <View style={[styles.auditActionIconBox, { backgroundColor: meta.bg }]}>
                          <AppIcon name={meta.icon as any} size={13} color={meta.color} />
                        </View>

                        <View style={styles.auditItemContent}>
                          <Text style={styles.auditItemActionTitle}>
                            {meta.label}
                          </Text>
                          <Text style={styles.auditItemTime}>{formattedDate}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {!data.audit.length && (
                    <Text style={styles.emptyNotice}>
                      {t('noAuditLogs', 'No recent activity recorded yet.')}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingBottom: 32,
  },
  container: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  desktopContainer: {
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  /* ========================================================= */
  /* 1. HERO FINANCIAL CARD */
  /* ========================================================= */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1.5,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTurnoverCol: {
    flex: 1,
  },
  heroTurnoverLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  heroTurnoverValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  heroProfitCol: {
    alignItems: 'flex-end',
    minWidth: 90,
  },
  heroProfitLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  heroProfitValue: {
    fontSize: 16,
    fontWeight: '900',
  },

  /* 4 KPI Grid */
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kpiBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 7,
  },
  kpiTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  kpiFoot: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },

  /* ========================================================= */
  /* 2. COMPACT EXPORT TOOLBAR */
  /* ========================================================= */
  exportToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  exportBtnPdf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  exportBtnTextPdf: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  exportBtnShare: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.2,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  exportBtnTextShare: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },

  /* ========================================================= */
  /* 3. SEGMENT NAVIGATION */
  /* ========================================================= */
  segmentNavContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
    gap: 3,
  },
  segmentNavBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 6,
  },
  segmentNavBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentNavBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentNavBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  tabContentBlock: {
    gap: 8,
  },

  /* ========================================================= */
  /* TAB 1: SITE PROFITABILITY CARDS */
  /* ========================================================= */
  filterSection: {
    gap: 6,
    marginBottom: 2,
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sitesCardList: {
    gap: 8,
  },
  siteReportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  siteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  siteCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  siteIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  siteCardSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  siteStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  siteStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  siteProfitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  siteProfitLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  siteProfitAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  siteMiniMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  siteMiniMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  siteMiniMetricLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 1,
  },
  siteMiniMetricValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  siteMiniMetricDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
  },
  siteCardActionFooter: {
    flexDirection: 'row',
    gap: 6,
  },
  sitePdfActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingVertical: 5,
  },
  sitePdfActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  siteShareActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    paddingVertical: 5,
  },
  siteShareActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },

  /* ========================================================= */
  /* TAB 2: COST ANALYTICS */
  /* ========================================================= */
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  analyticsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  analyticsIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  analyticsSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  segmentedCostBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  segmentedBarPart: {
    height: '100%',
  },
  costLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 4,
  },
  costLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
  },
  costDetailCardsWrap: {
    gap: 6,
  },
  costDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  costDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  costDetailIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costDetailMainTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  costDetailSubTitle: {
    fontSize: 9.5,
    color: '#64748B',
  },
  costDetailPercentBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  costDetailNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 7,
    gap: 4,
  },
  costDetailNumCol: {
    flex: 1,
  },
  costDetailNumLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 1,
  },
  costDetailNumVal: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* ========================================================= */
  /* TAB 3: AUDIT TRAIL */
  /* ========================================================= */
  auditContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  auditHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  auditHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  auditShieldIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  auditCardSub: {
    fontSize: 9.5,
    color: '#64748B',
  },
  auditLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  auditLiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#16A34A',
  },
  auditLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  auditListWrap: {
    gap: 4,
  },
  auditItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  auditActionIconBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditItemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditItemActionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  auditItemTime: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 10.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  emptyNotice: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    paddingVertical: 8,
  },
});
