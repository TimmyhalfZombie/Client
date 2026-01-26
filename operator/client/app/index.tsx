// app/index.tsx
import { Redirect } from "expo-router";

export default function Index() {
  // First screen shown *after* the splash hides:
  return <Redirect href="/welcome" />;
}
