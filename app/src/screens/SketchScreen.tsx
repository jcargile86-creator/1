import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { SKETCH_W, SKETCH_H } from '../types';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Sketch'>;

/**
 * Simple finger/stylus diagram pad — the manual-sketch safety net from
 * training (elevations, decks, fences). Paths are stored as SVG `d` strings
 * so they embed directly into the PDF report.
 */
export default function SketchScreen({ route, navigation }: Props) {
  const { id, sketchId } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const existing = inspection?.sketches.find((s) => s.id === sketchId);

  const [paths, setPaths] = useState<string[]>(existing?.paths ?? []);
  const [livePath, setLivePath] = useState<string | null>(null);
  const [name, setName] = useState(existing?.name ?? `Diagram ${(inspection?.sketches.length ?? 0) + 1}`);
  const size = useRef({ w: 1, h: 1 });
  const current = useRef<string>('');

  if (!inspection) return null;

  const toCanvas = (x: number, y: number) =>
    `${((x / size.current.w) * SKETCH_W).toFixed(1)} ${((y / size.current.h) * SKETCH_H).toFixed(1)}`;

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  const save = () => {
    void updateInspection(id, (d) => {
      const s = d.sketches.find((k) => k.id === sketchId);
      if (s) {
        s.paths = paths;
        s.name = name;
      } else {
        d.sketches.push({ id: Crypto.randomUUID(), name, paths, createdAt: new Date().toISOString() });
      }
    });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="Diagram name (e.g. Left Elevation Siding)" placeholderTextColor={colors.grayText} />
      <View
        style={styles.canvas}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          current.current = `M ${toCanvas(e.nativeEvent.locationX, e.nativeEvent.locationY)}`;
          setLivePath(current.current);
        }}
        onResponderMove={(e) => {
          current.current += ` L ${toCanvas(e.nativeEvent.locationX, e.nativeEvent.locationY)}`;
          setLivePath(current.current);
        }}
        onResponderRelease={() => {
          if (current.current.includes('L')) setPaths((p) => [...p, current.current]);
          current.current = '';
          setLivePath(null);
        }}
      >
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`}>
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={colors.navy} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {livePath && <Path d={livePath} stroke={colors.red} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>
        {paths.length === 0 && !livePath && <Text style={styles.placeholder}>Draw your elevation / deck / fence diagram here</Text>}
      </View>
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setPaths((p) => p.slice(0, -1))}>
          <Text style={[styles.btnText, { color: colors.navy }]}>Undo</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setPaths([])}>
          <Text style={[styles.btnText, { color: colors.red }]}>Clear</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={save}>
          <Text style={styles.btnText}>Save Diagram</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  nameInput: { backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 8, fontSize: 16, color: colors.ink, marginBottom: spacing.sm },
  canvas: { flex: 1, backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, overflow: 'hidden' },
  placeholder: { position: 'absolute', top: '48%', alignSelf: 'center', color: colors.grayLine, fontSize: 15 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1, backgroundColor: colors.navy, borderRadius: 10, minHeight: touch.minHeight - 4, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.grayLine },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
