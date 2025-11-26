// src/routes/home/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
    // Pas de logique localStorage ici (s'exécute aussi côté serveur)
    return {};
};
