import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import url from '@rollup/plugin-url';
import hotcss from 'rollup-plugin-hot-css';
import static_files from 'rollup-plugin-static-files';
import { terser } from 'rollup-plugin-terser';

const extensions = ['.js', '.ts', '.tsx'];
const isProduction = process.env.NODE_ENV === 'production';
let config = {
  input: './src/main.tsx',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].[hash].js',
    assetFileNames: '[name].[hash][extname]',
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      preventAssignment: true,
    }),
    hotcss({
      hot: process.env.NODE_ENV === 'development',
      filename: 'styles.css',
    }),
    resolve({ extensions, browser: true }),
    babel({ extensions, babelHelpers: 'bundled' }),
    url(),
    isProduction &&
      static_files({
        include: ['./public'],
      }),
    isProduction &&
      terser({
        compress: {
          global_defs: {
            module: false,
          },
        },
      }),
  ],
};

export default config;
