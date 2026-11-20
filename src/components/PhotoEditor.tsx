import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Muted } from '@/components/ui';
import { colors, radius } from '@/theme';

export const MAX_PHOTOS = 8;

/** Thumbnails with a remove button on each, plus "take a photo" and "from gallery". */
export function PhotoEditor({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const [problem, setProblem] = useState('');
  const full = photos.length >= MAX_PHOTOS;

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
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) onChange([...photos, result.assets[0].uri].slice(0, MAX_PHOTOS));
    } catch {
      setProblem('Nepavyko atidaryti kameros. Pasirinkite nuotrauką iš galerijos.');
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={{ alignItems: 'center', gap: 4 }}>
              <Image source={{ uri }} accessibilityLabel={`Nuotrauka ${index + 1}`} style={{ width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.placeholder }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pašalinti nuotrauką ${index + 1}`}
                onPress={() => onChange(photos.filter((_, i) => i !== index))}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Pašalinti</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Muted>Nuotraukų dar nėra.</Muted>
      )}
      {full ? (
        <Muted>Daugiausia {MAX_PHOTOS} nuotraukos. Norėdami pridėti kitą, vieną pašalinkite.</Muted>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Fotografuoti" kind="outline" onPress={() => add('camera')} style={{ flex: 1 }} />
          <Button label="Pridėti iš galerijos" kind="outline" onPress={() => add('library')} style={{ flex: 1 }} />
        </View>
      )}
      {problem ? <Text style={{ fontSize: 13, color: colors.warn }}>{problem}</Text> : null}
    </View>
  );
}
