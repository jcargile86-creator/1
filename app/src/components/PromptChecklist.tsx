import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { QueueItem, isDone } from '../flows/queue';
import { Inspection } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  items: QueueItem[];
  inspection: Inspection;
  onOpen: (item: QueueItem) => void;
  onToggleSkip: (key: string) => void;
}

/** Lightweight photo-prompt rows: the sub-section header above them carries
 *  the visual weight. A thumbnail appears only once a photo exists. Tap opens
 *  the camera at that prompt; long-press toggles skip. */
export default function PromptChecklist({ items, inspection, onOpen, onToggleSkip }: Props) {
  return (
    <View style={styles.list}>
      {items.map((item, i) => {
        const photos = inspection.photos.filter(
          (p) => p.sectionId === item.sectionId && p.promptId === item.prompt.id && p.instance === item.instance,
        );
        const done = isDone(inspection, item.key);
        const skipped = inspection.skipped[item.key];
        return (
          <Pressable
            key={item.key}
            style={[styles.row, i > 0 && styles.rowBorder]}
            onPress={() => onOpen(item)}
            onLongPress={() => onToggleSkip(item.key)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, skipped && styles.labelSkipped, done && !skipped && styles.labelDone]}>
                {item.label}
              </Text>
              {photos.length || skipped || !item.prompt.optional ? (
                <Text style={styles.meta}>
                  {photos.length
                    ? `${photos.length} photo${photos.length > 1 ? 's' : ''}`
                    : skipped
                      ? 'skipped — long-press to restore'
                      : 'required'}
                </Text>
              ) : null}
            </View>
            {photos[0] ? (
              <Image source={{ uri: photos[0].uri }} style={styles.thumb} />
            ) : null}
            <Text style={[styles.status, done && { color: colors.green }]}>{done ? '✓' : '›'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayLine,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    minHeight: 52,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.grayLine },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  labelDone: { color: colors.grayText },
  labelSkipped: { textDecorationLine: 'line-through', color: colors.grayText },
  meta: { fontSize: 11, color: colors.grayText, marginTop: 1 },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.offWhite },
  status: { color: colors.grayLine, fontSize: 20, width: 18, textAlign: 'center' },
});
