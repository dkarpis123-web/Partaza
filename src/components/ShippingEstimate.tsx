import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Muted, Notice } from '@/components/ui';
import { tr } from '@/i18n';
import { type ShippingEstimate as Estimate } from '@/services/ai';
import { countryName } from '@/services/geo';
import { openExternal } from '@/services/open';
import { useStore } from '@/store';
import { money } from '@/theme';

/** "AI: rough shipping price" – looks up the part's weight and size and carrier prices between two countries. */
export function ShippingEstimate({ title, oem, fits, from, to, current, onUse }: { title: string; oem: string; fits: string; from: string; to: string; current?: number | null; onUse?: (price: number) => void }) {
  const { aiShipping, registered } = useStore();
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [problem, setProblem] = useState('');
  const route = `${from}-${to}`;
  const shown = asked === route ? estimate : null;

  const ask = async () => {
    setBusy(true);
    setProblem('');
    const answer = await aiShipping({ title, oem, fits, from, to });
    setBusy(false);
    setAsked(route);
    setEstimate(answer.estimate ?? null);
    setProblem(answer.error ?? '');
  };

  if (!registered) return null;
  const middle = shown?.found ? Math.round((((shown.low ?? 0) + (shown.high ?? 0)) / 2) * 2) / 2 : 0;
  return (
    <View style={{ gap: 8 }}>
      <Button label={busy ? 'DI ieško siuntimo kainų…' : `${tr('DI: preliminari siuntimo kaina')} (${countryName(from)} → ${countryName(to)})`} kind="outline" disabled={busy} onPress={ask} />
      {busy ? <Muted>DI įvertina dalies svorį ir pakuotės dydį, tada ieško pašto ir kurjerių kainų. Tai užtrunka apie pusę minutės.</Muted> : null}
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {shown && !shown.found ? <Muted>{`${tr('Siuntimo kainų šiam maršrutui neradome.')} ${shown.note}`}</Muted> : null}
      {shown?.found ? (
        <>
          <Notice>
            {`${tr('Preliminari siuntimo kaina')}: ${money(shown.low ?? 0)}–${money(shown.high ?? 0)}.${shown.weightKg ? ` ${tr('Svoris apie')} ${shown.weightKg} kg.` : ''}${shown.size ? ` ${tr('Pakuotė apie')} ${shown.size} cm.` : ''} ${shown.note}`}
          </Notice>
          {onUse ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[shown.low ?? 0, middle, shown.high ?? 0].filter((v, i, all) => v > 0 && all.indexOf(v) === i).map((v) => (
                <Chip key={v} label={current === v ? `${tr('Pritaikyta')}: ${money(v)}` : money(v)} selected={current === v} onPress={() => onUse(v)} />
              ))}
            </View>
          ) : null}
          {shown.sources.map((s) => (
            <Button key={s.url} label={s.title} kind="quiet" onPress={() => openExternal(s.url)} />
          ))}
          <Muted>Tai DI įvertinimas pagal viešus kainoraščius, ne pasiūlymas. Tikrą kainą nustato pardavėjas ir vežėjas.</Muted>
        </>
      ) : null}
    </View>
  );
}
