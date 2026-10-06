import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search by name…',
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <AppIcon name="search-outline" size={18} color="#64748B" />
      <TextInput
        style={[
          styles.input,
          Platform.OS === 'web'
            ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
            : undefined,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: 'transparent',
  },
});
