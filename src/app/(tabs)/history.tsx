/**
 * 5.7: HISTORIA WSZYSTKICH PŁATNOŚCI
 *
 * Docelowo: wspólna, chronologiczna lista rekordów z rachunków,
 * subskrypcji i zakupów, od najnowszych do najstarszych.
 *
 * Powstanie w Etapie 6 — najpierw musi istnieć tabela Payment (Etap 1).
 */

import { strings } from '@/constants/strings';
import { ComingSoon } from '@/ui/components/coming-soon';
import { Screen } from '@/ui/components/screen';

export default function HistoryScreen() {
  return (
    <Screen centered>
      <ComingSoon
        title={strings.history.title}
        message={strings.common.comingSoon}
        stage="Etap 6 — historia i szczegóły"
      />
    </Screen>
  );
}
