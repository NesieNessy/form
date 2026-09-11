import { TrendingUp } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { ProgressGoalBar } from '@/components/ui/ProgressGoalBar';
import { goals, prognosis } from '@/lib/mockData';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

export default function GoalsForecastScreen() {
  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.goalsForecastsTitle} subtitle={strings.goalsForecastsSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.cardTitle}>{strings.yourGoals}</Text>
          {goals.map((g) => (
            <ProgressGoalBar
              key={g.id}
              label={g.label}
              currentLabel={g.currentLabel}
              targetLabel={g.targetLabel}
              progressPct={g.progressPct}
            />
          ))}
        </Card>

        <Card style={styles.prognosisCard}>
          <View style={styles.prognosisIconWrap}>
            <TrendingUp size={18} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.prognosisTitle}>{strings.forecast}</Text>
            <Text style={styles.prognosisBody}>{prognosis}</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: spacing.lg },
  prognosisCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.cardAlt,
  },
  prognosisIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: `${colors.teal}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prognosisTitle: { color: colors.text, fontSize: 13.5, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: 4 },
  prognosisBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
