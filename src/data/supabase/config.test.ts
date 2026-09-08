import { normalizeProjectUrl, readSupabaseConfig } from './config';

const KEY = 'sb_publishable_przykladowyKlucz';
const URL = 'https://przyklad.supabase.co';

describe('normalizeProjectUrl', () => {
  it('poprawny adres zostaje bez zmian', () => {
    expect(normalizeProjectUrl(URL)).toBe(URL);
  });

  it('obcina ukośnik na końcu', () => {
    expect(normalizeProjectUrl(`${URL}/`)).toBe(URL);
    expect(normalizeProjectUrl(`${URL}///`)).toBe(URL);
  });

  it('OBCINA KOŃCÓWKĘ /rest/v1/ — to jest ta pomyłka z panelu Supabase', () => {
    // Biblioteka dokleja tę część sama. Zostawiona dałaby /rest/v1/rest/v1/.
    expect(normalizeProjectUrl(`${URL}/rest/v1/`)).toBe(URL);
    expect(normalizeProjectUrl(`${URL}/rest/v1`)).toBe(URL);
  });

  it('obcina pozostałe końcówki API', () => {
    expect(normalizeProjectUrl(`${URL}/auth/v1`)).toBe(URL);
    expect(normalizeProjectUrl(`${URL}/storage/v1/`)).toBe(URL);
    expect(normalizeProjectUrl(`${URL}/realtime/v1`)).toBe(URL);
  });

  it('obcina spacje z kopiowania', () => {
    expect(normalizeProjectUrl(`  ${URL}  `)).toBe(URL);
  });

  it('nie obcina fragmentu nazwy projektu podobnego do końcówki', () => {
    // Projekt nazwany „rest" nie może stracić kawałka nazwy hosta.
    expect(normalizeProjectUrl('https://rest.supabase.co')).toBe('https://rest.supabase.co');
  });
});

describe('readSupabaseConfig', () => {
  it('komplet wartości daje konfigurację', () => {
    expect(readSupabaseConfig(URL, KEY)).toEqual({ url: URL, publishableKey: KEY });
  });

  it('BRAK PLIKU .env to nie jest błąd — aplikacja ma działać lokalnie', () => {
    // Repozytorium jest publiczne; kto je sklonuje, nie dostanie .env.
    expect(readSupabaseConfig(undefined, undefined)).toBeNull();
  });

  it('sam adres bez klucza to brak konfiguracji', () => {
    expect(readSupabaseConfig(URL, undefined)).toBeNull();
    expect(readSupabaseConfig(URL, '   ')).toBeNull();
  });

  it('sam klucz bez adresu to brak konfiguracji', () => {
    expect(readSupabaseConfig(undefined, KEY)).toBeNull();
    expect(readSupabaseConfig('', KEY)).toBeNull();
  });

  it('adres bez https odrzucamy — Supabase nie przyjmuje połączeń nieszyfrowanych', () => {
    expect(readSupabaseConfig('przyklad.supabase.co', KEY)).toBeNull();
    expect(readSupabaseConfig('http://przyklad.supabase.co', KEY)).toBeNull();
  });

  it('adres z końcówką REST jest naprawiany, a nie odrzucany', () => {
    expect(readSupabaseConfig(`${URL}/rest/v1/`, KEY)).toEqual({ url: URL, publishableKey: KEY });
  });

  it('klucz ze spacjami z kopiowania jest przycinany', () => {
    expect(readSupabaseConfig(URL, `  ${KEY}\n`)).toEqual({ url: URL, publishableKey: KEY });
  });
});
