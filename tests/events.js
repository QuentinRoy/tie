import test from "tape";
import Constraint from "../lib/constraint";

test("On change", assert => {
  let handlerCall = 0;
  let evaluation = 0;
  const a = new Constraint(0);
  const b = new Constraint(() => {
    evaluation += 1;
    return a.get() * a.get();
  });
  const handler = () => {
    handlerCall += 1;
    a.get();
  };
  b.onChange(handler, true);
  assert.equal(
    evaluation,
    1,
    "Constraint has been evaluated as the handler has check=true."
  );
  a.set(2);
  assert.equal(
    handlerCall,
    1,
    "Handler has been called after source has been re-set."
  );
  assert.equal(
    evaluation,
    2,
    "The constraint has been automatically re-evaluated."
  );
  a.set(4);
  assert.equal(
    handlerCall,
    2,
    "Handler has been called when source has been re-set again (even if the constraint has not" +
      " been explicitly fetched)."
  );
  b.get();
  assert.equal(
    evaluation,
    3,
    "The constraint has been automatically re-evaluated again."
  );
  a.set(-4);
  assert.equal(
    handlerCall,
    2,
    "Handler has not been called has the constraint value has not actually changed."
  );
  assert.equal(
    evaluation,
    4,
    "The constraint has been automatically re-evaluated again."
  );
  b.offChange(handler);
  b.get();
  a.set(8);
  assert.equal(
    handlerCall,
    2,
    "Handler has not been called as it has been removed from the listeners."
  );
  assert.end();
});

test("Multiple on change handlers", assert => {
  let calls = [];
  const a = new Constraint(0);
  const b = new Constraint(() => a.get() * a.get());
  b._debug = true;
  b.onChange(() => {
    calls.push(1);
  }, true);
  b.onChange(() => {
    calls.push(2);
  });
  b.onChange(() => {
    calls.push(3);
  }, true);
  a.set(2);
  assert.deepEqual(
    calls,
    [1, 2, 3],
    "All handlers are called in the proper order following a constraint's value change."
  );
  calls = [];
  a.set(-2); // b = a*a so it did not actually change
  assert.deepEqual(
    calls,
    [],
    "No handler is called following when a constraint has been updated but did not changed."
  );
  assert.end();
});

test("Diamond with on change handler", assert => {
  const src = new Constraint("");
  const len = new Constraint(() => src.get().length);
  const o = new Constraint(() => src.get().indexOf("o") >= 0);
  const final = new Constraint(
    () => `value: ${src.get()}, length: ${len.get()}, contains o: ${o.get()}`
  );
  let called = 0;
  final.onChange(() => {
    called += 1;
  });
  src.set("hello");
  assert.equal(called, 1, "On change handler has been called only once.");
  src.set("bye");
  assert.equal(
    called,
    2,
    "On change handler has been called only once (again)."
  );
  assert.end();
});

test("Events are sent once all dependent constraints has been notified", assert => {
  const src = new Constraint(0);
  const dep = src.add(5);
  let handlerDepVal;
  src.onChange(() => {
    handlerDepVal = dep.get();
  });
  // update dep
  dep.get();
  // invalid it by changing the source, handlerDepVal will be updated
  src.set(20);
  assert.equal(
    handlerDepVal,
    25,
    "All constraints are up to date when the events are processed."
  );
  assert.end();
});
