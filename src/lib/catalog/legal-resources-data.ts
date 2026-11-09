import { legalResourcesSchema } from './legal-types.ts';
import resourcesData from './data/resources.json';

export const legalResources = legalResourcesSchema.parse(resourcesData);
