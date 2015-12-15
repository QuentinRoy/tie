import Liven from './liven';
import Constraint from './constraint';
import { bindStyle, bindClass } from './bindings';

export default function tie(...args){ return new Constraint(...args); }
export function liven(...args){ return new Liven(...args); }

export { Constraint, Liven, bindStyle, bindClass};

// shortcuts to static operators
const { hypot, max, min, sum, product, atan2 } = Constraint;
export { hypot, max, min, sum, product, atan2 };
