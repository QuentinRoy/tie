import Constraint from "./constraint";

export default function liven(f) {
    new Constraint(f).onMayHaveChanged(function(){}, true);
}
