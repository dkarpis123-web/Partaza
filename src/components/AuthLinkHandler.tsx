import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useStore } from '@/store';

/**
 * Web only: when someone arrives from a link in an e-mail (address confirmation or password
 * reset), the link carries a one-time sign-in in the part of the address after "#".
 * This finishes the sign-in, removes that part from the address bar and opens the right screen.
 * In the phone apps the same links will need deep-link setup; that is not done yet.
 */
export function AuthLinkHandler() {
  const router = useRouter();
  const { completeAuthLink } = useStore();
  const handled = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || handled.current) return;
    const hash = window.location.hash;
    if (!hash || !/(access_token|error)=/.test(hash)) return;
    handled.current = true;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    completeAuthLink(hash).then((result) => {
      if (result.kind === 'recovery') router.replace('/reset');
      else if (result.kind === 'signedIn') router.replace('/profile');
      else if (result.kind === 'error') router.replace({ pathname: '/register', params: { notice: result.message ?? '', mode: 'signIn' } });
    });
  }, [completeAuthLink, router]);

  return null;
}
