import React from 'react';
import { ScrollView, View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Documents'>;

/** Supporting documents for the claim package: Sketch AR summary + wall
 *  screenshots, CAD markups, Free Form diagrams, receipts. Uploaded from
 *  Photos or Files; image documents also render into the PDF report. */
export default function DocumentsScreen({ route }: Props) {
  const { id } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);

  if (!inspection) return null;

  const storeFile = (srcUri: string, name: string, mimeType: string) => {
    const docId = Crypto.randomUUID();
    const dir = new Directory(Paths.document, 'docs', id);
    dir.create({ intermediates: true, idempotent: true });
    const safeName = name.replace(/[^\w.\- ]/g, '_') || `document-${docId.slice(0, 6)}`;
    const dest = new File(dir, `${docId.slice(0, 8)}-${safeName}`);
    new File(srcUri).copy(dest);
    void updateInspection(id, (d) => {
      d.documents.push({ id: docId, uri: dest.uri, name: safeName, mimeType, addedAt: new Date().toISOString() });
    });
  };

  const addFromPhotos = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (res.canceled) return;
      for (const a of res.assets) {
        storeFile(a.uri, a.fileName ?? 'photo.jpg', a.mimeType ?? 'image/jpeg');
      }
    } catch (e) {
      Alert.alert('Could not add from Photos', String(e instanceof Error ? e.message : e));
    }
  };

  const addFromFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (res.canceled) return;
      for (const a of res.assets) {
        storeFile(a.uri, a.name, a.mimeType ?? 'application/octet-stream');
      }
    } catch (e) {
      Alert.alert('Could not add file', String(e instanceof Error ? e.message : e));
    }
  };

  const removeDoc = (docId: string, uri: string, name: string) => {
    Alert.alert(`Remove "${name}"?`, 'It will be removed from the claim package.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void updateInspection(id, (d) => {
            d.documents = d.documents.filter((x) => x.id !== docId);
          });
          try {
            new File(uri).delete();
          } catch {
            // best-effort cleanup
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 140 }}>
        <Text style={styles.intro}>
          Sketch AR summaries and wall screenshots, CAD markups, diagrams, receipts. Image documents are added to the
          PDF report; everything is included in the claim export.
        </Text>
        {inspection.documents.length === 0 && <Text style={styles.empty}>No documents yet.</Text>}
        {inspection.documents.map((doc) => (
          <View key={doc.id} style={styles.card}>
            {doc.mimeType.startsWith('image/') ? (
              <Image source={{ uri: doc.uri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.fileBadge]}>
                <Text style={styles.fileBadgeText}>{(doc.name.split('.').pop() ?? 'file').toUpperCase().slice(0, 4)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.docName} numberOfLines={2}>{doc.name}</Text>
              <Text style={styles.docMeta}>{new Date(doc.addedAt).toLocaleString()}</Text>
            </View>
            <Pressable onPress={() => removeDoc(doc.id, doc.uri, doc.name)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={styles.addBtn} onPress={() => void addFromPhotos()}>
          <Text style={styles.addText}>Add from Photos</Text>
        </Pressable>
        <Pressable style={[styles.addBtn, styles.addBtnAlt]} onPress={() => void addFromFiles()}>
          <Text style={[styles.addText, { color: colors.navy }]}>Add File</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: { fontSize: 13, color: colors.grayText, marginBottom: spacing.md },
  empty: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: touch.radius,
    borderWidth: 1,
    borderColor: colors.grayLine,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.offWhite },
  fileBadge: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  fileBadgeText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  docName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  docMeta: { fontSize: 12, color: colors.grayText, marginTop: 2 },
  removeText: { color: colors.red, fontWeight: '800', fontSize: 14 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.offWhite },
  addBtn: { backgroundColor: colors.red, borderRadius: touch.radius, minHeight: touch.minHeight, alignItems: 'center', justifyContent: 'center' },
  addBtnAlt: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
  addText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
