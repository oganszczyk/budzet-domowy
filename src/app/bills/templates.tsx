/**
 * Zarządzanie rachunkami cyklicznymi (7.3).
 *
 * 5.8, reguły usuwania: „Usunięcie szablonu rachunku lub subskrypcji wymaga
 * osobnego działania w szczegółach źródła."
 *
 * Ten ekran jest tym osobnym działaniem. Usunięcie rachunku z listy kasuje
 * jeden miesiąc; dopiero wyłączenie tutaj sprawia, że rachunek przestaje
 * się tworzyć w kolejnych miesiącach.
 *
 * 7.5: wyłączamy (isActive=false), nie kasujemy — inaczej zniknęłaby
 * historia poprzednich miesięcy (BR-07).
 */

import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import type { BillTemplate } from '@/domain/models';
import { useAllBillTemplates, useSetBillTemplateActive } from '@/features/bills/queries';
import { formatGrosze } from '@/lib/money';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function BillTemplatesScreen() {
  const router = useRouter();
  const { data: templates } = useAllBillTemplates();
  const setActive = useSetBillTemplateActive();

  const rows = templates ?? [];

  const handleToggle = async (template: BillTemplate, next: boolean) => {
    if (!next) {
      const confirmed = await confirm({
        title: strings.bills.templateDeactivateTitle,
        message: strings.bills.templateDeactivateMessage,
        confirmLabel: strings.common.confirm,
      });
      if (!confirmed) return;
    }
    setActive.mutate({ id: template.id, isActive: next });
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.bills.templatesTitle }} />

      <Screen>
        <Text style={styles.intro}>{strings.bills.templatesIntro}</Text>

        <View style={styles.list}>
          {rows.map((template) => (
            <Card key={template.id}>
              <View style={styles.row}>
                <View style={styles.texts}>
                  <Text style={styles.name}>{template.name}</Text>

                  <Text style={styles.meta}>
                    {strings.bills.templateDueDay} {template.defaultDueDay}
                  </Text>

                  {template.useFixedAmount && template.fixedAmountGrosze !== null ? (
                    <Text style={styles.meta}>
                      {strings.bills.templateFixedAmount}:{' '}
                      {formatGrosze(template.fixedAmountGrosze)}
                    </Text>
                  ) : null}

                  <Text style={template.isActive ? styles.active : styles.inactive}>
                    {template.isActive
                      ? strings.bills.templateActive
                      : strings.bills.templateInactive}
                  </Text>
                </View>

                <Switch
                  value={template.isActive}
                  onValueChange={(next) => handleToggle(template, next)}
                  accessibilityLabel={template.name}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            </Card>
          ))}

          {rows.length === 0 ? (
            <Card>
              <Text style={styles.empty}>{strings.bills.templateEmpty}</Text>
            </Card>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button
            label={strings.bills.addTemplate}
            icon="add"
            variant="secondary"
            onPress={() => router.push('/bills/new')}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: spacing.lg,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  texts: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: fontSize.label,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  active: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.statusPaid,
  },
  inactive: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  empty: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.xl,
  },
});
