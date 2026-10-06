import { Text, View } from 'react-native';

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const colors = {
    success: { bg: '#DCFCE7', text: '#166534' },
    warning: { bg: '#FEF3C7', text: '#92400E' },
    danger: { bg: '#FEE2E2', text: '#991B1B' },
    neutral: { bg: '#E2E8F0', text: '#334155' }
  }[tone];
  return <View style={{ backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{label}</Text></View>;
}
