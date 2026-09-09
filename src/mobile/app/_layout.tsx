import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="projects/index" options={{ title: 'Dự án' }} />
      <Stack.Screen name="projects/[id]" options={{ title: 'Chi tiết dự án' }} />
      <Stack.Screen name="job-board/index" options={{ title: 'Bảng việc' }} />
      <Stack.Screen name="job-board/[id]" options={{ title: 'Chi tiết việc' }} />
    </Stack>
  );
}
