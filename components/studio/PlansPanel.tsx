import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FieldCard } from '@/components/workout/FieldCard';
import { addFacility, createPlan, setPlanActive } from '@/lib/studio/api';
import { formatPrice, PLAN_KIND_LABEL, type Organization, type People, type PlanKind } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { s } from './styles';

/** Owners and managers: membership plans and locations. */
export function PlansPanel({ org, people, reload, onToast }: { org: Organization; people: People; reload: () => Promise<void>; onToast: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlanKind>('monthly');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [currency, setCurrency] = useState('EUR');
  const [classes, setClasses] = useState<number | undefined>(10);
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');

  const done = async (res: { ok: boolean; error?: string }) => {
    if (!res.ok) onToast(res.error ?? '');
    await reload();
    return res.ok;
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.section}>{strings.plans}</Text>
      <Text style={s.hint}>{strings.billingNote}</Text>
      {people.plans.length === 0 ? <Text style={s.body}>{strings.noPlans}</Text> : null}
      {people.plans.map((p) => (
        <Card key={p.id} style={[s.card, !p.active && { opacity: 0.6 }]}>
          <View style={s.row}>
            <Text style={[s.title, { flex: 1 }]}>{p.name}</Text>
            <Text style={s.value}>{formatPrice(p.price_cents, p.currency)}</Text>
          </View>
          <Text style={s.meta}>{[PLAN_KIND_LABEL[p.kind], p.classes_included ? strings.packClasses(p.classes_included) : undefined].filter(Boolean).join(' · ')}</Text>
          <TouchableOpacity onPress={() => void setPlanActive(p.id, !p.active).then(done)} hitSlop={8}>
            <Text style={s.link}>{p.active ? strings.retirePlan : strings.reactivatePlan}</Text>
          </TouchableOpacity>
        </Card>
      ))}
      {adding ? (
        <Card style={s.card}>
          <FieldCard label={strings.planName} value={name} onChangeText={setName} maxLength={80} cardStyle={s.inset} />
          <SegmentedTabs options={(Object.keys(PLAN_KIND_LABEL) as PlanKind[]).map((k) => ({ key: k, label: PLAN_KIND_LABEL[k] }))} value={kind} onChange={(k) => setKind(k as PlanKind)} size="sm" />
          <View style={s.row}>
            <NumberField label={strings.planPrice} value={price} onChange={setPrice} decimals style={{ flex: 1 }} />
            <FieldCard label={strings.planCurrency} value={currency} onChangeText={(t) => setCurrency(t.toUpperCase())} maxLength={3} autoCapitalize="characters" cardStyle={[s.inset, { flex: 1 }]} />
          </View>
          {kind === 'class_pack' ? <NumberField label={strings.planClasses} value={classes} onChange={setClasses} /> : null}
          <View style={s.row}>
            <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
            <GradientButton
              label={strings.create}
              style={{ flex: 1 }}
              onPress={
                name.trim() && price !== undefined
                  ? async () => {
                      if (await done(await createPlan(org.id, name, kind, Math.round(price * 100), currency, kind === 'class_pack' ? (classes ?? null) : null))) {
                        setAdding(false);
                        setName('');
                        setPrice(undefined);
                      }
                    }
                  : undefined
              }
            />
          </View>
        </Card>
      ) : (
        <GradientButton label={strings.newPlan} variant="secondary" onPress={() => setAdding(true)} />
      )}

      <Text style={s.section}>{strings.locations}</Text>
      <Card style={s.card}>
        {org.facilities.map((f) => (
          <Text key={f.id} style={s.body}>{[f.name, f.address].filter(Boolean).join(' · ')}</Text>
        ))}
        <FieldCard label={strings.locationName} value={location} onChangeText={setLocation} maxLength={80} cardStyle={s.inset} />
        <FieldCard label={strings.locationAddress} value={address} onChangeText={setAddress} maxLength={200} cardStyle={s.inset} />
        <GradientButton
          label={strings.addLocation}
          variant="secondary"
          onPress={location.trim() ? async () => (await done(await addFacility(org.id, location, address))) && (setLocation(''), setAddress('')) : undefined}
        />
      </Card>
    </View>
  );
}
