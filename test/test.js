//import { expect } from "chai";
import test from "tape";
import tie from "../dist/tie";

test("Constraint ties", (assert) => {
	var x = tie(2);
	var y = tie(() => 3);
	var z = tie(() => x.get() * y.get());
	assert.equal(x.get(), 2,
		"A constraint is equal to set value.");
	assert.equal(y.get(), 3,
		"A constraint value can be set with a function.");
	assert.equal(z.get(), 6,
		"Constraint value can be calculated from other constraints.");
	x.set(10);
	assert.equal(x.get(), 10,
		"Constraint can be reset.");
	assert.equal(z.get(), 30,
		"Dependent constraint are updated when depedencies' value change.");

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
		"Proper constraint value.");
	assert.equal(xUpdates, 1,
		"Dependencies are evaluated when a constraint is get."
	);
	assert.equal(condUpdates, 1,
		"A constraint is evaluated when get."
	);
	xSource.set("b");
	assert.equal(cond.get(), "b", 
		"Proper constraint value after source reset.");
	assert.equal(xUpdates, 2,
		"Source has been re-evaluated."
	);
	assert.equal(condUpdates, 2,
		"Constraint has been re-evaluated."
	);
	det.set(false);
	assert.equal(cond.get(), "",
		"Source isn't a dependency anymore."
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

test("Self referring constraint", (assert) => {
	const x = tie(() => x.get() || 0 + 1);
	assert.equal(x.get(), 1,
		"Does not create infinite loop."
	);
	const y = tie(2);
	y.get();
	y.set(() => y.get() * 2)
	assert.equal(y.get(), 4,
		"Return the cached value when recursively called."
	);
	assert.end();
});
