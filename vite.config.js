import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import {readFileSync} from 'node:fs';
const notices=readFileSync(new URL('./THIRD_PARTY_LICENSES.txt',import.meta.url),'utf8');
export default defineConfig({plugins:[viteSingleFile(),{name:'bundled-license-notices',transformIndexHtml:{order:'post',handler:html=>html.replace('</html>',`<!--\n${notices}\n-->\n</html>`)}}],build:{target:'es2022',outDir:'dist',assetsInlineLimit:100000000,chunkSizeWarningLimit:1500},server:{port:4173,strictPort:true}});
