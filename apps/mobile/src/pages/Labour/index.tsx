import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { MetricCard } from '../../components/common/MetricCard';
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { money, workerSummary } from '../../finance';

interface LabourPageProps {
  data: Snapshot;
  onOpenWorkerModal: (worker?: Row) => void;
  onOpenPaymentModal: (workerId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function LabourPage({
  data,
  onOpenWorkerModal,
  onOpenPaymentModal,
  refreshing,
  onRefresh,
}: LabourPageProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const totalEarned = data.workers.reduce(
    (n, w) => n + workerSummary(w, data.attendance, data.entries).earned,
    0
  );
  const totalPendingWages = data.workers.reduce(
    (sum, w) =>
      sum + Math.max(0, workerSummary(w, data.attendance, data.entries).balance),
    0
  );
  const totalAdvances = data.workers.reduce(
    (sum, w) =>
      sum + Math.max(0, -workerSummary(w, data.attendance, data.entries).balance),
    0
  );

  const filteredWorkers = data.workers.filter((w) =>
    (w.name + ' ' + w.skill).toLowerCase().includes(query)
  );

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title="Labour & Team"
        subtitle="Daily wages, overtime & clear balances"
        icon="people-outline"
        badge={{ label: `${filteredWorkers.length} Workers`, tone: 'blue' }}
        onRefresh={onRefresh}
        refreshing={refreshing}
        actions={
          <Pressable
            onPress={() => onOpenWorkerModal()}
            style={styles.navActionBtn}
            accessibilityLabel="Add new worker"
          >
            <AppIcon name="add" size={17} color="#FFFFFF" />
            <Text style={styles.navActionBtnText}>Add Worker</Text>
          </Pressable>
        }
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

        {/* Stats */}
        <View style={styles.statsRow}>
          <MetricCard
            label="Total Wages Earned"
            value={money(totalEarned)}
            foot="Across all time"
            icon="cash-outline"
          />
          <MetricCard
            label="Pending Wages"
            value={money(totalPendingWages)}
            foot="To pay to team"
            icon="time-outline"
            tone="warning"
          />
          <MetricCard
            label="Worker Advances"
            value={money(totalAdvances)}
            foot="Paid in advance"
            icon="arrow-forward-outline"
          />
        </View>

        {/* Search */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search worker or skill (mistri, beldar)…"
        />

        {/* Workers List */}
        <View style={styles.list}>
          {filteredWorkers.map((w) => {
            const f = workerSummary(w, data.attendance, data.entries);
            const isAdvance = f.balance < 0;

            return (
              <Card key={w.id} style={styles.workerCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {w.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{w.name}</Text>
                    <Text style={styles.skillText}>
                      {w.skill} • {money(w.daily_rate)}/day • OT {money(w.overtime_rate)}/hr
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onOpenWorkerModal(w)}
                    style={styles.editBtn}
                    accessibilityLabel={'Edit ' + w.name}
                  >
                    <AppIcon name="create-outline" size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>

                {!w.active && <Badge label="INACTIVE" tone="orange" />}

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.earnedMeta}>
                      Earned {money(f.earned)} • Paid {money(f.paid)}
                    </Text>
                    <Text
                      style={[
                        styles.balanceValue,
                        { color: isAdvance ? Colors.warning : Colors.textPrimary },
                      ]}
                    >
                      {isAdvance
                        ? `${money(-f.balance)} Advance`
                        : `${money(f.balance)} Pending`}
                    </Text>
                  </View>
                  <Button
                    title="Pay / Advance"
                    variant="secondary"
                    size="sm"
                    onPress={() => onOpenPaymentModal(w.id)}
                    icon="wallet-outline"
                  />
                </View>
              </Card>
            );
          })}

          {!filteredWorkers.length && (
            <EmptyState
              title="No Workers Found"
              description="Add workers and team members to track daily attendance and wages."
              actionTitle="+ Add First Worker"
              onAction={() => onOpenWorkerModal()}
            />
          )}
        </View>
      </View>
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  navActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  workerCard: {
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  skillText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  editBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceSubtle,
  },
  earnedMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
});
