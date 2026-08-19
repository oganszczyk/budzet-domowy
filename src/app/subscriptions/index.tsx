/**
 * 5.3: SUBSKRYPCJE
 *
 * Docelowo: lista subskrypcji z sumą miesięczną, częstotliwością,
 * najbliższą datą płatności oraz okresowym pytaniem kontrolnym
 * „Czy nadal korzystasz z tej subskrypcji i ją opłacasz?”.
 *
 * Powstanie w Etapie 4.
 */

import { strings } from '@/constants/strings';
import { ComingSoon } from '@/ui/components/coming-soon';
import { Screen } from '@/ui/components/screen';

export default function SubscriptionsScreen() {
  return (
    <Screen centered>
      <ComingSoon
        title={strings.subscriptions.title}
        message={strings.common.comingSoon}
        stage="Etap 4 — subskrypcje"
      />
    </Screen>
  );
}
