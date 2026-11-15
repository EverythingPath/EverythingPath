import { readFile } from 'node:fs/promises';
import { findWeaponImportRule } from './weapon-import-rules.ts';
import {
  launchResourceInputs,
  resourceOwners,
  resourceEdges,
} from './launch-resource-audit.ts';
import { join } from 'node:path';
import { parse as parseHtml, type DefaultTreeAdapterMap } from 'parse5';
import { launchAuthority as authority } from './launch-inventory-authority.ts';
import { pcgenPin, prdPin } from './inventory.ts';
import { isRulesJournalLink, uuidKey } from './records.ts';
import { readArray, readObject } from './values.ts';
import { createNoticeReadiness } from './admission.ts';
import { heldNoticeInForce } from './legal/notice-clearances.ts';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import registryData from '../../src/lib/catalog/data/section15-registry.json' with { type: 'json' };
import {
  launchManifestSchema,
  type LaunchBinding,
  type LaunchManifest,
  type LaunchRow,
} from './launch-inventory-schema.ts';
import { campaignMvpRoots, launchInventoryHash } from './launch-inventory.ts';
import { launchCoverage, launchOwner } from './launch-inventory-coverage.ts';
import {
  readLaunchSourceRecords,
  readLaunchLegalInventories,
  sourceHash,
  sourceBooks,
  sourceTags,
  sourceKind,
  sourceKey,
  sourceLinks,
  sourcePrerequisites,
  classAssociations,
  normalizeSourceName,
  sourceSpellClasses,
  type LaunchSourcePaths,
  type LaunchSourceRecord,
  type LaunchLegalCandidate,
} from './launch-inventory-sources.ts';
import {
  reviewedSchedule,
  scheduleRows,
  incrementEntries,
} from './pcgen/schedules.ts';
import { classTableRows, printedSourceColumns } from './prd-coverage.ts';
import { classSources, classScheduleOwner } from './launch-class-sources.ts';
import {
  raceAbilityTraitKey,
  findRaceAbilityTraitRule,
} from './racial-trait-rules.ts';
import { readPcgenTree } from './pcgen/lst.ts';
import { inventoryPcgen } from './pcgen/inventory.ts';
import { buildEffectiveView } from './pcgen/effective.ts';
import { archetypeSourceSha256 } from './pcgen/archetypes.ts';
import {
  parseIdentityLedger,
  locatorKeyOf,
} from './everythingpath-identities.ts';
import {
  companionAudit,
  companionCoverage,
  inventoryCompanions,
} from './launch-companion-audit.ts';
import { coreAudit, coreCoverage, inventoryCore } from './launch-core-audit.ts';
import {
  advancedAudit,
  advancedCoverage,
  inventoryAdvanced,
} from './launch-advanced-audit.ts';

type Context = {
  paths: LaunchSourcePaths;
  records: LaunchSourceRecord[];
  raw: Map<string, LaunchSourceRecord>;
  legal: Map<string, LaunchLegalCandidate>;
  rows: Map<string, LaunchRow>;
  edges: LaunchManifest['edges'];
  edgeIds: Set<string>;
  pools: LaunchManifest['pools'];
  research: LaunchManifest['research'];
  ownerInventories: LaunchManifest['ownerInventories'];
};
type HtmlNode = DefaultTreeAdapterMap['node'];
const exploitKey = 'everythingpath/wizard-exploiter-wizard';
const observation = (
  evidence: string[],
  state: 'held' | 'unreviewed' | 'verified' = 'unreviewed',
) => ({ state, evidence });
const baselineBooks = new Set(['PZO1110', 'PZO1115']);

function originalOwner(key: string) {
  const matches = authority.batches.filter(({ originalInventory }) =>
    originalInventory.includes(key),
  );
  if (matches.length !== 1)
    throw new Error(
      `${key}: expected exactly one original batch owner, found ${matches.length}.`,
    );
  const batch = matches[0];
  if (!batch) throw new Error(`Missing original owner ${key}.`);
  return launchOwner(batch.issue, batch.title, [
    `https://github.com/AndreasUnunger/EverythingPath/issues/${batch.issue}`,
    `sha256:${batch.bodySha256}`,
  ]);
}

function implementationOwner(source: LaunchSourceRecord) {
  const kind = sourceKind(source);
  const owner = originalOwner(sourceKey(source));
  if (kind === 'race' || kind === 'racialTrait')
    return launchOwner(
      740,
      'Racial Trait identity, contribution, authentic seed and fresh reassessment',
      [source.binding.locator, '#328/#740'],
    );
  if (kind === 'item')
    return launchOwner(
      761,
      'Base Item, ammunition, weapon ends and actual stored candidate support',
      ['scripts/catalog/details.ts', '#761'],
    );
  if (kind === 'itemAbility')
    return launchOwner(764, 'Item Ability importer/conditional mechanics', [
      'scripts/catalog/item-abilities.ts',
      '#764',
    ]);
  if (kind === 'companion' || kind === 'familiar')
    return launchOwner(
      763,
      'Source statistics retained through stored candidates',
      ['scripts/catalog/details.ts', '#763'],
    );
  if (kind === 'eidolonEvolution' || kind === 'eidolonForm')
    return launchOwner(
      733,
      'Original eidolon promised automation and #707 public proof',
      ['docs/character-sheet/companions.md', '#733'],
    );
  if (sourceKey(source) === 'pf1-content/kDx6ZGhbIteoi7lG')
    return launchOwner(
      769,
      'Single saved spell and visible benefit; manual metamagic only',
      ['#382/#769', 'scripts/catalog/legal/traits-382.json'],
    );
  return owner;
}

function mechanismsOf(source: LaunchSourceRecord): LaunchRow['mechanisms'] {
  const system = source.record.system;
  const evidence = ['row.sources'];
  const changes = readArray(system.changes).map(readObject);
  const mechanisms: LaunchRow['mechanisms'] = changes.map((change) => ({
    name: `Modifier ${String(change.target)} ${String(change.formula)}`,
    disposition: 'calculated',
    status: 'outstanding',
    contract: `Preserve source target ${String(change.target)}, formula ${String(change.formula)}, bonus type ${String(change.type)} and all source conditions without double contribution.`,
    evidence,
  }));
  for (const prerequisite of sourcePrerequisites(source))
    mechanisms.push({
      name: 'Source prerequisites',
      disposition: 'calculated',
      status: 'outstanding',
      contract: `Preserve all alternatives, minima, conditions and recorded-level/active checks in the complete source requirement: ${prerequisite}`,
      evidence: ['row.sources', '#739'],
    });
  const kind = sourceKind(source);
  if (sourceKey(source) === 'pf1-content/kDx6ZGhbIteoi7lG')
    return [
      {
        name: 'Chosen spell',
        disposition: 'recorded choice',
        status: 'outstanding',
        contract:
          'Save/display/edit/clear one spell; an unset choice is visibly incomplete. Keep through reload, shared edits and publication.',
        evidence: ['#769', 'scripts/catalog/legal/traits-382.json'],
      },
      {
        name: 'Metamagic adjustment',
        disposition: 'permitted prose',
        status: 'permitted',
        contract:
          'The owner-approved sole manual exception: apply the one-level metamagic adjustment by hand. Do not change base level, DCs or slots.',
        evidence: [
          '#769',
          'docs/catalog-import/campaign-mvp.md#magical-lineage',
        ],
      },
    ];
  if (kind === 'class')
    mechanisms.push({
      name: 'Level 1–20 progression',
      disposition: 'calculated',
      status: 'outstanding',
      contract:
        'HP/Hit Dice, BAB, saves, class skills/ranks, proficiencies, feature increments/conditional grants and casting allowances from every printed checkpoint.',
      evidence,
    });
  if (kind === 'spell')
    mechanisms.push({
      name: 'Class-list and granted-spell metadata',
      disposition: 'recorded choice',
      status: 'outstanding',
      contract:
        'Preserve every applicable class list level, known/book/familiar recording, governing body and granted-spell rules; spell effects are distinct entries.',
      evidence,
    });
  if (
    [
      'companion',
      'familiar',
      'eidolonForm',
      'eidolonEvolution',
      'companionFeature',
    ].includes(kind)
  )
    mechanisms.push({
      name: 'Companion progression and choices',
      disposition: 'calculated',
      status: 'outstanding',
      contract:
        'Preserve species/type/base form, owner-level progression, size/ability changes, attacks, allocations, evolutionary prerequisites and linked updates. Missing promised automation remains required.',
      evidence,
    });
  if (kind === 'item' || kind === 'itemAbility')
    mechanisms.push({
      name: 'Gear and Item Abilities',
      disposition: 'calculated',
      status: 'outstanding',
      contract:
        'Preserve Base Item/ammunition, proficiency, damage/ends, armor, enhancement, targets, Item Abilities, Situations and stacking where the source supplies them.',
      evidence,
    });
  if (
    classAssociations(source).length ||
    sourceTags(source).some((tag) =>
      /talent|exploit|discovery|hex|bloodline|domain|mercy|ki power|arcana|mystery|curse|school|style|evolution/i.test(
        tag,
      ),
    )
  )
    mechanisms.push({
      name: 'Feature/option grants and conditions',
      disposition: 'recorded choice',
      status: 'outstanding',
      contract:
        'Retain the complete feature option, source eligibility/prerequisites, conditional grants and saved choices; numeric contributions remain calculated work.',
      evidence,
    });
  if (mechanisms.length === 0)
    mechanisms.push({
      name: 'Source body mechanics',
      disposition: 'calculated',
      status: 'outstanding',
      contract:
        'The owning batch must prove every promised sheet mechanic in the full source body through the public saved-sheet boundary; absence of raw Modifiers is not a prose exception.',
      evidence,
    });
  return mechanisms;
}

const noticeHoldInForce = heldNoticeInForce();
/**
 * The hold IDs a content row takes from its legal record, and its notice
 * observation. A notice hold the committed clearances name (an ID in
 * `held-notices.json`) holds nothing, as in notice readiness (`admission.ts`),
 * whether the record lists it under `noticeHoldIds` or, as a few batches do,
 * under `holdIds`; the legal record keeps it as evidence. Every other hold
 * stays. The notice observation reads `noticeHoldIds` alone, as before.
 */
export function legalHolds(
  legal: Pick<LaunchLegalCandidate, 'holdIds' | 'noticeHoldIds'> | undefined,
  inForce: (id: string) => boolean = noticeHoldInForce,
) {
  const noticeHoldIds = (legal?.noticeHoldIds ?? []).filter(inForce);
  return {
    holdIds: [...(legal?.holdIds ?? []).filter(inForce), ...noticeHoldIds],
    noticeEvidence: noticeHoldIds.length
      ? ('held' as const)
      : ('unreviewed' as const),
  };
}

function includeSource(
  context: Context,
  source: LaunchSourceRecord,
  requirement: 'required' | 'optional' = 'required',
) {
  const governing = sourceKind(source) === 'governingBody';
  const key = governing ? `rule/${sourceKey(source)}` : sourceKey(source);
  if (governing) context.raw.set(key, source);
  const previous = context.rows.get(key);
  if (previous) {
    if (requirement === 'required') previous.requirement = 'required';
    return previous;
  }
  const legal = context.legal.get(key);
  const inventoryOwner = governing
    ? launchOwner(
        253,
        'Original unassigned governing-body inventory; no new playable kind is admitted',
        [source.binding.locator, 'scripts/catalog/inventory.ts'],
      )
    : originalOwner(key);
  const evidence = legal
    ? [
        legal.path,
        ...(legal.evidenceId ? [legal.evidenceId] : []),
        `Recorded disposition=${legal.disposition ?? 'not recorded'}; assessmentStatus=${legal.assessmentStatus ?? 'not recorded'}.`,
      ]
    : ['row.sources', 'No current owning-batch assessment recorded.'];
  const projected = legalHolds(legal);
  const holds = projected.holdIds.map((reason) => ({
    owner: inventoryOwner,
    reason,
  }));
  const row: LaunchRow = {
    key,
    catalogKey: governing ? null : key,
    kind: governing ? 'rule' : sourceKind(source),
    name: source.record.name,
    requirement,
    sources: [source.binding],
    inventoryOwner,
    implementationOwner: governing
      ? launchOwner(
          716,
          'Required governing source body/notice integration remains outstanding',
          [source.binding.locator, '#716'],
        )
      : implementationOwner(source),
    publicTestOwner: inventoryOwner,
    mechanisms: mechanismsOf(source),
    admission: observation(
      evidence,
      legal?.assessmentStatus === 'unresolved' || legal?.disposition === 'held'
        ? 'held'
        : 'unreviewed',
    ),
    structure: observation([
      'convex/lib/catalogCandidateDefinition.ts',
      'Imported detail kinds alone do not prove all referenced IDs, granted spell/casting tables or companion resource shapes survive the stored adapter.',
    ]),
    contentEvidence: observation(
      evidence,
      holds.length ? 'held' : 'unreviewed',
    ),
    noticeEvidence: observation(evidence, projected.noticeEvidence),
    holds,
    research: [],
  };
  if (governing)
    row.holds.push({
      owner: row.implementationOwner,
      reason:
        'This required governing body is in an unassigned source pack. Inventory preserves its exact pinned identity/body; source integration and actual adapter/notice proof remain required before reliance.',
    });
  context.rows.set(key, row);
  return row;
}

function addEdge(context: Context, edge: LaunchManifest['edges'][number]) {
  const id = launchInventoryHash(edge);
  if (context.edgeIds.has(id)) return;
  context.edgeIds.add(id);
  context.edges.push(edge);
}

function includePool({
  context,
  root,
  name,
  members,
  source,
  selector,
}: {
  context: Context;
  root: string;
  name: string;
  members: LaunchSourceRecord[];
  source: LaunchBinding;
  selector: string;
}) {
  const keys = members
    .map((member) => includeSource(context, member).key)
    .sort();
  context.pools.push({
    id: `${root}:${name}`,
    root,
    name,
    selector,
    purpose: 'retained inventory',
    sources: [source],
    members: keys,
    membersSha256: launchInventoryHash(keys),
    remainder: [],
    research: [],
  });
  for (const to of keys)
    addEdge(context, {
      from: root,
      to,
      kind: 'option',
      reason: `Complete ${name} inventory; alternatives must all remain available.`,
      condition:
        'Apply the option’s actual source eligibility and prerequisites to a Character.',
      evidence: [source.locator, selector],
    });
}

async function readPrdBinding(context: Context, path: string) {
  const html = await readFile(join(context.paths.prd, path), 'utf8');
  const binding: LaunchBinding = {
    repository: 'prd',
    pin: prdPin.contentSha256,
    locator: path,
    rawSha256: sourceHash(html),
    effectiveSha256: sourceHash(html),
  };
  return { html, binding };
}

async function inventoryClasses(context: Context) {
  const checkpoints: LaunchManifest['checkpoints'] = [];
  for (const root of campaignMvpRoots.filter(({ kind }) => kind === 'class')) {
    const source = context.raw.get(root.key);
    const config = classSources[root.name];
    if (!source || !config)
      throw new Error(`Missing class source ${root.name}.`);
    const { html, binding } = await readPrdBinding(context, config.path);
    const table = classTableRows(html, config.caption);
    const sourceColumns = printedSourceColumns({
      html,
      lines: table.map(({ line }) => line),
    });
    if (table.length !== 20)
      throw new Error(`${root.name}: ${table.length} printed levels.`);
    const schedule = reviewedSchedule(root.name);
    const scheduled = schedule ? scheduleRows(schedule) : [];
    const classRow = includeSource(context, source);
    classRow.sources.push(binding);
    if (schedule) {
      for (const increment of incrementEntries(schedule)) {
        if (
          increment.detail.kind !== 'classFeature' ||
          !increment.detail.parentFeature
        )
          throw new Error(`Missing increment parent ${increment.externalKey}.`);
        const owner = originalOwner(root.key);
        const parent = increment.detail.parentFeature;
        context.rows.set(increment.externalKey, {
          key: increment.externalKey,
          catalogKey: increment.externalKey,
          kind: 'classFeature',
          name: increment.name,
          requirement: 'required',
          sources: [
            {
              ...binding,
              effectiveSha256: sourceHash(JSON.stringify(increment)),
            },
          ],
          inventoryOwner: owner,
          implementationOwner: classScheduleOwner(root.name),
          publicTestOwner: owner,
          mechanisms: [
            {
              name: 'Reviewed schedule increment',
              disposition: 'calculated',
              status: 'reused',
              contract: `Preserve parent ${parent} and independently replaceable part ${increment.detail.part}; the parent computes the benefit once.`,
              evidence: [
                'scripts/catalog/pcgen/schedules.ts',
                'tests/catalog/pcgen-schedules.test.ts',
              ],
            },
          ],
          admission: observation([
            'Owning class/feature batch must admit the complete generated schedule.',
          ]),
          structure: observation(['convex/lib/catalogCandidateDefinition.ts']),
          contentEvidence: observation([
            'Reviewed schedule implementation is reuse evidence, not new admission.',
          ]),
          noticeEvidence: observation([
            'Owning class source chain remains required.',
          ]),
          holds: [],
          research: [],
        });
        addEdge(context, {
          from: root.key,
          to: increment.externalKey,
          kind: 'grant',
          reason: `${increment.name}; reviewed table increment ${increment.detail.part}.`,
          condition: null,
          evidence: [binding.locator, 'scripts/catalog/pcgen/schedules.ts'],
        });
        addEdge(context, {
          from: increment.externalKey,
          to: parent,
          kind: 'requirement',
          reason:
            'A generated increment retains its exact acquisition parent and part; it adds no duplicate modifiers.',
          condition: null,
          evidence: ['scripts/catalog/pcgen/schedules.ts'],
        });
      }
    }
    if (!schedule)
      classRow.holds.push({
        owner: classScheduleOwner(root.name),
        reason:
          'Printed 1–20 requirements inventoried; reviewed schedule implementation remains outstanding.',
      });
    for (const row of table)
      checkpoints.push({
        classKey: root.key,
        className: root.name,
        level: row.level,
        source: { ...binding, locator: `${binding.locator}#L${row.line}` },
        printed: row.special,
        columns: { ...row.columns },
        sourceColumns: sourceColumns.get(row.line) ?? {},
        scheduledKeys: scheduled
          .filter(({ classLevel }) => classLevel === row.level)
          .map(({ externalKey }) => externalKey),
        scheduleStatus: schedule ? 'reviewed schedule' : 'outstanding schedule',
        owner: classScheduleOwner(root.name),
      });
    const matchingClass = (member: LaunchSourceRecord) =>
      classAssociations(member).some(
        (name) =>
          name === root.name ||
          (root.name === 'Monk (Unchained)' && name === 'Unchained Monk'),
      );
    const members = context.records.filter(
      (member) =>
        sourceKind(member) === 'classFeature' &&
        !member.record._key.startsWith('!folders!') &&
        matchingClass(member) &&
        (sourceBooks(member).length === 0 ||
          sourceBooks(member).some((book) => config.books.includes(book))),
    );
    inventoryPrintedRequirements({
      context,
      root: root.key,
      html,
      binding,
      members,
      name: root.name,
    });
    includePool({
      context,
      root: root.key,
      name: `${root.name} features and class options`,
      members,
      source: binding,
      selector: `All pinned class-associated feature records for ${root.name}; books ${config.books.join(', ')} plus unattributed source records retained for assessment.`,
    });
    const tags = new Set(members.flatMap(sourceTags));
    for (const tag of [...tags].sort()) {
      if (
        !/rage power|performance|domain|nature bond|bonus feat|weapon group|mercy|favored|combat style|talent|bloodline|school|discover|order|teamwork|judgment|myster|curse|revelation|hex|patron|arcana|ki power|style strike/i.test(
          tag,
        )
      )
        continue;
      includePool({
        context,
        root: root.key,
        name: `${root.name}: ${tag}`,
        members: members.filter((member) => sourceTags(member).includes(tag)),
        source: binding,
        selector: `Exact source tag ${tag} within the complete ${root.name} inventory.`,
      });
    }
    for (const association of readArray(
      readObject(source.record.system.links).classAssociations,
    ).map(readObject)) {
      const key =
        typeof association.uuid === 'string'
          ? uuidKey(association.uuid)
          : undefined;
      if (!key) continue;
      const target = context.raw.get(key);
      if (target) includeSource(context, target);
      addEdge(context, {
        from: root.key,
        to: key,
        kind: 'grant',
        reason: `Raw first acquisition at ${String(association.level)}; printed/reviewed increments take precedence (Tireless Rage is 17).`,
        condition: null,
        evidence: [source.binding.locator],
      });
    }
    for (const feature of schedule?.features ?? []) {
      const target = context.raw.get(feature.externalKey);
      if (target) includeSource(context, target);
      for (const level of feature.levels)
        addEdge(context, {
          from: root.key,
          to: feature.externalKey,
          kind: 'grant',
          reason: `${feature.name} at reviewed class level ${level}${feature.decision ? `; ${feature.decision}` : ''}.`,
          condition: null,
          evidence: [binding.locator, 'scripts/catalog/pcgen/schedules.ts'],
        });
    }
    const casting = readObject(source.record.system.casting);
    if (Object.keys(casting).length) {
      const spellMembers = context.records.filter(
        (member) =>
          sourceKind(member) === 'spell' &&
          sourceBooks(member).some((book) => config.books.includes(book)) &&
          sourceSpellClasses(member).some(
            ({ name }) =>
              name.toLowerCase() === root.name.toLowerCase() ||
              (['Wizard', 'Sorcerer'].includes(root.name) &&
                name.toLowerCase() === 'sorcerer/wizard'),
          ),
      );
      includePool({
        context,
        root: root.key,
        name: `${root.name} baseline spell-list metadata`,
        members: spellMembers,
        source: binding,
        selector: `Whole published baseline class list, not a selected spell sample; full learnedAt.class metadata remains bound.`,
      });
    }
  }
  return checkpoints;
}

function nodeText(node: HtmlNode): string {
  if ('value' in node) return node.value;
  return 'childNodes' in node ? node.childNodes.map(nodeText).join('') : '';
}

/** Complete named definitions, not a one-option example, including names absent from Foundry. */
function namedPrdDefinitions(html: string, includeSourcePositions = false) {
  const definitions: {
    id: string;
    name: string;
    line: number;
    text: string;
  }[] = [];
  const visit = (node: HtmlNode) => {
    if ('attrs' in node && 'childNodes' in node) {
      const id = node.attrs.find(({ name }) => name === 'id')?.value;
      const first = node.childNodes.find(
        (child) =>
          child.nodeName === 'strong' ||
          child.nodeName === 'em' ||
          child.nodeName === 'b' ||
          (includeSourcePositions && child.nodeName === 'i'),
      );
      if (
        (id || (includeSourcePositions && node.nodeName === 'p')) &&
        (first || /^h[2-5]$/.test(node.nodeName))
      )
        definitions.push({
          id:
            id ?? `source-position-L${node.sourceCodeLocation?.startLine ?? 0}`,
          name: nodeText(first ?? node)
            .replace(/\s*\((?:Ex|Su|Sp)\)/g, '')
            .replace(/:\s*$/, '')
            .trim(),
          line: node.sourceCodeLocation?.startLine ?? 0,
          text: nodeText(node).replace(/\s+/g, ' ').trim(),
        });
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  visit(parseHtml(html, { sourceCodeLocationInfo: true }));
  return definitions;
}

function inventoryPrintedRequirements({
  context,
  root,
  html,
  binding,
  members,
  name,
}: {
  context: Context;
  root: string;
  html: string;
  binding: LaunchBinding;
  members: LaunchSourceRecord[];
  name: string;
}) {
  const owner = originalOwner(root);
  const implementation = classScheduleOwner(name);
  const keys: string[] = [];
  for (const definition of namedPrdDefinitions(
    html,
    advancedAudit.accounting.some((entry) => entry.root === root),
  )) {
    const key = `rule/prd/${binding.locator}#${definition.id}:L${definition.line}`;
    keys.push(key);
    const recordedChoice = /\b(?:choose|select|pick|choice)\b/i.test(
      definition.text,
    );
    const references = members.filter(
      (member) =>
        normalizeSourceName(member.record.name) ===
        normalizeSourceName(definition.name),
    );
    context.rows.set(key, {
      key,
      catalogKey: null,
      kind: 'rule',
      name: `${name}: ${definition.name}`,
      requirement: 'required',
      sources: [
        {
          ...binding,
          locator: `${binding.locator}#${definition.id}:L${definition.line}`,
        },
      ],
      inventoryOwner: owner,
      implementationOwner: implementation,
      publicTestOwner: owner,
      mechanisms: [
        {
          name: definition.name,
          disposition: recordedChoice ? 'recorded choice' : 'calculated',
          status: 'outstanding',
          contract: `${recordedChoice ? 'Retain the source choices, conditions, dependent options and promised calculated effects' : 'Preserve all promised sheet effects and source conditions'} of this complete governing source definition. Its named source body is not replaced by an association level or a raw UUID.`,
          evidence: [`${binding.locator}:${definition.line}`],
        },
      ],
      admission: observation([binding.locator]),
      structure: observation([
        '#704',
        'convex/lib/catalogCandidateDefinition.ts',
      ]),
      contentEvidence: observation([binding.locator]),
      noticeEvidence: observation(['#736/#737']),
      holds: [],
      research: [],
    });
    addEdge(context, {
      from: root,
      to: key,
      kind: 'requirement',
      reason: `Printed governing definition ${definition.name}, including its full conditional/choice body.`,
      condition: null,
      evidence: [`${binding.locator}:${definition.line}`],
    });
    for (const target of references)
      addEdge(context, {
        from: key,
        to: includeSource(context, target).key,
        kind: recordedChoice ? 'option' : 'grant',
        reason: `The pinned ${name} definition ${definition.name} matches this class-associated source record; numeric/conditional requirements remain explicit owning-batch work.`,
        condition:
          'Use the complete governing definition, not the display-name match, to assess exact mechanics.',
        evidence: [
          `${binding.locator}:${definition.line}`,
          target.binding.locator,
        ],
      });
  }
  context.pools.push({
    id: `${root}:printed-definitions`,
    root,
    name: `${name} complete named printed definitions`,
    purpose: 'retained inventory',
    selector:
      'Every identified named governing paragraph/heading in the pinned class body, including conditional choices and definitions with no raw UUID.',
    sources: [binding],
    members: keys,
    membersSha256: launchInventoryHash(keys),
    remainder: [],
    research: [],
  });
}

async function inventoryExploiter(context: Context, repoRoot: string) {
  const file = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
  const tree = await readPcgenTree(context.paths.pcgen);
  const view = buildEffectiveView(tree);
  const inventory = inventoryPcgen(tree);
  const owner = inventory.owners.find(
    ({ record }) =>
      record.locator.file === file &&
      record.locator.key === 'Wizard Archetype ~ Exploiter Wizard',
  );
  const effective = owner ? view.records.get(owner.record) : undefined;
  if (!owner || !effective?.appliedMods.some(({ line }) => line === 4704))
    throw new Error(
      'Exploiter effective owner / :4704 modification is missing.',
    );
  const ledger = parseIdentityLedger(
    JSON.parse(
      await readFile(
        join(repoRoot, 'scripts/catalog/everythingpath-identities.json'),
        'utf8',
      ),
    ),
  );
  const identity = ledger.identities.find(({ sources }) =>
    sources.some(
      (source) =>
        locatorKeyOf(source) ===
        locatorKeyOf({ source: 'pcgen', locator: owner.record.locator }),
    ),
  );
  if (identity?.externalKey !== exploitKey)
    throw new Error(
      'Exploiter owner is not allocated to the canonical ledger key.',
    );
  const { binding } = await readPrdBinding(
    context,
    'pages/advancedClassGuide/classOptions/wizard.html',
  );
  const source: LaunchBinding = {
    repository: 'pcgen',
    pin: pcgenPin.commit,
    locator: `${file}#Wizard Archetype ~ Exploiter Wizard`,
    rawSha256: sourceHash(owner.record.text),
    effectiveSha256: archetypeSourceSha256(effective),
  };
  const wizardOwners = inventory.owners.filter(
    (candidate) => candidate.className === 'Wizard',
  );
  context.ownerInventories.push({
    issue: 702,
    selector:
      'Original #702 PRD/PCGen archetype selector: base_class Wizard; bounded author batches retain 100-candidate limits.',
    requiredLocators: [source.locator],
    remainderLocators: wizardOwners
      .filter((candidate) => candidate !== owner)
      .map(({ record }) => `${record.locator.file}#${record.locator.key}`),
    sources: wizardOwners.map(({ record }) => {
      const current = view.records.get(record);
      return {
        repository: 'pcgen',
        pin: pcgenPin.commit,
        locator: `${record.locator.file}#${record.locator.key}`,
        rawSha256: sourceHash(record.text),
        effectiveSha256: current
          ? archetypeSourceSha256(current)
          : sourceHash(record.text),
      };
    }),
  });
  const wizardOwner = launchOwner(
    702,
    'Wizard archetype inventory (Exploiter subset only)',
    ['#702', source.locator],
  );
  const sourceOwner = launchOwner(
    771,
    'Exploiter reservoir/exploit schedule, source definitions and legal eligibility',
    ['#771', source.locator, binding.locator],
  );
  context.rows.set(exploitKey, {
    key: exploitKey,
    catalogKey: exploitKey,
    kind: 'archetype',
    name: 'Exploiter Wizard',
    requirement: 'required',
    sources: [source, binding],
    inventoryOwner: wizardOwner,
    implementationOwner: sourceOwner,
    publicTestOwner: wizardOwner,
    mechanisms: [
      {
        name: 'Arcane Reservoir at 1',
        disposition: 'calculated',
        status: 'outstanding',
        contract:
          'Replace Arcane Bond at level 1; Wizard level supplies reservoir scale. Temporary pool tracking is outside MVP.',
        evidence: [`${file}:4057`, `${binding.locator}:350`],
      },
      {
        name: 'Exploits at 1/5/9/13/17',
        disposition: 'recorded choice',
        status: 'outstanding',
        contract:
          'Replace Arcane School, preserve Wizard casting, suppress school-only benefits and preserve dormant choices. Wizard level substitutes for exploit effects/DCs; no full Arcanist progression is granted.',
        evidence: [`${file}:4058`, `${file}:4704`, `${binding.locator}:351`],
      },
    ],
    admission: observation(['#702']),
    structure: observation([
      '#771',
      'convex/lib/catalogCandidateDefinition.ts',
    ]),
    contentEvidence: observation([source.locator]),
    noticeEvidence: observation(['#716 P9/P10b/P11', '#736/#737']),
    holds: [
      {
        owner: sourceOwner,
        reason:
          'P7f source output and owning #702 admission/public saved-sheet proof remain outstanding.',
      },
    ],
    research: [],
  });
  addEdge(context, {
    from: exploitKey,
    to: 'pf1/0c4lYDywj6bQ0i8r',
    kind: 'requirement',
    reason: 'Exploiter is a Wizard archetype and retains Wizard casting.',
    condition: null,
    evidence: [binding.locator],
  });
  const arc = await readPrdBinding(
    context,
    'pages/advancedClassGuide/classes/arcanist.html',
  );
  const records = [...view.records.keys()];
  const regular = records.filter(
    (record) =>
      record.locator.file === file &&
      record.tokens.some((token) =>
        token.startsWith('TYPE:ArcanistExploit.'),
      ) &&
      !record.tokens.some(
        (token) =>
          (token.startsWith('TYPE:') &&
            token.includes('ArcanistGreaterExploit')) ||
          (token.startsWith('PREABILITY:') &&
            token.includes('Arcanist Archetype ~ Blade Adept')),
      ),
  );
  const features = context.records.filter(
    (record) =>
      sourceKind(record) === 'classFeature' &&
      classAssociations(record).includes('Arcanist'),
  );
  const chosen: LaunchSourceRecord[] = [];
  const missing = [];
  const aliases = new Map([
    ['Arcanist Exploit ~ Familiar', 'pf1/YQgJJcgq11g7TBWP'],
    ['Arcanist Exploit ~ Quick Study', 'pf1/bQIHXFmVTfQv6rD3'],
    ['Arcanist Exploit ~ Spell Resistance', 'pf1/CO1zRIeXTn6L5yQY'],
  ]);
  for (const exploit of regular) {
    const alias = aliases.get(exploit.locator.key);
    const matches = features.filter((feature) =>
      alias
        ? sourceKey(feature) === alias
        : normalizeSourceName(feature.record.name) ===
          normalizeSourceName(exploit.name),
    );
    if (matches.length === 1 && matches[0]) chosen.push(matches[0]);
    else {
      missing.push(exploit);
      context.research.push({
        owner: sourceOwner,
        question: `Required regular exploit ${exploit.locator.key} at ${file}:${exploit.locator.line} has ${matches.length} unambiguous Foundry identities; resolve the source identity before generic completeness.`,
      });
    }
  }
  includePool({
    context,
    root: exploitKey,
    name: 'eligible ordinary ACG arcanist exploits',
    members: chosen,
    source: arc.binding,
    selector: `The ${regular.length} printed regular ACG exploits; exclude greater exploits and the five Blade Adept-only options at :2398–2402. Preserve their original inventories and independent incoming paths.`,
  });
  const excluded = records.filter(
    (record) =>
      record.locator.file === file &&
      record.tokens.some(
        (token) =>
          token.startsWith('TYPE:') && token.includes('ArcanistGreaterExploit'),
      ),
  );
  const pool = context.pools.at(-1);
  if (pool) {
    const bladeAdept = records.filter(
      (record) =>
        record.locator.file === file &&
        record.tokens.some(
          (token) =>
            token.startsWith('PREABILITY:') &&
            token.includes('Arcanist Archetype ~ Blade Adept'),
        ) &&
        record.tokens.some((token) =>
          token.startsWith('TYPE:ArcanistExploit.'),
        ),
    );
    pool.purpose = 'eligibility';
    pool.remainder = [...excluded, ...bladeAdept].map((record) => ({
      locator: `${record.locator.file}:${record.locator.line}#${record.locator.key}`,
      reason: bladeAdept.includes(record)
        ? 'Blade Adept-only exploit; original inventory and independent incoming paths retained.'
        : record.locator.key === 'Arcanist Exploit ~ Fast Healing'
          ? 'White Mage-only Fast Healing, distinct from the sixteen ordinary greater exploits; Exploiter grants neither its archetype nor Greater Exploits.'
          : 'Requires the separate Greater Exploits feature, which Exploiter does not grant. Wizard level substitutes for effects/DCs only; greater eligibility is not granted by that substitution.',
    }));
    context.rows.get(exploitKey)?.holds.push({
      owner: sourceOwner,
      reason:
        'Preserve sixteen ordinary greater exploits, distinct White Mage Fast Healing and five Blade Adept-only options; resolve PCGen :4058 formula/DC discrepancies against PRD before reliance.',
    });
  }
  for (const line of [
    4057,
    4058,
    ...missing.map(({ locator }) => locator.line),
  ]) {
    const feature = records.find(
      (record) => record.locator.file === file && record.locator.line === line,
    );
    if (!feature)
      throw new Error(`Missing required Exploiter feature ${line}.`);
    const allocatedFeature = ledger.identities.find(({ sources }) =>
      sources.some(
        (candidate) =>
          locatorKeyOf(candidate) ===
          locatorKeyOf({ source: 'pcgen', locator: feature.locator }),
      ),
    );
    const key =
      allocatedFeature?.externalKey ??
      `unallocated/pcgen/${feature.locator.key}`;
    const featureView = view.records.get(feature);
    const rootRow = context.rows.get(exploitKey);
    const mechanism = rootRow?.mechanisms[line === 4057 ? 0 : 1];
    if (!rootRow || !mechanism)
      throw new Error('Missing Exploiter requirement contract.');
    context.rows.set(key, {
      ...rootRow,
      key,
      catalogKey: allocatedFeature?.externalKey ?? null,
      kind: 'classFeature',
      name: feature.name,
      sources: [
        {
          repository: 'pcgen',
          pin: pcgenPin.commit,
          locator: `${file}#${feature.locator.key}`,
          rawSha256: sourceHash(feature.text),
          effectiveSha256: featureView
            ? archetypeSourceSha256(featureView)
            : sourceHash(feature.text),
        },
      ],
      inventoryOwner: wizardOwner,
      implementationOwner: sourceOwner,
      publicTestOwner: wizardOwner,
      mechanisms: [mechanism],
      holds: [
        {
          owner: sourceOwner,
          reason:
            'Required source feature output needs P7f schedule/structure implementation and owning #702 admission; ledger allocation is not implementation or approval.',
        },
      ],
      research: [],
    });
    addEdge(context, {
      from: exploitKey,
      to: key,
      kind: 'grant',
      reason: `${feature.name}; source-backed required output at ${line === 4057 ? '1' : '1,5,9,13,17'}.`,
      condition: null,
      evidence: [`${file}:${line}`],
    });
  }
}

async function inventoryItemAbilities(context: Context, root: string) {
  const sources = [
    'roleplaying_game/core_rulebook/cr_equipmods.lst',
    'roleplaying_game/advanced_players_guide/apg_equipmods.lst',
  ];
  const candidates = context.records.filter(
    (record) =>
      sourceKind(record) === 'itemAbility' &&
      !record.record._key.startsWith('!folders!'),
  );
  const members = new Set<string>();
  const bindings: LaunchBinding[] = [];
  for (const file of sources) {
    const text = await readFile(join(context.paths.pcgen, file), 'utf8');
    const source: LaunchBinding = {
      repository: 'pcgen',
      pin: pcgenPin.commit,
      locator: file,
      rawSha256: sourceHash(text),
      effectiveSha256: null,
      rawFileSha256: sourceHash(text),
    };
    bindings.push(source);
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (line.startsWith('#')) continue;
      const tokens = line.split('\t');
      const nativeKey = tokens
        .find((token) => token.startsWith('KEY:'))
        ?.slice(4);
      if (
        !nativeKey ||
        !/^Special Ability ~ .+ ~ (?:Weapon|Ammunition|Melee|Ranged|Thrown|Armor|Shield|Amulet of Mighty Fists)/.test(
          nativeKey,
        )
      )
        continue;
      const name = tokens[0];
      if (!name)
        throw new Error(`Empty Item Ability name ${file}:${index + 1}.`);
      let candidateName = name;
      if (name.startsWith('Energy Resistance ('))
        candidateName = name.includes('/Improved')
          ? 'Energy Resistance, Improved'
          : name.includes('/Greater')
            ? 'Energy Resistance, Greater'
            : 'Energy Resistance';
      if (/^(Light|Moderate|Heavy) Fortification$/.test(name))
        candidateName = `Fortification (${name.split(' ')[0]?.toLowerCase()})`;
      if (
        ['Ghost Touch', 'Glamered'].includes(name) &&
        nativeKey.endsWith(' ~ Armor')
      )
        candidateName = `${name} (Armor)`;
      const targets = candidates.filter(
        (record) =>
          normalizeSourceName(record.record.name) ===
          normalizeSourceName(candidateName),
      );
      const binding = {
        ...source,
        locator: `${file}:${index + 1}`,
        rawSha256: sourceHash(line),
        rawLineSha256: sourceHash(line),
        effectiveSha256: null,
      };
      const key = `rule/pcgen/${file}:${index + 1}`;
      members.add(key);
      const owner = launchOwner(
        716,
        'Original PCGen source inventory; native equipment-property body and governing source integration',
        [binding.locator, '#716'],
      );
      const implementation = launchOwner(
        764,
        'Item Ability and enhancement conditional mechanics through the public equipment boundary',
        [binding.locator, '#764'],
      );
      context.rows.set(key, {
        key,
        catalogKey: null,
        kind: 'rule',
        name: `CRB/APG Item Ability: ${name}`,
        requirement: 'required',
        sources: [binding],
        inventoryOwner: owner,
        implementationOwner: implementation,
        publicTestOwner: implementation,
        mechanisms: [
          {
            name: nativeKey,
            disposition: 'calculated',
            status: 'outstanding',
            contract: `Preserve this original scoped definition, including enhancement limits, eligible equipment, prerequisites, conditional formulas and properties: ${tokens.filter((token) => /^(?:TYPE|PLUS|COST|PRE\w*|BONUS|SPROP|ABILITY|ITYPE):/.test(token)).join('; ')}`,
            evidence: [binding.locator],
          },
        ],
        admission: observation([binding.locator]),
        structure: observation(['#764']),
        contentEvidence: observation([binding.locator]),
        noticeEvidence: observation(['#736/#737', binding.locator]),
        holds: [
          {
            owner: implementation,
            reason:
              'Original definition is inventory evidence; actual candidate/body comparison and public calculation proof remain required. Later reprint bodies retain their complete independent notice obligations.',
          },
        ],
        research: [],
      });
      addEdge(context, {
        from: root,
        to: key,
        kind: 'option',
        reason: `Original CRB/APG scoped equipment property ${nativeKey}.`,
        condition:
          'Apply the complete native equipment eligibility and enhancement prerequisites.',
        evidence: [binding.locator],
      });
      for (const target of targets) {
        const row = includeSource(context, target);
        if (
          !row.sources.some((existing) => existing.locator === binding.locator)
        )
          row.sources.push(binding);
        members.add(row.key);
        addEdge(context, {
          from: root,
          to: row.key,
          kind: 'option',
          reason: `Original CRB/APG property ${nativeKey} requires this pinned candidate, including its later reprint notice chain.`,
          condition:
            'Use the original scoped definition and complete candidate body together.',
          evidence: [binding.locator, target.binding.locator],
        });
        addEdge(context, {
          from: key,
          to: row.key,
          kind: 'requirement',
          reason: `Original property ${nativeKey} resolves to the pinned ${target.record.name} candidate; original/reprint comparison remains #764 work.`,
          condition:
            'Preserve original equipment scope and energy/tier choice; a generic reprint body does not erase the original alternatives.',
          evidence: [binding.locator, target.binding.locator],
        });
      }
    }
  }
  for (const candidate of candidates.filter((record) =>
    sourceBooks(record).some((book) => baselineBooks.has(book)),
  )) {
    members.add(includeSource(context, candidate).key);
    addEdge(context, {
      from: root,
      to: sourceKey(candidate),
      kind: 'option',
      reason: 'Pinned Item Ability body explicitly cites CRB/APG.',
      condition: 'Apply source equipment scope and prerequisites.',
      evidence: [candidate.binding.locator],
    });
  }
  const keys = [...members].sort();
  context.pools.push({
    id: `${root}:CRB/APG Item Abilities`,
    root,
    name: 'CRB/APG Item Abilities',
    purpose: 'eligibility',
    selector:
      'Every original CRB/APG PCGen scoped special equipment property, including numeric enhancements and all energy/resistance tiers; exact-name matches plus explicit energy/tier/armor aliases retain later reprint candidates without treating their notice chain as core-only.',
    sources: bindings,
    members: keys,
    membersSha256: launchInventoryHash(keys),
    remainder: candidates
      .filter((record) => !members.has(sourceKey(record)))
      .map((record) => ({
        locator: sourceKey(record),
        reason:
          'Outside original CRB/APG equipment-property inventory; transitive grants or the actual party supplement can require it separately.',
      })),
    research: [],
  });
}

async function inventorySupportingPools(context: Context) {
  const classes = campaignMvpRoots.filter(({ kind }) => kind === 'class');
  const defaultClass = classes.find(({ name }) => name === 'Fighter');
  if (!defaultClass) throw new Error('Missing supporting pool root.');
  const bindingOf = (key: string) => {
    const binding = context.raw.get(key)?.binding;
    if (!binding) throw new Error(`Missing source ${key}.`);
    return binding;
  };
  const pools = [
    {
      root: defaultClass.key,
      name: 'CRB/APG feat choices and prerequisite chains',
      kinds: ['feat'],
      baseline: true,
    },
    {
      root: defaultClass.key,
      name: 'CRB baseline weapons armor ammunition and Base Items',
      kinds: ['item'],
      baseline: true,
    },
  ];
  for (const pool of pools) {
    const members = context.records.filter(
      (record) =>
        !record.record._key.startsWith('!folders!') &&
        pool.kinds.includes(sourceKind(record)) &&
        (!pool.baseline ||
          sourceBooks(record).some((book) => baselineBooks.has(book))),
    );
    includePool({
      context,
      root: pool.root,
      name: pool.name,
      members,
      source: bindingOf(pool.root),
      selector: pool.baseline
        ? `All ${pool.kinds.join('/')} records with CRB/APG source metadata; source links extend required closure beyond this baseline.`
        : `Entire original ${pool.kinds.join('/')} source inventories retained; semantic baseline/remainder partition requires source review, never a selected species sample.`,
    });
  }
  await inventoryItemAbilities(context, defaultClass.key);
}

function inventoryRacialTraits(context: Context) {
  const folders = new Map(
    context.records
      .filter(({ record }) => record._key.startsWith('!folders!'))
      .map(({ record }) => [
        record._id,
        { name: record.name, parent: record.folder },
      ]),
  );
  const ancestry = (record: LaunchSourceRecord) => {
    const names: string[] = [];
    const visited = new Set<string>();
    let id = record.record.folder;
    while (id && !visited.has(id)) {
      visited.add(id);
      const folder = folders.get(id);
      if (!folder) break;
      names.push(folder.name);
      id = folder.parent;
    }
    return names;
  };
  for (const root of campaignMvpRoots.filter(({ kind }) => kind === 'race')) {
    const source = context.raw.get(root.key);
    if (!source) throw new Error(`Missing race ${root.key}.`);
    const members = context.records.filter(
      (record) =>
        sourceKind(record) === 'racialTrait' &&
        !record.record._key.startsWith('!folders!') &&
        ancestry(record).includes(root.name),
    );
    includePool({
      context,
      root: root.key,
      name: `${root.name} standard and alternate Racial Traits`,
      members,
      source: source.binding,
      selector:
        'Complete original race folder inventory, including standard and alternate traits; replacements are source conditions.',
    });
    const abilityRule = findRaceAbilityTraitRule(root.key);
    if (abilityRule) {
      const parent = includeSource(context, source);
      const localKey = raceAbilityTraitKey(root.key);
      const owner = launchOwner(
        740,
        'Generated/local standard Racial Trait identity and single contribution through the actual adapter',
        ['scripts/catalog/racial-trait-rules.ts', '#328/#740'],
      );
      context.rows.set(localKey, {
        ...parent,
        key: localKey,
        catalogKey: null,
        kind: 'racialTrait',
        name: `${root.name}: ${abilityRule.heading}`,
        sources: [
          {
            ...source.binding,
            effectiveSha256: sourceHash(JSON.stringify(abilityRule)),
          },
        ],
        inventoryOwner: originalOwner(root.key),
        implementationOwner: owner,
        publicTestOwner: owner,
        mechanisms: [
          {
            name: 'Generated ability-score trait',
            disposition: 'calculated',
            status: 'outstanding',
            contract: `Carry exactly the reviewed consumed ability changes ${abilityRule.consumes.map((change) => `${change.target} ${change.formula} ${change.type}`).join(', ')}; remove their duplicate contribution from the parent race. Ability-choice traits remain separate source-backed records.`,
            evidence: [
              'row.sources',
              'scripts/catalog/racial-trait-rules.ts',
              abilityRule.pcgen,
            ],
          },
        ],
        holds: [
          {
            owner,
            reason:
              'Local/generated traits require #740 fresh race assessment and actual stored-candidate identity/contribution proof. The inventory does not infer release support from the generated key.',
          },
        ],
        research: [],
      });
      addEdge(context, {
        from: root.key,
        to: localKey,
        kind: 'grant',
        reason:
          'The reviewed race ability line emits this exact local/generated standard trait identity; its ability changes must contribute once.',
        condition: null,
        evidence: [
          source.binding.locator,
          'scripts/catalog/racial-trait-rules.ts',
        ],
      });
    }
    includeSource(context, source).holds.push({
      owner: launchOwner(
        740,
        'Source-backed standard traits, generated/local identities and nonduplicated contributions',
        [source.binding.locator, '#740'],
      ),
      reason:
        'Race metadata/raw trait folders alone do not prove generated/local standard trait coverage or absence of double contribution; #740 must reassess the actual race.',
    });
  }
}

function expandContent(context: Context) {
  const queue = [...context.rows.keys()];
  const expanded = new Set<string>();
  for (const key of queue) {
    if (expanded.has(key)) continue;
    expanded.add(key);
    const source = context.raw.get(key);
    if (!source) continue;
    const baseItemKey = findWeaponImportRule(key)?.baseItemKey;
    if (baseItemKey) {
      const target = context.raw.get(baseItemKey);
      if (!target)
        throw new Error(`Missing source Base Item ${baseItemKey} for ${key}`);
      const required = includeSource(context, target);
      queue.push(required.key);
      addEdge(context, {
        from: key,
        to: required.key,
        kind: 'requirement',
        reason:
          'Specific weapon inherits its base profile from this stable Base Item.',
        condition: null,
        evidence: [
          source.binding.locator,
          target.binding.locator,
          'scripts/catalog/weapon-import-rules.ts',
        ],
      });
    }
    for (const link of sourceLinks(source)) {
      if (isRulesJournalLink(link.uuid)) {
        addEdge(context, {
          from: key,
          to: link.uuid,
          kind: 'citation',
          reason: `Rules citation ${link.label}; not a mechanical catalog dependency.`,
          condition: null,
          evidence: [source.binding.locator],
        });
        continue;
      }
      const target = uuidKey(link.uuid);
      if (!target) continue;
      const alternateKey = target.startsWith('pf1/')
        ? target.replace('pf1/', 'pf1-content/')
        : target.replace('pf1-content/', 'pf1/');
      const alternate = context.raw.get(alternateKey);
      const record =
        context.raw.get(target) ??
        (alternate &&
        normalizeSourceName(alternate.record.name) ===
          normalizeSourceName(link.label)
          ? alternate
          : undefined);
      if (record && ['race', 'class'].includes(sourceKind(record))) {
        addEdge(context, {
          from: key,
          to: target,
          kind: 'citation',
          reason: `Source names ${record.record.name}; this citation does not add or grant another playable class/race or its complete progression.`,
          condition: null,
          evidence: [source.binding.locator],
        });
        continue;
      }
      const resolvedTarget = record
        ? includeSource(context, record).key
        : target;
      if (record) queue.push(resolvedTarget);
      if (record && sourceKey(record) !== target) {
        context.rows.get(key)?.holds.push({
          owner: launchOwner(
            763,
            'Pinned companion/source reference discrepancy before adapter reliance',
            [source.binding.locator, record.binding.locator],
          ),
          reason: `Literal source reference ${target} names ${link.label.replace(/\s+/g, ' ')}; the identical ID/name exists in ${sourceKey(record)} instead. Inventory records the actual governing identity, preserving this discrepancy; no importer or source bytes were repaired.`,
        });
        addEdge(context, {
          from: key,
          to: target,
          kind: 'citation',
          reason:
            'Original broken namespace reference retained as discrepancy evidence, distinct from the resolved governing source identity.',
          condition: null,
          evidence: [source.binding.locator, record.binding.locator],
        });
      }
      const tieflingDarkness =
        key === 'pf1/nVjKDLZSRONzYm8f' && target === 'pf1/tsndfcfijmgxs37p';
      const tieflingSorcery =
        key === 'pf1/nVjKDLZSRONzYm8f' &&
        [
          'pf1/AoWSbnuTSGIxmv61',
          'pf1/YibSkrURB0yHprQK',
          'pf1/yHDVCenLfvduBVM7',
        ].includes(target);
      addEdge(context, {
        from: key,
        to: resolvedTarget,
        kind: tieflingDarkness
          ? 'grant'
          : link.prerequisite
            ? 'prerequisite'
            : 'requirement',
        reason: tieflingDarkness
          ? "Tiefling's once-per-day Darkness spell-like ability, with caster level equal to class level."
          : tieflingSorcery
            ? 'Fiendish Sorcery: +2 effective Charisma for Sorcerer class abilities with Abyssal or Infernal bloodline.'
            : link.prerequisite
              ? `Explicit source prerequisite ${link.label.replace(/\s+/g, ' ') || target}; preserve the complete prerequisite paragraph's alternatives, minima and conditions.`
              : `Full source body references ${link.label.replace(/\s+/g, ' ') || target}; required content retained pending owning-batch semantic assessment.`,
        condition: tieflingDarkness
          ? null
          : tieflingSorcery
            ? 'Tiefling Sorcerer with Abyssal or Infernal bloodline.'
            : 'Use source conditions; a content link alone does not prove an unconditional grant.',
        evidence: [source.binding.locator],
      });
    }
  }
}

function governingBook(binding: LaunchBinding) {
  if (binding.repository !== 'pcgen' && binding.repository !== 'prd') return [];
  const books = [
    ['core_rulebook/', 'PZO1110'],
    ['coreRulebook/', 'PZO1110'],
    ['advanced_players_guide/', 'PZO1115'],
    ['advancedPlayersGuide/', 'PZO1115'],
    ['advanced_class_guide/', 'PZO1129'],
    ['advancedClassGuide/', 'PZO1129'],
    ['ultimateMagic/', 'PZO1117'],
    ['unchained/', 'PZO1131'],
  ];
  return books
    .filter(([directory]) => directory && binding.locator.includes(directory))
    .flatMap(([, book]) => (book ? [book] : []));
}

// The Registry alone: `reviewed-data.ts` would also decode every evidence entry.
const noticeReadiness = createNoticeReadiness({
  registry: reviewedAdmissionSchema.shape.registry.parse(registryData),
});
/**
 * A notice row observes the notice it names: verified once every notice the
 * code reads as counts as reviewed (its Registry identity, or a usable PCGen
 * confirmation) and no uncleared hold holds it; unreviewed while a Registry
 * record awaits review; held while a hold is in force or no Registry
 * identity exists. A notice row has no structure or content apart from its
 * notice, so all four observations read it (owner decisions of 2026-10-30).
 */
function noticeObservation(book: string) {
  const readiness = noticeReadiness(book);
  const state =
    readiness.holds.length || readiness.identity === 'missing'
      ? ('held' as const)
      : readiness.identity === 'reviewed'
        ? ('verified' as const)
        : ('unreviewed' as const);
  const evidence = [
    `${book} reads as ${readiness.notices.join(', ')}: Registry identity ${readiness.identity}; holds in force: ${readiness.holds.join(', ') || 'none'}.`,
    'scripts/catalog/legal/notice-clearances.json',
    'src/lib/catalog/data/section15-registry.json',
  ];
  const holds = [
    ...(readiness.holds.length
      ? [`${book}: held by ${readiness.holds.join(', ')}.`]
      : []),
    ...(readiness.identity === 'missing'
      ? [
          `${book}: no Registry identity or usable PCGen confirmation; the owner supplies the notice text.`,
        ]
      : []),
  ];
  return { state, evidence, holds };
}
function inventoryNotices(context: Context) {
  for (const row of [...context.rows.values()]) {
    const source = context.raw.get(row.key);
    const legal = context.legal.get(row.key);
    const books = new Set([
      ...(source ? sourceBooks(source) : []),
      ...row.sources.flatMap(governingBook),
      ...(legal?.requiredNotices ?? []),
      ...context.edges
        .filter(({ from, kind }) => from === row.key && kind === 'notice')
        .map(({ to }) => to.replace(/^notice\//, '')),
    ]);
    if (source && JSON.stringify(source.record.system).includes('unchained'))
      books.add('PZO1131');
    if (
      row.key === 'pf1-content/kDx6ZGhbIteoi7lG' ||
      (source && sourceKind(source) === 'spell')
    )
      books.add('PZO1110');
    for (const book of books) {
      const key = `notice/${book}`;
      const sourceBinding = row.sources[0];
      if (!sourceBinding) throw new Error(`No notice provenance ${row.key}.`);
      const owner = launchOwner(
        737,
        `Required ${book} governing/whole-body notice chain`,
        ['scripts/catalog/legal/', '#736/#737'],
      );
      const notice = noticeObservation(book);
      if (!context.rows.has(key))
        context.rows.set(key, {
          key,
          catalogKey: null,
          kind: 'notice',
          name: `${book} complete governing notice chain`,
          requirement: row.requirement,
          sources: [sourceBinding],
          inventoryOwner: owner,
          implementationOwner: owner,
          publicTestOwner: owner,
          mechanisms: [
            {
              name: 'Notice inclusion',
              disposition: 'recorded choice',
              status: notice.state === 'verified' ? 'reused' : 'outstanding',
              contract:
                'Resolve the reviewed Registry identity, product-code alias, complete body/inherited notice chain and outstanding wording/attribution holds. Bibliographic metadata is not notice sufficiency.',
              evidence: [
                'scripts/catalog/legal/held-notices.json',
                'src/lib/catalog/data/section15-registry.json',
              ],
            },
          ],
          admission: observation(notice.evidence, notice.state),
          structure: observation(notice.evidence, notice.state),
          contentEvidence: observation(notice.evidence, notice.state),
          noticeEvidence: observation(notice.evidence, notice.state),
          holds: notice.holds.map((reason) => ({ owner, reason })),
          research: [],
        });
      addEdge(context, {
        from: row.key,
        to: key,
        kind: 'notice',
        reason: legal?.requiredNotices?.includes(book)
          ? `Original ${legal.path} requires ${book}.`
          : `Source metadata/governing mechanics require ${book}${book === 'PZO1131' ? ' (including actual Unchained action metadata)' : ''}.`,
        condition: null,
        evidence: [legal?.path ?? sourceBinding.locator],
      });
    }
  }
}

async function inventoryResources(context: Context, repoRoot: string) {
  for (const [name, locator, issue] of launchResourceInputs) {
    const hash = sourceHash(await readFile(join(repoRoot, locator)));
    const key = `resource/${name}`;
    context.rows.set(key, {
      key,
      catalogKey: null,
      kind: 'resource',
      name,
      requirement: 'required',
      sources: [
        {
          repository: 'everythingpath',
          pin: authority.baseline,
          locator,
          rawSha256: hash,
          effectiveSha256: hash,
        },
      ],
      ...resourceOwners({ name, locator, issue }),
      mechanisms: [
        {
          name: 'Immutable resource binding',
          disposition: 'recorded choice',
          status: 'reused',
          contract:
            'Reuse the existing resource seam; bind its actual source and resolved output into the launch release. Representative seed coverage never proves generic content or adapter completeness.',
          evidence: [
            'scripts/catalog/release-inputs.ts',
            'scripts/catalog/release-operator.ts',
          ],
        },
      ],
      admission: observation([
        'Existing resource implementation is preserved; scoped artifact qualification is pending.',
      ]),
      structure: observation(['scripts/catalog/release-operator.ts']),
      contentEvidence: observation([locator]),
      noticeEvidence: observation([
        'Required whole-body and notice chains remain separate.',
      ]),
      holds: [],
      research: [],
    });
    for (const edge of resourceEdges({ name, locator })) addEdge(context, edge);
  }
}

function retainSourceInventory(context: Context) {
  const citations = new Set(
    [...coreAudit.citations, ...advancedAudit.citations].map(
      ({ from, to }) => `${from}\0${to}`,
    ),
  );
  const auditedRoots = new Set(
    [...coreAudit.accounting, ...advancedAudit.accounting]
      .filter(
        ({ family }) =>
          family === 'core class inventory' ||
          family === 'race folder inventory' ||
          family === 'advanced class inventory',
      )
      .map(({ root }) => root),
  );
  const retained = context.pools.filter(
    ({ root, purpose }) => auditedRoots.has(root) && purpose !== 'eligibility',
  );
  const reasons = new Set(
    retained.map(
      ({ name }) =>
        `Complete ${name} inventory; alternatives must all remain available.`,
    ),
  );
  context.edges = context.edges.map((edge) =>
    (edge.kind !== 'citation' && citations.has(`${edge.from}\0${edge.to}`)) ||
    reasons.has(edge.reason) ||
    (auditedRoots.has(edge.from) &&
      edge.reason.startsWith('Raw first acquisition at '))
      ? {
          ...edge,
          kind: 'citation',
          condition:
            'Retained source metadata; exact printed contracts and reviewed schedules govern eligibility/acquisition.',
        }
      : edge,
  );
  const outgoing = new Map<string, string[]>();
  for (const edge of context.edges) {
    if (edge.kind === 'citation') continue;
    const targets = outgoing.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoing.set(edge.from, targets);
  }
  const reached = new Set(campaignMvpRoots.map(({ key }) => key));
  const queue = [...reached];
  for (const key of queue)
    for (const target of outgoing.get(key) ?? []) {
      if (reached.has(target)) continue;
      reached.add(target);
      queue.push(target);
    }
  for (const row of context.rows.values())
    row.requirement = reached.has(row.key) ? 'required' : 'optional';
}

function inventoryBatches(context: Context): LaunchManifest['batches'] {
  return authority.batches.map((batch) => ({
    ...batch,
    requiredKeys: batch.originalInventory.filter(
      (key) => context.rows.get(key)?.requirement === 'required',
    ),
    optionalKeys: batch.originalInventory.filter(
      (key) => context.rows.get(key)?.requirement === 'optional',
    ),
    remainderKeys: batch.originalInventory.filter(
      (key) => !context.rows.has(key),
    ),
  }));
}

export async function buildLaunchInventory({
  paths,
  repoRoot,
}: {
  paths: LaunchSourcePaths;
  repoRoot: string;
}): Promise<LaunchManifest> {
  const records = await readLaunchSourceRecords(paths);
  const context: Context = {
    paths,
    records,
    raw: new Map(records.map((record) => [sourceKey(record), record])),
    legal: await readLaunchLegalInventories(repoRoot),
    rows: new Map(),
    edges: [],
    edgeIds: new Set(),
    pools: [],
    research: [],
    ownerInventories: [],
  };
  for (const root of campaignMvpRoots) {
    if (root.key === exploitKey) continue;
    const source = context.raw.get(root.key);
    if (!source) throw new Error(`Missing pinned root ${root.key}.`);
    includeSource(context, source);
  }
  const checkpoints = await inventoryClasses(context);
  await inventoryExploiter(context, repoRoot);
  await inventorySupportingPools(context);
  await inventoryCompanions({
    paths,
    records,
    rows: context.rows,
    pools: context.pools,
    includeSource: (source) => includeSource(context, source),
    addEdge: (edge) => addEdge(context, edge),
  });
  inventoryRacialTraits(context);
  await inventoryCore({
    paths,
    repoRoot,
    rows: context.rows,
    pools: context.pools,
    includeKey: (key) => {
      const source = context.raw.get(key);
      return source ? includeSource(context, source) : context.rows.get(key);
    },
    addEdge: (edge) => addEdge(context, edge),
  });
  for (const pool of context.pools) {
    if (coreAudit.pools.some(({ id }) => id === pool.id)) continue;
    if (pool.name.includes('baseline spell-list metadata'))
      pool.purpose = 'metadata';
    if (pool.purpose === 'retained inventory')
      pool.selector = `Retained original source inventory, not a baseline eligibility certification. ${pool.selector} Source-bound semantic contracts and exact printed pools govern actual choices.`;
  }
  await inventoryAdvanced({
    paths,
    repoRoot,
    rows: context.rows,
    pools: context.pools,
    includeKey: (key) => {
      const source = context.raw.get(key);
      return source ? includeSource(context, source) : context.rows.get(key);
    },
    addEdge: (edge) => addEdge(context, edge),
  });
  expandContent(context);
  inventoryNotices(context);
  await inventoryResources(context, repoRoot);
  retainSourceInventory(context);
  const rows = [...context.rows.values()];
  return launchManifestSchema.parse({
    schemaVersion: 1,
    scopeVersion: 'campaign-mvp-v1',
    authoritySha256: launchInventoryHash(authority),
    roots: campaignMvpRoots,
    rows,
    edges: context.edges,
    pools: context.pools,
    companionPartitions: companionAudit.partitions,
    semanticContracts: [...coreAudit.contracts, ...advancedAudit.contracts],
    semanticContexts: coreAudit.contexts,
    sourceAccounting: [...coreAudit.accounting, ...advancedAudit.accounting],
    checkpoints,
    batches: inventoryBatches(context),
    ownerInventories: context.ownerInventories,
    coverage: [
      ...launchCoverage(rows),
      ...companionCoverage(),
      ...coreCoverage(),
      ...advancedCoverage(),
    ],
    research: context.research,
    party: {
      status: 'pending',
      owner: 'Campaign players; separate party qualification under #767',
      requiredInputs: [
        'Current and next-level classes/levels for each actual Character',
        'Bloodlines, exploits, talents and all saved feature choices',
        'Recorded/granted spells, feats, gear, ammunition and Item Abilities',
        'Companion species/progressions/forms/evolutions and allocations',
      ],
    },
  });
}
