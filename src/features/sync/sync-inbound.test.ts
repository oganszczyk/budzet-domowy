import { MainType } from '@/domain/enums';

import {
  markerKey,
  PULL_ORDER,
  readCategory,
  readDeletion,
  readIncome,
  readPayment,
} from './sync-inbound';

const CZAS_SERWERA = '2026-09-08T10:00:00.123456+00:00';
const uuid = (n: number) => String(n).padStart(32, '0');

describe('odczyt wierszy z serwera (Etap 14d)', () => {
  it('kolejność pobierania stawia kategorie przed tym, co na nie wskazuje', () => {
    // Repozytorium nie ma czym wypełnić wymaganej kolumny kategorii, więc
    // wydatek, który przyjdzie przed nią, musi zostać POMINIĘTY. Pominięty
    // wydatek to pieniądze, których nie widać w sumie miesiąca.
    expect(PULL_ORDER.indexOf('categories')).toBeLessThan(PULL_ORDER.indexOf('payments'));
    expect(PULL_ORDER.indexOf('bill_templates')).toBeLessThan(PULL_ORDER.indexOf('payments'));
  });

  it('skasowane pobieramy NA KOŃCU', () => {
    // Odwrotna kolejność najpierw usunęłaby wydatek, a zaraz potem wpisała
    // go z powrotem jego własnym wierszem z tabeli płatności — wysyłka nie
    // kasuje wierszy z serwera, tylko dokłada nagrobek.
    expect(PULL_ORDER[PULL_ORDER.length - 1]).toBe('deleted_records');
  });

  it('klucz znacznika jest inny dla każdej tabeli', () => {
    const klucze = new Set(PULL_ORDER.map((table) => markerKey(table)));

    expect(klucze.size).toBe(PULL_ORDER.length);
  });

  it('sprowadza znacznik serwera do jednego zapisu', () => {
    // Postgres oddaje czas w swoim formacie („+00:00"), a porównujemy te
    // wartości jako TEKST. Dwa różne zapisy tej samej chwili dałyby wynik
    // „starszy" albo „nowszy" zależnie od tego, jak akurat je sformatowano.
    const wiersz = readCategory({
      uuid: uuid(1),
      name: 'Jedzenie',
      icon_key: 'restaurant-outline',
      is_active: true,
      sort_order: 3,
      used_by: ['SUBSCRIPTION', 'PURCHASE'],
      synced_at: CZAS_SERWERA,
    });

    expect(wiersz?.syncedAt).toBe('2026-09-08T10:00:00.123Z');
    expect(wiersz?.syncedAt.endsWith('Z')).toBe(true);
  });

  it('czyta kategorię z listą typów głównych', () => {
    const wiersz = readCategory({
      uuid: uuid(1),
      name: 'Jedzenie',
      icon_key: 'restaurant-outline',
      is_active: true,
      sort_order: 3,
      used_by: ['SUBSCRIPTION', 'PURCHASE'],
      synced_at: CZAS_SERWERA,
    });

    expect(wiersz?.usedBy).toEqual([MainType.SUBSCRIPTION, MainType.PURCHASE]);
  });

  it('wydatek z serwera nigdy nie przynosi statusu ani ścieżki do zdjęcia', () => {
    // BR-11: status wyliczamy przy odczycie. Ścieżka do zdjęcia dotyczy
    // pamięci TAMTEGO telefonu — u nas nie prowadzi donikąd.
    const wiersz = readPayment({
      uuid: uuid(10),
      main_type: 'PURCHASE',
      category_uuid: uuid(1),
      title: 'Lidl',
      amount_grosze: 12550,
      effective_date: '2026-09-05',
      source: 'MANUAL',
      created_at: '2026-09-05T10:00:00.000Z',
      updated_at: '2026-09-05T10:00:00.000Z',
      synced_at: CZAS_SERWERA,
      // Nawet gdyby serwer je przysłał — a nie przyśle:
      status: 'OVERDUE',
      receipt_image_path: '/data/cudzy-telefon/paragon.jpg',
    });

    expect(wiersz?.status).toBeNull();
    expect(wiersz?.receiptImagePath).toBeNull();
  });

  it('pusta kwota rachunku zostaje pusta', () => {
    // BR-04. Zamiana na zero wpisałaby kwotę, której nikt nie podał,
    // i weszłaby do sum miesiąca.
    const wiersz = readPayment({
      uuid: uuid(11),
      main_type: 'BILL',
      category_uuid: uuid(1),
      title: 'Gaz',
      amount_grosze: null,
      effective_date: '2026-09-01',
      source: 'AUTO_BILL',
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-01T10:00:00.000Z',
      synced_at: CZAS_SERWERA,
    });

    expect(wiersz?.amountGrosze).toBeNull();
  });

  it('odrzuca wiersz bez identyfikatora', () => {
    // Rekord bez trwałego identyfikatora jest dla synchronizacji nierozpoznawalny
    // i przy każdym pobraniu wchodziłby jako nowy.
    expect(readPayment({ title: 'Lidl', synced_at: CZAS_SERWERA })).toBeNull();
    expect(readIncome({ person_name: 'Ola', synced_at: CZAS_SERWERA })).toBeNull();
  });

  it('odrzuca wiersz bez znacznika serwera', () => {
    // Bez niego nie da się przesunąć znacznika „dokąd doszliśmy" i pobieranie
    // zaczynałoby od początku przy każdej próbie.
    expect(
      readCategory({ uuid: uuid(1), name: 'Jedzenie', used_by: ['PURCHASE'], synced_at: null })
    ).toBeNull();
  });

  it('odrzuca skasowanie nieznanego rodzaju', () => {
    // Nieznany rodzaj encji znaczy, że wiersz zapisała NOWSZA wersja
    // aplikacji. Zgadywanie, czego dotyczy, mogłoby skasować niewłaściwy
    // rekord — a kasowanie rozchodzi się na wszystkie urządzenia.
    expect(
      readDeletion({
        entity_type: 'SAVED_REPORT',
        uuid: uuid(5),
        deleted_at: '2026-09-08T10:00:00.000Z',
        synced_at: CZAS_SERWERA,
      })
    ).toBeNull();
  });

  it('czyta poprawne skasowanie', () => {
    const wiersz = readDeletion({
      entity_type: 'PAYMENT',
      uuid: uuid(5),
      deleted_at: '2026-09-08T10:00:00.000Z',
      synced_at: CZAS_SERWERA,
    });

    expect(wiersz).toEqual({
      entityType: 'PAYMENT',
      uuid: uuid(5),
      deletedAt: '2026-09-08T10:00:00.000Z',
      syncedAt: '2026-09-08T10:00:00.123Z',
    });
  });
});
