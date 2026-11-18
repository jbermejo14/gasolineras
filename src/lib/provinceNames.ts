const PROVINCE_NAME_LOWERCASE_WORDS: ReadonlySet<string> = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const PROVINCE_NAME_POSTPONED_ARTICLE = /^(.*?)\s*\(([^()]+)\)\s*$/;
const PROVINCE_NAME_SEPARATORS = /([\s/]+)/;
const PROVINCE_NAME_HAS_LOWERCASE = /\p{Ll}/u;

function provinceNameCapitalize(word: string): string {
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function provinceNameCapitalizeAll(text: string): string {
  let wordIndex = 0;
  return text
    .split(PROVINCE_NAME_SEPARATORS)
    .map((part, index) => {
      if (index % 2 === 1 || part === '') return part;
      const isInnerSmallWord = wordIndex > 0 && PROVINCE_NAME_LOWERCASE_WORDS.has(part.toLowerCase());
      wordIndex++;
      return isInnerSmallWord ? part.toLowerCase() : provinceNameCapitalize(part);
    })
    .join('');
}

/**
 * Convierte el nombre de provincia de MITECO ("CORUÑA (A)", "CIUDAD REAL") en un nombre legible
 * ("A Coruña", "Ciudad Real"). Un nombre que ya tenga minúsculas se devuelve sin cambios.
 */
export function formatProvinceName(raw: string): string {
  const name = raw.trim();
  if (PROVINCE_NAME_HAS_LOWERCASE.test(name)) return name;
  const postponed = name.match(PROVINCE_NAME_POSTPONED_ARTICLE);
  const ordered = postponed ? `${postponed[2]} ${postponed[1]}` : name;
  return provinceNameCapitalizeAll(ordered);
}
