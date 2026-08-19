/**
 * 5.2: „Przycisk dodawania pozwala utworzyć nowy typ rachunku cyklicznego."
 *
 * Formularz szablonu rachunku (7.3). Po zapisaniu od razu generujemy rekord
 * na bieżąco wybrany miesiąc, żeby użytkownik zobaczył efekt natychmiast,
 * a nie dopiero po przełączeniu miesiąca.
 */

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { getRepository } from '@/data';
import { strings } from '@/constants/strings';
import { MainType } from '@/domain/enums';
import { generateMonthlyBills } from '@/features/bills/generate-monthly-bills';
import { useCreateBillTemplate } from '@/features/bills/queries';
import { useCategories } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';
import { validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** 6.2: nazwa pozycji ma 1-80 znaków. */
const MAX_NAME_LENGTH = 80;

export default function NewBillTemplateScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const { data: categories } = useCategories(MainType.BILL);
  const createTemplate = useCreateBillTemplate();

  /**
   * Rachunki nie mają podkategorii — kategoria jest jedna dla wszystkich,
   * więc bierzemy ją z repozytorium zamiast pytać użytkownika.
   */
  const billCategoryId = categories?.[0]?.id ?? null;

  const [name, setName] = useState('');
  const [dueDayText, setDueDayText] = useState('10');
  const [useFixedAmount, setUseFixedAmount] = useState(false);
  const [fixedAmountGrosze, setFixedAmountGrosze] = useState<number | null>(null);

  /**
   * Powrót na listę rachunków.
   *
   * Samo `router.back()` nie wystarcza: gdy ekran otwarto bezpośrednio
   * (link, odświeżenie strony w przeglądarce), nie ma dokąd wracać
   * i przycisk nic by nie zrobił.
   */
  const goToBills = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/bills');
    }
  };

  const dueDay = Number(dueDayText);
  const dueDayValid = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;

  const nameValid = name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
  const fixedAmountValid = !useFixedAmount || validateAmountGrosze(fixedAmountGrosze).ok;

  const canSave = nameValid && dueDayValid && billCategoryId !== null && fixedAmountValid;

  const handleSave = () => {
    if (!canSave || billCategoryId === null) return;

    createTemplate.mutate(
      {
        name: name.trim(),
        categoryId: billCategoryId,
        defaultDueDay: dueDay,
        isActive: true,
        useFixedAmount,
        fixedAmountGrosze: useFixedAmount ? fixedAmountGrosze : null,
      },
      {
        onSuccess: async () => {
          // Utwórz rekord na wybrany miesiąc, żeby nowy rachunek
          // pojawił się na liście od razu (BR-12 chroni przed duplikatem).
          await generateMonthlyBills(getRepository(), month);
          goToBills();
        },
      }
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.bills.newTemplate.title }} />

      <Screen>
        <View style={styles.field}>
          <Text style={styles.label}>{strings.bills.newTemplate.nameLabel}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={strings.bills.newTemplate.namePlaceholder}
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_NAME_LENGTH}
            accessibilityLabel={strings.bills.newTemplate.nameLabel}
            style={styles.input}
          />
        </View>

        {/* Bez wyboru podkategorii — rachunki jej nie mają.
            Kategoria jest jedna i przypisujemy ją automatycznie. */}

        <View style={styles.field}>
          <Text style={styles.label}>{strings.bills.newTemplate.dueDayLabel}</Text>
          <TextInput
            value={dueDayText}
            onChangeText={setDueDayText}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={2}
            accessibilityLabel={strings.bills.newTemplate.dueDayLabel}
            style={[styles.input, styles.inputNarrow, !dueDayValid && styles.inputError]}
          />
          {!dueDayValid ? (
            <Text style={styles.error}>{strings.bills.newTemplate.dueDayInvalid}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{strings.bills.newTemplate.fixedAmountToggle}</Text>
            <Switch
              value={useFixedAmount}
              onValueChange={setUseFixedAmount}
              accessibilityLabel={strings.bills.newTemplate.fixedAmountToggle}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          <Text style={styles.hint}>{strings.bills.newTemplate.fixedAmountHint}</Text>
        </View>

        {useFixedAmount ? (
          <View style={styles.field}>
            <AmountInput
              label={strings.bills.newTemplate.fixedAmountLabel}
              initialGrosze={fixedAmountGrosze}
              onChangeGrosze={(grosze) => setFixedAmountGrosze(grosze)}
              error={fixedAmountValid ? null : strings.validation.amountEmpty}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={strings.common.save}
            icon="checkmark"
            onPress={handleSave}
            disabled={!canSave}
            loading={createTemplate.isPending}
          />
          <Button label={strings.common.cancel} variant="secondary" onPress={goToBills} />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  inputNarrow: {
    width: 88,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.statusOverdue,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSize.caption,
    color: colors.statusOverdue,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
