import { promoted } from '@/services/match';
import { fitVerdict } from '@/services/fitment';
import { Link } from 'expo-router';
import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { DefectBadge } from '@/components/ui';
import { tr, useLang } from '@/i18n';
import { countryName, flagOf } from '@/services/geo';
import { useStore } from '@/store';
import { colors, money, radius } from '@/theme';
import { CONDITION_LABELS, Listing } from '@/types';
import { Text } from '@/components/Text';

/** whole: show the entire photo (nothing cut off, e.g. a part number at the edge); otherwise it fills the frame. */
export function Photo({ uri, height, whole = false }: { uri?: string; height: number; whole?: boolean }) {
  if (uri) {
    return <Image source={{ uri }} accessibilityLabel="Dalies nuotrauka" resizeMode={whole ? 'contain' : 'cover'} style={{ width: '100%', height, backgroundColor: whole ? colors.ink : colors.placeholder }} />;
  }
  return (
    <View style={{ height, backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>Nuotraukos nėra</Text>
    </View>
  );
}

export function deliveryText(listing: Listing): string {
  if (listing.shipping === null) return listing.shippingQuote ? 'Siuntimo kaina – pagal užklausą' : 'Tik atsiėmimas vietoje';
  return `+ ${money(listing.shipping)} pristatymas`;
}

export function ListingCard({ listing }: { listing: Listing }) {
  useLang();
  const { userById, myCar } = useStore();
  const fitsMine = !!myCar && fitVerdict(listing, myCar) === 'fits';
  const seller = userById(listing.sellerId);
  const hasDefects = listing.defects.length > 0;
  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${listing.title}, ${money(listing.price)}`}
        style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
        <View>
          <Photo uri={listing.photos[0]} height={120} />
          <View style={{ position: 'absolute', left: 8, top: 8 }}>
            <DefectBadge hasDefects={hasDefects} />
            {promoted(listing) ? (
              <View style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.accent }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Iškeltas</Text>
              </View>
            ) : null}
            {listing.wholeVehicle ? (
              <View style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.ink }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Visas automobilis</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ padding: 12, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '500', color: colors.ink }}>{listing.title}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>
            {money(listing.price)}{' '}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.muted }}>{listing.vat ? 'su PVM' : 'be PVM'}</Text>
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{CONDITION_LABELS[listing.condition]} · {flagOf(listing.country) ? `${flagOf(listing.country)} ` : ''}{listing.city}, {countryName(listing.country)}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {seller.kind === 'business' ? 'Verslas' : 'Privatus'}{seller.reviews > 0 ? ` · ★ ${seller.rating.toFixed(1).replace('.', ',')} (${seller.reviews})` : ` · ${tr('naujas pardavėjas')}`}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{deliveryText(listing)}</Text>
          {fitsMine ? <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D' }}>{`✓ ${tr('Tinka jūsų automobiliui')}`}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
}

/** Responsive grid: 2 columns on phones, more on wide screens. */
export function ListingGrid({ listings, width }: { listings: Listing[]; width: number }) {
  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  const rows: Listing[][] = [];
  for (let i = 0; i < listings.length; i += columns) rows.push(listings.slice(i, i + columns));
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
          {Array.from({ length: columns - row.length }).map((_, filler) => (
            <View key={`f${filler}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
