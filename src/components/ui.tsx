import React from 'react';
import { Pressable, ScrollView, StyleProp, TextInputProps, View, ViewStyle } from 'react-native';

import { MAX_WIDTH, colors, radius } from '@/theme';
import { VehicleIcon, type VehicleIconName } from '@/components/VehicleIcon';
import { Text, TextInput } from '@/components/Text';

/** Scrollable page with a centred, width-limited column (works on phone and desktop). */
export function Page({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_WIDTH, padding: 16, gap: 12 }}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: MAX_WIDTH, padding: 12, paddingHorizontal: 16 }}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 10 },
        style,
      ]}>
      {children}
    </View>
  );
}

type ButtonKind = 'primary' | 'outline' | 'dark' | 'quiet';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = kind === 'primary' ? colors.accent : kind === 'dark' ? colors.ink : kind === 'outline' ? colors.surface : 'transparent';
  const fg = kind === 'primary' || kind === 'dark' ? '#FFFFFF' : kind === 'quiet' ? colors.accent : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: 48, paddingHorizontal: 16, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
          backgroundColor: bg, opacity: disabled ? 0.5 : 1,
          borderWidth: kind === 'outline' ? 2 : 0, borderColor: colors.ink,
        },
        style,
      ]}>
      <Text style={{ color: fg, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: VehicleIconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: selected ? colors.ink : colors.surface,
        borderWidth: 1, borderColor: selected ? colors.ink : colors.border,
      }}>
      {icon ? <VehicleIcon name={icon} size={20} color={selected ? '#FFFFFF' : colors.ink} aria-hidden /> : null}
      <Text style={{ color: selected ? '#FFFFFF' : colors.ink, fontSize: 14, fontWeight: selected ? '600' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function DefectBadge({ hasDefects, count }: { hasDefects: boolean; count?: number }) {
  const text = hasDefects ? (count ? `Yra defektų: ${count}` : 'Yra defektų') : 'Be defektų';
  return (
    <View
      style={{
        alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 8, borderWidth: 1,
        backgroundColor: hasDefects ? colors.warnSoft : colors.okSoft,
        borderColor: hasDefects ? colors.warnBorder : colors.okBorder,
      }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: hasDefects ? colors.warn : colors.ok }}>{text}</Text>
    </View>
  );
}

export function Field({ label, hint, error, ...input }: { label: string; hint?: string; error?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...input}
        style={[
          {
            minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: error ? 2 : 1, borderColor: error ? '#B42318' : colors.border,
            borderRadius: radius.md, backgroundColor: colors.surface, fontSize: 15, color: colors.ink,
          },
          input.style,
        ]}
      />
      {error ? <Text style={{ fontSize: 13, fontWeight: '600', color: '#B42318' }}>{error}</Text> : null}
      {hint ? <Text style={{ fontSize: 12, color: colors.muted }}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontSize: 14, color: strong ? colors.warn : colors.muted, fontWeight: strong ? '600' : '400' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: strong ? colors.warn : colors.ink, fontWeight: strong ? '600' : '500', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>{children}</Text>;
}

export function Notice({ children, tone = 'ok' }: { children: React.ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <View
      style={{
        padding: 12, borderRadius: radius.md,
        backgroundColor: tone === 'ok' ? colors.okSoft : colors.warnSoft,
        borderWidth: tone === 'warn' ? 2 : 0, borderColor: colors.warnBorder,
      }}>
      <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: tone === 'ok' ? colors.ok : colors.warn }}>{children}</Text>
    </View>
  );
}
