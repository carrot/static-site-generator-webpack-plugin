import evaluate from 'eval'
import path from 'path'

export default class StaticSiteGeneratorWebpackPlugin {
  constructor (renderChunkName = 'main') {
    this.renderChunkName = renderChunkName
  }

  apply (compiler) {
    compiler.plugin('emit', (compilation, done) => {
      const webpackStats = compilation.getStats()
      const webpackStatsJson = webpackStats.toJson()

      try {
        const asset = findAsset(this.renderChunkName, compilation, webpackStatsJson)

        if (!asset) {
          throw new Error(`Source file not found: "${this.renderChunkName}"`)
        }

        const assets = getAssetsFromCompilation(compilation, webpackStatsJson)

        const source = asset.source()
        const render = evaluate(source, /* filename: */ this.renderChunkName, /* scope: */ {
          console: console,
          setTimeout: setTimeout
        })

        const locals = {
          assets: assets,
          webpackStats: webpackStats
        }

        render(locals)
          .then(pages => {
            Object.keys(pages).forEach(pth => {
              const outputFileName = path.join(pth, '/index.html')
                .replace(/^(\/|\\)/, '') // Remove leading slashes for webpack-dev-server
              const html = pages[pth]
              compilation.assets[outputFileName] = {
                source: () => html,
                size: () => html.length
              }
            })
            done()
          })
          .catch(err => {
            compilation.errors.push(err.stack)
            done(err)
          })
      } catch (err) {
        compilation.errors.push(err.stack)
        done(err)
      }
    })
  }
}

function findAsset (src, compilation, webpackStatsJson) {
  const asset = compilation.assets[src]

  if (asset) {
    return asset
  }

  let chunkValue = webpackStatsJson.assetsByChunkName[src]

  if (!chunkValue) {
    return null
  }
  // Webpack outputs an array for each chunk when using sourcemaps
  if (chunkValue instanceof Array) {
    // Is the main bundle always the first element?
    chunkValue = chunkValue[0]
  }
  return compilation.assets[chunkValue]
}

// Shamelessly stolen from html-webpack-plugin - Thanks @ampedandwired :)
function getAssetsFromCompilation (compilation, webpackStatsJson) {
  const assets = {}
  for (let chunk in webpackStatsJson.assetsByChunkName) {
    let chunkValue = webpackStatsJson.assetsByChunkName[chunk]

    // Webpack outputs an array for each chunk when using sourcemaps
    if (chunkValue instanceof Array) {
      // Is the main bundle always the first element?
      chunkValue = chunkValue[0]
    }

    if (compilation.options.output.publicPath) {
      chunkValue = compilation.options.output.publicPath + chunkValue
    }
    assets[chunk] = chunkValue
  }

  return assets
}
