const path = require('path')
const webpack = require('webpack')
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const shell = require('shelljs');

module.exports = (env, argv) => {
  const mode = argv.mode
  const target = process.env.NODE_ENV || mode

  // Set output file name
  const outputFilename = {
    'coverage': 'lab.coverage.js',
    'development': 'lab.dev.js',
    'legacy': 'lab.legacy.js',
  }[target] || 'lab.js'

  const banner = [
    'lab.js -- Building blocks for online experiments',
    '(c) 2015- Felix Henninger',
  ].join('\n')

  // Define babel options
  const babelPresets = {
    legacy: {
      presets: [
        ['env', {
          modules: false,
          useBuiltIns: true,
        }],
      ],
      plugins: [
        'transform-object-rest-spread',
        'transform-class-properties',
        'lodash',
        ['fast-async', {
          runtimePattern: './src/index.js'
        }],
      ],
    },
    default: {
      presets: [
        ['env', {
          targets: {
            browsers: [
              '> 2%',
              'last 2 versions', // 'not dead',
              'Firefox ESR',
              'not IE 11', 'not ExplorerMobile 11',
              'not OperaMini all', 'not OperaMobile < 37',
              'not Android < 60',
            ],
          },
          exclude: [
            'transform-async-to-generator',
            'transform-regenerator',
          ],
          modules: false,
          useBuiltIns: true,
        }],
      ],
      plugins: [
        'transform-object-rest-spread',
        'transform-class-properties',
        'lodash',
      ],
    }
  }

  const babelOptions = Object.keys(babelPresets).includes(target)
    ? babelPresets[target]
    : babelPresets.default

  const config = {
    entry: {
      js: target === 'legacy'
        ? ['whatwg-fetch', './src/index.js']
        : ['./src/index.js']
    },
    module: {
      rules: [{
        loader: 'babel-loader',
        test: /\.js$/,
        include: path.join(__dirname, 'src'),
        query: babelOptions,
      }],
    },
    devtool: mode === 'development' ? 'inline-source-map' : 'source-map',
    plugins: [
      new LodashModuleReplacementPlugin(),
      new webpack.BannerPlugin({
        banner,
        exclude: ['lab.vendor.js'],
      }),
      new webpack.DefinePlugin({
        BUILD_FLAVOR: JSON.stringify(target),
        BUILD_COMMIT: JSON.stringify(
          shell.exec('git rev-parse HEAD', { silent: true }).trim()
        ),
      }),
    ],
    output: {
      filename: outputFilename,
      path: path.join(__dirname, '/dist'),
      library: 'lab',
      libraryTarget: 'umd',
      umdNamedDefine: true,
    },
  }

  // Optimize/minimize output
  // by including the corresponding plugins
  if (mode !== 'development') {
    // Minify code
    const reservedTerms = [
      // Components
      'Component', 'Dummy',
      'Screen', 'Form', 'Frame',
      'Sequence', 'Loop', 'Parallel',
      // Plugins
      'Debug', 'Download', 'Logger', 'Metadata', 'Transmit',
      // Utilities
      'Random', 'fromObject',
    ]

    config.optimization = {
      minimizer: [
        new UglifyJsPlugin({
          sourceMap: true,
          uglifyOptions: {
            compress: {
              inline: false,
            },
            reserve: reservedTerms,
            mangle: {
              reserved: reservedTerms,
            },
          },
        }),
      ],
    };
    config.plugins.push(
      // eslint-disable-next-line comma-dangle
      new webpack.optimize.OccurrenceOrderPlugin()
    )
    if (target === 'analysis') {
      config.plugins.push(
        new BundleAnalyzerPlugin()
      )
    }
  } else if (target === 'coverage') {
    // Add code coverage instrumentation
    config.module.rules[0].query.plugins.push('istanbul')
  }

  return config
}
