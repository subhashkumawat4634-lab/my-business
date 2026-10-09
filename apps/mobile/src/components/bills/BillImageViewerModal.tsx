import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../icons/AppIcon';
import { triggerBrowserDownload } from '../../storage/docStorage';

export interface BillImageViewerModalProps {
  visible: boolean;
  imageUrl: string;
  title?: string;
  date?: string;
  amount?: number | string;
  party?: string;
  onClose: () => void;
}

export function BillImageViewerModal({
  visible,
  imageUrl,
  title = 'Bill / Parchi Photo',
  date,
  amount,
  party,
  onClose,
}: BillImageViewerModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  if (!visible || !imageUrl) return null;

  const handleDownload = () => {
    if (Platform.OS === 'web') {
      triggerBrowserDownload(imageUrl, `${title.replace(/\s+/g, '_')}.jpg`);
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
        <SafeAreaView style={[styles.container, isDesktop && styles.containerDesktop]}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <AppIcon name="receipt" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                {(date || party || amount) ? (
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {[
                      date ? `📅 ${date}` : null,
                      party ? `👤 ${party}` : null,
                      amount ? `💰 ₹${Number(amount).toLocaleString('en-IN')}` : null,
                    ]
                      .filter(Boolean)
                      .join('  •  ')}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.headerActions}>
              {Platform.OS === 'web' ? (
                <Pressable
                  onPress={handleDownload}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel="Download Bill Photo"
                >
                  <AppIcon name="download-outline" size={20} color="#FFFFFF" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
                accessibilityLabel="Close photo viewer"
              >
                <AppIcon name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Image Container */}
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>

          {/* Footer Note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ThekaBook Digital Bill & Expense Verification Record
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  containerDesktop: {
    maxWidth: 900,
    maxHeight: '92%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
});
