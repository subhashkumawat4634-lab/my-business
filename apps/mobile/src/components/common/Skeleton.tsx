import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable animated shimmer skeleton element with smooth pulsing effect
 */
export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size = 40,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <SkeletonBox width={size} height={size} borderRadius={size / 2} style={style} />;
}

/**
 * Full page modern placeholder skeleton imitating ThekaBook layout
 */
export function PageSkeleton() {
  return (
    <View style={styles.container}>
      {/* Top Bar Skeleton */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <SkeletonBox width={36} height={36} borderRadius={10} />
          <View style={{ gap: 6 }}>
            <SkeletonBox width={110} height={16} borderRadius={4} />
            <SkeletonBox width={70} height={10} borderRadius={3} />
          </View>
        </View>
        <SkeletonCircle size={38} />
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {/* Hero / Summary Card Skeleton */}
        <View style={styles.heroCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBox width={120} height={14} borderRadius={4} />
            <SkeletonBox width={60} height={20} borderRadius={6} />
          </View>
          <SkeletonBox width={180} height={28} borderRadius={6} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <SkeletonBox width="48%" height={48} borderRadius={10} />
            <SkeletonBox width="48%" height={48} borderRadius={10} />
          </View>
        </View>

        {/* Section Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <SkeletonBox width={130} height={18} borderRadius={4} />
          <SkeletonBox width={70} height={14} borderRadius={4} />
        </View>

        {/* List Card Skeletons */}
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.listCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SkeletonBox width={44} height={44} borderRadius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="70%" height={15} borderRadius={4} />
                <SkeletonBox width="45%" height={11} borderRadius={3} />
              </View>
              <SkeletonBox width={50} height={22} borderRadius={8} />
            </View>
            <View style={styles.cardDivider} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SkeletonBox width="30%" height={12} borderRadius={3} />
              <SkeletonBox width="25%" height={12} borderRadius={3} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  skeletonBase: {
    backgroundColor: '#CBD5E1',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
});
