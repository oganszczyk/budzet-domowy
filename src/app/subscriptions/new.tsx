/**
 * 5.3: „Przycisk dodawania otwiera formularz nowej subskrypcji."
 *
 * Zbiera dane z 7.4: nazwę, kwotę, częstotliwość, datę rozpoczęcia
 * i kategorię pomocniczą. Data rozpoczęcia wyznacza cały harmonogram —
 * dzień miesiąca z tej daty powtarza się w kolejnych okresach.
 */

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import { FrequencyType, MainType } from '@/domain/enums';
import { useCategories } from '@/features/expenses/queries';
import { useCreateCategory } from '@/features/expenses/mutations';
import { useCreateSubscription } from '@/features/subscriptions/queries';
import { daysInMonth, currentYearMonth, dueDateFor, formatDate, todayIso } from '@/lib/date';
import { validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { CategoryPicker } from '@/ui/components/category-picker';
import { Chip, chipRowStyle } from '@/ui/components/chip';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** 6.2: nazwa pozycji ma 1-80 znaków. */
const MAX_NAME_LENGTH = 80;

const FREQUENCIES = [
  FrequencyType.MONTHLY,
  FrequencyType.QUARTERLY,
  FrequencyType.HALF_YEARLY,
  FrequencyType.YEARLY,
  FrequencyType.CUSTOM,
] as const;

export default function NewSubscriptionScreen() {
  const router = useRouter();
  const { data: categories } = useCategories(MainType.SUBSCRIPTION);
  const createSubscription = useCreateSubscription();
  const createCategory = useCreateCategory();

  const [name, setName] = useState('');
  const [amountGrosze, setAmountGrosze] = useState<number | null>(null);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(FrequencyType.MONTHLY);
  const [customIntervalText, setCustomIntervalText] = useState('2');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [startDayText, setStartDayText] = useState(() => String(Number(todayIso().slice(-2))));

  const month = currentYearMonth();
  const startDay = Number(startDayText);
  const startDayValid =
    Number.isInteger(startDay) && startDay >= 1 && startDay <= daysInMonth(month);
  const startDate = startDayValid ? dueDateFor(month, startDay) : todayIso();

  const customInterval = Number(customIntervalText);
  const customIntervalValid =
    frequencyType !== FrequencyType.CUSTOM ||
    (Number.isInteger(customInterval) && customInterval >= 1 && customInterval <= 60);

  const nameValid = name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
  const amountValid = validateAmountGrosze(amountGrosze).ok;

  const canSave =
    nameValid && amountValid && startDayValid && customIntervalValid && categoryId !== null;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/subscriptions'));

  const handleSave = () => {
    if (!canSave || amountGrosze === null || categoryId === null) return;

    createSubscription.mutate(
      {
        name: name.trim(),
        amountGrosze,
        frequencyType,
        customIntervalMonths: frequencyType === FrequencyType.CUSTOM ? customInterval : null,
        startDate,
        // 7.4 przewiduje to pole; harmonogram i tak wyliczamy z daty rozpoczęcia,
        // więc początkowo wskazuje pierwszą płatność.
        nextPaymentDate: startDate,
        categoryId,
        isActive: true,
        lastUsageConfirmationDate: null,
        // 5.3: pytanie kontrolne domyślnie co 3 miesiące.
        confirmationIntervalMonths: 3,
      },
      { onSuccess: goBack }
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.subscriptions.newTitle }} />

      <Screen>
        <View style={styles.field}>
          <Text style={styles.label}>{strings.subscriptions.nameLabel}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={strings.subscriptions.namePlaceholder}
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_NAME_LENGTH}
            accessibilityLabel={strings.subscriptions.nameLabel}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <AmountInput
            label={strings.subscriptions.amountLabel}
            initialGrosze={null}
            onChangeGrosze={(grosze) => setAmountGrosze(grosze)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.subscriptions.frequencyLabel}</Text>
          <View style={styles.chips}>
            {FREQUENCIES.map((frequency) => (
              <Chip
                key={frequency}
                label={strings.subscriptions.frequency[frequency]}
                selected={frequency === frequencyType}
                onPress={() => setFrequencyType(frequency)}
              />
            ))}
          </View>
        </View>

        {frequencyType === FrequencyType.CUSTOM ? (
          <View style={styles.field}>
            <Text style={styles.label}>{strings.subscriptions.customIntervalLabel}</Text>
            <TextInput
              value={customIntervalText}
              onChangeText={setCustomIntervalText}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={2}
              accessibilityLabel={strings.subscriptions.customIntervalLabel}
              style={[styles.input, styles.inputNarrow, !customIntervalValid && styles.inputError]}
            />
            {!customIntervalValid ? (
              <Text style={styles.error}>{strings.subscriptions.customIntervalInvalid}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>{strings.subscriptions.startDate}</Text>
          <View style={styles.dayRow}>
            <TextInput
              value={startDayText}
              onChangeText={setStartDayText}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={2}
              accessibilityLabel={strings.subscriptions.startDate}
              style={[styles.input, styles.inputNarrow, !startDayValid && styles.inputError]}
            />
            <Text style={styles.resolved}>{startDayValid ? formatDate(startDate) : '—'}</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.subscriptions.categoryLabel}</Text>
          <CategoryPicker
            categories={categories ?? []}
            selectedId={categoryId}
            onSelect={setCategoryId}
            onCreate={(name) => createCategory.mutateAsync(name)}
            isCreating={createCategory.isPending}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.common.save}
            icon="checkmark"
            onPress={handleSave}
            disabled={!canSave}
            loading={createSubscription.isPending}
          />
          <Button label={strings.common.cancel} variant="secondary" onPress={goBack} />
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
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resolved: {
    // Bez tego data gubi ostatnia cyfre roku (19.08.202 zamiast 19.08.2026).
    // Element w wierszu flex moze skurczyc sie ponizej swojej tresci.
    flexShrink: 0,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  chips: chipRowStyle,
  error: {
    fontSize: fontSize.caption,
    color: colors.statusOverdue,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
