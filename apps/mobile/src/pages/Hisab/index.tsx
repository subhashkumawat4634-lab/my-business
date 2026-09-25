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
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { entryLabels } from '../../forms';

interface HisabPageProps {
  data: Snapshot;
  onOpenEntry: (kind: string, siteId?: string, workerId?: string, bill?: Row) => void;
  onOpenVoidModal: (entry: Row) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function HisabPage({
  data,
  onOpenEntry,
  onOpenVoidModal,
  refreshing,
  onRefresh,
}: HisabPageProps) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL');
  const query = search.trim().toLowerCase();

  const activeEntries = data.entries.filter((e) => !e.voided_at);

  const filteredEntries = [...data.entries]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .filter((e) => {
      const matchesKind = kindFilter === 'ALL' || e.kind === kindFilter;
      const matchesQuery = (e.description + ' ' + e.party).toLowerCase().includes(query);
      return matchesKind && matchesQuery;
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hisab & Ledger</Text>
          <Text style={styles.subtitle}>Money in, costs incurred & cash paid out</Text>
        </View>

        {/* Quick Add Buttons */}
        <View style={styles.actionsWrap}>
          <Button
            title="Paisa Aaya"
            onPress={() => onOpenEntry('RECEIPT')}
            icon="arrow-down"
            size="sm"
          />
          <Button
            title="Material Bill"
            variant="secondary"
            onPress={() => onOpenEntry('MATERIAL')}
            icon="cube"
            size="sm"
          />
          <Button
            title="Labour Payment"
            variant="secondary"
            onPress={() => onOpenEntry('WAGE_PAYMENT')}
            icon="wallet"
            size="sm"
          />
          <Button
            title="Expense Bill"
            variant="secondary"
            onPress={() => onOpenEntry('EXPENSE')}
            icon="receipt"
            size="sm"
          />
        </View>

        {/* Informative Hint */}
        <View style={styles.noticeBox}>
          <AppIcon name="information-circle-outline" size={18} color={Colors.warning} />
          <Text style={styles.noticeText}>
            Material and Expense bills record accrued costs. To record payments against bills, use "Pay Bill" so cash outflow is tracked accurately.
          </Text>
        </View>

        {/* Filter Chips Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContainer}
        >
          {['ALL', ...Object.keys(entryLabels)].map((k) => (
            <Pressable
              key={k}
              onPress={() => setKindFilter(k)}
              style={[
                styles.chip,
                kindFilter === k && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  kindFilter === k && styles.chipTextActive,
                ]}
              >
                {k === 'ALL' ? 'All Entries' : entryLabels[k]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Search */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search description or party name…"
        />

        {/* Entries List */}
        <View style={styles.list}>
          {filteredEntries.map((e) => {
            const isReceipt = e.kind === 'RECEIPT';
            const isBill = ['MATERIAL', 'EXPENSE'].includes(e.kind);
            const paid = activeEntries
              .filter((p) => p.linked_entry_id === e.id)
              .reduce((s, p) => s + Number(p.amount), 0);
            const pendingAmount = Number(e.amount) - paid;
            const siteName = data.sites.find((s) => s.id === e.site_id)?.name;
            const workerName = e.worker_id
              ? data.workers.find((w) => w.id === e.worker_id)?.name
              : null;

            return (
              <Card
                key={e.id}
                style={[
                  styles.entryCard,
                  e.voided_at ? { opacity: 0.5 } : null,
                ]}
              >
                <View style={styles.entryTop}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: isReceipt
                          ? Colors.successLight
                          : isBill
                          ? Colors.warningLight
                          : Colors.surfaceSubtle,
                      },
                    ]}
                  >
                    <AppIcon
                      name={
                        isReceipt
                          ? 'arrow-down'
                          : isBill
                          ? 'cube'
                          : 'arrow-up'
                      }
                      size={20}
                      color={
                        isReceipt
                          ? Colors.success
                          : isBill
                          ? Colors.warning
                          : Colors.textPrimary
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryTitle}>{e.description}</Text>
                    <Text style={styles.entryMeta}>
                      {String(e.date).slice(0, 10)} • {entryLabels[e.kind]}
                      {e.voided_at ? ' • [VOIDED]' : ''}
                    </Text>
                    <Text style={styles.entrySubmeta}>
                      {siteName || 'Site'}
                      {workerName ? ` • ${workerName}` : ''}
                      {e.party ? ` • ${e.party}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.amountText,
                      { color: isReceipt ? Colors.success : Colors.textPrimary },
                    ]}
                  >
                    {isReceipt ? '+' : '-'} {money(e.amount)}
                  </Text>
                </View>

                {e.reference ? (
                  <Text style={styles.refText}>Ref: {e.reference}</Text>
                ) : null}

                {!e.voided_at && (
                  <View style={styles.entryFooter}>
                    {isBill ? (
                      <Text style={styles.pendingText}>
                        Paid {money(paid)} • Pending {money(pendingAmount)}
                      </Text>
                    ) : (
                      <Text style={styles.modeText}>Mode: {e.mode}</Text>
                    )}

                    <View style={styles.btnRow}>
                      {isBill && pendingAmount > 0 && (
                        <Button
                          title="Pay Bill"
                          size="sm"
                          onPress={() =>
                            onOpenEntry('SUPPLIER_PAYMENT', e.site_id, undefined, e)
                          }
                        />
                      )}
                      <Button
                        title="Void"
                        variant="danger"
                        size="sm"
                        onPress={() => onOpenVoidModal(e)}
                      />
                    </View>
                  </View>
                )}
              </Card>
            );
          })}

          {!filteredEntries.length && (
            <EmptyState
              title="No Ledger Entries Found"
              description="Add a payment, client receipt or expense bill to update the financial ledger."
              actionTitle="+ Add First Entry"
              onAction={() => onOpenEntry('RECEIPT')}
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
    marginBottom: 12,
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
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  noticeText: {
    fontSize: 11,
    color: Colors.warningText,
    flex: 1,
    lineHeight: 16,
  },
  chipsScroll: {
    marginBottom: 12,
  },
  chipsContainer: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    gap: 10,
  },
  entryCard: {
    padding: 14,
    gap: 8,
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  entryMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  entrySubmeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  refText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  entryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceSubtle,
  },
  pendingText: {
    fontSize: 11,
    color: Colors.warningText,
    fontWeight: '600',
  },
  modeText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
