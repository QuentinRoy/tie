import test from "tape";
import tie from "../lib";

test("Module content", (assert) => {
    const expectedContent = ["Constraint", "liven"];
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
			return x.get();
		} else {
			return '';
		}
	});
	assert.equal(xUpdates, 0,
		"A constraint is not evaluated uncessary."
	)
	assert.equal(cond.get(), "a",
		"Constraint value ok.");
	assert.equal(xUpdates, 1,
		"Dependencies are evaluated when a constraint is get."
	);
	assert.equal(condUpdates, 1,
		"A constraint is evaluated when get."
	);
	xSource.set("b");
	assert.equal(cond.get(), "b",
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
	assert.equal(cond.get(), 'c',
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
	const x = tie(0);
	const y = tie(() => {
		yn++;
		return x.get() == 3;
	});
	const z = tie(() => {
		zn++;
		return y.get() ? "ok": "not ok";
	});
	z.get();
	x.set(2);
	z.get();
	assert.equal(y.get(), false,
		"Parent's value has not changed."
	)
	assert.equal(yn, 2,
		"Constraint's parent has been re-evaluated."
	);
	assert.equal(zn, 1,
		"Constraint has not as its parent's value did not actually change."
	);
	x.set(3);
	assert.equal(y.get(), true,
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
