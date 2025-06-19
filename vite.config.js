import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import Fonts from 'unplugin-fonts/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

const buildWorkerFunctions = () => {
    // execute npx wrangler commands to build worker functions
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const executeCommand = async (command) => {
        try {
            console.log(`Executing: ${command}`);
            const { stdout, stderr } = await execAsync(command);
            
            if (stdout) {
                console.log('stdout:', stdout);
            }
            
            if (stderr) {
                console.error('stderr:', stderr);
            }
        } catch (error) {
            console.error(`Error executing command: ${command}`, error);
        }
    };
    
    const command = 'npx wrangler pages functions build --outdir=./dist/worker/';
    executeCommand(command);
}
const postBuild = () => ({
    name: 'postbuild-commands',
    handleHotUpdate: async () => { buildWorkerFunctions(); },
    buildEnd: async () => { buildWorkerFunctions(); },
});

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        allowedHosts: ['.vulnetix.com', 'localhost', '127.0.0.1'],
        strictPort: true,
        port: 5173,
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern',
                silenceDeprecations: ["legacy-js-api"],
            },
            sass: {
                api: 'modern-compiler',
                silenceDeprecations: ["legacy-js-api"],
            },
        },
        devSourcemap: true,
    },
    plugins: [
        vue(),
        // Docs: https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin
        vuetify({
            styles: {
                configFile: 'src/styles/variables/_vuetify.scss',
            },
        }),
        Components({
            dirs: ['src/@core/components'],
            dts: true,
        }),
        Fonts({
          fontsource: {
            families: [
              {
                name: 'Roboto',
                weights: [100, 300, 400, 500, 700, 900],
                styles: ['normal', 'italic'],
              },
              {
                name: 'Segoe UI',
                weights: [100, 300, 400, 500, 700, 900],
                styles: ['normal', 'italic'],
              }
            ],
          },
        }),
        // Docs: https://github.com/antfu/unplugin-auto-import#unplugin-auto-import
        AutoImport({
            eslintrc: {
                enabled: true,
                filepath: './.eslintrc-auto-import.json',
            },
            imports: ['vue', 'vue-router', '@vueuse/core', '@vueuse/math', 'pinia'],
            vueTemplate: true,
        }),
        postBuild(),
    ],
    define: { 'process.env': {} },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
            '@core': fileURLToPath(new URL('./src/@core', import.meta.url)),
            '@layouts': fileURLToPath(new URL('./src/@layouts', import.meta.url)),
            '@images': fileURLToPath(new URL('./src/assets/images', import.meta.url)),
            '@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
            '@configured-variables': fileURLToPath(new URL('./src/styles/variables/_template.scss', import.meta.url)),
            '@axios': fileURLToPath(new URL('./src/plugins/axios', import.meta.url)),
            '@schemas': fileURLToPath(new URL('./schemas', import.meta.url)),
        },
    },
    build: {
        chunkSizeWarningLimit: 5000,
    },
    optimizeDeps: {
        exclude: ['vuetify'],
        entries: [
            './src/**/*.vue',
        ],
    },
})
