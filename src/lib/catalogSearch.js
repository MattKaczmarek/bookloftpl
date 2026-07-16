export function catalogSearchScore(value, query) {
  const rawQuery = String(query || "").trim().toLowerCase();
  if (!rawQuery) return 0;

  const rawValue = String(value || "").toLowerCase();
  const rawPhraseIndex = rawValue.indexOf(rawQuery);
  if (rawPhraseIndex >= 0) return 11_000 - Math.min(rawPhraseIndex, 999);

  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) return -1;
  const normalizedValue = normalizeCatalogSearch(value);
  if (!normalizedValue) return -1;

  const phraseIndex = normalizedValue.indexOf(normalizedQuery);
  if (phraseIndex >= 0) return 10_000 - Math.min(phraseIndex, 999);

  const queryTokens = uniqueTokens(normalizedQuery);
  const valueTokens = normalizedValue.split(" ").filter(Boolean);
  if (!queryTokens.length || !valueTokens.length) return -1;

  let score = 0;
  let previousIndex = -1;
  let ordered = true;

  for (const queryToken of queryTokens) {
    let bestScore = -1;
    let bestIndex = -1;

    for (const [index, valueToken] of valueTokens.entries()) {
      const tokenScore = catalogTokenScore(valueToken, queryToken);
      if (tokenScore > bestScore) {
        bestScore = tokenScore;
        bestIndex = index;
      }
    }

    if (bestScore < 0) return -1;
    if (bestIndex < previousIndex) ordered = false;
    previousIndex = bestIndex;
    score += bestScore;
  }

  return score + (ordered ? 60 : 0) + Math.min(queryTokens.length * 20, 100);
}

export function normalizeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTokens(value) {
  return [...new Set(value.split(" ").filter(Boolean))];
}

function catalogTokenScore(valueToken, queryToken) {
  if (valueToken === queryToken) return 300;
  if (queryToken.length >= 2 && valueToken.startsWith(queryToken)) return 220;
  if (queryToken.length >= 3 && valueToken.includes(queryToken)) return 180;
  if (queryToken.length >= 4 && isOneEditAway(valueToken, queryToken)) return 120;
  return -1;
}

function isOneEditAway(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;

  if (left.length === right.length) {
    const differences = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences.push(index);
      if (differences.length > 2) return false;
    }
    if (differences.length <= 1) return true;
    const [first, second] = differences;
    return second === first + 1 && left[first] === right[second] && left[second] === right[first];
  }

  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;

  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    longIndex += 1;
  }
  return true;
}
