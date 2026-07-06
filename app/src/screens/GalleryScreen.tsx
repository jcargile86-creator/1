import React, { useRef } from 'react';
import { SectionList, ScrollView, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { PhotoRecord } from '../types';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

/** Pre-submit photo review: every photo in report order, grouped the way
 *  the PDF assembles them, with a jump bar to skip between sections. */
export default function GalleryScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { getInspection } = useInspections();
  const inspection = getInspection(id);
  const flow = inspection ? getFlow(inspection.flowId) : undefined;
  const listRef = useRef<SectionList<PhotoRecord>>(null);
  const pendingJump = useRef<number | null>(null);

  if (!inspection || !flow) return null;

  const order = new Map<string, number>();
  flow.sections.forEach((s, i) => order.set(s.id, i));
  const sorted = [...inspection.photos].sort((a, b) => {
    const sa = order.get(a.sectionId) ?? 99;
    const sb = order.get(b.sectionId) ?? 99;
    if (sa !== sb) return sa - sb;
    return a.takenAt.localeCompare(b.takenAt);
  });

  const groups: { title: string; data: PhotoRecord[] }[] = [];
  for (const p of sorted) {
    const section = flow.sections.find((s) => s.id === p.sectionId);
    const title = section ? (p.instance ? `${section.title} — ${p.instance}` : section.title) : 'Other';
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.data.push(p);
    else groups.push({ title, data: [p] });
  }

  const jumpTo = (sectionIndex: number) => {
    pendingJump.current = sectionIndex;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, viewOffset: 0, animated: true });
  };

  return (
    <View style={styles.container}>
      {groups.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jumpBar} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, alignItems: 'center' }}>
          {groups.map((g, i) => (
            <Pressable key={g.title} style={styles.jumpChip} onPress={() => jumpTo(i)}>
              <Text style={styles.jumpText}>{g.title}</Text>
              <Text style={styles.jumpCount}>{g.data.length}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <SectionList
        ref={listRef}
        style={{ flex: 1 }}
        sections={groups}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        stickySectionHeadersEnabled={false}
        onScrollToIndexFailed={(info) => {
          // Far sections aren't measured yet — coarse scroll, then retry.
          const responder = (listRef.current as unknown as { getScrollResponder?: () => { scrollTo: (o: { y: number; animated: boolean }) => void } })?.getScrollResponder?.();
          responder?.scrollTo({ y: info.averageItemLength * info.index, animated: true });
          const target = pendingJump.current;
          if (target !== null) {
            setTimeout(() => {
              listRef.current?.scrollToLocation({ sectionIndex: target, itemIndex: 0, viewPosition: 0, animated: true });
            }, 350);
          }
        }}
        ListHeaderComponent={
          <Text style={styles.intro}>
            {sorted.length} photos in report order. Tap any photo to edit its caption, retake, or add more.
          </Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>No photos yet.</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{section.title}</Text>
            <Text style={styles.groupCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              item.promptId
                ? navigation.navigate('PhotoReview', { id, sectionId: item.sectionId, promptId: item.promptId, instance: item.instance })
                : undefined
            }
          >
            <Image source={{ uri: item.previewUri ?? item.uri }} style={styles.photo} />
            <View style={styles.captionRow}>
              <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
              <Text style={styles.time}>{new Date(item.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  jumpBar: { maxHeight: 52, flexGrow: 0, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.grayLine, paddingVertical: 8 },
  jumpChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1.5, borderColor: colors.grayLine, paddingHorizontal: 12, height: 34 },
  jumpText: { fontSize: 13, fontWeight: '800', color: colors.navy },
  jumpCount: { fontSize: 12, fontWeight: '800', color: colors.grayText },
  intro: { fontSize: 13, color: colors.grayText, marginBottom: spacing.sm },
  empty: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  groupCount: { fontSize: 13, fontWeight: '800', color: colors.grayText },
  card: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, marginBottom: spacing.sm, overflow: 'hidden' },
  photo: { width: '100%', height: 300, backgroundColor: '#111' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, paddingHorizontal: spacing.md },
  caption: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  time: { fontSize: 12, color: colors.grayText },
});
