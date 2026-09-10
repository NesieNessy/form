import { ChevronRight, Images, PenLine, Upload, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { WizardHeader } from './WizardHeader';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';

type Option = {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

type Props = {
  onBack: () => void;
  onUploadScreenshot: () => void;
  onChooseFromGallery: () => void;
  onEnterManually: () => void;
};

export function StepChooseMethod({ onBack, onUploadScreenshot, onChooseFromGallery, onEnterManually }: Props) {
  const options: Option[] = [
    {
      icon: Upload,
      color: colors.blue,
      title: 'Upload Screenshot',
      subtitle: 'PNG, JPG or HEIC',
      onPress: onUploadScreenshot,
    },
    {
      icon: Images,
      color: colors.purple,
      title: 'Choose from Gallery',
      subtitle: 'Pick a photo from your library',
      onPress: onChooseFromGallery,
    },
    {
      icon: PenLine,
      color: colors.teal,
      title: 'Enter Manually',
      subtitle: 'Type in the details yourself',
      onPress: onEnterManually,
    },
  ];

  return (
    <View style={styles.screen}>
      <WizardHeader title="New Workout" subtitle="How would you like to create it?" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {options.map((opt) => (
          <TouchableOpacity key={opt.title} activeOpacity={0.75} onPress={opt.onPress}>
            <Card style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: `${opt.color}22` }]}>
                <opt.icon size={20} color={opt.color} strokeWidth={iconStrokeWidth} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.title}>{opt.title}</Text>
                <Text style={styles.subtitle}>{opt.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  subtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
});
