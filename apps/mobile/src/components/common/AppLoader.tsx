import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { AppIcon } from '../icons/AppIcon';

interface AppLoaderProps {
  message?: string;
  subtitle?: string;
}

const THEME_STEPS = [
  { icon: 'business', label: 'Sites & Projects', color: '#2563EB' },
  { icon: 'people', label: 'Labour & Haziri', color: '#16A34A' },
  { icon: 'wallet', label: 'Hisab & Ledger', color: '#D97706' },
  { icon: 'shield-checkmark', label: 'Verified Ledger', color: '#0F2851' },
];

export function AppLoader({ message = 'ThekaBook', subtitle }: AppLoaderProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const iconFadeAnim = useRef(new Animated.Value(1)).current;

  // 3 Bouncing Dots
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance spring & fade
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous Ring Rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 3. Pulsing Aura
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 4. Staggered Bouncing Dots
    const bounce = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -4,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(500 - delay),
        ])
      );
    };

    bounce(dot1Anim, 0).start();
    bounce(dot2Anim, 140).start();
    bounce(dot3Anim, 280).start();

    // 5. Cycling Icon Transition every 1.5 seconds
    const interval = setInterval(() => {
      Animated.timing(iconFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStepIndex((prev) => (prev + 1) % THEME_STEPS.length);
        Animated.timing(iconFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [fadeAnim, scaleAnim, rotateAnim, pulseAnim, dot1Anim, dot2Anim, dot3Anim, iconFadeAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const currentStep = THEME_STEPS[stepIndex]!;

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.loadingCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Animated Construction & Ledger Icon Centerpiece */}
        <View style={styles.iconContainer}>
          {/* Pulsing Glow Aura */}
          <Animated.View
            style={[
              styles.pulseAura,
              {
                backgroundColor: currentStep.color,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          {/* Rotating Construction-Tech Dual Ring */}
          <Animated.View
            style={[
              styles.rotatingRing,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          />

          {/* Morphing Contractor Emblem Core */}
          <Animated.View
            style={[
              styles.emblemCore,
              {
                backgroundColor: currentStep.color,
                opacity: iconFadeAnim,
              },
            ]}
          >
            <AppIcon name={currentStep.icon as any} size={22} color="#FFFFFF" />
          </Animated.View>
        </View>

        {/* Brand Title with Bouncing Dots */}
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>
            Theka<Text style={styles.brandAccent}>Book</Text>
          </Text>
          <View style={styles.dotsRow}>
            <Animated.View style={[styles.dot, { transform: [{ translateY: dot1Anim }] }]} />
            <Animated.View style={[styles.dot, { transform: [{ translateY: dot2Anim }] }]} />
            <Animated.View style={[styles.dot, { transform: [{ translateY: dot3Anim }] }]} />
          </View>
        </View>

        {/* Dynamic Contractor Subtitle Chip */}
        <Animated.View style={[styles.subChip, { opacity: iconFadeAnim }]}>
          <Text style={[styles.subChipText, { color: currentStep.color }]}>
            {subtitle || currentStep.label}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 28,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 5,
    minWidth: 175,
  },
  iconContainer: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 2,
  },
  pulseAura: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    opacity: 0.25,
  },
  rotatingRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#2563EB',
    borderTopColor: '#F59E0B',
    borderRightColor: 'transparent',
  },
  emblemCore: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandAccent: {
    color: '#2563EB',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  subChip: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  subChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

