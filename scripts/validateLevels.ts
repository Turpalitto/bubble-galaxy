// Валидация генерации всех уровней кампании: связность, камни, объём поля
import { LEVELS } from '../src/game/constants';
import { generateGrid, findFloating } from '../src/game/engine';

let failed = 0;

for (let i = 0; i < LEVELS.length; i++) {
  const def = LEVELS[i];
  const grid = generateGrid(i, 400, 80);
  const stones = grid.filter((b) => b.special === 'stone').length;
  const floating = findFloating(grid).length;
  const colored = grid.length - stones;
  const problems: string[] = [];

  if (floating > 0) problems.push(`висячих: ${floating}`);
  if (stones > def.stones) problems.push(`камней ${stones} > ${def.stones}`);
  if (colored < 15) problems.push(`слишком мало пузырей: ${colored}`);
  if (grid.some((b) => b.special === 'stone' && b.row < 2)) problems.push('камень в верхних рядах');

  const status = problems.length === 0 ? 'OK' : 'FAIL ' + problems.join(', ');
  if (problems.length > 0) failed++;
  console.log(
    `L${String(i + 1).padStart(2)} ${def.pattern.padEnd(8)} rows=${def.rows} bubbles=${String(grid.length).padStart(3)} stones=${stones}/${def.stones} → ${status}`
  );
}

console.log(failed === 0 ? '\nВсе уровни валидны ✓' : `\nПроблемных уровней: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
