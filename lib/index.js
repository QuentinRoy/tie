var es6Module = require('./es-index');

var cjsModule = function tie(){
    return es6Module['default'].apply(es6Module, arguments);
}
cjsModule.Constraint = es6Module.Constraint;

module.exports = cjsModule;
