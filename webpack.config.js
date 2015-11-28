'use strict';

var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: {
    lib: [ path.resolve(__dirname, 'lib/cjs-index.js') ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'c.js',
    libraryTarget: 'umd',
    library: 'c'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        include: path.join(__dirname, 'lib')
      }
    ]
  },
  devtool: "source-map"
};