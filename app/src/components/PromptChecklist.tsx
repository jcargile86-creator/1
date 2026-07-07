import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { PhotoQueueItem, isDone } from '../flows/queue';
import { SectionDef, QuestionDef } from '../flows/types';
import { Inspection, answerKey } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  items: PhotoQueueItem[];
  inspection: Inspection;
  onOpen: (item: PhotoQueueItem) => void;
  onToggleSkip: (key: string) => void;
  /** When provided with onAnswer, count-pair questions (total + damaged)
   *  attached to a prompt render as inline steppers on its row. */
  section?: SectionDef;
  onAnswer?: (questionId: string, value: number, instance?: string) => void;
}

interface CounterPair {
  totalQ: QuestionDef;
  damagedQ: QuestionDef;
}

function counterPairFor(section: SectionDef | undefined, item: PhotoQueueItem): CounterPair | null {
  if (!section) return null;
  const pool = item.instance ? section.instanceQuestions ?? [] : section.questions ?? [];
  const attached = pool.filter((q) => q.promptId === item.prompt.id && q.type === 'number');
  const totalQ = attached.find((q) => q.autoFromPrompt);
  const damagedQ = attached.find((q) => /damaged/i.test(q.id));
  return totalQ && damagedQ ? { totalQ, damagedQ } : null;
}

/** Lightweight photo-prompt rows. Vent-type rows carry their total/damaged
 *  counters inline. Tap opens the item; long-press toggles skip. */
export default function PromptChecklist({ items, inspection, onOpen, onToggleSkip, section, onAnswer }: Props) {
  return (
    <View style={styles.list}>
      {items.map((item, i) => {
        const photos = inspection.photos.filter(
          (p) => p.sectionId === item.sectionId && p.promptId === item.prompt.id && p.instance === item.instance,
        );
        const done = isDone(inspection, item);
        const skipped = inspection.skipped[item.key];
        const pair = onAnswer ? counterPairFor(section, item) : null;

        let totalVal = 0;
        let damagedVal = 0;
        if (pair) {
          const storedTotal = inspection.answers[answerKey(item.sectionId, pair.totalQ.id, item.instance)];
          totalVal = typeof storedTotal === 'number' ? storedTotal : photos.length;
          const storedDamaged = inspection.answers[answerKey(item.sectionId, pair.damagedQ.id, item.instance)];
          damagedVal = typeof storedDamaged === 'number' ? storedDamaged : 0;
        }

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
              {pair && (
                <View style={styles.counterRow}>
                  <Counter
                    label="TOTAL"
                    value={totalVal}
                    onChange={(v) => onAnswer!(pair.totalQ.id, v, item.instance)}
                  />
                  <Counter
                    label="DAMAGED"
                    value={damagedVal}
                    accent
                    onChange={(v) => onAnswer!(pair.damagedQ.id, v, item.instance)}
                  />
                </View>
              )}
            </View>
            {photos[0] ? (
              <Image source={{ uri: photos[0].previewUri ?? photos[0].uri }} style={styles.thumb} />
            ) : null}
            <Text style={[styles.status, done && { color: colors.green }]}>{done ? '✓' : '›'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Counter({ label, value, onChange, accent }: { label: string; value: number; onChange: (v: number) => void; accent?: boolean }) {
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterLabel, accent && { color: colors.red }]}>{label}</Text>
      <Pressable style={styles.counterBtn} hitSlop={6} onPress={() => onChange(Math.max(0, value - 1))}>
        <Text style={styles.counterBtnText}>−</Text>
      </Pressable>
      <Text style={[styles.counterValue, accent && value > 0 && { color: colors.red }]}>{value}</Text>
      <Pressable style={styles.counterBtn} hitSlop={6} onPress={() => onChange(value + 1)}>
        <Text style={styles.counterBtnText}>＋</Text>
      </Pressable>
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
  counterRow: { flexDirection: 'row', gap: spacing.md, marginTop: 6 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterLabel: { fontSize: 10, fontWeight: '800', color: colors.grayText, letterSpacing: 0.5 },
  counterBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.grayLine, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.offWhite },
  counterBtnText: { fontSize: 16, fontWeight: '800', color: colors.navy, lineHeight: 20 },
  counterValue: { minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.ink },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.offWhite },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  status: { color: colors.grayLine, fontSize: 20, width: 18, textAlign: 'center' },
});
