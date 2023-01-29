import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

const BUILD_DIR = 'build'

async function main() {
    await esbuild.build({
        entryPoints: [
            ...fs.readdirSync('.').filter(f => f.endsWith('.ts')),
            'frontend_build/frontend_build.ts',
            'gcp_cloudrun_static_hosting/gcp_cloudrun_static_hosting.ts',
            'aws_cloudfront_static_hosting/aws_cloudfront_static_hosting.ts',
        ],
        bundle: true,
        // minify: true,
        // sourcemap: true,
        outdir: BUILD_DIR,
        loader: {
            '.py': 'text',
            '.go': 'text',
            '.dockerfile': 'text',
            '.template.js': 'text',
            '.conf' : 'text',
        }
    })
    fs.readdirSync(BUILD_DIR, { withFileTypes: true }).forEach(f => {
        if (!f.isDirectory()) {
            return
        }
        moveFiles(path.join(BUILD_DIR, f.name), BUILD_DIR)
    })
}

function moveFiles(dir, toDir) {
    const files = fs.readdirSync(dir, { withFileTypes: true })
    for (const file of files) {
        const filePath = path.join(dir, file.name)
        if (file.isDirectory()) {
            continue
        }
        fs.renameSync(filePath, path.join(toDir, file.name))
    }
    fs.rmdirSync(dir)
}

main()
    .then(() => console.log('done'))