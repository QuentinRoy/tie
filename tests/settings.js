import test from "tape";
import deepEqual from "deep-equal";
import Constraint from "../lib/constraint";

test("Equals setting", assert => {
  let changed = 0;
  const stdCon = new Constraint({});
  stdCon.onChange(() => {
    changed += 1;
  }, true);
  stdCon.set({});
  assert.equals(changed, 1, "Default equality check uses strict equality...");
  stdCon.set("1");
  stdCon.set("1");
  stdCon.set(1);
  stdCon.set(1);
  assert.equals(
    changed,
    3,
    "...And notifies it listeners each time a different value is set."
  );

  changed = 0;
  // eslint-disable-next-line eqeqeq
  const looseCon = new Constraint("4", { equals: (a, b) => a == b });
  looseCon.onChange(() => {
    changed += 1;
  }, true);
  looseCon.set(4);
  assert.equals(
    changed,
    0,
    "Equality check can be redefined (e.g. with a strict coercive equality..."
  );

  changed = 0;
  const deepCon = new Constraint(
    { 4: "4 val", prop: "prop val", a: [7, 9, 10] },
    { equals: deepEqual }
  );
  deepCon.onChange(() => {
    changed += 1;
  }, true);
  deepCon.set({ 4: "4 val", prop: "prop val", a: [7, 9, 10] });
  assert.equals(changed, 0, "... or with a strict deep equal).");

  assert.end();
});

test("Read-Only", assert => {
  const src = new Constraint("value");
  const roc = new Constraint(src, { readOnly: true });
  assert.equals(
    roc.get(),
    "value",
    "Read-only constraints get the proper value."
  );
  assert.throws(() => roc.set(8), "Read-only constraints cannot be set.");
  src.set("other value");
  assert.equals(
    roc.get(),
    "other value",
    "Read-only constraints are properly updated."
  );
  assert.notOk(
    src.readOnly,
    "readOnly getter is false for writable constraints."
  );
  assert.ok(roc.readOnly, "readOnly getter is true for read-only constraints.");
  assert.end();
});

test("Un-Untieable", assert => {
  const src = new Constraint("value");
  const udc = new Constraint(src, { untieable: false });
  assert.equals(
    udc.get(),
    "value",
    "Undetachable constraints get the proper value."
  );
  assert.throws(
    () => udc.untie(),
    "Undetachable constraints cannot be detached."
  );
  assert.ok(
    src.untieable,
    "Per default, constraint are untieable and their untieable getter is true."
  );
  assert.notOk(
    udc.untieable,
    "untieable getter is false for undetachable constraints."
  );
  src.untie();
  assert.equals(
    src.get(),
    undefined,
    "Per default, constraint can be detached"
  );
  assert.end();
});

test("View", assert => {
  const src = new Constraint("value");
  const view = src.view();
  assert.equals(view.get(), "value", "Views get their source's value.");
  assert.ok(view.readOnly, "View's read-only getter is properly set.");
  assert.notOk(view.untieable, "View's untieable getter is properly set.");
  assert.throws(() => view.set(8), "Views cannot be set.");
  assert.throws(() => view.untie(), "Views cannot be detached.");
  assert.end();
});

test("Default for constraint set to a function", assert => {
  const funcConstraint = new Constraint(() => 6);
  assert.ok(
    funcConstraint.readOnly,
    "Constraints set to a function are read-only per default."
  );
  assert.throws(
    () => funcConstraint.set(9),
    "They cannot be set (per default)."
  );
  const settableFuncConstraint = new Constraint(() => 9, { readOnly: false });
  assert.notOk(
    settableFuncConstraint.readOnly,
    "It is possible to overwrite the default read-only settings."
  );
  settableFuncConstraint.set(10);
  assert.equals(
    settableFuncConstraint.get(),
    10,
    "So that a constraint set to a function can be overwritten."
  );
  assert.end();
});

test("Default for constraint set to another constraint", assert => {
  const src = new Constraint(8);
  const consCons = new Constraint(src);
  assert.ok(
    consCons.readOnly,
    "Constraints set to a function are read-only per default."
  );
  assert.throws(() => consCons.set(9), "They cannot be set (per default).");
  const settableConsCons = new Constraint(() => 9, { readOnly: false });
  assert.notOk(
    settableConsCons.readOnly,
    "It is possible to overwrite the default read-only settings."
  );
  settableConsCons.set(10);
  assert.equals(
    settableConsCons.get(),
    10,
    "So that a constraint set to a function can be overwritten."
  );
  assert.end();
});

test("Default for constraint set to anything else", assert => {
  const strConstraint = new Constraint("value");
  assert.notOk(
    strConstraint.readOnly,
    "Constraints set to a string, an object, a number or null are writable per default."
  );
  assert.doesNotThrow(
    () => strConstraint.set("value"),
    "They can be overwritten (per default)."
  );
  assert.equals(
    strConstraint.get(),
    "value",
    "And will get the newly set value."
  );

  const objConstraint = new Constraint({ prop: "prop" });
  assert.notOk(
    objConstraint.readOnly,
    "Constraints set to a string, an object, a number or null are writable per default."
  );
  assert.doesNotThrow(
    () => objConstraint.set("value"),
    "They can be overwritten (per default)."
  );
  assert.equals(
    objConstraint.get(),
    "value",
    "And will get the newly set value."
  );

  const numberConstraint = new Constraint(10);
  assert.notOk(
    numberConstraint.readOnly,
    "Constraints set to a string, an object, a number or null are writable per default."
  );
  assert.doesNotThrow(
    () => numberConstraint.set("value"),
    "They can be overwritten (per default)."
  );
  assert.equals(
    numberConstraint.get(),
    "value",
    "And will get the newly set value."
  );

  const nullConstraint = new Constraint(null);
  assert.notOk(
    nullConstraint.readOnly,
    "Constraints set to a string, an object, a number or null are writable per default."
  );
  assert.doesNotThrow(
    () => nullConstraint.set("value"),
    "They can be overwritten (per default)."
  );
  assert.equals(
    nullConstraint.get(),
    "value",
    "And will get the newly set value."
  );

  assert.end();
});
