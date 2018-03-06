const merge = require("webpack-merge");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const commonConfig = require("./webpack.common");

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
