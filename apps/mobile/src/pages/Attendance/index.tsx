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
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';

interface AttendancePageProps {
  data: Snapshot;
  onOpenAttendanceModal: (siteId?: string, workerId?: string, existing?: Row) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function AttendancePage({
  data,
  onOpenAttendanceModal,
  refreshing,
  onRefresh,
}: AttendancePageProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const currentDate = today();

  const todayRecords = data.attendance.filter(
    (a) => String(a.date).slice(0, 10) === currentDate
  );
  const presentTodayWorkers = new Set(
    todayRecords.filter((a) => Number(a.units) > 0).map((a) => a.worker_id)
  );
  const todayEarnedWages = todayRecords.reduce((n, a) => n + Number(a.amount), 0);

  const sortedAttendance = [...data.attendance]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .filter((a) => {
      const workerName = data.workers.find((w) => w.id === a.worker_id)?.name || '';
      const siteName = data.sites.find((s) => s.id === a.site_id)?.name || '';
      return (workerName + ' ' + siteName).toLowerCase().includes(query);
    });

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
        {/* Header Row */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Daily Haziri Register</Text>
            <Text style={styles.subtitle}>Present, half day, absent & overtime</Text>
          </View>
          <Button
            title="Haziri Lagao"
            onPress={() => onOpenAttendanceModal()}
            icon="add"
            size="sm"
          />
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <MetricCard
            label="Present Today"
            value={String(presentTodayWorkers.size)}
            foot="Across all sites"
            icon="people-outline"
            tone="success"
          />
          <MetricCard
            label="Today's Wages"
            value={money(todayEarnedWages)}
            foot="Earned labour cost"
            icon="wallet-outline"
          />
        </View>

        {/* Search */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search worker or site name…"
        />

        {/* Attendance List */}
        <View style={styles.list}>
          {sortedAttendance.map((a) => {
            const worker = data.workers.find((w) => w.id === a.worker_id);
            const site = data.sites.find((s) => s.id === a.site_id);
            const units = Number(a.units);
            const isPresent = units === 1;
            const isHalf = units === 0.5;

            return (
              <Pressable
                key={a.id}
                onPress={() => onOpenAttendanceModal(a.site_id, a.worker_id, a)}
                style={styles.cardWrapper}
                accessibilityLabel={'Correct attendance for ' + (worker?.name || '')}
              >
                <Card style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.workerInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(worker?.name || 'W').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.workerName}>
                          {worker?.name || 'Unknown Worker'}
                        </Text>
                        <Text style={styles.metaText}>
                          {site?.name || 'Unknown Site'} • {String(a.date).slice(0, 10)}
                        </Text>
                      </View>
                    </View>
                    <Badge
                      label={isPresent ? 'PRESENT' : isHalf ? 'HALF DAY' : 'ABSENT'}
                      tone={isPresent ? 'green' : isHalf ? 'orange' : 'red'}
                    />
                  </View>

                  <View style={styles.cardBottom}>
                    <View style={styles.otBox}>
                      {a.overtime_minutes > 0 ? (
                        <Text style={styles.otText}>
                          OT: {a.overtime_minutes} min
                        </Text>
                      ) : (
                        <Text style={styles.tapText}>Tap to edit / correct</Text>
                      )}
                    </View>
                    <Text style={styles.amountText}>{money(a.amount)}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}

          {!sortedAttendance.length && (
            <EmptyState
              title="No Attendance Recorded"
              description="Mark attendance to automatically record earned daily wages and overtime."
              actionTitle="+ Mark Attendance"
              onAction={() => onOpenAttendanceModal()}
            />
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
  cardWrapper: {
    borderRadius: 16,
  },
  card: {
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceSubtle,
  },
  otBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.warning,
  },
  tapText: {
    fontSize: 11,
    color: Colors.textSubtle,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
});
