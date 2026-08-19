/**
 * 5.4: WYDATKI I ZAKUPY
 *
 * Docelowo: suma miesięczna, lista podkategorii z ich sumami oraz
 * dwa przyciski: „Wpisz ręcznie” (5.5) i „Zeskanuj paragon” (5.6).
 *
 * Powstanie w Etapie 5; skanowanie paragonu w Etapie 7.
 */

import { strings } from '@/constants/strings';
import { ComingSoon } from '@/ui/components/coming-soon';
import { Screen } from '@/ui/components/screen';

export default function PurchasesScreen() {
  return (
    <Screen centered>
      <ComingSoon
        title={strings.purchases.title}
        message={strings.common.comingSoon}
        stage="Etap 5 — zakupy ręczne"
      />
    </Screen>
  );
}
