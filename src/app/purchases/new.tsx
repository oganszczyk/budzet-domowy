/**
 * 5.5: RĘCZNE DODAWANIE WYDATKU
 *
 * | Pole             | Wymaganie                                          |
 * | Kwota            | wymagane, dodatnia, maksymalnie 2 miejsca po przec. |
 * | Data             | wymagana, domyślnie dzisiejsza                     |
 * | Podkategoria     | wymagana, wybór z aktywnych kategorii              |
 * | Sklep / miejsce  | opcjonalne, krótki tekst                           |
 * | Opis             | opcjonalny                                         |
 * | Sposób płatności | opcjonalny: karta, gotówka, przelew, inne          |
 *
 *  [x] Po zapisaniu utworzyć jeden rekord płatności ze źródłem MANUAL.
 *  [x] Po zapisaniu wrócić do listy zakupów.
 *  [x] Nie pozwolić zapisać pustej, zerowej ani ujemnej kwoty (BR-10).
 *  [x] Przecinek i kropka akceptowane, zapis jednolity — patrz AmountInput.
 *
 * AC: „Anulowanie formularza nie tworzy rekordu" — rekord powstaje wyłącznie
 * w `handleSave`, więc wyjście z ekranu nie zapisuje niczego.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import { MainType, PaymentMethod, PaymentSource } from '@/domain/enums';
import { useCreateCategory, useCreatePayment } from '@/features/expenses/mutations';
import { useCategories } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';
import {
  currentYearMonth,
  daysInMonth,
  dueDateFor,
  formatDate,
  isSameMonth,
  todayIso,
} from '@/lib/date';
import { validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { CategoryPicker } from '@/ui/components/category-picker';
import { Chip, chipRowStyle } from '@/ui/components/chip';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** 6.2: nazwa pozycji ma 1-80 znaków, opis maksymalnie 500. */
const MAX_MERCHANT_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;

const METHODS = [
  PaymentMethod.CARD,
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.OTHER,
] as const;

export default function NewPurchaseScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { data: categories } = useCategories(MainType.PURCHASE);
  const createPayment = useCreatePayment();
  const createCategory = useCreateCategory();

  const [amountGrosze, setAmountGrosze] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) : null
  );
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  /**
   * 5.5: „Data wymagana, domyślnie dzisiejsza."
   *
   * Wydatek zapisujemy w miesiącu, który użytkownik ogląda (BR-09), więc
   * wybieramy tylko dzień. Gdy przegląda bieżący miesiąc, domyślnie jest
   * to dzisiaj; w innym miesiącu — pierwszy dzień, bo „dzisiaj" nie istnieje
   * w tamtym miesiącu.
   */
  const [dayText, setDayText] = useState(() =>
    isSameMonth(month, currentYearMonth()) ? String(Number(todayIso().slice(-2))) : '1'
  );

  const day = Number(dayText);
  const dayValid = Number.isInteger(day) && day >= 1 && day <= daysInMonth(month);
  const effectiveDate = dayValid ? dueDateFor(month, day) : todayIso();

  // BR-10: 0,00 zł jest wyświetlane, ale nie może zostać zapisane.
  const amountCheck = validateAmountGrosze(amountGrosze);
  const amountTouched = amountText.trim() !== '';
  const amountError = !amountTouched
    ? null
    : amountCheck.ok
      ? null
      : amountCheck.reason === 'TOO_HIGH'
        ? strings.validation.amountTooHigh
        : strings.purchases.noAmount;

  const canSave = amountCheck.ok && dayValid && categoryId !== null;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/purchases'));

  const handleSave = () => {
    if (!canSave || amountGrosze === null || categoryId === null) return;

    createPayment.mutate(
      {
        mainType: MainType.PURCHASE,
        categoryId,
        // Tytuł to sklep, a gdy go nie podano — nazwa podkategorii.
        title:
          merchant.trim() ||
          categories?.find((c) => c.id === categoryId)?.name ||
          strings.purchases.title,
        amountGrosze,
        effectiveDate,
        dueDate: null,
        paidDate: null,
        status: null,
        // 5.5: rekord ma źródło MANUAL.
        source: PaymentSource.MANUAL,
        merchant: merchant.trim() || null,
        description: description.trim() || null,
        paymentMethod: method,
        billTemplateId: null,
        subscriptionId: null,
        receiptImagePath: null,
      },
      { onSuccess: goBack }
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.purchases.newTitle }} />

      <Screen>
        <View style={styles.field}>
          <AmountInput
            label={strings.purchases.amount}
            initialGrosze={null}
            autoFocus
            error={amountError}
            onChangeGrosze={(grosze, raw) => {
              setAmountGrosze(grosze);
              setAmountText(raw);
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.purchases.date}</Text>
          <View style={styles.dayRow}>
            <TextInput
              value={dayText}
              onChangeText={setDayText}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={2}
              accessibilityLabel={strings.purchases.dayLabel}
              style={[styles.input, styles.inputNarrow, !dayValid && styles.inputError]}
            />
            <Text style={styles.resolved}>{dayValid ? formatDate(effectiveDate) : '—'}</Text>
          </View>
          {!dayValid ? <Text style={styles.error}>{strings.purchases.dayInvalid}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.purchases.category}</Text>
          <CategoryPicker
            categories={categories ?? []}
            selectedId={categoryId}
            onSelect={setCategoryId}
            onCreate={(name) => createCategory.mutateAsync(name)}
            isCreating={createCategory.isPending}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.purchases.merchant}</Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder={strings.purchases.merchantPlaceholder}
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_MERCHANT_LENGTH}
            accessibilityLabel={strings.purchases.merchant}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.purchases.paymentMethod}</Text>
          <View style={styles.chips}>
            {METHODS.map((option) => (
              <Chip
                key={option}
                label={strings.purchases.method[option]}
                selected={option === method}
                // Ponowne kliknięcie odznacza — sposób płatności jest opcjonalny.
                onPress={() => setMethod((current) => (current === option ? null : option))}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{strings.purchases.description}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={strings.purchases.descriptionPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_DESCRIPTION_LENGTH}
            accessibilityLabel={strings.purchases.description}
            style={styles.textarea}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.common.save}
            icon="checkmark"
            onPress={handleSave}
            disabled={!canSave}
            loading={createPayment.isPending}
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
  textarea: {
    minHeight: 80,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: 'top',
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
