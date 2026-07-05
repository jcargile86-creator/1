import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { QueueItem, isDone } from '../flows/queue';
import { Inspection } from '../types';
import { colors, spacing, touch } from '../theme';

interface Props {
  items: QueueItem[];
  inspection: Inspection;
  onOpen: (item: QueueItem) => void;
  onToggleSkip: (key: string) => void;
}

/** The prompt checklist rows shared by every tab: thumbnail, label, status.
 *  Tap opens the camera at that prompt; long-press toggles skip. */
export default function PromptChecklist({ items, inspection, onOpen, onToggleSkip }: Props) {
  return (
    <View>
      {items.map((item) => {
        const photos = inspection.photos.filter(
          (p) => p.sectionId === item.sectionId && p.promptId === item.prompt.id && p.instance === item.instance,
        );
        const done = isDone(inspection, item.key);
        const skipped = inspection.skipped[item.key];
        return (
          <Pressable
            key={item.key}
            style={[styles.row, done && styles.rowDone]}
            onPress={() => onOpen(item)}
            onLongPress={() => onToggleSkip(item.key)}
          >
            {photos[0] ? (
              <Image source={{ uri: photos[0].uri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Text style={{ fontSize: 16, color: colors.grayText }}>{skipped ? '—' : ''}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, skipped && styles.labelSkipped]}>{item.label}</Text>
              {item.prompt.hint ? <Text style={styles.hint} numberOfLines={2}>{item.prompt.hint}</Text> : null}
              <Text style={styles.meta}>
                {photos.length
                  ? `${photos.length} photo${photos.length > 1 ? 's' : ''}`
                  : skipped
                    ? 'skipped (long-press to unskip)'
                    : item.prompt.optional
                      ? 'optional'
                      : 'required'}
              </Text>
            </View>
            <Text style={{ color: done ? colors.green : colors.grayLine, fontSize: 22 }}>{done ? '✓' : '›'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
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
  rowDone: { borderColor: colors.green },
  thumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.offWhite },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700', color: colors.ink },
  labelSkipped: { textDecorationLine: 'line-through', color: colors.grayText },
  hint: { fontSize: 12, color: colors.grayText, marginTop: 2 },
  meta: { fontSize: 11, color: colors.amber, marginTop: 3, fontWeight: '600' },
});
