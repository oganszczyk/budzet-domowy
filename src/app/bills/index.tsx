/**
 * 5.2: RACHUNKI DOMOWE
 *
 * Docelowo: lista rachunków wybranego miesiąca z sumą na górze,
 * statusami (WAITING_AMOUNT / TO_PAY / PAID / OVERDUE) i automatycznym
 * tworzeniem rekordów na kolejne miesiące.
 *
 * Powstanie w Etapie 3.
 */

import { strings } from '@/constants/strings';
import { ComingSoon } from '@/ui/components/coming-soon';
import { Screen } from '@/ui/components/screen';

export default function BillsScreen() {
  return (
    <Screen centered>
      <ComingSoon
        title={strings.bills.title}
        message={strings.common.comingSoon}
        stage="Etap 3 — rachunki"
      />
    </Screen>
  );
}
