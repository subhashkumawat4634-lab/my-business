import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { MetricCard } from '../../components/common/MetricCard';
import { Snapshot } from '../../types';
import { money, siteSummary } from '../../finance';

interface ReportsPageProps {
  data: Snapshot;
  onGenerateReport: (pdf: boolean) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function ReportsPage({
  data,
  onGenerateReport,
  refreshing,
  onRefresh,
}: ReportsPageProps) {
  const summaries = data.sites.map((site) => ({
    site,
    ...siteSummary(site, data.attendance, data.entries),
  }));

  const totalContract = summaries.reduce((s, f) => s + f.contract, 0);
  const totalCost = summaries.reduce((s, f) => s + f.cost, 0);
  const totalSupplierBalance = summaries.reduce((s, f) => s + f.supplierBalance, 0);
  const totalCashMovement = summaries.reduce((s, f) => s + f.cash, 0);

  return (
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reports & Statements</Text>
          <Text style={styles.subtitle}>
            Business performance, site margins & audit history
          </Text>
        </View>

        {/* Financial Metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Total Contract Value"
            value={money(totalContract)}
            foot="All sites combined"
            icon="business-outline"
          />
          <MetricCard
            label="Recorded Costs"
            value={money(totalCost)}
            foot="Labour + material + expenses"
            icon="calculator-outline"
          />
          <MetricCard
            label="Supplier Dues Pending"
            value={money(totalSupplierBalance)}
            foot="Unpaid bills"
            icon="alert-circle-outline"
            tone="warning"
          />
          <MetricCard
            label="Net Cash In Hand"
            value={money(totalCashMovement)}
            foot="Received minus payouts"
            icon="wallet-outline"
            tone={totalCashMovement >= 0 ? 'success' : 'danger'}
          />
        </View>

        {/* Action Buttons: PDF & Share */}
        <View style={styles.actionsWrap}>
          <Button
            title={Platform.OS === 'web' ? 'Print / Save PDF' : 'Export PDF'}
            onPress={() => onGenerateReport(true)}
            icon="document-text-outline"
          />
          <Button
            title={Platform.OS === 'web' ? 'Copy Text Statement' : 'Share on WhatsApp'}
            variant="secondary"
            onPress={() => onGenerateReport(false)}
            icon="share-social-outline"
          />
        </View>

        {/* Site Profitability Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Site-Wise Profitability</Text>
          <Text style={styles.sectionSubtitle}>
            Ongoing: estimated margin • Completed: final margin
          </Text>
        </View>

        <View style={styles.sitesList}>
          {summaries.map((f) => (
            <Card key={f.site.id} style={styles.profitCard}>
              <View style={styles.profitTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.siteTitle}>{f.site.name}</Text>
                  <Text style={styles.siteSub}>
                    {f.final ? 'Final Recorded Margin' : 'Estimated Margin'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.profitAmount,
                    { color: f.profit >= 0 ? Colors.success : Colors.danger },
                  ]}
                >
                  {money(f.profit)}
                </Text>
              </View>
              <Text style={styles.profitFormula}>
                Contract {money(f.contract)} − Incurred {money(f.cost)} − Remaining{' '}
                {money(f.remaining)}
              </Text>
            </Card>
          ))}
        </View>

        {/* Informative Disclaimer */}
        <View style={styles.noticeBox}>
          <AppIcon name="shield-outline" size={18} color={Colors.primary} />
          <Text style={styles.noticeText}>
            These figures represent direct project site margins (excluding common office overhead, owner salary, or statutory taxes). Consult your certified accountant for statutory audited statements.
          </Text>
        </View>

        {/* Audit Log / Change History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Audit Activity History</Text>
          <Text style={styles.sectionSubtitle}>
            Financial records tamper-proof log (Void with reason only)
          </Text>
        </View>

        <View style={styles.auditList}>
          {data.audit.slice(0, 15).map((a, i) => (
            <View key={i} style={styles.auditRow}>
              <Text style={styles.auditAction}>
                {a.action.replaceAll('.', ' • ')}
              </Text>
              <Text style={styles.auditTime}>
                {new Date(a.created_at).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
          {!data.audit.length && (
            <Text style={styles.emptyNotice}>Abhi koi audit log nahi hai.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 32,
  },
  container: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  sitesList: {
    gap: 10,
    marginBottom: 16,
  },
  profitCard: {
    padding: 14,
    gap: 6,
  },
  profitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  siteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  siteSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  profitAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  profitFormula: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  noticeText: {
    fontSize: 11,
    color: Colors.primaryDark,
    flex: 1,
    lineHeight: 16,
  },
  auditList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceSubtle,
  },
  auditAction: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  auditTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyNotice: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    marginVertical: 8,
  },
});
