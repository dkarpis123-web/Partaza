import React from 'react';
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';

import { tr, useLang } from '@/i18n';

function translate(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return tr(children);
  if (Array.isArray(children)) {
    // "{count} skelbimai" arrives as pieces; joined, it can be matched as one sentence.
    if (children.every((c) => typeof c === 'string' || typeof c === 'number')) return tr(children.join(''));
    return children.map((c) => (typeof c === 'string' ? tr(c) : c));
  }
  return children;
}

/** Drop-in replacement for React Native's Text that shows its text in the chosen language. */
export function Text({ children, ...props }: TextProps) {
  useLang();
  return <NativeText {...props}>{translate(children)}</NativeText>;
}

export function TextInput({ placeholder, ...props }: TextInputProps) {
  useLang();
  return <NativeTextInput {...props} placeholder={placeholder ? tr(placeholder) : placeholder} />;
}
