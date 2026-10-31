// Catalogue des méthodes disponibles. Ajouter une méthode = un fichier + une ligne ici.

import { createRegistry } from './registry.js';
import { geometricSolution } from './geometric.js';

export const solutions = createRegistry();
solutions.register(geometricSolution);
