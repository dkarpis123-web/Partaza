import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { type Marks } from '@/components/MarkedPhoto';
import { PhotoEditor } from '@/components/PhotoEditor';
import { Button, Card, Chip, Field, Heading, Muted, Notice, Page } from '@/components/ui';
import { readVin } from '@/services/vin';
import { useStore } from '@/store';
import { money } from '@/theme';

const SHOTS = ['1. Visa dalis', '2. Numeris ar lipdukas', '3. Pažeidimai iš arti'];

export default function SellScreen() {
  const router = useRouter();
  const { donors, addDonor, registered, live } = useStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [marks, setMarks] = useState<Marks>({});
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

  const next = () => {
    if (fromDonor && !donorId) return setError('Pasirinkite automobilį arba pridėkite naują.');
    router.push({ pathname: '/sell/review', params: { photos: JSON.stringify(photos), marks: JSON.stringify(marks), donor: fromDonor && donorId ? donorId : '', whole: fromDonor && whole ? '1' : '' } });
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

      <Muted>{SHOTS.join(' · ')}</Muted>
      <Card>
        <PhotoEditor photos={photos} onChange={setPhotos} marks={marks} onMarks={setMarks} />
      </Card>
      <Muted>Patarimas: nuvalykite dalį, fotografuokite dienos šviesoje ant vienspalvio fono. Pažeidimus nufotografuokite iš arti.</Muted>
    </Page>
  );
}
