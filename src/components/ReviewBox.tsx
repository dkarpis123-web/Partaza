import React, { useState } from 'react';
import { View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Button, Chip, Muted, Notice } from '@/components/ui';
import { useStore } from '@/store';
import { colors, radius } from '@/theme';

export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** After a completed order: rate the other side once (1–5 stars and an optional comment). */
export function ReviewBox({ kind, orderId, subjectIsSeller }: { kind: 'order' | 'payment'; orderId: string; subjectIsSeller: boolean }) {
  const { reviews, me, leaveReview } = useStore();
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const mine = reviews.find((r) => r.orderKind === kind && r.orderId === orderId && r.authorId === me.id);

  if (mine) {
    return (
      <View style={{ gap: 2, marginTop: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{`Jūsų įvertinimas: ${stars(mine.stars)}`}</Text>
        {mine.comment ? <Muted>{mine.comment}</Muted> : null}
      </View>
    );
  }

  const send = async () => {
    if (value === 0) return setProblem('Pasirinkite, kiek žvaigždučių skiriate.');
    setBusy(true);
    setProblem((await leaveReview(kind, orderId, value, comment.trim())) ?? '');
    setBusy(false);
  };

  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{subjectIsSeller ? 'Įvertinkite pardavėją' : 'Įvertinkite pirkėją'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip key={n} label={`${n} ★`} selected={value === n} onPress={() => setValue(n)} />
        ))}
      </View>
      <TextInput
        accessibilityLabel="Atsiliepimas"
        placeholder="Atsiliepimas (nebūtina): kaip sekėsi susitarti, ar dalis atitiko skelbimą…"
        placeholderTextColor={colors.muted}
        value={comment}
        onChangeText={setComment}
        multiline
        style={{ minHeight: 72, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, fontSize: 15, color: colors.ink, textAlignVertical: 'top' }}
      />
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      <Button label={busy ? 'Siunčiama…' : 'Pateikti įvertinimą'} disabled={busy} onPress={send} />
      <Muted>Įvertinimas viešas ir matomas kitiems naudotojams. Pateikus jo pakeisti negalima.</Muted>
    </View>
  );
}
