import { View, Text } from 'react-native';
import type { DoctorBadgeData } from '@healthcare/shared/doctor-badge';

export function DoctorChip({ d }: { d: DoctorBadgeData }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        padding: 6,
        borderRadius: 6,
        borderWidth: 1,
        flexWrap: 'wrap',
      }}
    >
      {d.verifiedSlmc && (
        <Text style={{ fontSize: 10, color: '#15803d', fontWeight: '600' }}>
          ✓ SLMC
        </Text>
      )}
      <Text style={{ fontWeight: '600' }}>{d.name}</Text>
      <Text style={{ fontSize: 12, color: '#666' }}>{d.specialty}</Text>
      {d.yearsExperience > 0 && (
        <Text style={{ fontSize: 11 }}>{d.yearsExperience}y</Text>
      )}
      {d.feeLkr > 0 && (
        <Text style={{ fontSize: 11 }}>LKR {d.feeLkr.toLocaleString()}</Text>
      )}
      {d.replyTimeMedianMinutes != null && (
        <Text style={{ fontSize: 10, color: '#1d4ed8' }}>
          ~{d.replyTimeMedianMinutes}m
        </Text>
      )}
    </View>
  );
}
