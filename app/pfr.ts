// Pro Football Reference game-log links. Player pages sit under the PFR ID's
// first letter, upper-cased: BoetBr00 -> /players/B/BoetBr00/gamelog/2026/.
// IDs can be short (MasoR01), hyphenated (Ya-SRo00) or start lower-case
// (vandJo00). Anything else is rejected so a bad ID renders as plain text.

const pfrPlayerIdPattern = /^[A-Za-z][A-Za-z.-]*\d{2}$/;

export function pfrGamelogUrl(pfrPlayerId: string | undefined, season: number | undefined): string | undefined {
  const id = pfrPlayerId?.trim();
  if (!id || !pfrPlayerIdPattern.test(id)) return undefined;
  if (season === undefined || !Number.isInteger(season) || season < 1920 || season > 2100) return undefined;
  return `https://www.pro-football-reference.com/players/${id[0].toUpperCase()}/${encodeURIComponent(id)}/gamelog/${season}/`;
}
