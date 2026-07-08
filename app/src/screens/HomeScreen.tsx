import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { deleteInspectionPhotos } from '../store/photos';
import { Inspection, ClaimStatus } from '../types';
import {
  buildMonthGrid,
  dayKey,
  dayKeyOf,
  formatDateTime,
  formatDayLabel,
  formatTime,
  relativeSince,
  WEEKDAY_LABELS,
} from '../lib/schedule';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type Tab = 'pending' | 'calendar' | 'active' | 'done';

export default function HomeScreen({ navigation }: Props) {
  const { inspections, loading, deleteInspection, acceptInspection, declineInspection } = useInspections();
  const [tab, setTab] = useState<Tab>('pending');

  const groups = useMemo(() => {
    const g: Record<ClaimStatus, Inspection[]> = { pending: [], in_progress: [], completed: [], declined: [] };
    for (const i of inspections) g[i.status ?? 'in_progress'].push(i);
    g.pending.sort((a, b) => (a.scheduledAt ?? a.assignedAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.assignedAt ?? b.createdAt));
    return g;
  }, [inspections]);

  const unseenCount = groups.pending.filter((i) => i.seen === false).length;

  const confirmDelete = (id: string, label: string) => {
    Alert.alert('Delete claim?', `${label} and all its photos will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteInspectionPhotos(id);
          void deleteInspection(id);
        },
      },
    ]);
  };

  const confirmDecline = (i: Inspection) => {
    Alert.alert('Decline this claim?', `${i.claim.insured || i.claim.claimNumber || 'This claim'} will move to Declined and won't be worked.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => void declineInspection(i.id) },
    ]);
  };

  const openInspection = (id: string) => navigation.navigate('Inspection', { id });

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: groups.pending.length },
    { key: 'calendar', label: 'Calendar', count: 0 },
    { key: 'active', label: 'Active', count: groups.in_progress.length },
    { key: 'done', label: 'Completed', count: groups.completed.length },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={[styles.newBtn, { flex: 1 }]} onPress={() => navigation.navigate('NewInspection', { mode: 'now' })}>
          <Text style={styles.newBtnText}>Start New Inspection</Text>
        </Pressable>
        <Pressable style={styles.addAssignBtn} onPress={() => navigation.navigate('NewInspection', { mode: 'assignment' })}>
          <Text style={styles.addAssignText}>＋ Assignment</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const showBadge = t.key === 'pending' && unseenCount > 0;
          return (
            <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]} numberOfLines={1}>
                {t.label}
                {t.count > 0 && t.key !== 'calendar' ? ` ${t.count}` : ''}
              </Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unseenCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {tab === 'pending' && (
        <FlatList
          data={groups.pending}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading…' : 'No pending claims. New assignments from XactAnalysis appear here.'}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, item.seen === false && styles.cardUnseen]}>
              <Pressable onPress={() => openInspection(item.id)} onLongPress={() => confirmDelete(item.id, item.claim.claimNumber || 'Claim')}>
                <View style={styles.cardTopLine}>
                  {item.seen === false && <View style={styles.newDot} />}
                  <Text style={styles.cardTitle}>{item.claim.insured || 'Unnamed insured'}</Text>
                  <View style={[styles.sourcePill, item.source === 'xact' && styles.sourcePillXact]}>
                    <Text style={styles.sourcePillText}>{item.source === 'xact' ? 'XACT' : 'MANUAL'}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>Claim {item.claim.claimNumber || '—'} · {item.claim.lossAddress || 'no address'}</Text>
                <Text style={styles.assignLine}>Assigned {relativeSince(item.assignedAt ?? item.createdAt)}</Text>
                {item.scheduledAt ? (
                  <Text style={styles.schedLine}>📅 {formatDateTime(item.scheduledAt)}</Text>
                ) : (
                  <Text style={styles.schedLineNone}>No appointment time set</Text>
                )}
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable style={[styles.actBtn, styles.declineBtn]} onPress={() => confirmDecline(item)}>
                  <Text style={styles.declineText}>Deny</Text>
                </Pressable>
                <Pressable
                  style={[styles.actBtn, styles.acceptBtn]}
                  onPress={() => {
                    void acceptInspection(item.id);
                    setTab('active');
                  }}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {tab === 'calendar' && <CalendarView claims={inspections} onOpen={openInspection} />}

      {tab === 'active' && (
        <FlatList
          data={groups.in_progress}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={<Text style={styles.empty}>No active inspections. Accept a pending claim or start a new one.</Text>}
          renderItem={({ item }) => <SimpleCard item={item} onOpen={openInspection} onDelete={confirmDelete} />}
        />
      )}

      {tab === 'done' && (
        <FlatList
          data={[...groups.completed, ...groups.declined]}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={<Text style={styles.empty}>Nothing submitted yet.</Text>}
          renderItem={({ item }) => <SimpleCard item={item} onOpen={openInspection} onDelete={confirmDelete} />}
        />
      )}

      <Text style={styles.versionStamp}>
        v{Constants.expoConfig?.version ?? '?'} · runtime {String(Updates.runtimeVersion ?? 'dev')} · update{' '}
        {Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded'}
      </Text>
    </View>
  );
}

function SimpleCard({ item, onOpen, onDelete }: { item: Inspection; onOpen: (id: string) => void; onDelete: (id: string, label: string) => void }) {
  const declined = item.status === 'declined';
  const completed = item.status === 'completed';
  return (
    <Pressable
      style={[styles.card, declined && { opacity: 0.6 }]}
      onPress={() => onOpen(item.id)}
      onLongPress={() => onDelete(item.id, item.claim.claimNumber || 'Claim')}
    >
      <View style={styles.cardTopLine}>
        <Text style={styles.cardTitle}>{item.claim.insured || 'Unnamed insured'}</Text>
        {completed && <View style={styles.donePill}><Text style={styles.donePillText}>✓ SUBMITTED</Text></View>}
        {declined && <View style={styles.declinedPill}><Text style={styles.declinedPillText}>DECLINED</Text></View>}
      </View>
      <Text style={styles.cardSub}>Claim {item.claim.claimNumber || '—'} · {item.claim.lossAddress || 'no address'}</Text>
      <Text style={styles.cardMeta}>
        {item.scheduledAt ? `${formatDateTime(item.scheduledAt)} · ` : ''}
        {item.photos.length} photos
        {completed && item.submittedAt ? ` · submitted ${formatDayLabel(item.submittedAt)}` : ''}
      </Text>
    </Pressable>
  );
}

function CalendarView({ claims, onOpen }: { claims: Inspection[]; onOpen: (id: string) => void }) {
  const today = new Date();
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string>(dayKeyOf(today));

  const byDay = useMemo(() => {
    const m: Record<string, Inspection[]> = {};
    for (const c of claims) {
      if (!c.scheduledAt || c.status === 'declined') continue;
      const k = dayKey(c.scheduledAt);
      (m[k] = m[k] ?? []).push(c);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
    return m;
  }, [claims]);

  const grid = useMemo(() => buildMonthGrid(ym.year, ym.month), [ym]);
  const step = (delta: number) => {
    const m = ym.month + delta;
    setYm({ year: ym.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };
  const todayKey = dayKeyOf(today);
  const dayClaims = byDay[selected] ?? [];

  return (
    <ScrollView contentContainerStyle={styles.listPad}>
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
          <Pressable key={c.id} style={styles.agendaRow} onPress={() => onOpen(c.id)}>
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

function statusLabel(s: ClaimStatus): string {
  return s === 'pending' ? 'Pending' : s === 'in_progress' ? 'In Progress' : s === 'completed' ? 'Submitted' : 'Declined';
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  topRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  newBtn: { backgroundColor: colors.red, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center' },
  newBtnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  addAssignBtn: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy, borderRadius: touch.radius, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  addAssignText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, overflow: 'hidden', marginBottom: spacing.sm },
  tab: { flex: 1, minHeight: touch.minHeight - 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  tabActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 12, fontWeight: '800', color: colors.grayText },
  tabTextActive: { color: colors.white },
  badge: { backgroundColor: colors.red, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  listPad: { paddingBottom: spacing.xl },
  empty: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl, fontSize: 15, paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: touch.radius, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.grayLine },
  cardUnseen: { borderColor: colors.red, borderWidth: 2 },
  cardTopLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.red },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  sourcePill: { backgroundColor: colors.grayText, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sourcePillXact: { backgroundColor: colors.navy },
  sourcePillText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardSub: { fontSize: 14, color: colors.grayText, marginTop: 3 },
  cardMeta: { fontSize: 13, color: colors.grayText, marginTop: 6 },
  assignLine: { fontSize: 12, color: colors.grayText, marginTop: 6, fontWeight: '600' },
  schedLine: { fontSize: 14, color: colors.navy, marginTop: 4, fontWeight: '800' },
  schedLineNone: { fontSize: 13, color: colors.amber, marginTop: 4, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actBtn: { flex: 1, borderRadius: 10, minHeight: touch.minHeight - 6, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: colors.green, flex: 2 },
  acceptText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  declineBtn: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.grayLine },
  declineText: { color: colors.grayText, fontSize: 16, fontWeight: '800' },
  donePill: { backgroundColor: colors.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  donePillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  declinedPill: { backgroundColor: colors.grayText, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  declinedPillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  chev: { fontSize: 26, color: colors.grayLine, marginLeft: spacing.sm },
  versionStamp: { textAlign: 'center', color: colors.grayLine, fontSize: 11, paddingVertical: 4 },
  // calendar
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
});
