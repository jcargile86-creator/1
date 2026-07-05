import React, { useLayoutEffect, useState } from 'react';
import { SectionList, View, Text, Pressable, StyleSheet, TextInput, Image, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { buildQueue, isDone, QueueItem } from '../flows/queue';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Section'>;

export default function SectionScreen({ route, navigation }: Props) {
  const { id, sectionId } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const [newInstance, setNewInstance] = useState('');

  const flow = inspection ? getFlow(inspection.flowId) : undefined;
  const section = flow?.sections.find((s) => s.id === sectionId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: section ? `${section.icon} ${section.title}` : 'Section' });
  }, [navigation, section]);

  if (!inspection || !flow || !section) {
    return (
      <View style={styles.center}>
        <Text>Section not found.</Text>
      </View>
    );
  }

  const queue = buildQueue(flow, inspection, sectionId);
  const groups: { title: string; instance?: string; data: QueueItem[] }[] = [];
  if (section.repeat) {
    const instances = inspection.instances[sectionId] ?? [];
    for (const inst of instances) {
      groups.push({ title: `${section.repeat.noun}: ${inst}`, instance: inst, data: queue.filter((q) => q.instance === inst) });
    }
    if (instances.length === 0) groups.push({ title: `No ${section.repeat.noun.toLowerCase()}s yet — add one below`, data: [] });
  } else {
    groups.push({ title: 'Photos', data: queue });
  }

  const addInstance = () => {
    const name = newInstance.trim();
    if (!name) return;
    if ((inspection.instances[sectionId] ?? []).includes(name)) {
      Alert.alert('Already exists', `${section.repeat?.noun} "${name}" is already in the list.`);
      return;
    }
    void updateInspection(id, (d) => {
      d.instances[sectionId] = [...(d.instances[sectionId] ?? []), name];
    });
    setNewInstance('');
  };

  const toggleSkip = (key: string) => {
    void updateInspection(id, (d) => {
      if (d.skipped[key]) delete d.skipped[key];
      else d.skipped[key] = true;
    });
  };

  const photoFor = (q: QueueItem) =>
    inspection.photos.filter((p) => p.sectionId === q.sectionId && p.promptId === q.prompt.id && p.instance === q.instance);

  return (
    <SectionList
      style={styles.container}
      sections={groups}
      keyExtractor={(item) => item.key}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
      ListHeaderComponent={
        <View>
          <Pressable
            style={styles.cameraBtn}
            onPress={() => navigation.navigate('Camera', { id, sectionId })}
          >
            <Text style={styles.cameraText}>📷 Start Camera for This Section</Text>
          </Pressable>
          {section.questions && section.questions.length > 0 && (
            <Pressable style={styles.qBtn} onPress={() => navigation.navigate('Questions', { id, sectionId })}>
              <Text style={styles.qText}>📋 Section Questions</Text>
            </Pressable>
          )}
        </View>
      }
      renderSectionHeader={({ section: g }) => (
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          {g.instance !== undefined && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable style={styles.smallBtn} onPress={() => navigation.navigate('Camera', { id, sectionId, instance: g.instance })}>
                <Text style={styles.smallBtnText}>📷 Shoot</Text>
              </Pressable>
              {section.instanceQuestions && (
                <Pressable style={styles.smallBtn} onPress={() => navigation.navigate('Questions', { id, sectionId, instance: g.instance })}>
                  <Text style={styles.smallBtnText}>📋 Data</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
      renderItem={({ item }) => {
        const photos = photoFor(item);
        const done = isDone(inspection, item.key);
        const skipped = inspection.skipped[item.key];
        return (
          <Pressable
            style={[styles.promptRow, done && styles.promptDone]}
            onPress={() => navigation.navigate('Camera', { id, sectionId, instance: item.instance, startKey: item.key })}
            onLongPress={() => toggleSkip(item.key)}
          >
            {photos[0] ? (
              <Image source={{ uri: photos[0].uri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Text style={{ fontSize: 18 }}>{skipped ? '⏭' : '📷'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.promptLabel, skipped && styles.promptSkipped]}>{item.label}</Text>
              {item.prompt.hint ? <Text style={styles.promptHint} numberOfLines={2}>{item.prompt.hint}</Text> : null}
              <Text style={styles.promptMeta}>
                {photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : skipped ? 'skipped (long-press to unskip)' : item.prompt.optional ? 'optional' : 'required'}
              </Text>
            </View>
            <Text style={{ color: done ? colors.green : colors.grayLine, fontSize: 22 }}>{done ? '✓' : '›'}</Text>
          </Pressable>
        );
      }}
      ListFooterComponent={
        section.repeat?.addable ? (
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder={`Add ${section.repeat.noun.toLowerCase()} (e.g. ${section.repeat.noun === 'Room' ? 'Dining Room' : section.repeat.noun === 'Facet' ? 'A' : 'Front'})`}
              placeholderTextColor={colors.grayText}
              value={newInstance}
              onChangeText={setNewInstance}
              onSubmitEditing={addInstance}
            />
            <Pressable style={styles.addBtn} onPress={addInstance}>
              <Text style={{ color: colors.white, fontWeight: '800', fontSize: 16 }}>Add</Text>
            </Pressable>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { backgroundColor: colors.red, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  cameraText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  qBtn: { backgroundColor: colors.navy, borderRadius: touch.radius, minHeight: touch.minHeight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  qText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  smallBtn: { backgroundColor: colors.navy, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: touch.radius,
    borderWidth: 1,
    borderColor: colors.grayLine,
    padding: spacing.sm,
    marginBottom: spacing.xs + 2,
    gap: spacing.sm,
  },
  promptDone: { borderColor: colors.green },
  thumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.offWhite },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  promptLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  promptSkipped: { textDecorationLine: 'line-through', color: colors.grayText },
  promptHint: { fontSize: 12, color: colors.grayText, marginTop: 2 },
  promptMeta: { fontSize: 11, color: colors.amber, marginTop: 3, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  addInput: { flex: 1, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 6, fontSize: 16, color: colors.ink },
  addBtn: { backgroundColor: colors.navy, borderRadius: 10, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
});
