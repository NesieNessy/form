import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FieldCard } from '@/components/workout/FieldCard';
import { assignMembership, inviteToStudio, removeFromStudio, revokeStudioInvite, updateMembership } from '@/lib/studio/api';
import { BILLING_LABEL, MEMBERSHIP_STATUS_LABEL, ROLE_LABEL, type OrgRole, type Organization, type People, type Person } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { s } from './styles';

type InviteRole = Exclude<OrgRole, 'owner'>;

/** Owners and managers: staff seats, invitations, and each person's role and membership. Nothing about their training. */
export function PeoplePanel({ org, people, reload, onToast }: { org: Organization; people: People; reload: () => Promise<void>; onToast: (m: string) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [busy, setBusy] = useState(false);
  const roles: InviteRole[] = org.role === 'owner' ? ['member', 'instructor', 'coach', 'physiotherapist', 'manager'] : ['member', 'instructor', 'coach', 'physiotherapist'];
  const activePlans = people.plans.filter((p) => p.active);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) onToast(res.error ?? '');
    await reload();
  };

  return (
    <View style={{ gap: 8 }}>
      <Card style={s.card}>
        <Text style={s.title}>{strings.invitePerson}</Text>
        <Text style={s.hint}>{strings.staffSeats(people.seats_used, people.staff_seats)}</Text>
        <FieldCard label={strings.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" cardStyle={s.inset} />
        <Text style={s.label}>{strings.inviteRole}</Text>
        <SegmentedTabs options={roles.map((r) => ({ key: r, label: ROLE_LABEL[r] }))} value={role} onChange={(k) => setRole(k as InviteRole)} scrollable size="sm" />
        <GradientButton
          label={busy ? strings.saving : strings.invitePerson}
          onPress={email.trim() && !busy ? () => void run(async () => {
            const res = await inviteToStudio(org.id, email, role);
            if (res.ok) {
              onToast(strings.invitationFor(email.trim(), res.data.invite_code));
              setEmail('');
            }
            return res;
          }) : undefined}
        />
      </Card>

      {people.invites.length ? (
        <Card style={s.card}>
          <Text style={s.title}>{strings.openInvites}</Text>
          {people.invites.map((i) => (
            <View key={i.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{`${i.email} · ${ROLE_LABEL[i.role]}`}</Text>
                <Text selectable style={s.value}>{i.code}</Text>
              </View>
              <TouchableOpacity onPress={() => void run(() => revokeStudioInvite(i.id))} hitSlop={8}>
                <Text style={s.danger}>{strings.revoke}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      ) : null}

      {people.people.map((p) => (
        <PersonCard key={p.user_id} person={p} org={org} plans={activePlans} run={run} />
      ))}
    </View>
  );
}

function PersonCard({ person: p, org, plans, run }: { person: Person; org: Organization; plans: People['plans']; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<void> }) {
  const [plan, setPlan] = useState(plans[0]?.id ?? '');
  const ms = p.membership;
  const removable = p.role !== 'owner' && (p.role !== 'manager' || org.role === 'owner');
  return (
    <Card style={s.card}>
      <View style={s.row}>
        <Text style={[s.title, { flex: 1 }]}>{p.name ?? strings.someone}</Text>
        <Text style={s.meta}>{ROLE_LABEL[p.role]}</Text>
      </View>
      {ms ? (
        <>
          <Text style={s.body}>
            {[ms.plan, MEMBERSHIP_STATUS_LABEL[ms.status], BILLING_LABEL[ms.billing_status], ms.classes_remaining !== null ? strings.classesLeft(ms.classes_remaining) : undefined, ms.paid_until ? strings.paidUntil(ms.paid_until) : undefined]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={s.wrap}>
            {ms.billing_status !== 'paid' && ms.billing_status !== 'none' ? (
              <TouchableOpacity style={s.pill} onPress={() => void run(() => updateMembership(ms.id, null, 'paid', new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)))}>
                <Text style={s.pillText}>{strings.markPaid}</Text>
              </TouchableOpacity>
            ) : null}
            {ms.billing_status !== 'overdue' && ms.billing_status !== 'none' ? (
              <TouchableOpacity style={s.pill} onPress={() => void run(() => updateMembership(ms.id, null, 'overdue'))}>
                <Text style={s.pillText}>{strings.markOverdue}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={s.pill} onPress={() => void run(() => updateMembership(ms.id, ms.status === 'paused' ? 'active' : 'paused', null))}>
              <Text style={s.pillText}>{ms.status === 'paused' ? strings.resumeMembership : strings.pauseMembership}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.pill} onPress={() => void run(() => updateMembership(ms.id, 'ended', null))}>
              <Text style={s.pillText}>{strings.endMembership}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : plans.length ? (
        <>
          <SegmentedTabs options={plans.map((x) => ({ key: x.id, label: x.name }))} value={plan} onChange={setPlan} scrollable size="sm" />
          <GradientButton label={strings.startPlan} variant="secondary" onPress={plan ? () => void run(() => assignMembership(org.id, p.user_id, plan)) : undefined} accessibilityLabel={`${strings.startPlan}: ${p.name ?? ''}`} />
        </>
      ) : null}
      {removable ? (
        <TouchableOpacity onPress={() => void run(() => removeFromStudio(org.id, p.user_id))} hitSlop={8}>
          <Text style={s.danger}>{strings.remove}</Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}
