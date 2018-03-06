var merge = require("webpack-merge");
var commonConfig = require("./webpack.common");
var UglifyJSPlugin = require("uglifyjs-webpack-plugin");

module.exports = merge(commonConfig, {
    mode: "production",
    output: {
        filename: "tie.min.js"
    },
    plugins: [
        new UglifyJSPlugin({
            sourceMap: true
        })
    ]
});
