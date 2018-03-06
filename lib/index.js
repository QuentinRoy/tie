import Activity from "./activity";
import Constraint from "./constraint";
import { bindStyle, bindClass } from "./bindings";

export default function tie(...args) {
  return new Constraint(...args);
}

export function liven(...args) {
  return new Activity(...args);
}
export { Constraint, Activity, bindStyle, bindClass };
// shortcuts to static operators
const { hypot, max, min, sum, product, atan2 } = Constraint;
export { hypot, max, min, sum, product, atan2 };

// Also patches tie with all named export for UMD consumer.
Object.assign(tie, {
  liven,
  Constraint,
  Activity,
  bindStyle,
  bindClass,
  hypot,
  max,
  min,
  sum,
  product,
  atan2
});
