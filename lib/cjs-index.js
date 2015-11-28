var es6Module = require('./index');

var cjsModule = function(){
	es6Module['default'].apply(es6Module, arguments);
}
cjsModule.Constraint = es6Module.Constraint;

module.exports = cjsModule;
