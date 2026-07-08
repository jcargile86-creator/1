import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { Inspection, ClaimStatus } from '../types';
import { buildMonthGrid, dayKey, dayKeyOf, formatDayLabel, formatTime, WEEKDAY_LABELS } from '../lib/schedule';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

function statusLabel(s: ClaimStatus): string {
  return s === 'pending' ? 'Pending' : s === 'in_progress' ? 'In Progress' : s === 'completed' ? 'Submitted' : 'Declined';
}

/** Appointment calendar — plots scheduled claims by day with a per-day
 *  agenda. Opened from the calendar icon in the Home header. */
export default function CalendarScreen({ navigation }: Props) {
  const { inspections } = useInspections();
  const today = new Date();
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string>(dayKeyOf(today));

  const byDay = useMemo(() => {
    const m: Record<string, Inspection[]> = {};
    for (const c of inspections) {
      if (!c.scheduledAt || c.status === 'declined') continue;
      const k = dayKey(c.scheduledAt);
      (m[k] = m[k] ?? []).push(c);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
    return m;
  }, [inspections]);

  const grid = useMemo(() => buildMonthGrid(ym.year, ym.month), [ym]);
  const step = (delta: number) => {
    const m = ym.month + delta;
    setYm({ year: ym.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };
  const todayKey = dayKeyOf(today);
  const dayClaims = byDay[selected] ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
      <View style={styles.calHeader}>
        <Pressable onPress={() => step(-1)} hitSlop={12} style={styles.calNav}><Text style={styles.calNavText}>‹</Text></Pressable>
        <Text style={styles.calTitle}>{grid.label}</Text>
        <Pressable onPress={() => step(1)} hitSlop={12} style={styles.calNav}><Text style={styles.calNavText}>›</Text></Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <Text key={i} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {grid.cells.map((cell, i) => {
          if (!cell) return <View key={i} style={styles.calCell} />;
          const k = dayKeyOf(cell);
          const count = (byDay[k] ?? []).length;
          const isSel = k === selected;
          const isToday = k === todayKey;
          return (
            <Pressable key={i} style={[styles.calCell, isSel && styles.calCellSel]} onPress={() => setSelected(k)}>
              <Text style={[styles.calDay, isToday && styles.calDayToday, isSel && styles.calDaySel]}>{cell.getDate()}</Text>
              {count > 0 && <View style={[styles.calDot, isSel && { backgroundColor: colors.white }]} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.agendaHeader}>{formatDayLabel(`${selected}T12:00:00`)}</Text>
      {dayClaims.length === 0 ? (
        <Text style={styles.agendaEmpty}>No appointments this day.</Text>
      ) : (
        dayClaims.map((c) => (
          <Pressable key={c.id} style={styles.agendaRow} onPress={() => navigation.navigate('Inspection', { id: c.id })}>
            <Text style={styles.agendaTime}>{c.scheduledAt ? formatTime(c.scheduledAt) : '—'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.agendaTitle}>{c.claim.insured || 'Unnamed insured'}</Text>
              <Text style={styles.agendaSub}>{c.claim.lossAddress || 'no address'} · {statusLabel(c.status)}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  calNav: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  calNavText: { fontSize: 28, color: colors.navy, fontWeight: '800' },
  calTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.grayText, marginBottom: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellSel: { backgroundColor: colors.navy, borderRadius: 10 },
  calDay: { fontSize: 15, fontWeight: '600', color: colors.ink },
  calDayToday: { color: colors.red, fontWeight: '800' },
  calDaySel: { color: colors.white, fontWeight: '800' },
  calDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginTop: 2 },
  agendaHeader: { fontSize: 15, fontWeight: '800', color: colors.navy, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  agendaEmpty: { color: colors.grayText, fontSize: 14, fontStyle: 'italic' },
  agendaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, padding: spacing.md, marginBottom: 6, gap: spacing.sm },
  agendaTime: { fontSize: 14, fontWeight: '800', color: colors.navy, width: 74 },
  agendaTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  agendaSub: { fontSize: 12, color: colors.grayText, marginTop: 1 },
  chev: { fontSize: 26, color: colors.grayLine, marginLeft: spacing.sm },
});
