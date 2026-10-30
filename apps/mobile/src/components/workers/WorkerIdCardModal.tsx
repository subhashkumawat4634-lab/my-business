import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../icons/AppIcon';
import { Row, Snapshot } from '../../types';
import { useLanguage } from '../../i18n';
import { printWorkerIdCardAndGatePassPdf, shareWorkerIdCard } from '../../report';

export interface WorkerIdCardModalProps {
  visible: boolean;
  worker: Row | null;
  data: Snapshot;
  onClose: () => void;
}

export function WorkerIdCardModal({
  visible,
  worker,
  data,
  onClose,
}: WorkerIdCardModalProps) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [busy, setBusy] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);

  // Auto-detect worker's assigned site from their latest attendance or active site
  const assignedSite = useMemo(() => {
    if (!worker) return data.sites[0];
    const workerAtt = data.attendance
      .filter((a) => a.worker_id === worker.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (workerAtt.length > 0 && workerAtt[0]?.site_id) {
      const found = data.sites.find((s) => s.id === workerAtt[0].site_id);
      if (found) return found;
    }
    return data.sites.find((s) => s.status === 'ONGOING') || data.sites[0];
  }, [worker, data.attendance, data.sites]);

  if (!worker) return null;

  const orgName = data.organization?.name || 'ThekaBook Contractor Services';
  const contractorName = data.user?.name || 'Site Incharge';
  const workerCode = `TK-W-${String(worker.id || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`;

  const siteDisplayName = assignedSite ? assignedSite.name : (isHi ? 'अधिकृत निर्माण स्थल' : 'Authorized Work Site');

  const todayStr = new Date().toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const validUntilStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const initials = worker.name
    ? worker.name
        .trim()
        .split(/\s+/)
        .map((p: string) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'W';

  const handlePrintPdf = async () => {
    try {
      setBusy(true);
      await printWorkerIdCardAndGatePassPdf(
        data,
        worker,
        assignedSite?.id,
        validUntilStr,
        lang
      );
    } catch (err: any) {
      console.error('Failed to print ID Card:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      setSharingWhatsApp(true);
      await shareWorkerIdCard(
        data,
        worker,
        assignedSite?.id,
        validUntilStr,
        lang
      );
    } catch (err: any) {
      console.error('Failed to share ID Card on WhatsApp:', err);
    } finally {
      setSharingWhatsApp(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.modalCard, isDesktop && styles.modalCardDesktop]} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBox}>
                <AppIcon name="id-card" size={20} color="#2563EB" />
              </View>
              <Text style={styles.headerTitle}>
                {isHi ? 'कारीगर पहचान पत्र (Labour ID Card)' : 'Labour Identity Card'}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Close"
            >
              <AppIcon name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          {/* Standard ID Card Preview Container */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Standard PVC Portrait ID Card Badge (CR80 Proportions) */}
            <View style={styles.pvcIdBadge}>
              {/* Lanyard punch cutout slot */}
              <View style={styles.lanyardPunchArea}>
                <View style={styles.lanyardHole} />
              </View>

              {/* Top Navy Blue Header Banner */}
              <View style={styles.idCardHeader}>
                <Text style={styles.firmNameText} numberOfLines={1}>
                  {orgName}
                </Text>
                <Text style={styles.idCardTagline}>
                  {isHi ? 'कारीगर पहचान पत्र • LABOUR IDENTITY CARD' : 'LABOUR IDENTITY CARD • OFFICIAL BADGE'}
                </Text>
              </View>

              {/* Metallic Gold Accent Band */}
              <View style={styles.goldBand} />

              {/* Card Inner Body */}
              <View style={styles.idCardBody}>
                {/* Photo Avatar Frame */}
                <View style={styles.photoFrame}>
                  {worker.photo ? (
                    <Image source={{ uri: worker.photo }} style={styles.photoImg} />
                  ) : (
                    <Text style={styles.photoInitials}>{initials}</Text>
                  )}
                  <View style={styles.verifiedShield}>
                    <AppIcon name="checkmark" size={11} color="#FFFFFF" />
                  </View>
                </View>

                {/* Worker Primary Identity */}
                <Text style={styles.workerNameText} numberOfLines={1}>
                  {worker.name}
                </Text>

                <View style={styles.skillBadgeWrap}>
                  <Text style={styles.skillBadgeText}>
                    {worker.skill || (isHi ? 'कुशल कारीगर' : 'Skilled Worker')}
                  </Text>
                </View>

                {/* Standard ID Credentials Table */}
                <View style={styles.credTable}>
                  <View style={styles.credRow}>
                    <Text style={styles.credKey}>{isHi ? 'आईडी नंबर' : 'ID NUMBER'}</Text>
                    <Text style={[styles.credVal, styles.monoId]}>{workerCode}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credKey}>{isHi ? 'मोबाइल' : 'PHONE'}</Text>
                    <Text style={styles.credVal}>{worker.phone || 'N/A'}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credKey}>{isHi ? 'कार्य स्थल' : 'SITE'}</Text>
                    <Text style={styles.credVal} numberOfLines={1}>{siteDisplayName}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credKey}>{isHi ? 'ठेकेदार' : 'CONTRACTOR'}</Text>
                    <Text style={styles.credVal} numberOfLines={1}>{contractorName}</Text>
                  </View>
                  <View style={[styles.credRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.credKey}>{isHi ? 'वैधता' : 'VALID UPTO'}</Text>
                    <Text style={[styles.credVal, { color: '#2563EB', fontWeight: '800' }]}>{validUntilStr}</Text>
                  </View>
                </View>

                {/* Seal & Authorized Signature Section */}
                <View style={styles.authSignatureRow}>
                  <View style={styles.sealBox}>
                    <View style={styles.sealBadge}>
                      <Text style={styles.sealBadgeText}>THEKABOOK</Text>
                      <Text style={styles.sealBadgeSub}>VERIFIED</Text>
                    </View>
                  </View>
                  <View style={styles.signatureBox}>
                    <View style={styles.signLine} />
                    <Text style={styles.signLabel}>
                      {isHi ? 'अधिकृत हस्ताक्षर' : 'Authorized Signature'}
                    </Text>
                  </View>
                </View>

                {/* Bottom Barcode Security Bar */}
                <View style={styles.barcodeSection}>
                  <Text style={styles.barcodeDisplay}>|||| | ||||| || |||| |||</Text>
                  <Text style={styles.securityText}>SECURITY VERIFIED • NON-TRANSFERABLE</Text>
                </View>
              </View>
            </View>

            <Text style={styles.standardSizeNote}>
              {isHi
                ? '📏 मानक CR80 साइज (Standard PVC ID Badge Size)'
                : '📏 Standard CR80 PVC ID Card Size'}
            </Text>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleShareWhatsApp}
              disabled={sharingWhatsApp || busy}
              style={({ pressed }) => [
                styles.shareBtn,
                (sharingWhatsApp || busy) && { opacity: 0.7 },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              {sharingWhatsApp ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppIcon name="logo-whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>
                    {isHi ? 'व्हाट्सएप भेजें' : 'WhatsApp'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handlePrintPdf}
              disabled={busy || sharingWhatsApp}
              style={({ pressed }) => [
                styles.printBtn,
                (busy || sharingWhatsApp) && { opacity: 0.7 },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppIcon name="download-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.printBtnText}>
                    {isHi ? 'आईडी कार्ड डाउनलोड करें' : 'Download ID Card'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 44, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '94%',
    height: '94%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCardDesktop: {
    maxWidth: 460,
    height: '88%',
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },

  /* Standard CR80 PVC ID Card (Width: 292px, Height: 462px - Standard 1:1.58 Ratio) */
  pvcIdBadge: {
    width: 292,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  lanyardPunchArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  lanyardHole: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  idCardHeader: {
    width: '100%',
    backgroundColor: '#1E293B',
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  firmNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  idCardTagline: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  goldBand: {
    width: '100%',
    height: 2.5,
    backgroundColor: '#F59E0B',
  },
  idCardBody: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },

  /* Photo Frame */
  photoFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 7,
    overflow: 'visible',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    resizeMode: 'cover',
  },
  photoInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#475569',
  },
  verifiedShield: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Name & Skill */
  workerNameText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 3,
    textAlign: 'center',
  },
  skillBadgeWrap: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 12,
    marginBottom: 10,
  },
  skillBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* Credential Table */
  credTable: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  credKey: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  credVal: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: '65%',
    textAlign: 'right',
  },
  monoId: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Seal & Signature */
  authSignatureRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sealBox: {
    alignItems: 'flex-start',
  },
  sealBadge: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  sealBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  sealBadgeSub: {
    fontSize: 6.5,
    fontWeight: '700',
    color: '#D97706',
  },
  signatureBox: {
    alignItems: 'center',
    width: 100,
  },
  signLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 3,
  },
  signLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#94A3B8',
  },

  /* Barcode Section */
  barcodeSection: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 4,
    alignItems: 'center',
  },
  barcodeDisplay: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#475569',
    letterSpacing: 2.5,
  },
  securityText: {
    fontSize: 6.5,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginTop: 1,
  },

  standardSizeNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 14,
    fontWeight: '600',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    borderRadius: 10,
  },
  printBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
