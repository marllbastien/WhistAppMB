// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

const ADMIN_HOST = 'admin.wb-scoring.com';
const PUBLIC_HOSTS = ['wb-scoring.com', 'www.wb-scoring.com'];

export const handle: Handle = async ({ event, resolve }) => {
    const host = event.request.headers.get('host') ?? '';
    const url = event.url;
    const { pathname, search } = url;

    // 1) Si on est sur le sous-domaine admin et sur la racine, on renvoie vers /admin
    if (host === ADMIN_HOST && pathname === '/') {
        throw redirect(302, '/admin');
    }

    // 2) Si on tape /admin depuis le domaine public, on redirige vers le sous-domaine
    if (PUBLIC_HOSTS.includes(host) && pathname.startsWith('/admin')) {
        throw redirect(302, `https://${ADMIN_HOST}${pathname}${search}`);
    }

    // Laisser SvelteKit rendre la page normalement
    return resolve(event);
};
