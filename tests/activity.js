import test from "tape";
import Constraint from "../lib/constraint";
import Activity from "../lib/activity";

test("Activity", assert => {
  const a = new Constraint("a");
  const b = new Constraint("c");
  const l = new Constraint(() => b.get().length);
  let called = 0;
  const liven = new Activity(() => {
    a.get();
    l.get();
    called += 1;
  });
  assert.equal(called, 1, "Activities are called when created.");
  a.set("d");
  assert.equal(
    called,
    2,
    "Activities are called when one of its dependency changes."
  );
  b.set("u");
  assert.equal(
    called,
    2,
    "Activities are not called when one of their dependencies is re-evaluated but did not " +
      "change."
  );
  liven.call();
  assert.equal(called, 3, "Activities can be manually called.");
  liven.stop();
  a.set("u");
  assert.equal(
    called,
    3,
    "Activities can be stopped and are not called anymore on change."
  );
  liven.resume();
  assert.equal(
    called,
    4,
    "Activities can be resumed and will be automatically called then."
  );

  assert.end();
});

test("Diamond with activities", assert => {
  const src = new Constraint("");
  const len = new Constraint(() => src.get().length);
  const o = new Constraint(() => src.get().indexOf("o") >= 0);
  const final = new Constraint(
    () => `value: ${src.get()}, length: ${len.get()}, contains o: ${o.get()}`
  );
  let called = 0;
  // eslint-disable-next-line no-new
  new Activity(() => {
    final.get();
    called += 1;
  });
  src.set("hello");
  assert.equal(called, 2, "Liven has been updated only once.");
  src.set("bye");
  assert.equal(called, 3, "Liven has been updated only once (again).");
  assert.end();
});
