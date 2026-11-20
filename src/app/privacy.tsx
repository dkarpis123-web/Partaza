import React from 'react';

import { LegalPage } from '@/components/LegalPage';
import { PRIVACY } from '@/legal/company';

export default function PrivacyScreen() {
  return <LegalPage title="Privatumo politika" sections={PRIVACY} />;
}
