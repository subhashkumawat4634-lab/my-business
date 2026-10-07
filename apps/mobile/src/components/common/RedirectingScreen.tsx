import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface RedirectingScreenProps {
  title?: string;
  subtitle?: string;
}

export function RedirectingScreen({
  title = 'Setting up your Workspace...',
  subtitle = 'Syncing sites, attendance records & financial ledger',
}: RedirectingScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Fade in whole screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // 2. Pulse Emblem
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Continuous Spinner Rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 4. Smooth 3-second Progress bar fill to 100%
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fadeAnim, pulseAnim, rotateAnim, progressAnim]);

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['15%', '100%'],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Background Ambient Aura */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.contentContainer}>
        {/* Animated Emblem Box */}
        <Animated.View
          style={[
            styles.emblemContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.emblemAura} />
          <View style={styles.emblemBox}>
            <AppIcon name="shield-checkmark" size={36} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* Brand Name */}
        <Text style={styles.brandTitle}>
          Theka<Text style={styles.brandAccent}>Book</Text>
        </Text>

        {/* Title & Status */}
        <View style={styles.textWrap}>
          <Text style={styles.mainTitle}>{title}</Text>
          <Text style={styles.subTitle}>{subtitle}</Text>
        </View>

        {/* Animated Progress Bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>

        {/* Dynamic Status Pill */}
        <View style={styles.statusPill}>
          <Animated.View
            style={{
              transform: [{ rotate: spinInterpolate }],
            }}
          >
            <AppIcon name="sync-outline" size={14} color="#0284C7" />
          </Animated.View>
          <Text style={styles.statusPillText}>Redirecting safely...</Text>
        </View>
      </View>

      {/* Security Note at Bottom */}
      <View style={styles.footerRow}>
        <AppIcon name="lock-closed" size={12} color="#64748B" />
        <Text style={styles.footerText}>
          Encrypted Session • Tamper-Proof Financial Ledger
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  glowTop: {
    position: 'absolute',
    top: -60,
    left: '20%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#DBEAFE',
    opacity: 0.6,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -60,
    right: '20%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#E0E7FF',
    opacity: 0.5,
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  emblemContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emblemAura: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#93C5FD',
    opacity: 0.45,
  },
  emblemBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  brandAccent: {
    color: '#2563EB',
  },
  textWrap: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 240,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0369A1',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
