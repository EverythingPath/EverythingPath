import { z } from 'zod';

/**
 * A stable catalog key: a Foundry record (`pf1/<id>`, `pf1-content/<id>`) or a
 * #716 identity, `everythingpath/<id>` with a lowercase hyphenated id such as
 * `everythingpath/ranger-beast-master`. Never a source path or URL. Its own
 * module, so a reader that needs only the key (the #227 gate's reviewed PCGen
 * records) loads no entry schema.
 */
export const catalogKeySchema = z
  .string()
  .regex(
    /^(?:(?:pf1|pf1-content)\/[A-Za-z0-9]+|everythingpath\/[a-z0-9]+(?:-[a-z0-9]+)*)$/,
  );
