import { ARC1_EVENTS } from './events/arc1.js';
import { SPRING_EVENTS } from './events/spring.js';

export const EVENTS = Object.fromEntries([...ARC1_EVENTS, ...SPRING_EVENTS].map((e) => [e.id, e]));
export { CHARGES } from './charges.js';
export { FACTS } from './facts.js';
export { SOURCES } from './sources.js';
