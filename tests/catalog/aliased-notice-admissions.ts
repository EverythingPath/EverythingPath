/**
 * Confirmed launch rows a batch recorded as held only for a missing notice
 * that a reviewed Registry alias of 2026-11-12 supplies (party-admission-a:
 * PZO9413 and PZO9443), and the row that waited on one of them. Their
 * assessments now bind the reviewed notice, so a batch's assessment-path gate
 * admits them beside the rows it recorded as admitted.
 */
export const aliasedNoticeAdmissions: Readonly<Record<string, string>> = {
  'pf1/05i5rxwim12hwktu': "Bull's Strength (PZO9413)",
  'pf1/nnj51dwfkwd15ngj': 'Wish (PZO9443)',
  'pf1/ns8jbp0ilbvbvuif': "Cat's Grace (PZO9443)",
  'pf1/nznqmwpavfediten': 'Enter Image (PZO9443)',
  'pf1/xco22162bwgxn7pj': 'True Strike (PZO9443)',
  'pf1/xhzme0v6tjq95fg6': 'Meteor Swarm (PZO9413)',
  'pf1/xlch97n99ea0pog6': "Cat's Grace, Mass (waited on Cat's Grace)",
  'pf1/xmkvpl56appk20cl': 'Trap the Soul (PZO9443)',
  'pf1/xuuzj9lr2xbwaim4': 'Overwhelming Presence (PZO9443)',
};

/** A batch's recorded admitted keys with the aliased-notice admissions among `keys`. */
export const withAliasedNoticeAdmissions = (
  admitted: readonly string[],
  keys: readonly string[],
) =>
  [
    ...new Set([
      ...admitted,
      ...Object.keys(aliasedNoticeAdmissions).filter((key) =>
        keys.includes(key),
      ),
    ]),
  ].sort();
