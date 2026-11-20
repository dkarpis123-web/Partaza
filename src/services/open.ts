import { Linking, Platform } from 'react-native';

/** Leaves the app for an outside page (Stripe checkout, seller onboarding). */
export function openExternal(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }
  Linking.openURL(url).catch(() => {});
}
