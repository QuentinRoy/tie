import test from "tape";
import tie from "../lib";

test("Module content", (assert) => {
    const expectedContent = ["Constraint", "Liven", "liven"];
    const content = Object.keys(tie);
    expectedContent.forEach((k) => {
        assert.notOk(content.indexOf(k) < 0,
            `${k} is integrated.`
        )
    });
    content.filter(k => expectedContent.indexOf(k) < 0).forEach((k) => {
        assert.fail(`${k} is not supposed to be integrated.`);
    });
    assert.end();
});

test("Constraint ties", (assert) => {
	var x = tie(2);
    assert.equal(x.get(), 2,
        "A constraint is equal to set value.");
	var y = tie(() => 3);
    assert.equal(y.get(), 3,
        "A constraint value can be set with a function.");
	var z = tie(() => x.get() * y.get());
	assert.equal(z.get(), 6,
		"Constraint value can be calculated from other constraints.");
	x.set(10);
	assert.equal(x.get(), 10,
		"Constraint can be reset.");
	assert.equal(z.get(), 30,
		"Dependent constraints are updated when dependencies' value change.");

	assert.end();
});

test("Constraint set to constraint", (assert) => {
	var x = tie('x');
	var y = tie('y');
	var z = tie(x);

	assert.equal(z.get(), 'x',
		"Constraint set to a constraint get its value."
	)
	z.set('z');
	assert.equal(z.get(), 'z',
		"It can be reset..."
	);
	assert.equal(x.get(), 'x',
		"...without changing the set constraint value."
	);
	z.set(y);
	assert.equal(z.get(), 'y',
		"It can be reset to a new constraint and will take its value."
	);

	assert.end();
});

test("Evaluations and dependency updates", (assert) => {
	let xUpdates = 0;
	let condUpdates = 0;
	const det = tie(true);
	const xSource = tie('a');
	const x = tie(() => {
		xUpdates++;
		return xSource.get();
	});
	const cond = tie(() => {
		condUpdates++;
		if(det.get()){
            // Call it itentionally twice to make sure
            // the dep is added only once
			return x.get() + x.get();
		} else {
			return '';
		}
	});
	assert.equal(xUpdates, 0,
		"A constraint is not evaluated uncessary."
	)
	assert.equal(cond.get(), "aa",
		"Constraint value ok.");
	assert.equal(xUpdates, 1,
		"Dependencies are evaluated when a constraint is get."
	);
	assert.equal(condUpdates, 1,
		"A constraint is evaluated when get."
	);
	xSource.set("b");
	assert.equal(cond.get(), "bb",
		"Constraint value ok after source reset.");
	assert.equal(xUpdates, 2,
		"Source has been re-evaluated."
	);
	assert.equal(condUpdates, 2,
		"Constraint has been re-evaluated."
	);
	det.set(false);
	assert.equal(cond.get(), "",
		"Constraint value ok after source isn't a dependency anymore."
	);
	assert.equal(xUpdates, 2,
		"Source has not been re-evaluated."
	);
	assert.equal(condUpdates, 3,
		"Constraint has been re-evaluated."
	);
	xSource.set('c');
	assert.equal(cond.get(), '',
		"Constraint does not change anymore when source is reset."
	);
	assert.equal(xUpdates, 2,
		"Source has not been re-evaluated while constraint has been requested."
	);
	assert.equal(condUpdates, 3,
		"Constraint has not been re-evaluated after being requested."
	);
	det.set(true);
	assert.equal(cond.get(), 'cc',
		"Constraint is now dependent of source again."
	);
	assert.equal(condUpdates, 4,
		"It has been re-evaluated after bein requested."
	);
	assert.equal(xUpdates, 3,
		"Source too."
	);

	assert.end();
});

test("Avoid update when parent are invalidated but did not change", (assert) => {
	let zn = 0;
	let yn = 0;
	const x = tie("a");
	const y = tie(() => {
		yn++;
		return x.get().length;
	});
	const z = tie(() => {
		zn++;
		return "length: " + y.get();
	});
	z.get();
	x.set("b");
	z.get();
	assert.equal(y.get(), 1,
		"Parent's value has not changed."
	)
	assert.equal(yn, 2,
		"Constraint's parent has been re-evaluated."
	);
	assert.equal(zn, 1,
		"Constraint has not as its parent's value did not actually change."
	);
	x.set("ab");
	assert.equal(y.get(), 2,
		"Value of constraint's parent has changed."
	);
	assert.equal(yn, 3,
		"Constraint's parent has been re-evaluated."
	);
	const lastZn = zn;
	z.get();
	assert.equal(zn, lastZn + 1,
		"Constraint is re-evaluated."
	)
	assert.end();
});

test("Cycles", (assert) => {
	const x = tie(() => x.get() || 0 + 1);
    assert.plan(6);
	assert.doesNotThrow(x.get.bind(x),
		"Self referring constraint does not create infinite loop..."
	);
    assert.equal(x.get(), 1,
        "...and has the expected value."
    )
	const y = tie(2);
	y.get();
	y.set(() => y.get() * 2)
	assert.equal(y.get(), 4,
		"Self referring constraint return the cached value when recursively called."
	);
    // This part is still under reflection.
    // One other approach may be to allow self-invalidating evaluation (i.e. y below will always being invalid).
    // However, such constraint will create an infinite loop if a liven makes use of it.
    assert.equal(y.get(), 4,
        "Self referring constraint are validated and (so are not re-evaluated at each call)."
    );
    const a = tie(1);
    const b = tie(() => {
        const aValue = a.get();
        return aValue;
    });
    const c = tie(() => b.get());
    const d = tie(() => {
        const aValue = a.get();
        assert.equal(aValue, 1,
            "The same constraint has the same value during the whole cycle evaluation."
        );
    });
    a.get();
    a.set(() => c.get() + d.get());
    assert.doesNotThrow(() => a.get(),
        "Cyclic constraints does not create infinite loop."
    );
	assert.end();
});

test("On may have changed", (assert) => {
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
    b.onMayHaveChanged(handler);

    assert.equal(evaluation, 1,
        "Constraint has been evaluated for the first time."
    )
    a.set(2)
    assert.equal(handlerCall, 1,
        "Handler has been called after source has been re-set."
    )
    assert.equal(evaluation, 1,
        "The constraint has not been re-evaluated without beeing asked."
    )
    a.set(4);
    assert.equal(handlerCall, 2,
        "Handler has been called when source has been re-set (even if it was not fetch since last call)."
    )
    b.get();
    assert.equal(evaluation, 2,
        "The constraint has been re-evaluated."
    )
    a.set(-4);
    assert.equal(handlerCall, 3,
        "Handler has been called even if its value has not actually changed."
    )
    assert.equal(evaluation, 2,
        "The constraint has not been re-evaluated without beeing asked."
    )
    b.offMayHaveChanged(handler);
    b.get();
    a.set(8);
    assert.equal(handlerCall, 3,
        "Handler has not been called as it has been removed from the listeners."
    )
    assert.end();
});

test("On may have changed with check=true", (assert) => {
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
    b.onMayHaveChanged(handler, true);
    assert.equal(evaluation, 1,
        "Constraint has been evaluated as the handler has check=true."
    )
    a.set(2)
    assert.equal(handlerCall, 1,
        "Handler has been called after source has been re-set."
    )
    assert.equal(evaluation, 2,
        "The constraint has been automatically re-evaluated."
    )
    a.set(4);
    assert.equal(handlerCall, 2,
        "Handler has been called when source has been re-set again (even if the contraint has not been explecitly fetched)."
    )
    b.get();
    assert.equal(evaluation, 3,
        "The constraint has been automatically re-evaluated again."
    )
    a.set(-4);
    assert.equal(handlerCall, 2,
        "Handler has not been called has the constraint value has not actually changed."
    )
    assert.equal(evaluation, 4,
        "The constraint has been automatically re-evaluated again."
    )
    b.offMayHaveChanged(handler);
    b.get();
    a.set(8);
    assert.equal(handlerCall, 2,
        "Handler has not been called as it has been removed from the listeners."
    )
    assert.end();
});

test("Multiple on may have changed handlers", (assert) => {
    let calls = [];
    const a = tie(0);
    const b = tie(() => a.get() * a.get());
    b._debug = true;
    b.onMayHaveChanged(() => {
        calls.push('no check 1');
        b.get();
    });
    b.onMayHaveChanged(() => {
        calls.push('check 1')
    }, true);
    b.onMayHaveChanged(() => {
        calls.push('no check 2');
    });
    b.onMayHaveChanged(() => {
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
    )
    a.set('d');
    assert.equal(called, 2,
        "Liven is called when one of its dependency changes."
    )
    b.set('u');
    assert.equal(called, 2,
        "Liven is not called when one of its dependency is re-evaluated but did not change."
    )
    liven.call();
    assert.equal(called, 3,
        "Liven can be manually called."
    )
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

test("Losange with on may have changed handler", (assert) => {
    const src = tie('');
    const len = tie(() => src.get().length);
    const o = tie(() => src.get().indexOf('o') >= 0);
    const final = tie(
        () => 'value: ' + src.get() + ', length: ' + len.get() + ', contains o: ' + o.get()
    );
    let called = 0;
    final.onMayHaveChanged(() => {
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
