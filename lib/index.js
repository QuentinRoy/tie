var es6Module = require('./es-index');

var cjsModule = function tie(){
    return es6Module['default'].apply(es6Module, arguments);
}
for(var prop in es6Module){
    if(prop !== 'default'){
        cjsModule[prop] = es6Module[prop];
    }
}

module.exports = cjsModule;
