const Constraint = require("../dist/tie.js").Constraint;
const N = 1000000;

function test(equals){
    const args = { readOnly: false, equals };
    const first = new Constraint(" ", args);
    const second = new Constraint(1, args);
    let evaluated = {};
    const deps = [];

    function depsGetter(){
        evaluated.dep = (evaluated.dep || 0) + 1;
        return first.get().length + second.get();
    }

    for(var i=0; i<N; i++){
        const newDep = new Constraint(depsGetter, args);
        deps.push(newDep);
    }
    const sum = new Constraint(() => {
        evaluated.sum = (evaluated.sum || 0) + 1;
        let sum = 0;
        for(let dep of deps){
            sum += dep.get();
        }
        return sum;
    }, args);

    const res = [];
    let start, val, time;


    (function t1(){
        start = Date.now();
        evaluated = {};
        val = sum.get();
        time = Date.now() - start;
        res.push({
            action: "first get",
            time, val, evaluated
        });
    })();

    (function t2(){
        start = Date.now();
        evaluated = {};
        first.set("abcd");
        val = sum.get();
        time = Date.now() - start;
        res.push({
            action: 'first.set("abcd")',
            time, val, evaluated
        });
    })();

    (function t3(){
        start = Date.now();
        evaluated = {};
        first.set("dbca");
        val = sum.get();
        time = Date.now() - start;
        res.push({
            action: "first.set(\"dbca\")",
            time, val, evaluated
        });
    })();

    (function t4(){
        start = Date.now();
        evaluated = {};
        first.set("cd");
        val = sum.get();
        time = Date.now() - start;
        res.push({
            action: "first.set(\"cd\")",
            time, val, evaluated
        });
    })();

    (function t5(){
        start = Date.now();
        evaluated = {};
        first.set("dc");
        val = sum.get();
        time = Date.now() - start;
        res.push({
            action: "first.set(\"dc\")",
            time, val, evaluated
        });
    })();

    (function t6(){
        start = Date.now();
        evaluated = {};
        deps[N/2].set(() => {
            evaluated.newDep = (evaluated.newDep || 0) + 1;
            return 3;
        });
        val = sum.get();
        time = Date.now() - start;
        res.push({
            action: "deps[N/2].set(() => 3)",
            time, val, evaluated
        });
    })();

    return res;
}

var typesToBeCompared = ["number", "string", "boolean", "symbol"];
var bothNaN = (a, b) => typeof a === "number" && typeof b === "number" && isNaN(a) && isNaN(b);



// var strEqual = test(function(a, b){
//     return a === b;
// });


// console.log("strEqual", strEqual);


// global.gc();


// var noObj = test(function(a, b){
//     if(a === b){
//         if(a == null) return true;
//         return typesToBeCompared.indexOf(typeof a) >= 0;
//     } else {
//         return bothNaN(a, b);
//     }
// });

// console.log("noObj", noObj);



// global.gc();



var falsy = test(function(){
    return false;
});

console.log("falsy", falsy);

