/**
 * 5.6: SKANOWANIE PARAGONU — UPROSZCZONE OCR
 *
 * Przepływ użytkownika:
 *  [x] 1. Użytkownik wybiera „Zeskanuj paragon".
 *  [x] 2. Aplikacja prosi o dostęp do aparatu lub pozwala wybrać zdjęcie z galerii.
 *  [x] 3. Użytkownik wykonuje zdjęcie.
 *  [x] 4. Aplikacja uruchamia OCR i wyświetla ekran weryfikacji.
 *  [x] 5. Pola sklep, data i kwota są wstępnie uzupełnione, jeżeli rozpoznane.
 *  [x] 6. Użytkownik wybiera podkategorię zakupu.
 *  [x] 7. Aplikacja pyta: „Czy dane zostały poprawnie odczytane?".
 *  [x] 8. Użytkownik zapisuje, poprawia dane, ponawia zdjęcie lub anuluje.
 *
 * BR-08 / AC 5.6: „Skan nie tworzy transakcji przed naciśnięciem «Zapisz»."
 * Rekord powstaje wyłącznie w `handleSave`.
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import { MainType, PaymentMethod, PaymentSource } from '@/domain/enums';
import { useCreateCategory, useCreatePayment } from '@/features/expenses/mutations';
import { useCategories } from '@/features/expenses/queries';
import { scanReceipt, type ScanOutcome } from '@/features/receipts/ocr-service';
import { saveReceiptImage } from '@/features/receipts/receipt-storage';
import { formatDate, todayIso } from '@/lib/date';
import { validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { CategoryPicker } from '@/ui/components/category-picker';
import { Chip, chipRowStyle } from '@/ui/components/chip';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

type Stage = 'PICK' | 'RECOGNIZING' | 'VERIFY';

const METHODS = [
  PaymentMethod.CARD,
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.OTHER,
] as const;

export default function ScanReceiptScreen() {
  const router = useRouter();
  const { data: categories } = useCategories(MainType.PURCHASE);
  const createPayment = useCreatePayment();
  const createCategory = useCreateCategory();

  const [stage, setStage] = useState<Stage>('PICK');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Pola weryfikacji — wstępnie uzupełnione, w całości edytowalne (AC 5.6).
  const [merchant, setMerchant] = useState('');
  const [dateText, setDateText] = useState('');
  const [amountGrosze, setAmountGrosze] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/purchases'));

  /** Uruchamia rozpoznawanie i przechodzi do weryfikacji. */
  const runOcr = async (uri: string) => {
    setImageUri(uri);
    setStage('RECOGNIZING');

    const result = await scanReceipt(uri);
    setOutcome(result);

    if (result.status === 'OK') {
      // 5.6 krok 5: uzupełniamy tylko to, co rozpoznano. Reszta zostaje pusta.
      setMerchant(result.fields.merchant ?? '');
      setDateText(result.fields.date ?? '');
      setAmountGrosze(result.fields.amountGrosze);
    }

    setStage('VERIFY');
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    // 5.6, stany błędów: „Brak uprawnień do aparatu — wyjaśnić problem
    // i zaoferować otwarcie ustawień lub wybór zdjęcia."
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) await runOcr(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled) await runOcr(result.assets[0].uri);
  };

  const retake = () => {
    setStage('PICK');
    setOutcome(null);
    setImageUri(null);
  };

  // AC 5.6: „W przypadku pustej kwoty zapis jest zablokowany do czasu jej uzupełnienia."
  const amountValid = validateAmountGrosze(amountGrosze).ok;
  const canSave = amountValid && categoryId !== null;

  const handleSave = async () => {
    if (!canSave || amountGrosze === null || categoryId === null) return;

    // 8: baza przechowuje wyłącznie ścieżkę, samo zdjęcie leży w katalogu aplikacji.
    const storedPath = imageUri ? await saveReceiptImage(imageUri) : null;

    createPayment.mutate(
      {
        mainType: MainType.PURCHASE,
        categoryId,
        title: merchant.trim() || strings.purchases.title,
        amountGrosze,
        effectiveDate: dateText.trim() || todayIso(),
        dueDate: null,
        paidDate: null,
        status: null,
        // AC 5.6: „Po zapisaniu transakcja ma źródło RECEIPT_SCAN."
        source: PaymentSource.RECEIPT_SCAN,
        merchant: merchant.trim() || null,
        description: null,
        paymentMethod: method,
        billTemplateId: null,
        subscriptionId: null,
        receiptImagePath: storedPath,
      },
      { onSuccess: goBack }
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.scan.title }} />

      <Screen>
        {stage === 'PICK' ? (
          <View style={styles.actions}>
            <Button label={strings.scan.takePhoto} icon="camera-outline" onPress={pickFromCamera} />
            <Button
              label={strings.scan.pickFromGallery}
              icon="images-outline"
              variant="secondary"
              onPress={pickFromGallery}
            />

            {permissionDenied ? (
              <Card style={styles.problem}>
                <Text style={styles.problemTitle}>{strings.scan.noPermission}</Text>
                <Text style={styles.problemHint}>{strings.scan.noPermissionHint}</Text>
                <Button
                  label={strings.scan.openSettings}
                  variant="secondary"
                  onPress={() => Linking.openSettings()}
                />
              </Card>
            ) : null}

            <Button label={strings.common.cancel} variant="secondary" onPress={goBack} />
          </View>
        ) : null}

        {stage === 'RECOGNIZING' ? (
          <View style={styles.recognizing}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.recognizingText}>{strings.scan.recognizing}</Text>
          </View>
        ) : null}

        {stage === 'VERIFY' ? (
          <>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            ) : null}

            <OcrStatusBanner outcome={outcome} />

            <Text style={styles.question}>{strings.scan.verifyQuestion}</Text>
            <Text style={styles.hint}>{strings.scan.verifyHint}</Text>

            <View style={styles.field}>
              <AmountInput
                label={strings.purchases.amount}
                initialGrosze={amountGrosze}
                onChangeGrosze={(grosze) => setAmountGrosze(grosze)}
                error={amountGrosze !== null && !amountValid ? strings.purchases.noAmount : null}
              />
              {amountGrosze === null ? (
                <Text style={styles.warning}>{strings.scan.amountRequired}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{strings.purchases.merchant}</Text>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder={strings.purchases.merchantPlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={80}
                accessibilityLabel={strings.purchases.merchant}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{strings.purchases.date}</Text>
              <TextInput
                value={dateText}
                onChangeText={setDateText}
                placeholder={todayIso()}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={strings.purchases.date}
                style={styles.input}
              />
              <Text style={styles.hint}>
                {dateText ? formatDate(dateText) : formatDate(todayIso())}
              </Text>
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
              <Text style={styles.label}>{strings.purchases.paymentMethod}</Text>
              <View style={styles.chips}>
                {METHODS.map((option) => (
                  <Chip
                    key={option}
                    label={strings.purchases.method[option]}
                    selected={option === method}
                    onPress={() => setMethod((current) => (current === option ? null : option))}
                  />
                ))}
              </View>
            </View>

            <Text style={styles.hint}>{strings.scan.photoSaved}</Text>

            <View style={styles.actions}>
              <Button
                label={strings.common.save}
                icon="checkmark"
                onPress={handleSave}
                disabled={!canSave}
                loading={createPayment.isPending}
              />
              <Button
                label={strings.scan.retake}
                icon="refresh-outline"
                variant="secondary"
                onPress={retake}
              />
              <Button label={strings.common.cancel} variant="secondary" onPress={goBack} />
            </View>
          </>
        ) : null}
      </Screen>
    </>
  );
}

/**
 * Informuje, skąd wzięły się dane — i czy w ogóle pochodzą ze zdjęcia.
 *
 * 5.6 wymaga obsługi stanów błędów; użytkownik musi wiedzieć, czy patrzy
 * na odczyt, czy na puste pola do ręcznego uzupełnienia.
 */
function OcrStatusBanner({ outcome }: { outcome: ScanOutcome | null }) {
  if (!outcome) return null;

  if (outcome.status === 'OK') {
    return (
      <View style={styles.banners}>
        {/* Bez tego ostrzeżenia rozpoznane dane wyglądałyby jak odczyt
            z Twojego paragonu, a nie jak przykład. */}
        {!outcome.readsImage ? (
          <Card style={styles.demoBanner}>
            <View style={styles.bannerRow}>
              <Ionicons name="flask-outline" size={18} color={colors.statusWaiting} />
              <Text style={styles.demoBannerText}>{strings.scan.demoBanner}</Text>
            </View>
          </Card>
        ) : null}

        {outcome.fields.amountSource ? (
          <Text style={styles.hint}>
            {strings.scan.amountFrom} {strings.scan.amountFromLabel[outcome.fields.amountSource]}
          </Text>
        ) : null}
      </View>
    );
  }

  const message =
    outcome.status === 'NO_TEXT'
      ? strings.scan.noText
      : outcome.status === 'ENGINE_UNAVAILABLE'
        ? strings.scan.engineUnavailable
        : strings.scan.ocrError;

  // 5.6: „Błąd OCR — użytkownik nadal może przejść do formularza ręcznego
  // z zachowanym zdjęciem." Dlatego to komunikat, a nie ślepy zaułek.
  return (
    <Card style={styles.problem}>
      <Text style={styles.problemTitle}>{message}</Text>
      <Text style={styles.problemHint}>{strings.scan.fillManually}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  recognizing: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  recognizingText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  banners: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  demoBanner: {
    backgroundColor: colors.statusWaitingSoft,
    borderColor: colors.statusWaiting,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  demoBannerText: {
    flex: 1,
    fontSize: fontSize.caption,
    color: colors.statusWaiting,
    lineHeight: 18,
  },
  question: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  warning: {
    fontSize: fontSize.caption,
    color: colors.statusWaiting,
  },
  field: {
    marginTop: spacing.lg,
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
  chips: chipRowStyle,
  problem: {
    backgroundColor: colors.statusOverdueSoft,
    borderColor: colors.statusOverdue,
    gap: spacing.sm,
  },
  problemTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.statusOverdue,
  },
  problemHint: {
    fontSize: fontSize.caption,
    color: colors.statusOverdue,
  },
});
