// Catalogue des méthodes disponibles. Ajouter une méthode = un fichier + une ligne ici.

import { createRegistry } from './registry.js';
import { geometricSolution } from './geometric.js';
import { algebraicSolution } from './algebraic.js';
import { tabularSolution } from './tabular.js';

export const solutions = createRegistry();
solutions.register(geometricSolution);
solutions.register(algebraicSolution);
solutions.register(tabularSolution);
