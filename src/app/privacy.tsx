import React from 'react';

import { LegalPage } from '@/components/LegalPage';
import { PRIVACY } from '@/legal/company';
import { PRIVACY_EN } from '@/legal/en';

export default function PrivacyScreen() {
  return <LegalPage title="Privatumo politika" sections={PRIVACY} english={PRIVACY_EN} />;
}
