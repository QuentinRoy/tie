import Liven from './liven';
import Constraint from './constraint';

export default function constraint(...args){ return new Constraint(...args); }
export function liven(...args){ return new Liven(...args); }

export { Constraint, Liven };
