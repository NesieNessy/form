import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/lib/useLayout';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons, type LucideIcon } from '@/theme/icons';

export type MenuItem = { icon: LucideIcon; color: string; title: string; subtitle: string; route: string };

/** A list of destinations, as on the hub tabs and More: one column on phones, a two-column grid on wider screens. */
export function MenuList({ items }: { items: MenuItem[] }) {
  const { wide } = useLayout();
  return (
    <View style={wide ? styles.grid : styles.list}>
      {items.map((item) => (
        <TouchableOpacity key={item.route} style={wide ? styles.cell : undefined} activeOpacity={0.75} onPress={() => router.push(item.route as never)} accessibilityRole="link" accessibilityLabel={item.title}>
          <Card style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
              <item.icon size={20} color={item.color} strokeWidth={iconStrokeWidth} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
            </View>
            <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexBasis: '48%', flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  itemSubtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
});
