import { Configuration, RuleSetRule, rspack } from '@rspack/core';
import * as path from 'path';
import { SharedConfigContext } from './model';

export interface WithWebOptions {
  stylePreprocessorOptions?: {
    includePaths?: string[];
  };
  cssModules?: boolean;
}

export function withWeb(opts: WithWebOptions = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isProd =
      process.env.NODE_ENV === 'production' || options.mode === 'production';

    const projectRoot = path.join(
      context.root,
      context.projectGraph.nodes[context.projectName].data.root
    );

    const includePaths: string[] = [];
    if (opts?.stylePreprocessorOptions?.includePaths?.length > 0) {
      opts.stylePreprocessorOptions.includePaths.forEach(
        (includePath: string) =>
          includePaths.push(path.resolve(context.root, includePath))
      );
    }

    let lessPathOptions: { paths?: string[] } = {};

    if (includePaths.length > 0) {
      lessPathOptions = {
        paths: includePaths,
      };
    }

    return {
      ...config,
      experiments: {
        css: true,
      },
      module: {
        ...config.module,
        rules: [
          ...(config.module.rules || []),
          {
            test: /\.css$/,
            type: opts?.cssModules ? 'css/module' : undefined,
          },
          {
            test: /\.css$/,
            type: 'css',
            use: [
              {
                loader: require.resolve('postcss-loader'),
              },
            ],
          },
          {
            test: /\.scss$|\.sass$/,
            type: opts?.cssModules ? 'css/module' : undefined,
            use: [
              {
                loader: require.resolve('sass-loader'),
                options: {
                  sourceMap: !!options.sourceMap,
                  sassOptions: {
                    fiber: false,
                    // bootstrap-sass requires a minimum precision of 8
                    precision: 8,
                    includePaths,
                  },
                },
              },
            ],
          },
          {
            test: /.less$/,
            type: opts?.cssModules ? 'css/module' : undefined,
            use: [
              {
                loader: require.resolve('less-loader'),
                options: {
                  sourceMap: !!options.sourceMap,
                  lessOptions: {
                    javascriptEnabled: true,
                    ...lessPathOptions,
                  },
                },
              },
            ],
          },
          {
            test: /\.styl$/,
            use: [
              {
                loader: require.resolve('stylus-loader'),
                options: {
                  sourceMap: !!options.sourceMap,
                  stylusOptions: {
                    include: includePaths,
                  },
                },
              },
            ],
          },
        ].filter((a): a is RuleSetRule => !!a),
      },
      plugins: [
        ...config.plugins,
        new rspack.HtmlRspackPlugin({
          template: options.indexHtml
            ? path.join(context.root, options.indexHtml)
            : path.join(projectRoot, 'src/index.html'),
          ...(options.baseHref ? { base: { href: options.baseHref } } : {}),
        }),
        new rspack.EnvironmentPlugin({
          NODE_ENV: isProd ? 'production' : 'development',
        }),
        new rspack.DefinePlugin(
          getClientEnvironment(isProd ? 'production' : undefined).stringified
        ),
      ],
    };
  };
}

function getClientEnvironment(mode?: string) {
  // Grab NODE_ENV and NX_PUBLIC_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const nxPublicKeyRegex = /^NX_PUBLIC_/i;

  const raw = Object.keys(process.env)
    .filter((key) => nxPublicKeyRegex.test(key))
    .reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});

  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}
