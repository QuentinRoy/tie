var webpack = require('webpack');
var path = require('path');
var WebpackDevServer = require('webpack-dev-server');

var webpackConfig = {
    entry: {
        lib: [
            path.resolve(__dirname, 'index.js'),
            "webpack-dev-server/client?http://0.0.0.0:3000",
            "webpack/hot/only-dev-server"
        ]
    },
    output: {
        path: path.join(__dirname, 'assets'),
        filename: 'test.js'
    },
    module: {
        loaders: [
          {
            test: /\.js$/,
            loader: 'babel',
            include: [
                path.join(__dirname, '../lib'),
                path.join(__dirname, '../test'),
                __dirname
            ]
          }
        ]
    },
    node: {
        fs: 'empty'
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoErrorsPlugin()
    ],
    devtool: "source-map"
};

new WebpackDevServer(webpack(webpackConfig), {
  publicPath: "/assets",
  hot: true,
  historyApiFallback: true
}).listen(3000, '0.0.0.0', function (err, result) {
  if (err) {
    console.log(err);
  }

  console.log('Listening at 0.0.0.0:3000');
});
