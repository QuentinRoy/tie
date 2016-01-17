var es6Module = require('./es-index');

module.exports = function tie(){
    return es6Module['default'].apply(es6Module, arguments);
};

for(var prop in es6Module){
    if(prop !== 'default'){
        module.exports[prop] = es6Module[prop];
    }
}
