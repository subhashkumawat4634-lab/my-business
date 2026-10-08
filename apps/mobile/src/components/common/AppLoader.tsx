import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PageSkeleton } from './Skeleton';
import { AppIcon } from '../icons/AppIcon';

interface AppLoaderProps {
  message?: string;
}

export function AppLoader({ message = 'Loading...' }: AppLoaderProps) {
  return (
    <View style={styles.root}>
      {/* Full Page Modern Skeleton Placeholder */}
      <PageSkeleton />

      {/* Floating Status Pill */}
      <View style={styles.floatingPillContainer}>
        <View style={styles.floatingPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.pillText}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  floatingPillContainer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F2851',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
