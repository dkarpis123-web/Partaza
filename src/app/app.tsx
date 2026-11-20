import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Button, Card, Heading, Muted, Notice, Page } from '@/components/ui';
import { openExternal } from '@/services/open';

interface AndroidBuild {
  url: string | null;
  version: string | null;
  built: string | null;
}

/** Where the test version of the phone app can be downloaded. The link is refreshed by every new build. */
export default function AppScreen() {
  const [build, setBuild] = useState<AndroidBuild | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    fetch(`/android.json?t=${Date.now()}`)
      .then((r) => r.json())
      .then(setBuild)
      .catch(() => setFailed(true));
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <Page>
        <Notice>Jūs jau naudojate programėlę. Naujausią bandomąją versiją rasite svetainėje partaza.eu/app.</Notice>
      </Page>
    );
  }

  const date = build?.built ? new Date(build.built).toLocaleDateString('lt-LT') : '';
  return (
    <Page>
      <Notice tone="warn">Bandomoji versija: programėlė dar tobulinama ir parduotuvėse jos nėra.</Notice>
      <Card>
        <Heading>„Android“ telefonui</Heading>
        {build?.url ? (
          <>
            <Button label="Atsisiųsti programėlę (APK)" onPress={() => openExternal(build.url as string)} />
            <Muted>{`Versija ${build.version ?? ''} · ${date}`}</Muted>
            <Muted>Atsisiuntę atidarykite failą. Telefonas paklaus, ar leisti diegti iš šio šaltinio – leiskite.</Muted>
          </>
        ) : (
          <Muted>{failed ? 'Nepavyko patikrinti, ar yra programėlė. Bandykite vėliau.' : build ? 'Programėlė dar ruošiama. Užsukite vėliau.' : 'Kraunama…'}</Muted>
        )}
      </Card>
      <Card>
        <Heading>„iPhone“ ir kiti telefonai</Heading>
        <Muted>Naršyklėje atidarykite partaza.eu ir pasirinkite „Pridėti prie pradžios ekrano“. Svetainė atsidarys kaip programėlė, be naršyklės juostos.</Muted>
      </Card>
    </Page>
  );
}
