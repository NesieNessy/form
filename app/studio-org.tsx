import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClassList } from '@/components/studio/ClassList';
import { PeoplePanel } from '@/components/studio/PeoplePanel';
import { PlansPanel } from '@/components/studio/PlansPanel';
import { ReportPanel } from '@/components/studio/ReportPanel';
import { StaffPanel } from '@/components/studio/StaffPanel';
import { s } from '@/components/studio/styles';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { leaveStudio, myOrganizations, studioPeople } from '@/lib/studio/api';
import { BILLING_LABEL, isAdmin, isStaff, MEMBERSHIP_STATUS_LABEL, ROLE_LABEL, type Organization, type People } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { colors, spacing } from '@/theme/colors';

type Tab = 'classes' | 'people' | 'plans' | 'staff' | 'report';

/** One studio. Members book classes and see their membership; staff see what their role allows. */
export default function StudioOrgScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [people, setPeople] = useState<People | null>(null);
  const [tab, setTab] = useState<Tab>('classes');
  const [toast, setToast] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    const res = await myOrganizations();
    if (!res.ok) return setToast(res.error);
    const found = res.data.find((o) => o.id === id) ?? null;
    setOrg(found);
    if (found && isAdmin(found.role)) {
      const p = await studioPeople(found.id);
      if (p.ok) setPeople(p.data);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!org) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.studioTitle} />
      </View>
    );
  }

  const admin = isAdmin(org.role);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'classes', label: strings.tabClasses },
    ...(admin ? [{ key: 'people' as Tab, label: strings.tabPeople }, { key: 'plans' as Tab, label: strings.tabPlans }] : []),
    ...(isStaff(org.role) ? [{ key: 'staff' as Tab, label: strings.tabStaff }] : []),
    ...(admin ? [{ key: 'report' as Tab, label: strings.tabReport }] : []),
  ];
  const ms = org.membership;

  return (
    <View style={styles.screen}>
      <DetailHeader title={org.name} subtitle={ROLE_LABEL[org.role]} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tabs.length > 1 ? <SegmentedTabs options={tabs} value={tab} onChange={(k) => setTab(k as Tab)} scrollable size="sm" /> : null}

        {tab === 'classes' ? (
          <>
            {org.role === 'member' || ms ? (
              <Card style={s.card}>
                <Text style={s.title}>{strings.yourMembership}</Text>
                <Text style={s.body}>
                  {ms
                    ? [ms.plan, MEMBERSHIP_STATUS_LABEL[ms.status], BILLING_LABEL[ms.billing_status], ms.classes_remaining !== null ? strings.classesLeft(ms.classes_remaining) : undefined, ms.paid_until ? strings.paidUntil(ms.paid_until) : undefined]
                        .filter(Boolean)
                        .join(' · ')
                    : strings.noMembership}
                </Text>
              </Card>
            ) : null}
            <ClassList org={org} onToast={setToast} />
          </>
        ) : null}
        {tab === 'people' && people ? <PeoplePanel org={org} people={people} reload={load} onToast={setToast} /> : null}
        {tab === 'plans' && people ? <PlansPanel org={org} people={people} reload={load} onToast={setToast} /> : null}
        {tab === 'staff' ? <StaffPanel org={org} people={people} onToast={setToast} /> : null}
        {tab === 'report' ? <ReportPanel orgId={org.id} onToast={setToast} /> : null}

        <Text style={s.hint}>{strings.studioPrivacyNote}</Text>
        {org.role !== 'owner' ? (
          confirmLeave ? (
            <Card style={s.card}>
              <Text style={s.body}>{strings.leaveStudioBody}</Text>
              <View style={s.row}>
                <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmLeave(false)} />
                <GradientButton
                  label={strings.leaveStudio}
                  style={{ flex: 1 }}
                  onPress={async () => {
                    const res = await leaveStudio(org.id);
                    if (!res.ok) return setToast(res.error);
                    router.back();
                  }}
                />
              </View>
            </Card>
          ) : (
            <GradientButton label={strings.leaveStudio} variant="tertiary" onPress={() => setConfirmLeave(true)} />
          )
        ) : null}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
});
