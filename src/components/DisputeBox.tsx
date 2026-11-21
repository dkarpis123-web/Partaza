import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Button, Card, Chip, Field, Muted, Notice } from '@/components/ui';
import { tr } from '@/i18n';
import { useStore } from '@/store';
import { colors } from '@/theme';
import { DISPUTE_LABELS, type DisputeKind, type DisputeMessage, type PaidOrder } from '@/types';

const KINDS = Object.keys(DISPUTE_LABELS) as DisputeKind[];

const when = (value: number) => new Date(value).toLocaleString('lt-LT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** The buyer's form for reporting a problem with a paid order: what kind of problem, and what happened. */
export function ReportProblem({ order, busy, onSend }: { order: PaidOrder; busy: boolean; onSend: (kind: DisputeKind, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DisputeKind | null>(null);
  const [reason, setReason] = useState('');
  const [hint, setHint] = useState('');
  if (!open) return <Button label="Pranešti apie problemą" kind="quiet" onPress={() => setOpen(true)} />;
  const kinds = order.status === 'paid' ? KINDS.filter((k) => k === 'not_received' || k === 'other') : KINDS;
  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Kas negerai?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {kinds.map((k) => (
          <Chip key={k} label={DISPUTE_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      {kind === 'no_fit' ? (
        <Muted>Parašykite savo automobilio markę, modelį, metus ir kur dalis nesutampa. Jei skelbime šis automobilis buvo nurodytas kaip tinkantis, tai skelbimo neatitikimas.</Muted>
      ) : null}
      <Field
        label="Aprašykite, kas nutiko"
        hint="Pinigai bus sulaikyti. Pardavėjas matys jūsų aprašymą ir galės parašyti savo paaiškinimą."
        value={reason}
        onChangeText={setReason}
        multiline
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />
      {hint ? <Notice tone="warn">{hint}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Atšaukti" kind="outline" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <Button
          label="Siųsti"
          kind="dark"
          disabled={busy}
          onPress={() => {
            if (!kind) return setHint('Pasirinkite, kokia tai problema.');
            if (reason.trim().length < 10) return setHint('Aprašykite problemą bent keliais žodžiais.');
            setHint('');
            onSend(kind, reason.trim());
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

/** An open dispute: the buyer's report, then both sides' explanations in order, and what each side can do. */
export function DisputeBox({ order, buyer, busy, onStep }: { order: PaidOrder; buyer: boolean; busy: boolean; onStep: (step: 'dispute_withdraw' | 'dispute_refund') => void }) {
  const { loadDispute, sendDispute, me } = useStore();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const [confirm, setConfirm] = useState(false);
  const open = order.status === 'disputed';

  useEffect(() => {
    let active = true;
    loadDispute(order.id).then((rows) => active && setMessages(rows));
    return () => {
      active = false;
    };
  }, [order.id, loadDispute]);

  const send = async () => {
    if (text.trim().length < 2 || sending) return;
    setSending(true);
    const failure = await sendDispute(order.id, text);
    if (!failure) {
      setText('');
      setMessages(await loadDispute(order.id));
    }
    setSending(false);
    setProblem(failure ?? '');
  };

  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{`${tr('Ginčas')}${order.disputeKind ? `: ${tr(DISPUTE_LABELS[order.disputeKind])}` : ''}`}</Text>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{buyer ? 'Jūsų pranešimas' : 'Pirkėjo pranešimas'}</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>{order.disputeReason}</Text>
      </View>
      {messages.map((m) => {
        const mine = m.authorId === me.id;
        const fromBuyer = m.authorId === order.buyerId;
        return (
          <View key={m.id} style={{ gap: 2, padding: 10, borderRadius: 10, backgroundColor: mine ? colors.accentSoft : colors.bg }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{`${tr(mine ? 'Jūs' : fromBuyer ? 'Pirkėjas' : 'Pardavėjas')} · ${when(m.createdAt)}`}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>{m.body}</Text>
          </View>
        );
      })}
      {open ? (
        <>
          <Field
            label={buyer ? 'Papildyti' : 'Jūsų paaiškinimas'}
            hint="Abi pusės mato visus paaiškinimus. Sprendimą priima Partaza administratorius, juos peržiūrėjęs."
            value={text}
            onChangeText={setText}
            multiline
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          {problem ? <Notice tone="warn">{problem}</Notice> : null}
          <Button label={sending ? 'Siunčiama…' : 'Siųsti paaiškinimą'} kind="dark" disabled={sending || text.trim().length < 2} onPress={send} />
          {confirm ? (
            <>
              <Notice tone="warn">{buyer ? 'Atsiėmus pranešimą, užsakymas tęsiamas ir pinigai po patikros laiko bus pervesti pardavėjui.' : 'Visa pirkėjo sumokėta suma bus grąžinta pirkėjui. Šio veiksmo atšaukti negalima.'}</Notice>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Ne" kind="outline" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
                <Button label={buyer ? 'Taip, atsiimti' : 'Taip, grąžinti pinigus'} disabled={busy} onPress={() => onStep(buyer ? 'dispute_withdraw' : 'dispute_refund')} style={{ flex: 2 }} />
              </View>
            </>
          ) : (
            <Button label={buyer ? 'Problema išspręsta – atsiimti pranešimą' : 'Sutinku – grąžinti pinigus pirkėjui'} kind="outline" disabled={busy} onPress={() => setConfirm(true)} />
          )}
        </>
      ) : null}
    </Card>
  );
}
