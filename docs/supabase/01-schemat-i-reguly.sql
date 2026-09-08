-- ===========================================================================
--  Domowe wydatki — schemat w chmurze i reguły dostępu (Etap 14c)
-- ===========================================================================
--
--  JAK TO URUCHOMIĆ
--
--  1. Wejdź na https://supabase.com i otwórz swój projekt.
--  2. Z lewej strony wybierz „SQL Editor", a potem „New query".
--  3. Wklej CAŁY ten plik i naciśnij „Run".
--  4. Powinno napisać „Success. No rows returned".
--
--  Wykonanie tego pliku drugi raz niczego nie zepsuje — każde polecenie ma
--  `IF NOT EXISTS` albo `DROP ... IF EXISTS` przed sobą. Gdyby coś poszło
--  nie tak w połowie, można po prostu uruchomić go ponownie.
--
--
--  CO TU POWSTAJE
--
--  Sześć tabel — lustrzane odbicie tego, co aplikacja trzyma w telefonie —
--  oraz reguły RLS, które pilnują, żeby każde konto widziało wyłącznie swoje
--  wiersze.
--
--  TELEFON POZOSTAJE BAZĄ GŁÓWNĄ. Chmura jest kopią, do której aplikacja
--  dosyła zmiany. Wydatek wpisuje się przy kasie, często bez zasięgu —
--  gdyby zapis wymagał internetu, aplikacja byłaby bezużyteczna dokładnie
--  w tym jednym momencie, w którym jest potrzebna.
--
--
--  CZEGO TU NIE MA I DLACZEGO
--
--  * LOKALNEGO `id`. To numer kolejny nadany przez JEDEN telefon; na drugim
--    ta sama liczba oznacza inny wydatek. Rekordy rozpoznajemy po `uuid`,
--    który jest nadawany raz i nigdy się nie zmienia.
--
--  * ŚCIEŻKI DO ZDJĘCIA PARAGONU. To ścieżka do pliku w pamięci jednego
--    telefonu — na drugim nie prowadzi donikąd. Wysłanie jej dałoby wydatek,
--    który udaje, że ma paragon, i zawodzi przy próbie otwarcia. Same zdjęcia
--    zostają w telefonie; ich przenoszenie to osobna decyzja, nie ten etap.
--
--  * STANU RACHUNKU (`status`). Aplikacja wylicza go przy każdym odczycie
--    z terminu i daty opłacenia (BR-11), właśnie po to, żeby rachunek stawał
--    się „po terminie" sam, bez zapisu do bazy. Przechowany byłby wartością,
--    która może się rozjechać z prawdą.
--
--  * KLUCZY OBCYCH między tabelami. Wygląda to na brak dyscypliny, ale jest
--    świadome: rekordy przychodzą z telefonu paczkami i przy słabym zasięgu
--    paczka bywa przerwana w połowie. Twardy klucz obcy odrzuciłby wtedy
--    wydatek NA STAŁE, bo jego kategoria jeszcze nie dojechała. Bez klucza
--    wydatek czeka i doczeka się przy następnej synchronizacji.
--
--
--  DATY SĄ TEKSTEM, NIE ZNACZNIKIEM CZASU
--
--  `created_at` i `updated_at` trzymamy jako `text` w zapisie ISO ze strefą
--  UTC („2026-09-08T12:34:56.789Z"). To ta sama zasada, co w telefonie:
--  taki tekst sortuje się alfabetycznie dokładnie tak, jak chronologicznie,
--  i wraca z serwera znak w znak taki sam, jaki tam poszedł.
--
--  Kolumna `timestamptz` wracałaby w innym zapisie niż wysłany
--  („+00:00" zamiast „Z"), a Etap 14d rozstrzyga konflikty porównaniem
--  „który zapis jest nowszy". Porównanie dwóch różnie zapisanych dat to
--  klasa błędów, której wolimy w ogóle nie wpuścić.
--
--  Osobno stoi `synced_at` — TEN znacznik stawia serwer własnym zegarem
--  i służy do jednego pytania z Etapu 14d: „co się zmieniło od mojej
--  ostatniej wizyty". Zegar telefonu bywa przestawiony i do tego się nie
--  nadaje.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Wspólny mechanizm: serwer sam stempluje każdy zapis swoim zegarem
-- ---------------------------------------------------------------------------
create or replace function public.stamp_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
--  Kategorie
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  uuid        text        not null,
  name        text        not null,
  icon_key    text        not null,
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  -- Lista kategorii głównych, które korzystają z tej podkategorii,
  -- np. {SUBSCRIPTION,PURCHASE}. Subskrypcje i zakupy dzielą podkategorie,
  -- żeby analiza mogła zsumować wydatki z obu źródeł.
  used_by     text[]      not null default '{}',
  synced_at   timestamptz not null default now(),

  -- Klucz główny zawiera `user_id`, a nie sam `uuid`. Dzięki temu dwa konta
  -- nie mogą sobie nawzajem zablokować zapisu, gdyby kiedykolwiek wylosowały
  -- ten sam identyfikator.
  primary key (user_id, uuid)
);


-- ---------------------------------------------------------------------------
--  Szablony rachunków cyklicznych
-- ---------------------------------------------------------------------------
create table if not exists public.bill_templates (
  user_id             uuid        not null references auth.users (id) on delete cascade,
  uuid                text        not null,
  name                text        not null,
  category_uuid       text,
  default_due_day     integer     not null,
  is_active           boolean     not null default true,
  use_fixed_amount    boolean     not null default false,
  -- BR-03: kwoty wyłącznie w groszach, jako liczby całkowite.
  fixed_amount_grosze bigint,
  created_at          text        not null,
  updated_at          text        not null,
  synced_at           timestamptz not null default now(),

  primary key (user_id, uuid)
);


-- ---------------------------------------------------------------------------
--  Subskrypcje
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                       uuid        not null references auth.users (id) on delete cascade,
  uuid                          text        not null,
  name                          text        not null,
  amount_grosze                 bigint      not null,
  frequency_type                text        not null,
  custom_interval_months        integer,
  start_date                    date        not null,
  next_payment_date             date        not null,
  category_uuid                 text,
  is_active                     boolean     not null default true,
  last_usage_confirmation_date  date,
  confirmation_interval_months  integer     not null default 3,
  created_at                    text        not null,
  updated_at                    text        not null,
  synced_at                     timestamptz not null default now(),

  primary key (user_id, uuid)
);


-- ---------------------------------------------------------------------------
--  Płatności — wspólna tabela rachunków, subskrypcji i zakupów
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  user_id             uuid        not null references auth.users (id) on delete cascade,
  uuid                text        not null,
  -- 'BILL', 'SUBSCRIPTION' albo 'PURCHASE' (BR-01).
  main_type           text        not null,
  category_uuid       text,
  title               text        not null,
  -- BR-04: pusta kwota wyłącznie dla rachunku oczekującego na wpisanie kwoty.
  amount_grosze       bigint,
  effective_date      date        not null,
  due_date            date,
  paid_date           date,
  source              text        not null,
  merchant            text,
  description         text,
  payment_method      text,
  -- Z czego rekord powstał; puste dla wydatku wpisanego ręcznie.
  bill_template_uuid  text,
  subscription_uuid   text,
  created_at          text        not null,
  updated_at          text        not null,
  synced_at           timestamptz not null default now(),

  primary key (user_id, uuid)
);

-- Etap 14d będzie pytał „co się zmieniło od znacznika X" — bez tego indeksu
-- każde takie pytanie przeglądałoby całą historię wydatków konta.
create index if not exists payments_user_synced_idx
  on public.payments (user_id, synced_at);


-- ---------------------------------------------------------------------------
--  Dochody domowników
-- ---------------------------------------------------------------------------
create table if not exists public.incomes (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  uuid          text        not null,
  person_name   text        not null,
  amount_grosze bigint      not null,
  -- Miesiąc w zapisie „RRRR-MM". Dochód dotyczy miesiąca, nie konkretnego dnia.
  month         text        not null,
  created_at    text        not null,
  updated_at    text        not null,
  synced_at     timestamptz not null default now(),

  primary key (user_id, uuid)
);


-- ---------------------------------------------------------------------------
--  Ślad po rekordach skasowanych przez użytkownika
-- ---------------------------------------------------------------------------
--
--  Bez tej tabeli kasowanie nie byłoby trwałe. Telefon A kasuje wydatek
--  i przestaje go mieć. Telefon B, który nic nie kasował, nadal go ma
--  i wysyła. Telefon A dostaje rekord, którego u siebie nie zna, uznaje go
--  za nowy i zapisuje z powrotem. Skasowany wydatek WRACA — za każdym razem,
--  na obu telefonach, bez żadnego komunikatu.
--
--  Dlatego kasowanie jest tu osobnym rodzajem zmiany, a nie brakiem wiersza.
-- ---------------------------------------------------------------------------
create table if not exists public.deleted_records (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- 'PAYMENT', 'CATEGORY', 'BILL_TEMPLATE', 'SUBSCRIPTION' albo 'INCOME'.
  entity_type text        not null,
  uuid        text        not null,
  deleted_at  text        not null,
  synced_at   timestamptz not null default now(),

  primary key (user_id, entity_type, uuid)
);

create index if not exists deleted_records_user_synced_idx
  on public.deleted_records (user_id, synced_at);


-- ---------------------------------------------------------------------------
--  Wyzwalacze stemplujące zegarem serwera
-- ---------------------------------------------------------------------------
do $$
declare
  nazwa text;
begin
  foreach nazwa in array array[
    'categories', 'bill_templates', 'subscriptions',
    'payments', 'incomes', 'deleted_records'
  ]
  loop
    execute format('drop trigger if exists stamp_synced_at on public.%I', nazwa);
    execute format(
      'create trigger stamp_synced_at
         before insert or update on public.%I
         for each row execute function public.stamp_synced_at()',
      nazwa
    );
  end loop;
end;
$$;


-- ===========================================================================
--  REGUŁY DOSTĘPU (RLS)
-- ===========================================================================
--
--  TO JEST JEDYNE PRAWDZIWE ZABEZPIECZENIE TYCH DANYCH.
--
--  Klucz `publishable`, który aplikacja nosi w sobie, jest jawny — da się go
--  odczytać z każdej zainstalowanej aplikacji i nie jest hasłem. Gdyby nie
--  reguły niżej, każdy z tym kluczem czytałby wydatki wszystkich kont.
--
--  `auth.uid()` to identyfikator zalogowanego konta, ustalany przez serwer
--  na podstawie tokenu. Aplikacja nie ma jak go podmienić — nie pochodzi
--  z niczego, co wysyła.
--
--  Warunek jest ten sam dla każdej operacji i każdej tabeli:
--  wiersz musi należeć do konta, które o niego pyta.
--
--  `with check` przy zapisie jest równie ważny, co `using` przy odczycie:
--  bez niego zalogowany użytkownik mógłby wstawić wiersz PODPISANY CUDZYM
--  kontem — czyli wstrzyknąć komuś wydatek do historii.
-- ===========================================================================

do $$
declare
  nazwa text;
begin
  foreach nazwa in array array[
    'categories', 'bill_templates', 'subscriptions',
    'payments', 'incomes', 'deleted_records'
  ]
  loop
    execute format('alter table public.%I enable row level security', nazwa);

    -- Dawne reguły znikają, żeby ponowne uruchomienie pliku nie mnożyło ich
    -- w nieskończoność. Reguły są sumowane logicznie: jedna zapomniana,
    -- zbyt luźna, otwiera dane niezależnie od pozostałych.
    execute format('drop policy if exists wlasne_wiersze on public.%I', nazwa);

    execute format(
      'create policy wlasne_wiersze on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      nazwa
    );
  end loop;
end;
$$;


-- ===========================================================================
--  SPRAWDZENIE
-- ===========================================================================
--
--  Zaznacz poniższe zapytanie i uruchom je osobno. Ma zwrócić SZEŚĆ wierszy,
--  każdy z `rowsecurity` = true i jedną regułą. Gdyby któraś tabela miała
--  `rowsecurity` = false, jej dane byłyby dostępne dla każdego — wtedy
--  uruchom ten plik jeszcze raz.
--
--  select
--    t.tablename,
--    t.rowsecurity,
--    count(p.policyname) as regul
--  from pg_tables t
--  left join pg_policies p
--    on p.tablename = t.tablename and p.schemaname = t.schemaname
--  where t.schemaname = 'public'
--  group by t.tablename, t.rowsecurity
--  order by t.tablename;
-- ===========================================================================
