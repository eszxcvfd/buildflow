import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '600' }}>BuildFlow Mobile</Text>
      <Text style={{ marginTop: 12, textAlign: 'center', color: '#666' }}>
        Technical foundation only. Business screens land in a later phase.
      </Text>
    </View>
  );
}
