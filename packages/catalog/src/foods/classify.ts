import type { FoodGroup } from '@stenia/core';

/** Grupo de equivalentes a partir de la categoría USDA y la descripción. */
export function foodGroupFor(category: string, description: string): FoodGroup {
  const d = description.toLowerCase();
  const c = category.toLowerCase();
  if (/^(fast foods|restaurant foods|meals, entrees)/.test(c)) return 'mixed';
  if (c.startsWith('spices') || /^(beverages, (water|coffee|tea))/.test(d) || /^water/.test(d)) return 'free';
  if (c.startsWith('dairy')) {
    if (/^egg/.test(d)) return 'protein';
    if (/^cheese|cottage/.test(d)) return 'protein';
    if (/^(butter|cream|whipped|sour cream)/.test(d)) return 'fat';
    if (/^(milk|yogurt|kefir|buttermilk)/.test(d)) return 'dairy';
    return 'dairy';
  }
  if (/(poultry|pork|beef|lamb|finfish|sausages)/.test(c)) return /bacon|salami|pepperoni/.test(d) ? 'fat' : 'protein';
  if (c.startsWith('legumes')) {
    if (/peanut|soymilk|tofu|soy protein/.test(d)) return /tofu|soy protein/.test(d) ? 'protein' : /soymilk/.test(d) ? 'dairy' : 'fat';
    return 'legume';
  }
  if (c.startsWith('nut and seed')) return 'fat';
  if (c.startsWith('fats and oils')) return 'fat';
  if (c.startsWith('fruits')) return 'fruit';
  if (c.startsWith('vegetables')) {
    if (/^(potato|sweet potato|yam|cassava|taro|plantain|corn, sweet|peas, green)/.test(d)) return 'cereal';
    return 'vegetable';
  }
  if (/(cereal grains|breakfast cereals)/.test(c)) return 'cereal';
  if (c.startsWith('baked products')) return /(cake|cookie|pie|doughnut|pastr|brownie|danish|sweet roll|frosting)/.test(d) ? 'sugar' : 'cereal';
  if (c.startsWith('sweets')) return 'sugar';
  if (c.startsWith('snacks')) return /popcorn|pretzel|rice cake/.test(d) ? 'cereal' : 'mixed';
  if (c.startsWith('beverages')) {
    if (/protein|whey/.test(d)) return 'protein';
    if (/milk|soymilk|almond/.test(d)) return 'dairy';
    if (/juice|nectar/.test(d)) return 'fruit';
    if (/(carbonated|soda|energy|sports|lemonade|punch|drink mix|sweetened)/.test(d)) return 'sugar';
    if (/alcoholic/.test(d)) return 'mixed';
    return 'free';
  }
  if (c.startsWith('soups')) return /salsa|sauce, (hot|pepper)/.test(d) ? 'free' : 'mixed';
  return 'mixed';
}
