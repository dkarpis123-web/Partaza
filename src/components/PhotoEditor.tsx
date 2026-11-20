import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, Muted } from '@/components/ui';
import { colors, radius } from '@/theme';
import { Text } from '@/components/Text';

export const MAX_PHOTOS = 10;

/** Thumbnails; tapping one opens its actions (move, retake, replace, remove). Plus "take a photo" and "from gallery". */
export function PhotoEditor({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const [problem, setProblem] = useState('');
  const full = photos.length >= MAX_PHOTOS;
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked !== null && picked < photos.length ? picked : null;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    setPicked(to);
  };

  /** Puts a new photo in the same place as the old one. */
  const replace = async (index: number, source: 'camera' | 'library') => {
    setProblem('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setProblem('Kad nufotografuotumėte dalį, leiskite programėlei naudoti kamerą.');
      }
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) onChange(photos.map((uri, i) => (i === index ? result.assets[0].uri : uri)));
    } catch {
      setProblem('Nepavyko atidaryti kameros. Pasirinkite nuotrauką iš galerijos.');
    }
  };

  const add = async (source: 'camera' | 'library') => {
    setProblem('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setProblem('Kad nufotografuotumėte dalį, leiskite programėlei naudoti kamerą.');
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length });
      if (!result.canceled) onChange([...photos, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    } catch {
      setProblem('Nepavyko atidaryti kameros. Pasirinkite nuotrauką iš galerijos.');
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {photos.map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Nuotrauka ${index + 1}`}
              onPress={() => setPicked(selected === index ? null : index)}
              style={{ alignItems: 'center', gap: 4 }}>
              <Image source={{ uri }} resizeMode="contain" style={{ width: 132, height: 132, borderRadius: radius.md, backgroundColor: colors.ink, borderWidth: 3, borderColor: selected === index ? colors.accent : 'transparent' }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: selected === index ? colors.accent : colors.muted }}>{index === 0 ? 'Pagrindinė' : `${index + 1}`}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Muted>Nuotraukų dar nėra.</Muted>
      )}
      {photos.length > 0 && selected === null ? <Muted>Palieskite nuotrauką, kad pakeistumėte jos vietą, perfotografuotumėte ar pašalintumėte.</Muted> : null}
      {selected !== null ? (
        <View style={{ gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{`Nuotrauka ${selected + 1}`}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {selected > 0 ? <Button label="Padaryti pagrindine" kind="outline" onPress={() => move(selected, 0)} /> : null}
            {selected > 0 ? <Button label="← Arčiau pradžios" kind="outline" onPress={() => move(selected, selected - 1)} /> : null}
            {selected < photos.length - 1 ? <Button label="Toliau →" kind="outline" onPress={() => move(selected, selected + 1)} /> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Platform.OS === 'web' ? null : <Button label="Perfotografuoti" kind="outline" onPress={() => replace(selected, 'camera')} />}
            <Button label="Pakeisti kita nuotrauka" kind="outline" onPress={() => replace(selected, 'library')} />
            <Button label="Pašalinti" kind="quiet" onPress={() => { onChange(photos.filter((_, i) => i !== selected)); setPicked(null); }} />
          </View>
        </View>
      ) : null}
      {full ? (
        <Muted>Daugiausia {MAX_PHOTOS} nuotraukų. Norėdami pridėti kitą, vieną pašalinkite.</Muted>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Fotografuoti" kind="outline" onPress={() => add('camera')} style={{ flex: 1 }} />
          <Button label="Pridėti iš galerijos" kind="outline" onPress={() => add('library')} style={{ flex: 1 }} />
        </View>
      )}
      {full ? null : <Muted>Galite įkelti iki {MAX_PHOTOS} nuotraukų – iš galerijos galima pažymėti kelias iš karto.</Muted>}
      {problem ? <Text style={{ fontSize: 13, color: colors.warn }}>{problem}</Text> : null}
    </View>
  );
}
