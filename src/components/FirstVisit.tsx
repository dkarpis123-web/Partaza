import React, { useState } from 'react';
import { View , Text as PlainText } from 'react-native';

import { Button } from '@/components/ui';
import { Flag } from '@/components/Flag';
import { LANGUAGES, type Lang, setLang, useLang, useLangChosen } from '@/i18n';
import { allowLocation, declineLocation, useGeo } from '@/services/geo';
import { colors, radius } from '@/theme';

/** The language most people in a country read, among the ones the app has. */
const BY_COUNTRY: Record<string, Lang> = { LT: 'lt', LV: 'lv', EE: 'et', PL: 'pl', DE: 'de', AT: 'de', CH: 'de', RU: 'ru', BY: 'ru', UA: 'ru', KZ: 'ru' };

/**
 * Two questions on the first visit, one after the other, and nothing is assumed until answered:
 * 1. May we use your location? (then the browser or phone shows its own permission prompt)
 * 2. Which language? We suggest one from the location (or the device), the person confirms it or picks another.
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

  const suggested: Lang = place?.country ? BY_COUNTRY[place.country] ?? 'en' : lang;
  const name = LANGUAGES.find((l) => l.code === suggested)?.name ?? 'English';

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
          <PlainText style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>{`Siūlome · We suggest: ${name}`}</PlainText>
          <Button label={name} icon={<Flag lang={suggested} />} onPress={() => setLang(suggested)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LANGUAGES.filter((l) => l.code !== suggested).map((l) => (
              <Button key={l.code} label={l.name} icon={<Flag lang={l.code} />} kind="outline" onPress={() => setLang(l.code)} style={{ flexGrow: 1, minWidth: 110 }} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
