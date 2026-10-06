import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

export type IconSource = 'ion' | 'material';

export interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  source?: IconSource;
  style?: any;
}

export function AppIcon({
  name,
  size = 22,
  color = Colors.textPrimary,
  source = 'ion',
  style,
}: AppIconProps) {
  if (source === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
  }
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
}
