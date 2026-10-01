import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Row } from '../../types';
import { money } from '../../finance';

export interface VoidEntryModalProps {
  spec: FormSpec;
  entry?: Row;
  site?: Row;
  worker?: Row;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const VOID_REASONS = [
  'Wrong amount',
  'Duplicate entry',
  'Wrong site',
  'Cancelled entry',
];

const KIND_META: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  RECEIPT: {
    label: 'Client Payment',
    icon: 'arrow-down-circle',
    color: '#15803D',
    bg: '#DCFCE7',
  },
  MATERIAL: {
    label: 'Material Bill',
    icon: 'cube',
    color: '#2563EB',
    bg: '#DBEAFE',
  },
  WAGE_PAYMENT: {
    label: 'Labour Wage / Adv',
    icon: 'people',
    color: '#D97706',
    bg: '#FEF3C7',
  },
  EXPENSE: {
    label: 'Expense Bill',
    icon: 'receipt',
    color: '#475569',
    bg: '#F1F5F9',
  },
  EXTRA: {
    label: 'Extra Work',
    icon: 'hammer',
    color: '#9333EA',
    bg: '#F3E8FF',
  },
  SUPPLIER_PAYMENT: {
    label: 'Bill Payment',
    icon: 'cash',
    color: '#0284C7',
    bg: '#E0F2FE',
  },
};

export function VoidEntryModal({
  spec,
  entry,
  site,
  worker,
  busy,
  error,
  onClose,
  onSave,
}: VoidEntryModalProps) {
  const [reason, setReason] = useState(spec.initial?.reason || '');
  const [localError, setLocalError] = useState('');

  const kindMeta = entry?.kind
    ? KIND_META[entry.kind] || {
        label: entry.kind,
        icon: 'document-text',
        color: '#64748B',
        bg: '#F1F5F9',
      }
    : null;

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  const handleConfirm = () => {
    setLocalError('');
    if (!reason.trim()) {
      setLocalError('Please select or type a reason for voiding.');
      return;
    }
    onSave({ reason: reason.trim() });
  };

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={() => !busy && onClose()}
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.backdropPressable}
          onPress={() => !busy && onClose()}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.dialogContainer}
        >
          <View style={styles.dialogCard}>
            {/* Top Close Bar */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.dangerIconBadge}>
                  <AppIcon name="trash" size={16} color="#DC2626" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Void Entry?</Text>
                  <Text style={styles.headerSubtitle}>Cancel & remove from totals</Text>
                </View>
              </View>

              <Pressable
                onPress={() => !busy && onClose()}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel="Close"
              >
                <AppIcon name="close" size={16} color="#64748B" />
              </Pressable>
            </View>

            {/* Error Banner */}
            {localError || error ? (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-circle" size={14} color="#DC2626" />
                <Text style={styles.errorBannerText}>{localError || error}</Text>
              </View>
            ) : null}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dialogBody}
            >
              {/* Mini Transaction Summary Card */}
              {entry ? (
                <View style={styles.transactionCard}>
                  <View style={styles.transactionTop}>
                    {kindMeta && (
                      <View
                        style={[
                          styles.kindBadge,
                          { backgroundColor: kindMeta.bg },
                        ]}
                      >
                        <AppIcon
                          name={kindMeta.icon as any}
                          size={12}
                          color={kindMeta.color}
                        />
                        <Text
                          style={[
                            styles.kindBadgeText,
                            { color: kindMeta.color },
                          ]}
                        >
                          {kindMeta.label}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.transactionDate}>
                      {formatDateDisplay(entry.date)}
                    </Text>
                  </View>

                  <Text style={styles.amountText}>{money(entry.amount)}</Text>

                  <View style={styles.metaRow}>
                    {site?.name ? (
                      <Text style={styles.metaText} numberOfLines={1}>
                        📍 {site.name}
                      </Text>
                    ) : null}
                    {worker?.name || entry.party ? (
                      <Text style={styles.metaText} numberOfLines={1}>
                        👤 {worker?.name || entry.party}
                      </Text>
                    ) : null}
                  </View>
                  {entry.description ? (
                    <Text style={styles.descText} numberOfLines={1}>
                      📝 {entry.description}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Quick Reason Chips */}
              <View style={styles.reasonSection}>
                <Text style={styles.sectionLabel}>REASON FOR VOIDING *</Text>
                <View style={styles.chipsRow}>
                  {VOID_REASONS.map((r) => {
                    const isSelected = reason === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setReason(r)}
                        style={[
                          styles.chip,
                          isSelected && styles.chipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Reason Input */}
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Or enter custom reason..."
                  placeholderTextColor="#94A3B8"
                  style={[
                    styles.input,
                    Platform.OS === 'web'
                      ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
                      : undefined,
                  ]}
                />
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.footer}>
              <Pressable
                onPress={() => !busy && onClose()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                disabled={busy}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  busy && { opacity: 0.6 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="trash" size={15} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>Void Entry</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
  },
  dialogCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dangerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 6,
  },
  errorBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  dialogBody: {
    padding: 14,
    gap: 10,
  },
  transactionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  transactionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  transactionDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  amountText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#DC2626',
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  descText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  reasonSection: {
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0F172A',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
