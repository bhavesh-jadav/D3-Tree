import resolve from 'rollup-plugin-node-resolve';
 
export default {
    entry: 'src/js/app.js',
    dest: 'src/js/bundle.js',
    format: 'umd',
    plugins: [
        resolve({
            jsnext: true,
            main: true,
            module: true
        })
    ],
    moduleName: 'app'
};