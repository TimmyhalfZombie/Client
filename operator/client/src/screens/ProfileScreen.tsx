import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import ProfileCard from '../components/ProfileCard';
import { fetchProfile, type ProfileData } from './functions/profile';
import { useLogoutFlow } from './functions/LogoutFlow';
import LogoutFlowModal from '../components/LogoutFlowModal';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>({ username: '', phone: '', email: '' });

  // logout flow control
  const {
    stage, visible, openConfirm, cancel, confirmLogout, goToLogin,
  } = useLogoutFlow(router);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await fetchProfile();
        if (mounted) setProfile(p);
      } catch (e) {
        console.log('profile load failed:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <ProfileCard profile={profile} onLogoutPress={openConfirm} />

      {/* modal over the screen (dims background automatically) */}
      <LogoutFlowModal
        visible={visible}
        stage={stage === 'confirm' ? 'confirm' : 'success'}
        onCancel={cancel}
        onConfirm={confirmLogout}
        onGoToLogin={goToLogin}
      />
    </>
  );
}
