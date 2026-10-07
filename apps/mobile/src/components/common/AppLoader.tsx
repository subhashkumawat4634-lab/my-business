import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { AppIcon } from '../icons/AppIcon';

interface AppLoaderProps {
  message?: string;
}

export function AppLoader({ message = 'Loading...' }: AppLoaderProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Smooth spinner rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2. Subtle pulse on icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [rotateAnim, pulseAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Animated Icon with Spinner Ring */}
        <View style={styles.spinnerWrapper}>
          <Animated.View style={[styles.rotatingRing, { transform: [{ rotate: spin }] }]}>
            <View style={styles.ringDot} />
          </Animated.View>

          <Animated.View style={[styles.centerIconBox, { transform: [{ scale: pulseAnim }] }]}>
            <AppIcon name="business" size={18} color="#2563EB" />
          </Animated.View>
        </View>

        {/* Brand & Loading Message */}
        <Text style={styles.brandTitle}>
          Theka<Text style={styles.brandAccent}>Book</Text>
        </Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    minWidth: 180,
  },
  spinnerWrapper: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  rotatingRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: '#EFF6FF',
    borderTopColor: '#2563EB',
    borderRightColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ringDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1D4ED8',
    marginTop: -3.5,
  },
  centerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  brandAccent: {
    color: '#2563EB',
  },
  messageText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
});
