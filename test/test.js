import { expect } from "chai";
import tie from "../lib";

describe("Basic Constraint", function() {
	it("should calculate constraint values and update when dependencies' change", function(){
		var x = tie(1);
		var y = tie(() => x.get() + 1);
		var z = tie(() => y.get() * 2);
		expect(x.get()).be.equal(1);
		expect(y.get()).be.equal(2);
		expect(z.get()).be.equal(4);
		x.set(10);
		expect(x.get()).be.equal(10);
		expect(y.get()).be.equal(11);
		expect(z.get()).be.equal(22);
	});
	it("should remove dependencies that are not used anymore", function(){
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
		expect(xUpdates).be.equal(0);
		expect(cond.get()).be.equal('a');
		expect(xUpdates).be.equal(1);
		expect(condUpdates).be.equal(1);
		xSource.set('b');
		expect(cond.get()).be.equal('b');
		expect(xUpdates).be.equal(2);
		expect(condUpdates).be.equal(2);
		det.set(false);
		expect(cond.get()).be.equal('');
		expect(xUpdates).be.equal(2);
		expect(condUpdates).be.equal(3);
		xSource.set('c');
		expect(cond.get()).be.equal('');
		expect(xUpdates).be.equal(2);
		expect(condUpdates).be.equal(3);
		det.set(true);	
		expect(cond.get()).be.equal('c');
		expect(xUpdates).be.equal(3);
		expect(condUpdates).be.equal(4);		
	});
});

describe("Constraint set to constraint", function() {
	var x = tie(1);
	var y = tie(x);
	var z = tie(3);
	it("should be equal to the set constraint", function() {
		expect(x.get()).be.equal(1);
		expect(y.get()).be.equal(1);
		x.set(2);
		expect(x.get()).be.equal(2);
		expect(y.get()).be.equal(2);
		y.set(z);
		expect(x.get()).be.equal(2);
		expect(y.get()).be.equal(3);
		expect(z.get()).be.equal(3);
	});
});

describe("Constraint referring itself", function(){
	it("should make use of previous value", function(){
		var x = tie(1);
		expect(x.get()).be.equal(1);
		x.set(function() {
			return x.get() + 1;
		});
		expect(x.get()).be.equal(2);
		expect(x.get()).be.equal(2);
	});
})