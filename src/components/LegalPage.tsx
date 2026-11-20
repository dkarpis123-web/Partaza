import React from 'react';
import { Text } from 'react-native';

import { Heading, Muted, Page } from '@/components/ui';
import { COMPANY, type LegalSection } from '@/legal/company';
import { colors } from '@/theme';

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <Page>
      <Heading>{title}</Heading>
      <Muted>Redakcija galioja nuo {COMPANY.version}.</Muted>
      {sections.map((section) => (
        <React.Fragment key={section.title}>
          <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 8 }}>{section.title}</Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text key={index} style={{ fontSize: 15, lineHeight: 23, color: colors.ink }}>{paragraph}</Text>
          ))}
        </React.Fragment>
      ))}
    </Page>
  );
}
