import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AppIcon } from '../icons/AppIcon';
import { BillImageViewerModal } from './BillImageViewerModal';

export interface BillAttachmentPickerProps {
  photoUrl?: string;
  photoName?: string;
  onPhotoSelected: (dataUrl: string, name: string) => void;
  onPhotoRemoved: () => void;
  lang?: string;
}

export function BillAttachmentPicker({
  photoUrl,
  photoName,
  onPhotoSelected,
  onPhotoRemoved,
}: BillAttachmentPickerProps) {
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const resizeAndProcessImage = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) {
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
            onPhotoSelected(optimizedDataUrl, file.name || 'bill_photo.jpg');
          } else {
            onPhotoSelected(src, file.name || 'bill_photo.jpg');
          }
          setLoading(false);
        };
        img.onerror = () => {
          onPhotoSelected(src, file.name || 'bill_photo.jpg');
          setLoading(false);
        };
        img.src = src;
      } else {
        onPhotoSelected(src, file.name || 'bill_photo.jpg');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePickFile = (captureCamera = false) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (captureCamera) {
        input.capture = 'environment';
      }
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          resizeAndProcessImage(file);
        }
      };
      input.click();
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Title Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <AppIcon name="receipt-outline" size={13} color="#2563EB" />
          <Text style={styles.titleText}>BILL & RECEIPT PHOTO</Text>
        </View>
        <Text style={styles.optionalBadge}>OPTIONAL</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Processing photo...</Text>
        </View>
      ) : photoUrl ? (
        /* Sleek Attached File Card */
        <View style={styles.attachedCard}>
          {/* Left Thumbnail (Clickable to open viewer) */}
          <Pressable
            onPress={() => setViewerOpen(true)}
            style={({ pressed }) => [
              styles.thumbnailWrapper,
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityLabel="Tap thumbnail photo to view full image"
          >
            <Image source={{ uri: photoUrl }} style={styles.thumbnailImg} />
            <View style={styles.zoomPill}>
              <AppIcon name="expand-outline" size={9} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Center Info */}
          <View style={styles.infoCol}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {photoName || 'bill_receipt.jpg'}
            </Text>
            <View style={styles.attachedStatusRow}>
              <View style={styles.greenDot} />
              <Text style={styles.attachedStatusText}>Tap to view</Text>
            </View>
          </View>

          {/* Right Action: Delete Button */}
          <Pressable
            onPress={onPhotoRemoved}
            style={({ pressed }) => [
              styles.iconActionBtn,
              styles.removeBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            accessibilityLabel="Remove photo"
          >
            <AppIcon name="trash-outline" size={14} color="#DC2626" />
          </Pressable>
        </View>
      ) : (
        /* Empty Upload Dropzone */
        <View style={styles.emptyDropzone}>
          <View style={styles.btnRow}>
            <Pressable
              onPress={() => handlePickFile(true)}
              style={({ pressed }) => [
                styles.uploadBtn,
                pressed && { opacity: 0.75, backgroundColor: '#DBEAFE' },
              ]}
            >
              <AppIcon name="camera-outline" size={15} color="#2563EB" />
              <Text style={styles.uploadBtnText}>Camera</Text>
            </Pressable>

            <Pressable
              onPress={() => handlePickFile(false)}
              style={({ pressed }) => [
                styles.uploadBtn,
                pressed && { opacity: 0.75, backgroundColor: '#DBEAFE' },
              ]}
            >
              <AppIcon name="images-outline" size={15} color="#2563EB" />
              <Text style={styles.uploadBtnText}>Gallery</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Full Size Image Viewer Modal */}
      {photoUrl ? (
        <BillImageViewerModal
          visible={viewerOpen}
          imageUrl={photoUrl}
          title={photoName || 'Bill Receipt Photo'}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  optionalBadge: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  loadingBox: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Attached File Card */
  attachedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 7,
    gap: 9,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  zoomPill: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 3,
    padding: 2,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  fileNameText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  attachedStatusText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '600',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  removeBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  /* Empty Dropzone */
  emptyDropzone: {
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
