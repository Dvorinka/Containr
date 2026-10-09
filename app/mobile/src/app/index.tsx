import { Redirect } from 'expo-router';
import { useSession } from '../session';

export default function Index() {
  const { ready, api } = useSession();
  if (!ready) return null;
  return <Redirect href={api ? '/(tabs)' : '/login'} />;
}
