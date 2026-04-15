import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                contact: 'contact.html',
                carbon: 'carbon-report.html',
                deck: 'yul-pitch-deck.html',
                admin: 'admin.html'
            }
        }
    },
    server: {
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
