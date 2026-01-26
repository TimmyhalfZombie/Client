import { useState, useCallback } from 'react';
import type { Router } from 'expo-router';
import { tokens } from '../../auth/tokenStore';

type Stage = 'hidden' | 'confirm' | 'success';

export function useLogoutFlow(router: Router) {
  const [stage, setStage] = useState<Stage>('hidden');

  // open the confirm dialog
  const openConfirm = useCallback(() => setStage('confirm'), []);

  // close everything (from X / backdrop / "No" button)
  const cancel = useCallback(() => setStage('hidden'), []);

  // actually clear tokens then show success state
  const confirmLogout = useCallback(async () => {
    try {
      tokens.clear();
      await tokens.clearStorage();
      setStage('success');
    } catch {
      // even on error we can navigate out if you want; for now, just show success
      setStage('success');
    }
  }, []);

  // navigate away from success screen
  const goToLogin = useCallback(() => {
    setStage('hidden');
    router.replace('/(auth)/login');
  }, [router]);

  const visible = stage !== 'hidden';

  return { stage, visible, openConfirm, cancel, confirmLogout, goToLogin };
}
