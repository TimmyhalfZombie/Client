import { Redirect } from 'expo-router';

export default function NotFound() {
  // Any unknown route goes to Home
  return <Redirect href="/home" />;
}
