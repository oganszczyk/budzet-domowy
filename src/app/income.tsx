/**
 * Etap 11: EKRAN DOCHODÓW DOMOWNIKÓW
 *
 * Lista „kto ile zarobił" dla wybranego miesiąca. Sumę z tego ekranu
 * odejmuje od wydatków wykres na ekranie głównym.
 *
 * Miesiąc bierze się z tego samego kontekstu, co wszędzie indziej (4.3),
 * więc przełącznik u góry działa tak samo jak na ekranie głównym, a wejście
 * tutaj nie resetuje wybranego miesiąca.
 *
 * Formularz jest WBUDOWANY w ekran, a nie na osobnej trasie — inaczej niż
 * przy wydatkach. Powód: wpisów jest kilka, są krótkie (imię + kwota)
 * i wpisuje się je hurtem raz w miesiącu. Skakanie po ekranach przy każdej
 * z czterech pozycji byłoby uciążliwe bez żadnego zysku.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import type { Income } from '@/domain/models';
import {
  useCopyIncomesFromPreviousMonth,
  useCreateIncome,
  useDeleteIncome,
  useUpdateIncome,
} from '@/features/income/mutations';
import { useIncomes } from '@/features/income/queries';
import { useMonth } from '@/features/month/month-context';
import { yearMonthKey } from '@/lib/date';
import { formatGrosze, validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { MonthSwitcher } from '@/ui/components/month-switcher';
import { Screen } from '@/ui/components/screen';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** Co robi teraz formularz: nic, dodaje nowy wpis, albo zmienia istniejący. */
type FormState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; income: Income };

export default function IncomeScreen() {
  const { month } = useMonth();
  const { data } = useIncomes();
  const incomes = data ?? [];

  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();
  const deleteIncome = useDeleteIncome();
  const copyPrevious = useCopyIncomesFromPreviousMonth();

  const [form, setForm] = useState<FormState>({ mode: 'closed' });
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const totalGrosze = incomes.reduce((sum, income) => sum + income.amountGrosze, 0);

  const handleDelete = async (income: Income) => {
    const confirmed = await confirm({
      title: strings.income.deleteConfirmTitle,
      message: strings.income.deleteConfirmMessage,
      confirmLabel: strings.common.delete,
      destructive: true,
    });
    if (!confirmed) return;

    // Zamykamy formularz, gdyby akurat edytował kasowany wpis — inaczej
    // zapis odwoływałby się do rekordu, którego już nie ma.
    if (form.mode === 'edit' && form.income.id === income.id) setForm({ mode: 'closed' });
    deleteIncome.mutate(income.id);
  };

  const handleCopyPrevious = async () => {
    setCopyMessage(null);
    const copied = await copyPrevious.mutateAsync();
    setCopyMessage(
      copied > 0 ? `${strings.income.copyDone} ${copied}` : strings.income.copyNothing
    );
  };

  const handleSubmit = (personName: string, amountGrosze: number) => {
    if (form.mode === 'edit') {
      updateIncome.mutate({ id: form.income.id, patch: { personName, amountGrosze } });
    } else {
      createIncome.mutate({ personName, amountGrosze, month: yearMonthKey(month) });
    }
    setForm({ mode: 'closed' });
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.income.title }} />

      <Screen>
        <MonthSwitcher />

        <Text style={styles.intro}>{strings.income.intro}</Text>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{strings.income.total}</Text>
          <Text style={styles.totalAmount}>{formatGrosze(totalGrosze)}</Text>
        </Card>

        {incomes.length === 0 ? (
          <Text style={styles.empty}>{strings.income.empty}</Text>
        ) : (
          <View style={styles.list}>
            {incomes.map((income) => (
              <IncomeRow
                key={income.id}
                income={income}
                isEditing={form.mode === 'edit' && form.income.id === income.id}
                onEdit={() => setForm({ mode: 'edit', income })}
                onDelete={() => handleDelete(income)}
              />
            ))}
          </View>
        )}

        {form.mode === 'closed' ? (
          <View style={styles.actions}>
            <Button
              label={strings.income.add}
              icon="add-outline"
              onPress={() => setForm({ mode: 'new' })}
            />

            {/* Przepisanie ma sens tylko wtedy, gdy nie ma czego nadpisać. */}
            {incomes.length === 0 ? (
              <>
                <Button
                  label={strings.income.copyPrevious}
                  icon="arrow-undo-outline"
                  variant="secondary"
                  onPress={handleCopyPrevious}
                  loading={copyPrevious.isPending}
                />
                <Text style={styles.hint}>{strings.income.copyPreviousHint}</Text>
              </>
            ) : null}

            {copyMessage ? <Text style={styles.copyMessage}>{copyMessage}</Text> : null}
          </View>
        ) : (
          <IncomeForm
            // Klucz wymusza zbudowanie pola kwoty od nowa przy zmianie
            // edytowanego wpisu — pole zapamiętuje tekst przy pierwszym
            // renderowaniu, więc bez tego pokazywałoby poprzednią kwotę.
            key={form.mode === 'edit' ? `edit-${form.income.id}` : 'new'}
            initial={form.mode === 'edit' ? form.income : null}
            onCancel={() => setForm({ mode: 'closed' })}
            onSubmit={handleSubmit}
          />
        )}

        <Text style={styles.note}>{strings.income.monthNote}</Text>
      </Screen>
    </>
  );
}

/** Jedna pozycja listy: kto, ile, i dwa działania. */
function IncomeRow({
  income,
  isEditing,
  onEdit,
  onDelete,
}: {
  income: Income;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card style={isEditing ? styles.rowEditing : undefined}>
      <View style={styles.row}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`${strings.common.edit}: ${income.personName}`}
          style={styles.rowTexts}
        >
          <Text style={styles.rowName}>{income.personName}</Text>
          <Text style={styles.rowAmount}>{formatGrosze(income.amountGrosze)}</Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${strings.common.delete}: ${income.personName}`}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.statusOverdue} />
        </Pressable>
      </View>
    </Card>
  );
}

/** Formularz dodawania i zmiany dochodu. */
function IncomeForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Income | null;
  onCancel: () => void;
  onSubmit: (personName: string, amountGrosze: number) => void;
}) {
  const [personName, setPersonName] = useState(initial?.personName ?? '');
  const [amountGrosze, setAmountGrosze] = useState<number | null>(initial?.amountGrosze ?? null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmedName = personName.trim();
    const amountCheck = validateAmountGrosze(amountGrosze);

    setNameError(trimmedName === '' ? strings.validation.nameRequired : null);
    setAmountError(
      amountCheck.ok
        ? null
        : amountCheck.reason === 'TOO_HIGH'
          ? strings.validation.amountTooHigh
          : amountCheck.reason === 'TOO_LOW'
            ? strings.validation.amountTooLow
            : strings.validation.amountEmpty
    );

    if (trimmedName === '' || !amountCheck.ok) return;

    onSubmit(trimmedName, amountGrosze as number);
  };

  return (
    <Card style={styles.form}>
      <Text style={styles.formTitle}>
        {initial ? strings.income.editTitle : strings.income.addTitle}
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{strings.income.nameLabel}</Text>
        <TextInput
          value={personName}
          onChangeText={setPersonName}
          placeholder={strings.income.namePlaceholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={strings.income.nameLabel}
          style={[styles.input, nameError ? styles.inputError : null]}
        />
        {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      </View>

      <AmountInput
        label={strings.income.amountLabel}
        initialGrosze={initial?.amountGrosze ?? null}
        onChangeGrosze={(grosze) => setAmountGrosze(grosze)}
        error={amountError}
      />

      <Button label={strings.income.save} icon="checkmark-outline" onPress={handleSave} />
      <Button label={strings.common.cancel} variant="secondary" onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginTop: spacing.lg,
    fontSize: fontSize.body,
    lineHeight: 21,
    color: colors.textMuted,
  },
  totalCard: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  totalLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  totalAmount: {
    fontSize: fontSize.amount,
    fontWeight: '800',
    color: colors.income,
  },
  empty: {
    marginTop: spacing.lg,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowEditing: {
    borderColor: colors.primary,
  },
  rowTexts: {
    flex: 1,
    gap: spacing.xs,
  },
  rowName: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  rowAmount: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.statusOverdueSoft,
  },
  pressed: {
    opacity: 0.6,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  hint: {
    fontSize: fontSize.caption,
    lineHeight: 18,
    color: colors.textMuted,
  },
  copyMessage: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.income,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  formTitle: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.text,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
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
  inputError: {
    borderColor: colors.statusOverdue,
  },
  error: {
    fontSize: fontSize.caption,
    color: colors.statusOverdue,
  },
  note: {
    marginTop: spacing.xl,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
