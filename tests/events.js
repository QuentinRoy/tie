import test from "tape";
import tie from "../lib";

test("On change", (assert) => {
    let handlerCall = 0;
    let evaluation = 0;
    const a = tie(0);
    const b = tie(() => {
        evaluation++;
        return a.get() * a.get();
    });
    const handler = () => {
        handlerCall++;
        a.get();
    };
    b.onChange(handler, true);
    assert.equal(evaluation, 1,
        "Constraint has been evaluated as the handler has check=true."
    );
    a.set(2);
    assert.equal(handlerCall, 1,
        "Handler has been called after source has been re-set."
    );
    assert.equal(evaluation, 2,
        "The constraint has been automatically re-evaluated."
    );
    a.set(4);
    assert.equal(handlerCall, 2,
        "Handler has been called when source has been re-set again (even if the contraint has not" +
        " been explicitly fetched)."
    );
    b.get();
    assert.equal(evaluation, 3,
        "The constraint has been automatically re-evaluated again."
    );
    a.set(-4);
    assert.equal(handlerCall, 2,
        "Handler has not been called has the constraint value has not actually changed."
    );
    assert.equal(evaluation, 4,
        "The constraint has been automatically re-evaluated again."
    );
    b.offChange(handler);
    b.get();
    a.set(8);
    assert.equal(handlerCall, 2,
        "Handler has not been called as it has been removed from the listeners."
    );
    assert.end();
});

test("Multiple on change handlers", (assert) => {
    let calls = [];
    const a = tie(0);
    const b = tie(() => a.get() * a.get());
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
    assert.deepEqual(calls, [1, 2, 3],
        "All handlers are called in the proper order following a constraint's value change."
    );
    calls = [];
    a.set(-2); // b = a*a so it did not actually change
    assert.deepEqual(calls, [],
        "No handler is called following when a constrait has been updated but did not changed."
    );
    assert.end();
});

test("Activity", (assert) => {
    const a = tie('a');
    const b = tie('c');
    const l = tie(() => b.get().length);
    let called = 0;
    const liven = tie.liven(() => {
        a.get();
        l.get();
        called++;
    });
    assert.equal(called, 1,
        "Activities are called when created."
    );
    a.set('d');
    assert.equal(called, 2,
        "Activities are called when one of its dependency changes."
    );
    b.set('u');
    assert.equal(called, 2,
        "Activities are not called when one of their dependencies is re-evaluated but did not " +
        "change."
    );
    liven.call();
    assert.equal(called, 3,
        "Activities can be manually called."
    );
    liven.stop();
    a.set('u');
    assert.equal(called, 3,
        "Activites can be stopped and are not called anymore on change."
    );
    liven.resume();
    assert.equal(called, 4,
        "Activities can be resumed and will be automatically called then."
    );

    assert.end();
});

test("Losange with on change handler", (assert) => {
    const src = tie('');
    const len = tie(() => src.get().length);
    const o = tie(() => src.get().indexOf('o') >= 0);
    const final = tie(
        () => 'value: ' + src.get() + ', length: ' + len.get() + ', contains o: ' + o.get()
    );
    let called = 0;
    final.onChange(() => {
        called++;
    });
    src.set('hello');
    assert.equal(called, 1,
        "On change handler has been called only once.");
    src.set('bye');
    assert.equal(called, 2,
        "On change handler has been called only once (again).");
    assert.end();
});

test("Diamond with activities", (assert) => {
    const src = tie('');
    const len = tie(() => src.get().length);
    const o = tie(() => src.get().indexOf('o') >= 0);
    const final = tie(
        () => 'value: ' + src.get() + ', length: ' + len.get() + ', contains o: ' + o.get()
    );
    let called = 0;
    tie.liven(() => {
        final.get();
        called++;
    });
    src.set('hello');
    assert.equal(called, 2,
        "Liven has been updated only once.");
    src.set('bye');
    assert.equal(called, 3,
        "Liven has been updated only once (again).");
    assert.end();
});

test("Events are sent once all dependent constraints has been notified", (assert) => {
    const src = tie(0);
    const dep = src.add(5);
    let handlerDepVal;
    src.onChange(() => {
        handlerDepVal = dep.get();
    });
    // update dep
    dep.get();
    // invalid it by changing the source, handlerDepVal will be updated
    src.set(20);
    assert.equal(handlerDepVal, 25,
        "All constraints are up to date when the events are processed."
    );
    assert.end();
});

