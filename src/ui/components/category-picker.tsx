/**
 * Wybór podkategorii z możliwością dodania własnej.
 *
 * 12.1 zostawiała otwarte pytanie: „Czy użytkownik może tworzyć własne główne
 * kategorie, czy tylko podkategorie." Decyzja: tylko PODKATEGORIE.
 * Kategorie główne pozostają trzy, bo na nich opiera się cały ekran główny
 * i reguła BR-01.
 *
 * Plusik jest celowo dyskretny — wygląda jak zwykły chip i stoi na końcu
 * listy. Dodawanie podkategorii to rzadka czynność, więc nie może
 * przyciągać uwagi bardziej niż sam wybór z gotowych.
 *
 * Nowa podkategoria od razu trafia do subskrypcji I zakupów, żeby zachować
 * wspólną listę — inaczej przyszła analiza znów miałaby dwie „Rozrywki".
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import type { Category } from '@/domain/models';
import { Button } from '@/ui/components/button';
import { Chip, chipRowStyle } from '@/ui/components/chip';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** 6.2: nazwa pozycji ma 1-80 znaków. */
const MAX_NAME_LENGTH = 80;

type CategoryPickerProps = {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Tworzy podkategorię i zwraca ją — wywołujący decyduje, gdzie ją zapisać. */
  onCreate: (name: string) => Promise<Category>;
  isCreating?: boolean;
};

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  onCreate,
  isCreating = false,
}: CategoryPickerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');

  const trimmed = name.trim();

  // Nie pozwalamy stworzyć drugiej podkategorii o tej samej nazwie —
  // dwie „Rozrywki" na liście byłyby nie do odróżnienia.
  const isDuplicate = categories.some(
    (c) => c.name.toLocaleLowerCase('pl') === trimmed.toLocaleLowerCase('pl')
  );
  const canCreate = trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH && !isDuplicate;

  const handleCreate = async () => {
    if (!canCreate) return;
    const created = await onCreate(trimmed);
    // Nowa podkategoria od razu staje się wybraną — po to ją tworzono.
    onSelect(created.id);
    setName('');
    setIsAdding(false);
  };

  const cancel = () => {
    setName('');
    setIsAdding(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.chips}>
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            selected={category.id === selectedId}
            onPress={() => onSelect(category.id)}
          />
        ))}

        {!isAdding ? (
          <Pressable
            onPress={() => setIsAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={strings.categories.addNew}
            style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {isAdding ? (
        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={strings.categories.namePlaceholder}
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            accessibilityLabel={strings.categories.nameLabel}
            style={styles.input}
          />

          {isDuplicate ? <Text style={styles.error}>{strings.categories.duplicate}</Text> : null}

          <View style={styles.formActions}>
            <Button
              label={strings.categories.create}
              icon="checkmark"
              onPress={handleCreate}
              disabled={!canCreate}
              loading={isCreating}
            />
            <Button label={strings.common.cancel} variant="secondary" onPress={cancel} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  chips: chipRowStyle,
  addChip: {
    flexShrink: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  form: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  formActions: {
    gap: spacing.sm,
  },
  error: {
    fontSize: fontSize.caption,
    color: colors.statusOverdue,
  },
});
