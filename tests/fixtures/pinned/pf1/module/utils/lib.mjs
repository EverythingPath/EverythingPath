import { RollPF } from "@dice/roll.mjs";

/**
 * Creates a tag from a string.
 *
 * @example
 * ```js
 * pf1.utils.createTag("Wizard of Oz 2"); // => "wizardOfOz2"
 * pf1.utils.createTag("Wizard of Oz 2", {camelCase:false}); // => wizardofoz2
 * pf1.utils.createTag("Wizard of Oz 2", {camelCase:false,allowUpperCase:true}); // => WizardofOz2
 * pf1.utils.createTag("d'Artagnan"); // => dartagnan
 * pf1.utils.createTag("d'Artagnan", {allowUpperCase:true}); // => dArtagnan
 * ```
 *
 * @param {string} str - String to convert
 * @param {object} [options] - Additional options
 * @param {boolean} [options.allowUpperCase=false] - Do not forcibly lowercase everything.
 * @param {boolean} [options.camelCase=true] - Automatic camel case
 * @param {string | Function} [options.replacement=""] - Replacement for disallowed characters.
 * @param {boolean} [options.allowInitialNumbers=false] - If false, number prefix is removed.
 * @param {boolean} [options.allowUnderScore=true] - If false, underscore is removed.
 * @returns {string} - String suitable as a tag
 */
export function createTag(
  str,
  {
    allowUpperCase = false,
    camelCase = true,
    replacement = "",
    allowInitialNumbers = false,
    allowUnderScore = true,
  } = {}
) {
  if (!str) return "";

  str = str
    .normalize("NFD") // Normalize
    .replace(/\p{Diacritic}/gu, "") // Remove diacritics
    .replace(/[^a-zA-Z0-9_\s]/g, replacement) // Replace remaining non-latin letters
    // Camel case and such
    .split(/\s+/)
    .map((s, a) => {
      if (!allowUpperCase) s = s.toLowerCase();
      if (a > 0 && camelCase) s = s.substring(0, 1).toUpperCase() + s.substring(1);
      return s;
    })
    .join("");

  if (!allowUnderScore) str = str.replaceAll("_", "");

  // Remove number prefix
  if (!allowInitialNumbers) str = str.replace(/^\d+/, "");

  return str;
}

/**
 * Turn some fractional numbers into pretty strings.
 *
 * @remarks
 * - Only supports the following fractions: 1/4, 1/3, 1/2, 2/3, 3/4
 *
 * @param {number} n - Number to transform
 * @returns {string} - Representation of the fraction
 */
export const fractionalToString = (n) => {
  const base = Math.floor(n);
  const f = pf1.utils.limitPrecision(n - base, 3, "round");
  if (f === 0) return `${base}`;
  const rv = [];
  if (base !== 0) rv.push(base);
  if (f === 0.25) rv.push("1/4");
  else if (f === 0.333) rv.push("1/3");
  else if (f === 0.5) rv.push("1/2");
  else if (f === 0.667) rv.push("2/3");
  else if (f === 0.75) rv.push("3/4");
  return rv.join(" ");
};

/**
 * Challenge Rating helper functions.
 */
export class CR {
  /**
   * Parse CR string to produce a numeric representation
   *
   * Parses 1/8, 1/6, 1/4, 1/3, and 1/2 as exact decimals. Everything else is treated as regular number string and passed through parseFloat().
   *
   * @param {string} value - String to transform
   * @returns {number} - Transformed number
   */
  static fromString(value) {
    if (value === "1/8") return 0.125;
    if (value === "1/6") return 0.1625;
    if (value === "1/4") return 0.25;
    if (value === "1/3") return 0.3375;
    if (value === "1/2") return 0.5;
    return parseFloat(value);
  }

  /**
   * Convert number to string representation.
   *
   * @param {number} value - Number to transform
   * @returns {string} - String representation
   */
  static fromNumber(value = 0) {
    if (value === 0.125) return "1/8";
    if (value === 0.1625) return "1/6";
    if (value === 0.25) return "1/4";
    if (value === 0.3375) return "1/3";
    if (value === 0.5) return "1/2";
    if (!Number.isNumeric(value)) return "0";
    return value?.toString() ?? "";
  }

  /**
   * Return the amount of experience granted by killing a creature of a certain CR.
   *
   * @param {number} cr - The creature's challenge rating
   * @returns {number|null} - The amount of experience granted per kill. Or null if the CR was invalid.
   */
  static getXP(cr) {
    if (cr < 1.0) return Math.floor(Math.max(400 * cr, 0));
    return pf1.config.CR_EXP_LEVELS[cr] || null;
  }
}

/**
 * Converts feet to what the world is using as a measurement unit.
 *
 * @example
 * With metric enabled
 * ```js
 * pf1.utils.convertDistance(30); // => [9, "m"]
 * ```
 *
 * @param {number} value - The value (in feet) to convert.
 * @param {"ft"|"mi"} type - The original type to convert from. Either 'ft' (feet, default) or 'mi' (miles, in which case the result is in km (metric))
 * @returns {[range:number, unit:string]} An array containing the converted value in index 0 and the new unit key in index 1 (for use in {@link pf1.config.measureUnits}, for example)
 */
export const convertDistance = (value, type = "ft") => {
  const system = getDistanceSystem();
  switch (system) {
    case "metric":
      switch (type) {
        case "mi":
          return [Math.round(value * 1.6 * 100) / 100, "km"];
        default:
          return [Math.round((value / 5) * 1.5 * 100) / 100, "m"];
      }
    default:
      if (!["ft", "mi"].includes(type)) type = "ft";
      return [value, type];
  }
};

/**
 * Simplify range value to something more humanly readable but not necessarily precise
 *
 * @param {number} range
 * @param {string} type
 * @returns {[range:number, unit:string]} - Tuple of new range and unit
 */
export function simplifyRange(range, type = "ft") {
  switch (type) {
    case "km":
      if (range < 0.8) return [Math.floor(range * 1_000), "m"];
      break;
    case "m":
      if (range > 0) {
        if (range % 1_000 === 0) return [Math.floor(range / 1000), "km"];
        if (range > 800) return [limitPrecision(range / 1000, 2), "km"];
      }
      break;
    case "mi":
      if (range < 0.3) return [Math.floor(range * 5_280), "ft"];
      break;
    case "ft":
      if (range > 2_000) {
        if (range % 5_280 === 0) {
          return [Math.floor(range / 5_280), "mi"];
        }
        return [limitPrecision(range / 5_280, 2), "mi"];
      }
      break;
  }

  return [range, type];
}

/**
 * Converts what the world is using as a measurement unit to feet.
 *
 * @param {number} value - The value (in the world's measurement unit) to convert back.
 * @param {string} type - The target type to convert back to. Either 'ft' (feet, default) or 'mi' (miles, in which case the expected given value should be in km (metric))
 * @returns {number} The resulting value.
 */
export const convertDistanceBack = (value, type = "ft") => {
  const system = getDistanceSystem();
  switch (system) {
    case "metric":
      switch (type) {
        case "mi":
          return [Math.round((value / 1.6) * 100) / 100, "mi"];
        default:
          return [Math.round(((value * 5) / 1.5) * 100) / 100, "ft"];
      }
    default:
      return [value, type];
  }
};

/**
 * Convert feet or meters distance to the opposite regardless of what configuration is used.
 *
 * @example
 * ```js
 * pf1.utils.swapDistance(30, "ft"); // => 9
 * pf1.utils.swapDistance(9, "m"); // => 30
 * ```
 * @param {number} value - Feet or meters
 * @param {"ft"|"m"} type - Type the value is in
 * @throws {Error} - On invalid parameters.
 * @returns {number} - Feet or meters, opposite of what set type was
 */
export function swapDistance(value, type) {
  if (!Number.isFinite(value)) throw new Error("value parameter must be a number");
  switch (type) {
    case "ft":
      return Math.round(((value * 100) / 5) * 1.5) / 100; // to meters
    case "m":
      return Math.round(((value * 100) / 1.5) * 5) / 100; // to feet
    default:
      throw new Error("type parameter must be defined");
  }
}

/**
 * Convert pounds or kilograms weight to the opposite regardless of what configuration is used.
 *
 * @example
 * ```js
 * pf1.utils.swapWeight(5, "kg"); // => 10
 * pf1.utils.swapWeight(10, "lbs"); // => 5
 * ```
 * @param {number} value - Pounds or kilos
 * @param {"kg"|"lbs"} type - Type the value is in
 * @throws {Error} - On invalid parameters.
 * @returns {number} - Pounds or kilos, opposite of what set type was
 */
export function swapWeight(value, type) {
  if (!Number.isFinite(value)) throw new Error("value parameter must be a number");
  switch (type) {
    case "kg":
      return value * 2; // to lbs
    case "lbs":
      return value / 2; // to kg
    default:
      throw new Error("type parameter must be defined");
  }
}

/**
 * Calculate overland speed per hour
 *
 * @see {@link https://www.aonprd.com/Rules.aspx?Name=Movement&Category=Exploration Exploration Movement rules}
 *
 * @example
 * With metric metric enabled
 * ```js
 * overlandSpeed(9); // => {speed:6, unit:'km'}
 * ```
 * With imperial
 * ```js
 * overlandSpeed(40); // => {speed:4, unit:'mi'}
 * ```
 *
 * @param {number} speed - Tactical speed
 * @returns {{speed:number,unit:string}} - Object with overland speed and unit.
 */
export function overlandSpeed(speed) {
  const system = getDistanceSystem();
  const variant = system === "metric" ? game.settings.get("pf1", "overlandMetricVariant") : "default";
  const { per, out, unit } = pf1.config.overlandSpeed[system][variant];

  return { speed: (speed / per) * out, unit };
}

/**
 * @returns {UnitSystem} Effective system of units
 */
export const getDistanceSystem = () => {
  let system = game.settings.get("pf1", "distanceUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  return system;
};

/**
 * @returns {UnitSystem} Effective system of units
 */
export const getWeightSystem = () => {
  let system = game.settings.get("pf1", "weightUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  return system;
};

/**
 * @typedef Point
 * @property {number} x X coordinate
 * @param {number} y Y coordinate
 */

/**
 * @typedef MeasureState
 * @param {number} diagonals Number of diagonals passed so far.
 * @param {number} cells Total cells in distance
 */

/**
 * Measure distance between two points.
 *
 * @deprecated
 * @example
 * ```js
 * pf1.utils.measureDistance(token, game.user.targets.first());
 * ```
 * @param {Point} p0 - Start point on canvas
 * @param {Point} p1 - End point on canvas
 * @param {object} [options] - Measuring options.
 * @param {"5105"|"555"} [options.diagonalRule="5105"] - Used diagonal rule. Defaults to 5/10/5 PF measuring.
 * @param {Ray} [options.ray=null] - Pre-generated ray to use instead of the points.
 * @param {MeasureState} [options.state] - Optional state tracking across multiple measures.
 * @returns {number} - Grid distance between the two points.
 */
export const measureDistance = (
  p0,
  p1,
  { ray = null, diagonalRule = "5105", state = { diagonals: 0, cells: 0 } } = {}
) => {
  foundry.utils.logCompatibilityWarning(
    "pf1.utils.measureDistance() is deprecated in favor of canvas.grid.measurePath()",
    {
      since: "PF1 v11",
      until: "PF1 v12",
    }
  );

  // TODO: Optionally adjust start and end point to closest grid
  ray ??= new Ray(p0, p1);
  const gs = canvas.dimensions.size,
    nx = Math.ceil(Math.abs(ray.dx / gs)),
    ny = Math.ceil(Math.abs(ray.dy / gs));

  // Get the number of straight and diagonal moves
  const nDiagonal = Math.min(nx, ny),
    nStraight = Math.abs(ny - nx);

  state.diagonals += nDiagonal;

  let cells = 0;
  // Standard Pathfinder diagonals: double distance for every odd.
  if (diagonalRule === "5105") {
    const nd10 = Math.floor(state.diagonals / 2) - Math.floor((state.diagonals - nDiagonal) / 2);
    cells = nd10 * 2 + (nDiagonal - nd10) + nStraight;
  }
  // Equal distance diagonals
  else cells = nStraight + nDiagonal;

  state.cells += cells;
  return cells * canvas.dimensions.distance;
};

/**
 * Converts lbs to what the world is using as a measurement unit.
 *
 * @param {number} value - The value (in lbs) to convert.
 * @returns {number} The converted value. In the case of the metric system, converts to kg.
 */
export const convertWeight = (value) => {
  const system = getWeightSystem();
  switch (system) {
    case "metric":
      // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
      return value / 2;
    default:
      return value;
  }
};

/**
 * Converts back to lbs from what the world is using as a measurement unit.
 *
 * @example
 * With metric enabled
 * ```js
 * pf1.utils.convertWeightBack(10); // => 20
 * ```
 * With default imperial
 * ```js
 * pf1.utils.convertWeightBack(10); // => 10
 * ```
 *
 * @param {number} value - The value to convert back to lbs.
 * @returns {number} The converted value. In the case of the metric system, converts from kg.
 */
export const convertWeightBack = (value) => {
  const system = getWeightSystem();
  switch (system) {
    case "metric":
      return value * 2; // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
    default:
      return value;
  }
};

/**
 * Sort an array in-place using a language-aware comparison function that can sort by a property key.
 * If no property key is provided, the array is sorted directly.
 *
 * @template T
 * @param {T[]} arr The array to sort
 * @param {string} [propertyKey=""] The property key to sort by, if any; can be a dot-separated path
 * @param {object} [sortOptions] - Options affecting the sorting of elements
 * @param {boolean} sortOptions.numeric - Whether numeric collation should be used, such that "1" < "2" < "10".
 * @param {boolean} sortOptions.ignorePunctuation - Whether punctuation should be ignored.
 * @returns {T[]} The sorted array
 */
export const naturalSort = (arr, propertyKey = "", { numeric = true, ignorePunctuation = false } = {}) => {
  const collator = new Intl.Collator(game.settings.get("core", "language"), { numeric, ignorePunctuation });
  return arr.sort((a, b) => {
    const propA = propertyKey ? (propertyKey in a ? a[propertyKey] : foundry.utils.getProperty(a, propertyKey)) : a;
    const propB = propertyKey ? (propertyKey in b ? b[propertyKey] : foundry.utils.getProperty(b, propertyKey)) : b;
    return collator.compare(propA, propB);
  });
};

/**
 * Opens journal or journal page.
 *
 * Pages are opened in collapsed state.
 *
 * @param {string} uuid - UUID to journal or journal page
 * @param {object} [options={}] - Additional rendering options
 * @returns {JournalEntry|JournalEntryPage|null} - Opened document
 */
export async function openJournal(uuid, options = {}) {
  const journal = await fromUuid(uuid);

  if (journal instanceof JournalEntryPage) {
    journal.parent.sheet.render(true, {
      pageId: journal.id,
      editable: false,
      collapsed: true,
      width: 600,
      height: 700,
      ...options,
    });
  } else {
    journal.sheet.render(true, { editable: false, ...options });
  }

  return journal;
}

/**
 * A simple binary search to be used on sorted arrays
 *
 * @internal
 * @template T
 * @param {T[]} searchArr - Sorted Array to be searched
 * @param {T} el - Element to be compared to array values
 * @param {function(T, T): number} compare_fn - Comparison function to be apply el to every element in ar. Should return an positive/ negative integer or 0 if matching.
 * @returns {number} Index where search is found or negative index indicating where it would be inserted
 */
export const binarySearch = (searchArr, el, compare_fn) => {
  let m = 0,
    n = searchArr.length - 1;
  while (m <= n) {
    const k = (n + m) >> 1,
      cmp = compare_fn(el, searchArr[k]);
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return k;
    }
  }
  return -m - 1;
};

/**
 * Generate permutations of an array. Complexity is O(n!).
 * Should be safe up to 7, though you should probably consider something else if you're reaching that high often.
 *
 * @internal
 * @template T
 * @param {T[]} perm - The Array to be generated upon
 * @returns {Array.<T[]>|false} An Array containing all Array permutations or false if failed.
 */
function uniquePermutations(perm) {
  perm = perm.map((p) => p.trim()).filter((p) => p?.length > 0);

  if (perm.length > 7) {
    console.warn("Array too large. Not attempting.", perm);
    return false;
  }

  const total = new Set();

  for (let i = 0; i < perm.length; i = i + 1) {
    const rest = uniquePermutations(perm.slice(0, i).concat(perm.slice(i + 1)));

    if (!rest.length) {
      total.add([perm[i]]);
    } else {
      for (let j = 0; j < rest.length; j = j + 1) {
        total.add([perm[i]].concat(rest[j]));
      }
    }
  }
  return [...total];
}

/**
 * Searches through compendia quickly using the system generated index caches.
 * Exact matches excluding punctuation and case are prioritized before searching word order permutations.
 *
 * @param {string} searchTerm - The name of the Document being searched for
 * @param {object} [options] - Provides a filter to limit search to specific packs or Document types
 * @param {string[]} [options.packs] - An array of packs to search in
 * @param {"Actor"|"Item"|"Scene"|"JournalEntry"|"Macro"|"RollTable"|"Playlist"} [options.type] - A Document type to limit which packs are searched in
 * @param {string} [options.docType] - Document type, such as "loot" or "npc"
 * @param {boolean} [options.disabled=false] - Include packs disabled for compendium browser.
 * @returns {{pack: CompendiumCollection, index: object}|false} The index and pack containing it or undefined if no match is found
 */
export const findInCompendia = (searchTerm, { packs = [], type, docType, disabled = false } = {}) => {
  if (packs?.length) packs = packs.flatMap((o) => game.packs.get(o) ?? []);
  else packs = game.packs.filter((o) => !type || o.metadata.type == type);
  if (!disabled) packs = packs.filter((o) => o.config?.pf1?.disabled !== true);

  searchTerm = searchTerm.toLocaleLowerCase();

  for (const pack of packs) {
    if (!pack.fuzzyIndex) pack.fuzzyIndex = pf1.utils.internal.sortArrayByName([...pack.index]);
    let filteredIndex = pack.fuzzyIndex;
    if (docType) filteredIndex = filteredIndex.filter((e) => e.type === docType);

    const found = binarySearch(filteredIndex, searchTerm, (sp, it) =>
      sp.localeCompare(it.name, undefined, { ignorePunctuation: true })
    );
    if (found > -1) {
      const entry = pack.index.get(filteredIndex[found]._id);
      return { pack, index: entry };
    }
  }

  let searchMutations = uniquePermutations(searchTerm.split(/[, _-]/));
  if (searchMutations) searchMutations = searchMutations.map((o) => o.join(" "));
  else {
    // If array is too long, search for just a reversed version and one that pivots around commas/ semicolons
    searchMutations = [null];
    searchMutations.push(searchTerm.split(/[ _-]/).reverse().join(" "));
    searchMutations.push(
      searchTerm
        .split(/[,;] ?/)
        .reverse()
        .flatMap((o) => o.split(" "))
        .join(" ")
    );
  }

  for (const pack of packs) {
    let filteredIndex = pack.fuzzyIndex;
    if (docType) filteredIndex = filteredIndex.filter((e) => e.type === docType);

    // Skip first mutation since it is already searched for manually before computing mutations
    for (let mut = 1; mut < searchMutations.length; mut++) {
      const found = binarySearch(filteredIndex, searchMutations[mut], (sp, it) =>
        sp.localeCompare(it.name, undefined, { ignorePunctuation: true })
      );
      if (found > -1) {
        const entry = pack.index.get(filteredIndex[found]._id);
        if (entry) return { pack, index: entry };
      }
    }
  }

  return false;
};

/**
 * enrichHTML but with inline rolls not rolled
 *
 * Exists because core devs refused to have it in Foundry itself: https://github.com/foundryvtt/foundryvtt/issues/10557
 *
 * {@inheritDoc TextEditor.enrichHTML}
 *
 * @experimental - This may be removed without warning.
 * @param {string} content HTML content in string format to be enriched.
 * @param {options} [options] Additional options passed to enrichHTML
 * @param {object} [options.rollData] Roll data object
 * @param {boolean} [options.secrets] Display secrets
 * @param {boolean} [options.rolls=false] Roll inline rolls. If false, the roll formula is shown instead as if /r had been used.
 * @param {boolean} [options.documents] Parse content links
 * @returns {string} - Enriched HTML string
 * Synchronized with Foundry VTT v12.331 & v13.339
 */
export async function enrichHTMLUnrolled(
  content,
  { secrets, documents, links, embeds, rolls = false, rollData, relativeTo } = {}
) {
  let pcontent = await TextEditor.enrichHTML(content, {
    secrets,
    documents,
    links,
    embeds,
    rolls,
    rollData,
    relativeTo,
  });

  if (rolls !== true) {
    const html = document.createElement("div");
    html.innerHTML = pcontent;
    const text = TextEditor_getTextNodes(html);

    rollData = rollData instanceof Function ? rollData() : rollData || {};
    const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)(]{2,3})(?:{([^}]+)})?/gi;
    await TextEditor_replaceTextContent(text, rgx, (match) => pf1.utils.internal.createInlineFormula(match, rollData));

    pcontent = html.innerHTML;
  }

  return pcontent;
}

/**
 * Re-implementation of TextEditor##getTextNodes() since v13 made it fully private.
 *
 * Needed by {@link enrichHTMLUnrolled}
 *
 * @param {HTMLElement} parent
 * Synced with v13.339
 */
function TextEditor_getTextNodes(parent) {
  const text = [];
  const walk = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) text.push(walk.currentNode);
  return text;
}

/**
 * Re-implementation of TextEditor##replaceTextContent() since v13 made it fully private.
 *
 * Needed by {@link enrichHTMLUnrolled}
 *
 * @param text
 * @param rgx
 * @param func
 * @param options
 * Synced with v13.339
 */
async function TextEditor_replaceTextContent(text, rgx, func, options = {}) {
  let replaced = false;
  for (const t of text) {
    const matches = t.textContent.matchAll(rgx);
    for (const match of Array.from(matches).reverse()) {
      let result;
      try {
        result = await func(match);
      } catch (err) {
        Hooks.onError("TextEditor.enrichHTML", err, { log: "error" });
      }
      if (result) {
        TextEditor_replaceTextNode(t, match, result, options);
        replaced = true;
      }
    }
  }
  return replaced;
}

/**
 * Re-implementation of TextEditor##replaceTextNode() since v13 made it fully private.
 *
 * Needed by {@link TextEditor_replaceTextContent}
 *
 * @param text
 * @param match
 * @param replacement
 * @param options
 * @param options.replaceParent
 * Synced with v13.339
 */
function TextEditor_replaceTextNode(text, match, replacement, { replaceParent = false } = {}) {
  let target = text;
  if (match.index > 0) target = text.splitText(match.index);
  if (match[0].length < target.length) target.splitText(match[0].length);
  const parent = target.parentElement;
  if (parent.parentElement && parent.childNodes.length < 2 && replaceParent) parent.replaceWith(replacement);
  else target.replaceWith(replacement);
}

/**
 * Resolve range formula to numeric value.
 *
 * @param {string} [formula] Range formula. Only used with "mi", "ft", "m", "km" and similar types.
 * @param {"natural"|"melee"|"touch"|"reach"|"close"|"medium"|"long"|"mi"} [type="ft"] Formula type
 * @param {object} [rollData] Roll data for evaluating the formula
 * @returns {number} Range in feet for the defined formula
 */
export const calculateRangeFormula = (formula, type = "ft", rollData = {}) => {
  switch (type) {
    case "natural":
      return rollData.traits?.reach?.natural?.melee ?? 0;
    case "melee":
    case "touch":
      return rollData.range?.melee ?? 0;
    case "reach":
      return rollData.range?.reach ?? 0;
    case "close":
      return RollPF.safeRollSync(pf1.config.spellRangeFormulas.close, rollData).total;
    case "medium":
      return RollPF.safeRollSync(pf1.config.spellRangeFormulas.medium, rollData).total;
    case "long":
      return RollPF.safeRollSync(pf1.config.spellRangeFormulas.long, rollData).total;
    case "mi":
      return RollPF.safeRollSync(formula, rollData).total * 5_280;
    case "m":
      return (RollPF.safeRollSync(formula, rollData).total / 1.5) * 5;
    case "km":
      return ((RollPF.safeRollSync(formula, rollData).total * 1_000) / 1.5) * 5;
    default:
      return RollPF.safeRollSync(formula, rollData).total;
  }
};

/**
 * Calculates range formula and converts it.
 *
 * Wrapper around {@link calculateRangeFormula} and {@link convertDistance}
 *
 * @example
 * Simple example
 * ```js
 * const [range,unit] = calculateRange("@level", "mi", { level:2 });
 * // => range:10560, unit:"ft"
 * ```
 *
 * @param {string} formula - Range formula
 * @param {string} type - Type fed to calculateRangeFormula
 * @param {object} rollData - Roll data fed to calculateRangeFormula
 * @returns {[range:number, unit:string]} - Range value and unit tuple
 */
export function calculateRange(formula, type = "ft", rollData = {}) {
  const value = calculateRangeFormula(formula, type, rollData);
  return convertDistance(value, "ft");
}

/**
 * Refreshes all actor data and re-renders sheets.
 *
 * @internal
 * @param {object} [options] - Additional options
 * @param {boolean} [options.renderOnly=false] - If false, actors are reset also.
 * @param {boolean} [options.renderForEveryone=false] - Deprecated. If true, other players are told to re-render, too.
 */
export function refreshActors({ renderOnly = false, renderForEveryone = false } = {}) {
  // Reset base actors
  if (!renderOnly) {
    game.actors.forEach((a) => a.reset());

    // Reset unlinked actors in all scenes
    game.scenes.forEach((scene) =>
      scene.tokens
        .filter((t) => t.actor && !t.isLinked)
        .map((t) => t.actor)
        .forEach((a) => a.reset())
    );
  }

  // Render system sheets. Doesn't matter if this renders more than necessary
  pf1.utils.renderApplications({ systemOnly: true });

  if (renderForEveryone) {
    foundry.utils.logCompatibilityWarning(
      "pf1.utils.refreshActors() renderForEveryone option is deprecated with no replacement.",
      {
        since: "PF1 v11",
        until: "PF1 v12",
      }
    );

    game.socket.emit("pf1", "refreshActorSheets");
  }
}

/**
 * Re-render all open applications. Optionally limiting to just the the system apps.
 *
 * @param {object} [options] - Additional options
 * @param {boolean} [options.systemOnly=false] - Render only system apps.
 * @param {boolean} [options.force] - Force render
 */
export async function renderApplications({ systemOnly = false, force } = {}) {
  const applications = [];
  for (const app of Object.values(ui.windows)) {
    if (systemOnly && !app.options.classes.includes("pf1")) continue;
    applications.push(app);
  }
  for (const app of foundry.applications.instances.values()) {
    if (systemOnly && !app.options.classes.includes("pf1-v2")) continue;
    applications.push(app);
  }

  applications.sort((a, b) => a.position.zIndex - b.position.zIndex);

  for (const app of applications) {
    if (app.minimized) continue;
    app.render(force, { zIndex: app.position.zIndex });
  }

  console.debug("PF1 |", applications.length, "application(s) re-rendered");
}

/**
 * Refresh all actor, item and action sheets.
 *
 * @internal
 * @param {object} [options] Additional options
 * @param {boolean} [options.reset=true] Reset underlying document.
 * @param {boolean} [options.actor] Include actor sheets
 * @param {boolean} [options.item] Include item sheets
 * @param {boolean} [options.action] Include action sheets
 */
export function refreshSheets({ reset = true, actor = true, item = true, action = true } = {}) {
  Object.values(ui.windows).forEach((app) => {
    if (
      (actor && app instanceof ActorSheet) ||
      (item && app instanceof ItemSheet) ||
      (action && app instanceof pf1.applications.component.ItemActionSheet)
    ) {
      if (reset && app.object instanceof Document) app.object.reset();
      app.render();
    }
  });
}

/**
 * Deeply difference an object against some other, returning the update keys and values.
 * Unlike foundry.utils.diffObject, this function also deeply compares arrays.
 *
 * @internal
 * @deprecated - Will be removed with PF1 v12
 * @param {object} original       An object comparing data against which to compare
 * @param {object} other          An object containing potentially different data
 * @param {object} [options={}]   Additional options which configure the diff operation
 * @param {boolean} [options.inner=false]  Only recognize differences in other for keys which also exist in original
 * @param {boolean} [options.keepLength=false]  Keep array length intact, possibly having to insert empty objects
 * @returns {object}               An object of the data in other which differs from that in original
 */
export const diffObjectAndArray = (original, other, { inner = false, keepLength = false } = {}) => {
  foundry.utils.logCompatibilityWarning("pf1.utils.diffObjectAndArray() is deprecated with no replacement.", {
    since: "PF1 v11",
    until: "PF1 v12",
  });

  function _difference(v0, v1) {
    const t0 = foundry.utils.getType(v0);
    const t1 = foundry.utils.getType(v1);
    if (t0 !== t1) return [true, v1];
    if (t0 === "Array") {
      if (v0.length !== v1.length) return [true, v1];
      const d = [];
      for (let a = 0; a < v0.length; a++) {
        const d2 = diffObjectAndArray(v0[a], v1[a], { inner, keepLength });
        if (!foundry.utils.isEmpty(d2)) d.push(d2);
        else if (keepLength) d.push({});
      }
      if (d.length > 0) return [true, d];
      return [false, d];
    }
    if (t0 === "Object") {
      if (foundry.utils.isEmpty(v0) !== foundry.utils.isEmpty(v1)) return [true, v1];
      const d = diffObjectAndArray(v0, v1, { inner, keepLength });
      return [!foundry.utils.isEmpty(d), d];
    }
    return [v0 !== v1, v1];
  }

  // Recursively call the _difference function
  return Object.keys(other).reduce((obj, key) => {
    if (inner && !(key in original)) return obj;
    const [isDifferent, difference] = _difference(original[key], other[key]);
    if (isDifferent) obj[key] = difference;
    return obj;
  }, {});
};

/**
 * Determines what ability modifier is appropriate for a given score.
 *
 * @example
 * ```js
 * pf1.utils.getAbilityModifier(15); // => 2
 * pf1.utils.getAbilityModifier(6, { damage: 1 }); // => -2
 * ```
 *
 * @param {number} [score] - The score to find the modifier for.
 * @param {object} [options={}] - Options for this function.
 * @param {number} [options.penalty=0] - A penalty value to take into account.
 * @param {number} [options.damage=0] - Ability score damage to take into account.
 * @returns {number} The modifier for the given score.
 */
export function getAbilityModifier(score = null, options = {}) {
  if (score != null) {
    const penalty = Math.abs(options.penalty ?? 0);
    const damage = Math.abs(options.damage ?? 0);
    return Math.max(-5, Math.floor((score - 10) / 2) - Math.floor(penalty / 2) - Math.floor(damage / 2));
  }
  return 0;
}

/**
 * Create throttling function.
 *
 * Returned function will execute after defined delay. Multiple calls will be discarded until the callback is executed and new timeout can start.
 *
 * @param {Function} callback - Callback function
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
export function throttle(callback, delay) {
  let timeoutId = -1;
  return () => {
    if (timeoutId <= 0) {
      timeoutId = setTimeout(() => {
        timeoutId = -1;
        callback();
      }, delay);
    }
    return timeoutId;
  };
}

/**
 * Create limiting function
 *
 * The function is called immediately, unless it was recently called in which case the call is discarded until defined amount of time has passed.
 *
 * @param {Function} callback - Function to call
 * @param {number} ms - Milliseconds that must pass before the wrapped function can be called again.
 * @returns {Function} - Limited function
 */
export function limit(callback, ms = 100) {
  let lastCall = 0;
  return (...args) => {
    const t0 = performance.now();
    if (t0 - lastCall < ms) return;
    lastCall = t0;
    callback(...args);
  };
}

/**
 * Get iterator for all actors.
 *
 * @param {object} [options] - Options for which actors to fetch.
 * @param {Array<string>|null} [options.types=null] - Array of actor types to accept. Returns all if null.
 * @param {boolean} [options.base=true] - Return base actors (from game.actors).
 * @param {string|Scene|null} [options.scene=null] - Specific scene. Sets `scenes` and `base` to false.
 * @param {boolean} [options.scenes=false] - All scenes.
 * @param {boolean} [options.linked=true] - Get linked actors from scenes.
 * @param {boolean} [options.unlinked=true] - Get unlinked actors from scenes.
 * @param {Array<string|User>} [options.users=[game.user]] - Test specific users permission, either User instances or user IDs. Defaults to current user.
 * @param {*} [options.ownership=CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER] - What permission level (`CONST.DOCUMENT_OWNERSHIP_LEVELS`) to test user for, if user is defined.
 *
 * @yields {Actor} - Relevant actors
 */
export function* getActors({
  base = true,
  types = null,
  scene = null,
  scenes = false,
  linked = true,
  unlinked = true,
  users = [game.user],
  ownership = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
} = {}) {
  users = users.map((user) => (user instanceof User ? user : game.users.get(user)));

  const testUsers = (actor) => (users.length ? users.some((user) => actor.testUserPermission(user, ownership)) : true);

  if (base) {
    for (const actor of [...game.actors]) {
      if (types && !types.includes(actor.type)) continue;
      if (!testUsers(actor)) continue;
      yield actor;
    }
  }

  let sceneList;
  if (scene) {
    if (scene instanceof Scene) sceneList = [scene];
    else sceneList = [game.scenes.get(scene)];
  } else if (scenes) {
    sceneList = [...game.scenes];
  }

  for (const scene of sceneList) {
    for (const token of [...scene.tokens]) {
      const actor = token.actor;
      if (!actor) continue;

      if (types && !types.includes(actor.type)) continue;

      // Test at least one user has appropriate ownership
      if (!testUsers(actor)) continue;

      const isLinked = token.isLinked;
      // Yield linked only if such are desired and we didn't already return base actors
      if (isLinked && linked && !base) yield actor;
      // Yield unlinked only if desired
      else if (!isLinked && unlinked) yield actor;
    }
  }
}

/**
 * Parse alignment string and provide breakdown of it.
 *
 * Each alignment is either 0 or 1, except for neutral which can reach 2 for true neutral.
 *
 * @param {string} align - Alignment string.
 * @returns {{lawful:number, evil:number, chaotic:number, good:number, neutral:number}}
 * @since PF1 v10
 */
export function parseAlignment(align) {
  const lawful = align.includes("l") ? 1 : 0;
  const evil = align.includes("e") ? 1 : 0;
  const chaotic = align.includes("c") ? 1 : 0;
  const good = align.includes("g") ? 1 : 0;
  const neutral = align == "tn" ? 2 : align.includes("n") ? 1 : 0;
  return { lawful, evil, chaotic, good, neutral };
}

/**
 * Limit precision.
 *
 * Reduces number of decimals but does not insist on those decimals to be there.
 *
 * @beta
 * @param {number} number - Number to adjust
 * @param {number} [decimals] - Maximum number of decimals
 * @param {"floor"|"ceil"|"round"} [method] - Rounding method.
 * @returns {number} - Adjusted number
 */
export function limitPrecision(number, decimals = 2, method = "floor") {
  const mult = Math.pow(10, decimals);
  return Math[method](number * mult) / mult;
}

/**
 * Tests if two items are in same sub-group.
 *
 * This does not test main grouping (that is, item type itself).
 *
 * @param {ItemPF} item0 - First item to test
 * @param {ItemPF} item1 - Second item to test
 * @returns {boolean} - Equivalency
 */
export function isItemSameSubGroup(item0, item1) {
  if (item0.type === "spell") {
    // Spells sort by spell level instead of subtype
    return item0.system.spellbook === item1.system.spellbook && item0.system.level === item1.system.level;
  }

  if (item0.subType) return item0.subType === item1.subType;

  // Assume everything else is only categorized by main type
  return true;
}

/**
 * Clone value.
 *
 * Similar to `foundry.utils.deepClone()` but does not return references for DataModel instances.
 *
 * @remarks
 * - Documents are returned as references (unless source option is enabled)
 * - PIXI graphics are returned as references
 * - DataModels are extracted like objects with `parent` excluded
 * - Unsupported objects call .toObject() when present, otherwise as references
 *
 * @param {object} original - Original data
 * @param {object} [options] - Additional options
 * @param {boolean} [options.strict=false] - Throw an error if a reference would be returned.
 * @param {boolean} [options.source=false] - Return source data instead for supporting data.
 * @throws {Error} - With strict mode if reference would be returned.
 * @returns {object} - Cloned object
 */
export function deepClone(original, { strict = false, source = false } = {}) {
  return _deepClone(original, strict, source);
}

/**
 * Faster deepClone() without destructuring.
 *
 * @internal
 * @param {*} original - Original data
 * @param {boolean} strict - Strict mode
 * @param {boolean} source - Clone source data
 * @param {number} _depth - Recursion depth
 * @returns {*} - Cloned data
 */
function _deepClone(original, strict = false, source = false, _depth = 0) {
  if (_depth > 100) {
    throw new Error("Maximum depth exceeded. Be sure your object does not contain cyclical data structures.");
  }
  _depth++;

  // Simple types (null, undefined, number, string, bigint, function,...)
  if (typeof original !== "object" || original === null) return original;

  // Does not clone injected extra data
  if (Array.isArray(original)) return original.map((value) => _deepClone(value, strict, source, _depth));

  // Dates
  if (original instanceof Date) return new Date(original);

  // Return documents as is
  if (original instanceof foundry.abstract.Document) {
    if (source) return original.toObject();
    if (strict) throw new Error("Document instance encountered");
    return original;
  }

  if (original instanceof PIXI.DisplayObject) {
    if (strict) throw new Error("PIXI graphic encountered");
    return original;
  }

  // Unsupported advanced objects
  if (original instanceof foundry.abstract.DataModel) {
    if (source) return original.toObject();
    // Otherwise treat as regular object
  } else if (original.constructor && original.constructor !== Object) {
    if (typeof original.toObject === "function") return original.toObject();
    else if (typeof original.toJSON === "function") return original.toJSON();
    if (strict) throw new Error(`Unsupported advanced object: ${original.constructor.name}`);
    return original;
  }

  // DataModels and other plain objects
  const clone = {};
  for (const k of Object.keys(original)) {
    clone[k] = _deepClone(original[k], strict, source, _depth);
  }

  return clone;
}
