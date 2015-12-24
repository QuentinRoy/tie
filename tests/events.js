import test from "tape";
import tie from "../lib";


test("On unsettled", (assert) => {
    let handlerCall = 0;
    let evaluation = 0;
    const a = tie(0);
    const abis = tie(() => a.get() * a.get());
    const b = tie(() => {
        evaluation++;
        return abis.get() + 1;
    });
    const handler = () => {
        handlerCall++
        a.get();
    };
    b.onUnsettled(handler);

    assert.equal(evaluation, 1,
        "Constraint has been evaluated for the first time."
    );
    a.set(2)
    assert.equal(handlerCall, 1,
        "Handler has been called after source has been re-set."
    );
    assert.equal(evaluation, 1,
        "The constraint has not been re-evaluated without beeing asked."
    );
    a.set(4);
    assert.equal(handlerCall, 2,
        "Handler has been called when source has been re-set (even if it was not fetch since last call)."
    );
    b.get();
    assert.equal(evaluation, 2,
        "The constraint has been re-evaluated."
    );
    a.set(-4);
    assert.equal(handlerCall, 3,
        "Handler has been called even if its value has not actually changed."
    );
    assert.equal(evaluation, 2,
        "The constraint has not been re-evaluated without beeing asked."
    );
    b.offUnsettled(handler);
    b.get();
    a.set(8);
    assert.equal(handlerCall, 3,
        "Handler has not been called as it has been removed from the listeners."
    );
    assert.end();
});

test("On unsettled with check=true", (assert) => {
    let handlerCall = 0;
    let evaluation = 0;
    const a = tie(0);
    const b = tie(() => {
        evaluation++;
        return a.get() * a.get()
    });
    const handler = () => {
        handlerCall++
        a.get();
    };
    b.onUnsettled(handler, true);
    assert.equal(evaluation, 1,
        "Constraint has been evaluated as the handler has check=true."
    );
    a.set(2)
    assert.equal(handlerCall, 1,
        "Handler has been called after source has been re-set."
    );
    assert.equal(evaluation, 2,
        "The constraint has been automatically re-evaluated."
    );
    a.set(4);
    assert.equal(handlerCall, 2,
        "Handler has been called when source has been re-set again (even if the contraint has not been explecitly fetched)."
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
    b.offUnsettled(handler);
    b.get();
    a.set(8);
    assert.equal(handlerCall, 2,
        "Handler has not been called as it has been removed from the listeners."
    );
    assert.end();
});

test("Multiple on unsettled handlers", (assert) => {
    let calls = [];
    const a = tie(0);
    const b = tie(() => a.get() * a.get());
    b._debug = true;
    b.onUnsettled(() => {
        calls.push('no check 1');
        b.get();
    });
    b.onUnsettled(() => {
        calls.push('check 1')
    }, true);
    b.onUnsettled(() => {
        calls.push('no check 2');
    });
    b.onUnsettled(() => {
        calls.push('check 2');
    }, true);
    a.set(2);
    assert.deepEqual(calls, ['no check 1', 'check 1', 'no check 2', 'check 2'],
        "All handlers are called in the proper order following a constraint's value change."
    );
    calls = [];
    a.set(-2); // b = a*a so it did not actually change
    assert.deepEqual(calls, ['no check 1', 'no check 2'],
        "Handlers that does not check are still called following a \"false change alert\"."
    );
    assert.end();
});

test("Liven", (assert) => {
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
        "Liven is called when created."
    );
    a.set('d');
    assert.equal(called, 2,
        "Liven is called when one of its dependency changes."
    );
    b.set('u');
    assert.equal(called, 2,
        "Liven is not called when one of its dependency is re-evaluated but did not change."
    );
    liven.call();
    assert.equal(called, 3,
        "Liven can be manually called."
    );
    liven.stop();
    a.set('u');
    assert.equal(called, 3,
        "Liven can be stopped and are not called anymore on change."
    );
    liven.resume();
    assert.equal(called, 4,
        "Liven can be resumed and will be automatically called then."
    );

    assert.end();
});

test("Losange with on unsettled handler", (assert) => {
    const src = tie('');
    const len = tie(() => src.get().length);
    const o = tie(() => src.get().indexOf('o') >= 0);
    const final = tie(
        () => 'value: ' + src.get() + ', length: ' + len.get() + ', contains o: ' + o.get()
    );
    let called = 0;
    final.onUnsettled(() => {
        called++;
    });
    src.set('hello');
    assert.equal(called, 1,
        "On unsettled handler has been called only once.");
    src.set('bye');
    assert.equal(called, 2,
        "On unsettled handler has been called only once (again).");
    assert.end();
});

test("Losange with liven", (assert) => {
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
    src.onUnsettled(() => {
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

