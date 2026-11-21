import React from 'react';

import { LegalPage } from '@/components/LegalPage';
import { TERMS } from '@/legal/company';
import { TERMS_EN } from '@/legal/en';

export default function TermsScreen() {
  return <LegalPage title="Naudojimosi taisyklės" sections={TERMS} english={TERMS_EN} />;
}
