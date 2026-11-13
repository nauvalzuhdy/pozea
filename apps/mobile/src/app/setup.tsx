import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/core/theme';
import { Chip, PrimaryButton, Screen } from '@/core/ui';
import {
  aspectRatios,
  photoTypes,
  places,
  type AspectRatio,
  type PhotoType,
  type Place,
} from '@/features/setup/options';

export default function SetupScreen() {
  const [type, setType] = useState<PhotoType>('solo');
  const [place, setPlace] = useState<Place>('cafe');
  const [ratio, setRatio] = useState<AspectRatio>('3:4');

  return (
    <Screen>
      <ChoiceRow title="Jenis foto" options={photoTypes} value={type} onChange={setType} />
      <ChoiceRow title="Tempat" options={places} value={place} onChange={setPlace} />
      <ChoiceRow title="Ukuran" options={aspectRatios} value={ratio} onChange={setRatio} />
      <PrimaryButton
        label="Lihat pose"
        href={{ pathname: '/poses', params: { type, place, ratio } }}
      />
    </Screen>
  );
}

function ChoiceRow<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={o.value === value}
            onPress={() => onChange(o.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  rowTitle: { color: colors.textOnNavy, fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
