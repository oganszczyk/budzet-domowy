/**
 * 5.9: EKRAN ANALIZY — ZAKRES TYMCZASOWY
 *
 * Decyzja projektowa ze specyfikacji: ikona Analiza ma być obecna
 * od początku, ale wykresy i wskaźniki zostaną opisane w kolejnej
 * wersji specyfikacji.
 *
 * [x] P1 Utworzyć trasę i pusty ekran Analiza.
 * [x] P1 Nie wdrażać wykresów bez osobnej specyfikacji.
 *
 * To jedyny ekran, który celowo pozostaje pusty także po zakończeniu MVP.
 */

import { strings } from '@/constants/strings';
import { ComingSoon } from '@/ui/components/coming-soon';
import { Screen } from '@/ui/components/screen';

export default function AnalysisScreen() {
  return (
    <Screen centered>
      <ComingSoon
        title={strings.analysis.title}
        message={strings.analysis.placeholder}
        stage="Czeka na osobną specyfikację"
      />
    </Screen>
  );
}
