import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { readVin } from '@/services/vin';
import { useStore } from '@/store';
import { colors, money, radius } from '@/theme';
import { Text } from '@/components/Text';

const SHOTS = ['1. Visa dalis', '2. Numeris ar lipdukas', '3. Pažeidimai iš arti'];

function notify(message: string) {
  if (Platform.OS === 'web') {
    // Alert.alert does nothing on web.
    window.alert(message);
  } else {
    Alert.alert('Partaza', message);
  }
}

export default function SellScreen() {
  const router = useRouter();
  const { donors, addDonor, registered, live } = useStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [fromDonor, setFromDonor] = useState(false);
  const [whole, setWhole] = useState(false);
  const [donorId, setDonorId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [donorVin, setDonorVin] = useState('');
  const [donorCost, setDonorCost] = useState('');
  const [error, setError] = useState('');

  const donorVinInfo = readVin(donorVin);
  const donorSuggestion = donorVinInfo?.make ? [donorVinInfo.make, donorVinInfo.model, donorVinInfo.year].filter(Boolean).join(' ') : '';

  const saveDonor = async () => {
    const cost = Number(donorCost.replace(',', '.').trim() || '0');
    if (!donorName.trim()) return setError('Įrašykite automobilį, pvz., VW Passat B6 2008.');
    if (!Number.isFinite(cost) || cost < 0) return setError('Įrašykite, už kiek pirkote automobilį, pvz., 900.');
    if (live && !registered) return router.push('/register');
    const result = await addDonor(donorName.trim(), donorVin.trim().toUpperCase(), Math.round(cost * 100) / 100);
    if (!result.id) return setError(result.error ?? 'Nepavyko išsaugoti.');
    setDonorId(result.id);
    setAdding(false);
    setDonorName('');
    setDonorVin('');
    setDonorCost('');
    setError('');
  };

  const add = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          notify('Kad nufotografuotumėte dalį, leiskite programėlei naudoti kamerą.');
          return;
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) {
        setPhotos((current) => [...current, result.assets[0].uri]);
      }
    } catch {
      notify('Nepavyko atidaryti kameros. Pasirinkite nuotrauką iš galerijos.');
    }
  };

  const next = () => {
    if (fromDonor && !donorId) return setError('Pasirinkite automobilį arba pridėkite naują.');
    router.push({ pathname: '/sell/review', params: { photos: JSON.stringify(photos), donor: fromDonor && donorId ? donorId : '', whole: fromDonor && whole ? '1' : '' } });
  };

  return (
    <Page
      footer={
        <Button label={photos.length > 0 ? 'Toliau' : 'Toliau be nuotraukų'} onPress={next} />
      }>
      <Heading>Ką parduodate?</Heading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Pavienė dalis" selected={!fromDonor} onPress={() => { setFromDonor(false); setWhole(false); setError(''); }} />
        <Chip label="Dalys iš ardomo automobilio" selected={fromDonor && !whole} onPress={() => { setFromDonor(true); setWhole(false); setError(''); }} />
        <Chip label="Visas automobilis dalims" selected={fromDonor && whole} onPress={() => { setFromDonor(true); setWhole(true); setError(''); }} />
      </View>
      {fromDonor ? (
        <Card>
          <Muted>{whole ? 'Parduodate visą automobilį vienu skelbimu: pirkėjas pasiima jį visą ir ardo pats. Automobilio pirkimo kainą matote tik jūs.' : 'Automobilį įrašote vieną kartą. Tada kiekvienai jo daliai užtenka nuotraukų, o apskaita parodys, kiek automobilis jau atsipirko. Automobilio kainą matote tik jūs.'}</Muted>
          {donors.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {donors.map((d) => (
                <Chip key={d.id} label={`${d.name} · ${money(d.cost)}`} selected={donorId === d.id} onPress={() => { setDonorId(d.id); setError(''); }} />
              ))}
            </View>
          ) : null}
          {adding || donors.length === 0 ? (
            <>
              <Field label="Automobilis" value={donorName} onChangeText={setDonorName} placeholder="Pvz., VW Passat B6 2008" />
              <Field label="VIN (nebūtina)" value={donorVin} onChangeText={setDonorVin} autoCapitalize="characters" />
              {donorSuggestion && donorSuggestion !== donorName ? (
                <Button label={`Pagal VIN: ${donorSuggestion}`} kind="quiet" onPress={() => setDonorName(donorSuggestion)} />
              ) : null}
              <Field label="Už kiek pirkote, €" value={donorCost} onChangeText={setDonorCost} keyboardType="decimal-pad" placeholder="0" />
              <Button label="Išsaugoti automobilį" kind="outline" onPress={saveDonor} />
            </>
          ) : (
            <Button label="Pridėti kitą automobilį" kind="quiet" onPress={() => setAdding(true)} />
          )}
        </Card>
      ) : null}
      {error ? <Notice tone="warn">{error}</Notice> : null}

      <Heading>{fromDonor && whole ? 'Nufotografuokite automobilį' : 'Nufotografuokite dalį'}</Heading>
      <Muted>Trys nuotraukos, ir skelbimas beveik paruoštas. Pavadinimą, numerį ir kainą padėsime užpildyti kitame žingsnyje.</Muted>

      <Card>
        {SHOTS.map((label, index) => {
          const uri = photos[index];
          return (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {uri ? (
                <Image source={{ uri }} accessibilityLabel={label} resizeMode="contain" style={{ width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.ink }} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.placeholder }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{label}</Text>
                <Text style={{ fontSize: 13, color: uri ? colors.ok : colors.muted }}>{uri ? 'Nufotografuota' : 'Dar nėra'}</Text>
              </View>
              {uri ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Pašalinti nuotrauką: ${label}`}
                  onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                  <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Pašalinti</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Fotografuoti" kind="dark" onPress={() => add('camera')} style={{ flex: 1 }} />
        <Button label="Iš galerijos" kind="outline" onPress={() => add('library')} style={{ flex: 1 }} />
      </View>
      <Muted>Patarimas: nuvalykite dalį, fotografuokite dienos šviesoje ant vienspalvio fono. Pažeidimus nufotografuokite iš arti.</Muted>
    </Page>
  );
}
