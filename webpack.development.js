var merge = require("webpack-merge");
var commonConfig = require("./webpack.common");

module.exports = merge(commonConfig, {
    mode: "development",
    output: {
        filename: "tie.js"
    }
});
