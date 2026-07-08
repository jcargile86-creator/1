import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, StyleSheet, View, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { ClaimInfo } from '../types';
import { listFlows, DEFAULT_FLOW_ID } from '../flows';
import { parseSchedule } from '../lib/schedule';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NewInspection'>;

const empty: ClaimInfo = {
  claimNumber: '',
  insured: '',
  lossAddress: '',
  carrier: '',
  adjuster: '',
  inspector: '',
  inspectorContact: '',
  inspectionType: 'Interior & Exterior Inspection',
  dateOfLoss: '',
  structureType: 'Single Family - 1 Story',
  stories: '1',
  otherStructures: 'N/A',
};

const FIELDS: { key: keyof ClaimInfo; label: string; placeholder?: string }[] = [
  { key: 'claimNumber', label: 'Claim Number' },
  { key: 'insured', label: 'Insured Name' },
  { key: 'lossAddress', label: 'Loss Address' },
  { key: 'dateOfLoss', label: 'Date of Loss', placeholder: 'MM/DD/YYYY' },
  { key: 'adjuster', label: 'Adjuster / OA' },
  { key: 'inspector', label: 'Inspector' },
  { key: 'inspectorContact', label: 'Inspector Contact', placeholder: 'email · phone' },
  { key: 'inspectionType', label: 'Inspection Type' },
  { key: 'structureType', label: 'Structure Type' },
  { key: 'stories', label: 'Stories' },
  { key: 'otherStructures', label: 'Other Structures' },
];

export default function NewInspectionScreen({ navigation, route }: Props) {
  const { createInspection, createAssignment } = useInspections();
  const isAssignment = route.params?.mode === 'assignment';
  const [claim, setClaim] = useState<ClaimInfo>(empty);
  const [flowId, setFlowId] = useState(DEFAULT_FLOW_ID);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const flows = listFlows();

  useLayoutEffect(() => {
    navigation.setOptions({ title: isAssignment ? 'Add Assignment' : 'New Inspection' });
  }, [navigation, isAssignment]);

  const carrierClaim = () => ({ ...claim, carrier: flows.find((f) => f.id === flowId)?.carrier ?? claim.carrier });

  const start = async () => {
    const insp = await createInspection(carrierClaim(), flowId);
    navigation.replace('Inspection', { id: insp.id });
  };

  const addAssignment = async () => {
    let scheduledAt: string | undefined;
    if (schedDate.trim()) {
      scheduledAt = parseSchedule(schedDate, schedTime);
      if (!scheduledAt) {
        Alert.alert('Check the appointment', 'Use date MM/DD/YYYY and time like 2:30 PM (or leave both blank).');
        return;
      }
    }
    await createAssignment(carrierClaim(), { scheduledAt, source: 'manual' }, flowId);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} keyboardShouldPersistTaps="handled">
      {isAssignment && (
        <>
          <Text style={styles.groupLabel}>Appointment</Text>
          <Text style={styles.helpText}>
            This mirrors an incoming XactAnalysis assignment — it lands in Pending for accept/deny and shows on the
            calendar. Leave the time blank to schedule it later.
          </Text>
          <View style={styles.schedRow}>
            <View style={{ flex: 1.3 }}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput style={styles.input} value={schedDate} onChangeText={setSchedDate} placeholder="MM/DD/YYYY" placeholderTextColor={colors.grayLine} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Time</Text>
              <TextInput style={styles.input} value={schedTime} onChangeText={setSchedTime} placeholder="2:30 PM" placeholderTextColor={colors.grayLine} />
            </View>
          </View>
        </>
      )}

      <Text style={styles.groupLabel}>Carrier Flow</Text>
      {flows.map((f) => (
        <Pressable key={f.id} style={[styles.flowCard, flowId === f.id && styles.flowCardActive]} onPress={() => setFlowId(f.id)}>
          <Text style={[styles.flowTitle, flowId === f.id && { color: colors.white }]}>{f.carrier}</Text>
          <Text style={[styles.flowSub, flowId === f.id && { color: '#cdd0e6' }]}>{f.name}</Text>
        </Pressable>
      ))}

      <Text style={styles.groupLabel}>Claim Details</Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            style={styles.input}
            value={claim[f.key]}
            placeholder={f.placeholder}
            placeholderTextColor={colors.grayLine}
            onChangeText={(t) => setClaim((c) => ({ ...c, [f.key]: t }))}
          />
        </View>
      ))}

      <Pressable style={styles.startBtn} onPress={isAssignment ? addAssignment : start}>
        <Text style={styles.startText}>{isAssignment ? 'Add to Pending' : 'Create Inspection'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  groupLabel: { fontSize: 14, fontWeight: '800', color: colors.navy, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  helpText: { fontSize: 13, color: colors.grayText, marginBottom: spacing.sm, fontWeight: '600' },
  schedRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  flowCard: { backgroundColor: colors.white, borderRadius: touch.radius, padding: spacing.md, borderWidth: 1, borderColor: colors.grayLine, marginBottom: spacing.sm },
  flowCardActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  flowTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  flowSub: { fontSize: 13, color: colors.grayText, marginTop: 2 },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.grayText, marginBottom: 4 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.grayLine,
    paddingHorizontal: spacing.md,
    minHeight: touch.minHeight - 4,
    fontSize: 16,
    color: colors.ink,
  },
  startBtn: { backgroundColor: colors.red, borderRadius: touch.radius, minHeight: touch.minHeight + 8, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  startText: { color: colors.white, fontSize: 19, fontWeight: '800' },
});
