import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Stepper } from '@/components/ui/Stepper';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  visible: boolean;
  time: Date;
  onClose: () => void;
  onSelect: (time: Date) => void;
};

function to12Hour(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 % 12 === 12 ? 0 : hour12 % 12;
  return hour12 % 12 === 12 ? 12 : (hour12 % 12) + 12;
}

export function TimePickerModal({ visible, time, onClose, onSelect }: Props) {
  const initial = to12Hour(time.getHours());
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(time.getMinutes());
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  useEffect(() => {
    if (visible) {
      const next = to12Hour(time.getHours());
      setHour12(next.hour12);
      setMinute(time.getMinutes());
      setPeriod(next.period);
    }
  }, [visible, time]);

  const handleDone = () => {
    const next = new Date(time);
    next.setHours(to24Hour(hour12, period), minute, 0, 0);
    onSelect(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Hour</Text>
              <Stepper value={hour12} onChange={setHour12} min={1} max={12} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Minute</Text>
              <Stepper value={minute} onChange={setMinute} min={0} max={55} step={5} />
            </View>
          </View>
          <SegmentedTabs
            options={[
              { key: 'AM', label: 'AM' },
              { key: 'PM', label: 'PM' },
            ]}
            value={period}
            onChange={(k) => setPeriod(k as 'AM' | 'PM')}
          />
          <GradientButton label={strings.done} onPress={handleDone} style={styles.doneBtn} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: 6 },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  doneBtn: { marginTop: spacing.xs },
});
