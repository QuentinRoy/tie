'use strict';

var path = require('path');

module.exports = {
  entry: {
    lib: [ path.resolve(__dirname, 'lib/index.js') ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'tie.js',
    libraryTarget: 'umd',
    library: 'tie'
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
