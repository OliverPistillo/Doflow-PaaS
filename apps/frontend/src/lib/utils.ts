// Niente any, usiamo un'unione esplicita
export function cn(
  ...inputs: Array<string | number | boolean | null | undefined>
): string {
  return inputs
    .filter(Boolean)        // rimuove falsy (null, undefined, false, 0, '')
    .map(String)            // tutto in stringa
    .join(' ');
}
