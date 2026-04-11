// fallback minutes when recipe store doesn't have the product yet — typed from Process Duration.xlsx (NPB ref)
// mixing column = sponge mixing through floor time; IP/FP = dividing/panning; packaging includes cooling+pack in the sheet
// If your real line uses a different total (e.g. 299 from a Process Profile), set that on the recipe / profile — this table is not auto-synced.
export const SKU_PROCESS_DURATIONS = {
  'Everyday Bread 8s': {
    mixing: 282,       // spreadsheet "SL" row — not necessarily your live profile minutes
    makeupDividing: 17,
    makeupPanning: 60,
    baking: 38,
    packaging: 105,    // Cooling 100 + Packaging 5
  },
  'Everyday Bread 12s': {
    mixing: 282,       // PL
    makeupDividing: 17,
    makeupPanning: 55,
    baking: 38,
    packaging: 115,    // Cooling 110 + Packaging 5
  },
  'Whole Wheat 8s': {
    mixing: 287,
    makeupDividing: 17,
    makeupPanning: 60,
    baking: 38,
    packaging: 115,
  },
  'Raisin 8s': {
    mixing: 302,
    makeupDividing: 17,
    makeupPanning: 80,
    baking: 41,
    packaging: 115,
  },
};

export function getStageDurationsForProduct(productName) {
  return SKU_PROCESS_DURATIONS[productName] ?? null;
}

export function getTotalProcessMinutes(productName) {
  const d = getStageDurationsForProduct(productName);
  if (!d) return 0;
  return d.mixing + d.makeupDividing + d.makeupPanning + d.baking + d.packaging;
}
