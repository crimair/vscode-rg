/**
 * 検索ワードにマッチした部分をハイライト
 * 検索ワードに大文字が含まれていればcase sensitive、なければignoreCase
 */
export function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const hasUpper = /[A-Z]/.test(query);
  const flags = hasUpper ? 'g' : 'gi';
  try {
    return text.replace(new RegExp(query, flags), match =>
      `<span class="highlight-match">${match}</span>`
    );
  } catch (e) {
    // 不正な正規表現の場合はそのまま返す
    return text;
  }
}