'use strict';

var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: {
        lib: [ path.resolve(__dirname, 'lib/index.js') ],
    },
    output: {
        path: path.join(__dirname, 'dist'),
        libraryTarget: 'umd',
        library: 'tie',
        libraryExport: 'default'
    },
    module: {
        rules: [
        {
            test: /\.js$/,
            loader: 'babel-loader',
            include: path.join(__dirname, 'lib')
        }
        ]
    },
    plugins: [
        new webpack.optimize.ModuleConcatenationPlugin()
    ],
    devtool: "source-map"
};
