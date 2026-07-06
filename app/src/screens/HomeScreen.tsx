import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { deleteInspectionPhotos } from '../store/photos';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { inspections, loading, deleteInspection } = useInspections();

  const confirmDelete = (id: string, label: string) => {
    Alert.alert('Delete inspection?', `${label} and all its photos will be removed.`, [
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

  return (
    <View style={styles.container}>
      <Pressable style={styles.newBtn} onPress={() => navigation.navigate('NewInspection')}>
        <Text style={styles.newBtnText}>Start New Inspection</Text>
      </Pressable>
      <FlatList
        data={inspections}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading…' : 'No inspections yet. Start one above.'}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('Inspection', { id: item.id })}
            onLongPress={() => confirmDelete(item.id, item.claim.claimNumber || item.claim.insured || 'Inspection')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.claim.insured || 'Unnamed insured'}</Text>
              <Text style={styles.cardSub}>Claim {item.claim.claimNumber || '—'} · {item.claim.lossAddress || 'no address'}</Text>
              <Text style={styles.cardMeta}>
                {item.photos.length} photos · updated {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        )}
      />
      <Text style={styles.versionStamp}>
        v{Constants.expoConfig?.version ?? '?'} · runtime {String(Updates.runtimeVersion ?? 'dev')} · update{' '}
        {Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  newBtn: {
    backgroundColor: colors.red,
    borderRadius: touch.radius,
    minHeight: touch.minHeight + 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  newBtnText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl, fontSize: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: touch.radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grayLine,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  cardSub: { fontSize: 14, color: colors.grayText, marginTop: 2 },
  cardMeta: { fontSize: 13, color: colors.grayText, marginTop: 6 },
  chev: { fontSize: 30, color: colors.grayLine, marginLeft: spacing.sm },
  versionStamp: { textAlign: 'center', color: colors.grayLine, fontSize: 11, paddingVertical: 4 },
});
