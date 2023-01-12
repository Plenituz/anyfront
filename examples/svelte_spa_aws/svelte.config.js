import adapter from '@sveltejs/adapter-static';

const config = {
    kit: {
        adapter: adapter(),
        // anyfront works with or without trailing slash
        // trailingSlash: 'always',
        alias: {
            "@": 'src/lib',
        },
    },
    vitePlugin: {
        experimental: {
            useVitePreprocess: true,
        },
    },
};

export default config;
