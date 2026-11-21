import React from 'react';
import { View } from 'react-native';

import { Chip, Muted } from '@/components/ui';
import { tr } from '@/i18n';
import { type WebPrices } from '@/services/ai';
import { money } from '@/theme';

/** Share taken off the lowest market price when the part has damage. */
const DAMAGE_DISCOUNT = 0.2;

/** The prices worth choosing from after a market search: for a damaged part, lowest minus 20 %; then lowest and average. */
export function priceOptions(prices: WebPrices, damaged: boolean): { label: string; value: number }[] {
  const low = Math.round(prices.low ?? 0);
  const typical = Math.round(prices.typical ?? 0);
  const options: { label: string; value: number }[] = [];
  if (damaged && low > 0) options.push({ label: 'Su pažeidimais (−20 % nuo mažiausios)', value: Math.max(1, Math.round(low * (1 - DAMAGE_DISCOUNT))) });
  if (low > 0) options.push({ label: damaged ? 'Mažiausia rinkoje (be pažeidimų)' : 'Mažiausia rinkoje', value: low });
  if (typical > 0 && typical !== low) options.push({ label: damaged ? 'Vidutinė rinkoje (be pažeidimų)' : 'Vidutinė rinkoje', value: typical });
  return options;
}

export function PriceOptions({ prices, damaged, current, onUse }: { prices: WebPrices; damaged: boolean; current?: number | null; onUse?: (value: number) => void }) {
  const options = priceOptions(prices, damaged);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip key={o.label} label={`${tr(o.label)}: ${money(o.value)}`} selected={current === o.value} onPress={() => onUse?.(o.value)} />
        ))}
      </View>
      <Muted>
        {damaged
          ? 'Nurodėte pažeidimų, todėl siūlome kainą 20 % mažesnę už mažiausią rinkoje. Kitos dvi – palyginimui, tokiai pačiai daliai be pažeidimų.'
          : 'Mažiausia kaina parduoda greičiau, vidutinė – įprasta rinkos kaina.'}
      </Muted>
    </View>
  );
}
