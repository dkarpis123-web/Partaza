import React from 'react';

import { LegalPage } from '@/components/LegalPage';
import { TERMS } from '@/legal/company';

export default function TermsScreen() {
  return <LegalPage title="Naudojimosi taisyklės" sections={TERMS} />;
}
