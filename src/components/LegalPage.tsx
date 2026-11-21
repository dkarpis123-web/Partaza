import React from 'react';

import { Heading, Muted, Page } from '@/components/ui';
import { COMPANY, type LegalSection } from '@/legal/company';
import { useLang } from '@/i18n';
import { colors } from '@/theme';
import { Text } from '@/components/Text';

/** Terms or privacy policy in the chosen language; the Lithuanian text is the binding one. */
export function LegalPage({ title, sections, english }: { title: string; sections: LegalSection[]; english: LegalSection[] }) {
  const lang = useLang();
  const shown = lang === 'en' ? english : sections;
  return (
    <Page>
      <Heading>{title}</Heading>
      <Muted>{lang === 'en' ? `Version in force from ${COMPANY.version}. This is a translation; in case of differences the Lithuanian text prevails.` : `Redakcija galioja nuo ${COMPANY.version}.`}</Muted>
      {shown.map((section) => (
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
