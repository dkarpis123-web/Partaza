import React, { useState } from 'react';
import { View , Text as PlainText } from 'react-native';

import { Button } from '@/components/ui';
import { type Lang, setLang, useLang, useLangChosen } from '@/i18n';
import { allowLocation, declineLocation, useGeo } from '@/services/geo';
import { colors, radius } from '@/theme';

const NAMES: Record<Lang, string> = { lt: 'Lietuvių', en: 'English' };

/**
 * Two questions on the first visit, one after the other, and nothing is assumed until answered:
 * 1. May we use your location? (then the browser or phone shows its own permission prompt)
 * 2. Which language? We suggest one from the location (or the device), the person confirms or picks the other.
 * Both texts are shown in both languages, because we do not know the person's language yet.
 */
export function FirstVisit() {
  const { consent, place } = useGeo();
  const chosen = useLangChosen();
  const lang = useLang();
  const [busy, setBusy] = useState(false);

  const askLocation = consent === 'asking';
  const askLanguage = !askLocation && consent !== 'unknown' && chosen === false;
  if (!askLocation && !askLanguage) return null;

  const suggested: Lang = place?.country ? (place.country === 'LT' ? 'lt' : 'en') : lang;
  const other: Lang = suggested === 'lt' ? 'en' : 'lt';

  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute', left: 12, right: 12, bottom: 76, alignSelf: 'center', maxWidth: 520, marginHorizontal: 'auto',
        backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      }}>
      {askLocation ? (
        <>
          <PlainText style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Leisti naudoti jūsų vietą? · Use your location?</PlainText>
          <PlainText style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
            Rodysime dalis jūsų šalyje ir mieste. Tikslios vietos nesaugome.{'\n'}We will show parts in your country and city. Your exact position is not stored.
          </PlainText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Ne dabar · Not now" kind="outline" disabled={busy} onPress={declineLocation} style={{ flex: 1 }} />
            <Button
              label={busy ? '…' : 'Leisti · Allow'}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                await allowLocation();
                setBusy(false);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : (
        <>
          <PlainText style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Kalba · Language</PlainText>
          <PlainText style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
            {suggested === 'lt' ? 'Siūlome lietuvių kalbą. · We suggest Lithuanian.' : 'Siūlome anglų kalbą. · We suggest English.'}
          </PlainText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={NAMES[other]} kind="outline" onPress={() => setLang(other)} style={{ flex: 1 }} />
            <Button label={NAMES[suggested]} onPress={() => setLang(suggested)} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </View>
  );
}
