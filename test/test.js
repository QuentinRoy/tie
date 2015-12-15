import test from "tape";
import tie from "../lib";

test("Module content", (assert) => {
    const expectedContent = ["Constraint", "Liven", "liven", "bindStyle", "bindClass"];
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

test("Constraint Modifiers", (assert) => {

    assert.test("Alter", (assert) => {
        const a = tie(5);
        const b = a.alter(x => x + 4);
        assert.equal(b.get(), 9,
            "Simple alter has the proper value."
        );
        a.set(6);
        assert.equal(b.get(), 10,
            "It is updated when the source constraint changes."
        );
        const c = tie(1);
        const d = b.alter(x => x + c.get());
        assert.equal(d.get(), 11,
            "Alter works if the alter body fetches another constraint."
        );
        c.set(2);
        assert.equal(d.get(), 12,
            "It is updated if this other constraint changes."
        );
        a.set(0);
        assert.equal(d.get(), 6,
            "And continues to be updated if the source constraint changes."
        );
        assert.end();
    });

    assert.test("IfElse", (assert) => {
        const a = tie('a');
        const b = tie('b');
        const cond = tie(false);
        const res = cond.ifElse(a, b);
        assert.equal(res.get(), 'b',
            "IfElse constriant gets the proper value."
        );
        cond.set(true);
        assert.equal(res.get(), 'a',
            "It is updated when the conditional constraint changes."
        );
        a.set('a2')
        assert.equal(res.get(), 'a2',
            "It is updated when the \"result\" constraint on which it depends changes."
        );
        let called = false;
        res.onMayHaveChanged(() => {
            called = true;
        });
        b.set('b3');
        res.get();
        assert.notOk(called,
            "It is not updated if the \"result\" on which it does not depends change."
        );
        assert.end();
    });

    assert.test("Parse Numbers", (assert) => {
        const a = tie("3");
        const b = tie("3.6");
        const c = tie("3.1px");
        const af = a.parseFloat();
        const bf = b.parseFloat();
        const cf = c.parseFloat();
        const ai = a.parseInt();
        const bi = b.parseInt();
        const ci = c.parseInt();

        assert.equal(af.get(), 3.0,
            "parseFloat is working for integer strings."
        );
        assert.equal(ai.get(), 3,
            "parseInt is working for integer strings."
        );
        a.set("7");
        assert.equal(af.get(), 7.0,
            "parseFloat is properly updated for integer strings."
        );
        assert.equal(ai.get(), 7,
            "parseInt is properly updated for integer strings."
        );

        assert.equal(bf.get(), 3.6,
            "parseFloat is working for float strings."
        );
        assert.equal(bi.get(), 3,
            "parseInt is working for float strings."
        );
        b.set("49.1020");
        assert.equal(bf.get(), 49.102,
            "parseFloat is properly updated for float strings."
        );
        assert.equal(bi.get(), 49,
            "parseInt is properly updated for float strings."
        );

        assert.equal(cf.get(), 3.1,
            "parseFloat is working for float strings with letters."
        );
        assert.equal(ci.get(), 3,
            "parseInt is working for float strings with letters."
        );
        c.set("32.100001 tie tie tie");
        assert.equal(cf.get(), 32.100001,
            "parseFloat is properly updated for float strings with letters."
        );
        assert.equal(ci.get(), 32,
            "parseInt is properly updated for float strings with letters."
        );
        assert.end();
    });

    assert.test("Prop", (assert) => {
        const a = tie({
            p1: 'p1-val',
            p2: {
                p21: 'p21-val',
                p22: 'p22-val'
            },
            p3: 'p3-val'
        });

        const b = a.prop('p1');
        assert.equal(b.get(), 'p1-val',
            "Simple prop modifier gets the proper value."
        );

        const prop = tie('p1');
        const c = a.prop(prop);
        assert.equal(c.get(), 'p1-val',
            "Prop can be defined by a constraint."
        );
        prop.set('p3');
        assert.equal(c.get(), 'p3-val',
            "It is updated when this constraint changes."
        );

        assert.equal(a.prop('p2', 'p21').get(), 'p21-val',
            "Multi-level prop works."
        );

        const subPropNum = tie(1);
        const subPropName = tie(() => 'p2' + subPropNum.get());
        const d = a.prop('p2', subPropName);
        assert.equal(d.get(), 'p21-val',
            "Multi-level prop modifier with one level depending of a constraint works."
        );
        subPropNum.set(2);
        assert.equal(d.get(), 'p22-val',
            "It is updated if this constraint changes."
        );
        assert.end();
    });

    assert.test("Other operators that can be applied multiple times.", (assert) => {
        const a = tie(8);
        const b = tie(13);
        const c = tie(0.5);

        const add = a.add(b, c, 1);
        assert.equal(add.get(), 8 + 13 + 0.5 + 1, "Add gets the correct value..." );
        a.set(5); b.set(10)
        assert.equal(add.get(), 5 + 10 + 0.5 + 1, "...And is properly updated." );

        const sub = a.sub(b, c, -5);
        assert.equal(sub.get(), 5 - 10 - 0.5 + 5, "Sub gets the correct value...");
        a.set(7); b.set(-14);
        assert.equal(sub.get(), 7 + 14 - 0.5 + 5, "...And is properly updated.");

        const mul = a.mul(b, c, 3);
        assert.equal(mul.get(), 7 * (-14) * 0.5 * 3, "Mul gets the correct value...");
        b.set(2.6); c.set(0.8);
        assert.equal(mul.get(), 7 * 2.6 * 0.8 * 3, "...And is properly updated.");

        const div = b.div(c, a, 2);
        assert.equal(div.get(), 2.6 / 0.8 / 7 / 2, "Div gets the correct value...");
        c.set(4); a.set(1);
        assert.equal(div.get(), 2.6 / 4 / 1 / 2, "...And is properly updated.");

        assert.end();
    });

    assert.test("Math", (assert) => {
        const x = tie(0.2);
        ["abs","acos","asin","asinh","atan","atanh","cbrt","ceil","clz32",
         "cos","cosh","exp","expm1","floor","fround","imul","log","log10","log1p",
         "log2","round","sign","sin","sinh","sqrt","tan","tanh","trunc"].forEach((op) => {
            const xop = x[op]();
            assert.equal(xop.get(), Math[op](0.2),
                op + "(constraint) has the expected value."
            );
        });

        // acoshx is NaN if x < 1
        const acoshx = x.acosh();
        x.set(5);
        assert.equal(acoshx.get(), Math.acosh(5),
            "acosh(constraint) has the expected value."
        )
        assert.end();
    });

    assert.test("Equals and not equals", (assert) => {
        const a = tie(6);
        const b = tie(6);
        const eqStrict = a.eq(b);
        const neqStrict = a.neq(b);
        const eqLoose = a.looseEq(b);
        const neqLoose = a.looseNeq(b);
        assert.ok(eqStrict.get(), "eqStrict is working with a===b.");
        assert.ok(eqLoose.get(), "eqLoose is working with a===b.");
        assert.notOk(neqStrict.get(), "neqStrict is working with a===b.");
        assert.notOk(neqLoose.get(), "neqLoose is working with a===b.");
        b.set(7);
        assert.notOk(eqStrict.get(), "eqStrict is working with a!==b.");
        assert.notOk(eqLoose.get(), "eqLoose is working with a!==b.");
        assert.ok(neqStrict.get(), "neqStrict is working with a!==b.");
        assert.ok(neqLoose.get(), "neqLoose is working with a!==b.");
        a.set("7");
        assert.notOk(eqStrict.get(), "eqStrict is working with a==b but not a===b.");
        assert.ok(eqLoose.get(), "eqLoose is working with a==b but not a===b.");
        assert.ok(neqStrict.get(), "neqStrict is working with a==b but not a===b.");
        assert.notOk(neqLoose.get(), "neqLoose is working with a==b but not a===b.");
        assert.end();
    });

    assert.test("Greaters and Lessers", (assert) => {
        const a = tie(6);
        const b = tie("6");
        const gt = a.gt(b);
        const gte = a.gte(b);
        const lt = a.lt(b);
        const lte = a.lte(b);
        assert.notOk(gt.get(), "gt is working with a===b.");
        assert.ok(gte.get(), "gte is working with a===b.");
        assert.notOk(lt.get(), "lt is working with a===b.");
        assert.ok(lte.get(), "lte is working with a===b.");
        b.set("7");
        assert.notOk(gt.get(), "gt is working with a > b.");
        assert.notOk(gte.get(), "gte is working with a > b.");
        assert.ok(lt.get(), "lt is working with a > b.");
        assert.ok(lte.get(), "lte is working with a > b.");
        a.set(10);
        assert.ok(gt.get(), "gt is working with a < b.");
        assert.ok(gte.get(), "gte is working with a < b.");
        assert.notOk(lt.get(), "lt is working with a < b.");
        assert.notOk(lte.get(), "lte is working with a < b.");
        assert.end();
    });

    assert.test("Pow", (assert) => {
        const a = tie(5);
        const b = tie(3);

        const pow = a.pow(b);
        assert.equal(pow.get(), 125, "Pow is working...");
        a.set(2); b.set(8);
        assert.equal(pow.get(), 256, "...And is propertly updated.");

        assert.end();
    });

    assert.test("Static constraint combination", (assert) => {
        const a = tie(5);
        const b = tie(2);

        const sum = tie.Constraint.sum(a, b, 6);
        assert.equal(sum.get(), 5+2+6,
            "Constraint sum is working."
        );
        a.set(3);
        assert.equal(sum.get(), 3+2+6,
            "It is updated when one of the constraints changes."
        );

        const product = tie.Constraint.product(a, b, 2);
        assert.equal(product.get(), 3*2*2,
            "Constraint product is working."
        );
        b.set(10);
        assert.equal(product.get(), 3*10*2,
            "It is updated when one of the constraints changes."
        );

        const max = tie.Constraint.max(a, b, 11);
        assert.equal(max.get(), 11,
            "Constraint max is working."
        );
        a.set(20);
        assert.equal(max.get(), 20,
            "It is updated when one of the constraint changes."
        );

        const min = tie.Constraint.min(a, b, 0);
        assert.equal(min.get(), 0,
            "Constraint min is working."
        );
        b.set(-4);
        assert.equal(min.get(), -4,
            "It is updated when one of the constraint changes."
        );

        const hypot = tie.Constraint.hypot(a, 8, b);
        assert.equal(hypot.get(), Math.hypot(20, -4, 8),
            "Constraint hypot is working."
        );
        a.set(2);
        assert.equal(hypot.get(), Math.hypot(2, -4, 8),
            "It is updated when one of the constraint changes."
        );

        a.set(90); b.set(15);
        const atan2 = tie.Constraint.atan2(a, b);
        assert.equal(atan2.get(), Math.atan2(90, 15),
            "Constraint atan2 is working."
        );
        b.set(30);
        assert.equal(atan2.get(), Math.atan2(90, 30),
            "It is properly updated."
        );

        assert.end();
    });

    assert.test("Unary operator", (assert) => {

        assert.notOk(tie(true).not().get(),
            "Not true is not ok."
        );
        assert.ok(tie(false).not().get(),
            "Not false is ok."
        );
        assert.notOk(tie("thing").not().get(),
            "Not truthy is not ok."
        );
        assert.ok(tie("").not().get(),
            "Not not truthy is ok."
        );

        assert.equal(tie(5).neg().get(), -5,
            "Positive neg is correct."
        );
        assert.equal(tie(-5).neg().get(), 5,
            "Negative neg is correct."
        );


        assert.equal(tie(5).pos().get(), 5,
            "Pos is working with numbers."
        );
        assert.equal(tie("-28").pos().get(), -28,
            "Pos is working with strings."
        );

        assert.equal(tie(2).bitwiseNot().get(), ~2,
            "bitwiseNot is working with positive values."
        );

        assert.equal(tie(-2).bitwiseNot().get(), ~(-2),
            "bitwiseNot is working with negative values."
        );


        assert.equal(tie("6").pos().get(), 6,
            "Pos is working for a string."
        );

        assert.equal(tie([12]).pos().get(), 12,
            "Pos is working for an array."
        );

        assert.end();
    });

    assert.end();
});
