/**
 * Traducción determinista de nombres de ejercicios al español de México. El equipo pasa al final
 * («Dumbbell Bench Press» → «Press de banca con mancuernas») y los movimientos usan el vocabulario de gimnasio
 * mexicano (lagartija, dominada, jalón, remo). Lo que no reconoce se conserva en inglés.
 */

const EQUIPMENT: [RegExp, string][] = [
  [/\bsmith machine\b/i, 'en máquina Smith'],
  [/\bez[- ]?bar\b/i, 'con barra Z'],
  [/\btrap bar\b/i, 'con barra hexagonal'],
  [/\blandmine\b/i, 'en landmine'],
  [/\bbarbell\b/i, 'con barra'],
  [/\bdumbbells?\b/i, 'con mancuernas'],
  [/\bkettlebells?\b/i, 'con pesa rusa'],
  [/\bcables?\b/i, 'en polea'],
  [/\bmachine\b/i, 'en máquina'],
  [/\b(resistance )?bands?\b/i, 'con liga'],
  [/\bexercise ball\b|\bstability ball\b|\bswiss ball\b/i, 'en balón suizo'],
  [/\bmedicine ball\b/i, 'con balón medicinal'],
  [/\brings?\b/i, 'en anillas'],
  [/\bparallettes?\b/i, 'en paralelas bajas'],
  [/\bsled\b/i, 'con trineo'],
  [/\bfoam roll(er)?\b/i, 'con rodillo'],
];

type Gender = 'm' | 'f' | 'mp' | 'fp';

/** Movimiento principal (primera coincidencia gana) con su género para concordar adjetivos. */
const PHRASES: [RegExp, string, Gender][] = [
  [/\bbench press\b/i, 'press de banca', 'm'],
  [/\bfloor press\b/i, 'press en el piso', 'm'],
  [/\bshoulder press\b/i, 'press de hombro', 'm'],
  [/\boverhead press\b|\bmilitary press\b/i, 'press militar', 'm'],
  [/\bchest press\b/i, 'press de pecho', 'm'],
  [/\bleg press\b/i, 'prensa de piernas', 'f'],
  [/\barnold press\b/i, 'press Arnold', 'm'],
  [/\bpress behind (the )?neck\b/i, 'press tras nuca', 'm'],
  [/\bpush[- ]?press\b/i, 'push press', 'm'],
  [/\bhandstand push[- ]?ups?\b|\bhspu\b/i, 'lagartija en parada de manos', 'f'],
  [/\bpush[- ]?ups?\b/i, 'lagartija', 'f'],
  [/\bpull[- ]?ups?\b/i, 'dominada', 'f'],
  [/\bchin[- ]?ups?\b/i, 'dominada supina', 'f'],
  [/\bmuscle[- ]?ups?\b/i, 'muscle-up', 'm'],
  [/\bsit[- ]?ups?\b/i, 'abdominal completo', 'm'],
  [/\bstep[- ]?ups?\b/i, 'subida al cajón', 'f'],
  [/\blat pull[- ]?downs?\b|\bpull[- ]?downs?\b/i, 'jalón al pecho', 'm'],
  [/\bdeadlifts?\b/i, 'peso muerto', 'm'],
  [/\bgood mornings?\b/i, 'buenos días', 'mp'],
  [/\bhip thrusts?\b/i, 'hip thrust', 'm'],
  [/\bglute bridges?\b|\bbridges?\b/i, 'puente de glúteo', 'm'],
  [/\bbulgarian split squats?\b/i, 'sentadilla búlgara', 'f'],
  [/\bsplit squats?\b/i, 'sentadilla dividida', 'f'],
  [/\bwall sit\b/i, 'sentadilla isométrica en pared', 'f'],
  [/\bsquats?\b/i, 'sentadilla', 'f'],
  [/\blunges?\b/i, 'zancada', 'f'],
  [/\bcalf raises?\b/i, 'elevación de talones', 'f'],
  [/\blateral raises?\b|\bside lateral raises?\b/i, 'elevación lateral', 'f'],
  [/\bfront raises?\b/i, 'elevación frontal', 'f'],
  [/\bleg raises?\b|\bleg lifts?\b/i, 'elevación de piernas', 'f'],
  [/\bknee raises?\b/i, 'elevación de rodillas', 'f'],
  [/\braises?\b/i, 'elevación', 'f'],
  [/\bleg curls?\b/i, 'curl de piernas', 'm'],
  [/\bhammer curls?\b/i, 'curl martillo', 'm'],
  [/\bpreacher curls?\b/i, 'curl predicador', 'm'],
  [/\bconcentration curls?\b/i, 'curl concentrado', 'm'],
  [/\bcurls?\b/i, 'curl', 'm'],
  [/\bleg extensions?\b/i, 'extensión de piernas', 'f'],
  [/\btriceps? extensions?\b/i, 'extensión de tríceps', 'f'],
  [/\bback extensions?\b|\bhyperextensions?\b/i, 'hiperextensión', 'f'],
  [/\bskull ?crushers?\b/i, 'rompecráneos', 'm'],
  [/\bextensions?\b/i, 'extensión', 'f'],
  [/\bkickbacks?\b/i, 'patada', 'f'],
  [/\bpushdowns?\b|\bpress[- ]?downs?\b/i, 'jalón hacia abajo', 'm'],
  [/\bcrossovers?\b/i, 'cruce', 'm'],
  [/\bflye?s?\b/i, 'aperturas', 'fp'],
  [/\bpullovers?\b/i, 'pullover', 'm'],
  [/\bshrugs?\b/i, 'encogimiento de hombros', 'm'],
  [/\bface pulls?\b/i, 'face pull', 'm'],
  [/\bupright rows?\b/i, 'remo al mentón', 'm'],
  [/\brows?\b/i, 'remo', 'm'],
  [/\bdips?\b/i, 'fondos', 'mp'],
  [/\bcrunch(es)?\b/i, 'crunch', 'm'],
  [/\bside planks?\b/i, 'plancha lateral', 'f'],
  [/\bplanks?\b/i, 'plancha', 'f'],
  [/\bplanche\b/i, 'planche', 'f'],
  [/\bfront lever\b/i, 'front lever', 'm'],
  [/\bback lever\b/i, 'back lever', 'm'],
  [/\bhandstand\b/i, 'parada de manos', 'f'],
  [/\bl[- ]sit\b/i, 'L-sit', 'm'],
  [/\bmountain climbers?\b/i, 'escaladores', 'mp'],
  [/\bjumping jacks?\b/i, 'saltos de tijera', 'mp'],
  [/\bburpees?\b/i, 'burpee', 'm'],
  [/\bbox jumps?\b/i, 'salto al cajón', 'm'],
  [/\bjumps?\b/i, 'salto', 'm'],
  [/\bswings?\b/i, 'swing', 'm'],
  [/\bsnatch\b/i, 'arranque', 'm'],
  [/\bclean and jerk\b/i, 'envión', 'm'],
  [/\bclean\b/i, 'cargada', 'f'],
  [/\bjerk\b/i, 'envión', 'm'],
  [/\bthrusters?\b/i, 'thruster', 'm'],
  [/\bfarmer'?s walk\b|\bcarry\b/i, 'caminata de granjero', 'f'],
  [/\bstretch(es)?\b/i, 'estiramiento', 'm'],
  [/\bdead bug\b/i, 'dead bug', 'm'],
  [/\bbird dog\b/i, 'bird dog', 'm'],
  [/\bsuperman\b/i, 'superman', 'm'],
  [/\bhold\b/i, 'sostén', 'm'],
  [/\bpress\b/i, 'press', 'm'],
];

/** Modificadores: [patrón, masculino, femenino] (adjetivos) o una sola forma invariable. */
const MODIFIERS: [RegExp, string, string?][] = [
  [/\bto (a )?bench\b/i, 'a banco'],
  [/\bincline\b/i, 'inclinado', 'inclinada'],
  [/\bdecline\b/i, 'declinado', 'declinada'],
  [/\bseated\b/i, 'sentado', 'sentada'],
  [/\bstanding\b/i, 'de pie'],
  [/\blying\b|\bprone\b/i, 'acostado', 'acostada'],
  [/\bsupine\b/i, 'boca arriba'],
  [/\bkneeling\b/i, 'de rodillas'],
  [/\bone[- ]arm(ed)?\b|\bsingle[- ]arm\b/i, 'a un brazo'],
  [/\bone[- ]leg(ged)?\b|\bsingle[- ]leg(ged)?\b/i, 'a una pierna'],
  [/\balternat(e|ing)\b/i, 'alterno', 'alterna'],
  [/\bclose[- ]grip\b|\bnarrow[- ]grip\b/i, 'agarre cerrado'],
  [/\bwide[- ]grip\b/i, 'agarre abierto'],
  [/\breverse[- ]grip\b|\bunderhand\b|\bsupinated\b/i, 'agarre supino'],
  [/\bneutral[- ]grip\b/i, 'agarre neutro'],
  [/\breverse\b/i, 'inverso', 'inversa'],
  [/\bfront\b/i, 'frontal'],
  [/\bforward\b/i, 'al frente'],
  [/\boverhead\b/i, 'sobre la cabeza'],
  [/\bbehind the neck\b|\bbehind neck\b/i, 'tras nuca'],
  [/\bstiff[- ]legged\b/i, 'con piernas rígidas'],
  [/\bromanian\b/i, 'rumano', 'rumana'],
  [/\bsumo\b/i, 'sumo'],
  [/\bweighted\b/i, 'con lastre'],
  [/\bassisted\b/i, 'asistido', 'asistida'],
  [/\bexplosive\b/i, 'explosivo', 'explosiva'],
  [/\bisometric\b/i, 'isométrico', 'isométrica'],
  [/\bpartial\b/i, 'parcial'],
  [/\bfull\b/i, 'completo', 'completa'],
  [/\bdiamond\b/i, 'diamante'],
  [/\bpike\b/i, 'en pica'],
  [/\barcher\b/i, 'arquero', 'arquera'],
  [/\bwalking\b/i, 'caminando'],
  [/\bjumping\b/i, 'con salto'],
  [/\bslow\b/i, 'lento', 'lenta'],
  [/\bnegatives?\b/i, 'negativo', 'negativa'],
  [/\bside\b|\blateral\b/i, 'lateral'],
  [/\bwall\b/i, 'en pared'],
  [/\bbox\b/i, 'en cajón'],
  [/\bbench\b/i, 'en banco'],
  [/\bbar\b/i, 'en barra'],
  [/\bfloor\b/i, 'en el piso'],
  [/\bbodyweight\b/i, 'con peso corporal'],
  [/\bhammer\b/i, 'martillo'],
  [/\bab\b|\babs\b|\babdominal\b/i, 'abdominal'],
  [/\bchest\b/i, 'de pecho'],
  [/\bshoulders?\b/i, 'de hombros'],
  [/\btriceps\b/i, 'de tríceps'],
  [/\bbiceps\b/i, 'de bíceps'],
  [/\bhamstrings?\b/i, 'de isquiotibiales'],
  [/\bquads?\b|\bquadriceps\b/i, 'de cuádriceps'],
  [/\bglutes?\b/i, 'de glúteos'],
  [/\bcalf\b|\bcalves\b/i, 'de pantorrilla'],
  [/\blegs?\b/i, 'pierna'],
  [/\barms?\b/i, 'brazo'],
  [/\bknees?\b/i, 'rodillas'],
  [/\bhips?\b/i, 'cadera'],
  [/\bback\b/i, 'espalda'],
  [/\bneck\b/i, 'cuello'],
  [/\bwith\b/i, 'con'],
  [/\band\b/i, 'y'],
  [/\bto\b/i, 'a'],
  [/\bon\b/i, 'en'],
  [/\bfrom\b/i, 'desde'],
  [/\bof\b/i, 'de'],
  [/\bthe\b|\ba\b|\ban\b/i, ''],
];

function agree(masc: string, fem: string | undefined, gender: Gender): string {
  const base = gender.startsWith('f') && fem ? fem : masc;
  if (!gender.endsWith('p') || !fem) return base;
  return /[aeiou]$/.test(base) ? `${base}s` : `${base}es`;
}

function translateCore(text: string): string {
  let core = text.trim();
  const suffixes: string[] = [];
  for (const [re, es] of EQUIPMENT) {
    if (re.test(core)) {
      core = core.replace(re, ' ');
      suffixes.push(es);
    }
  }
  // «with» que quedó colgando tras quitar el equipo («Split Squat with Dumbbells»).
  core = core.replace(/\bwith\s*$/i, '').replace(/\bwith\s+(?=with\b)/i, '');
  let head = '';
  let gender: Gender = 'm';
  for (const [re, es, g] of PHRASES) {
    if (re.test(core)) {
      head = es;
      gender = g;
      core = core.replace(re, ' ');
      break;
    }
  }
  // Marcadores §n§ para que una traducción no vuelva a procesarse con otra regla.
  const slots: string[] = [];
  for (const [re, masc, fem] of MODIFIERS) {
    core = core.replace(new RegExp(re.source, 'gi'), () => {
      slots.push(agree(masc, fem, gender));
      return ` §${slots.length - 1}§ `;
    });
  }
  const tail = core
    .replace(/§(\d+)§/g, (_, i: string) => slots[Number(i)] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return [head, tail, ...suffixes].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/\bcon con\b/g, 'con').trim();
}

export function translateExerciseName(en: string): string {
  const parenMatch = en.match(/\(([^)]*)\)\s*$/);
  let out = translateCore(parenMatch ? en.slice(0, parenMatch.index) : en);
  if (parenMatch?.[1]) {
    const inner = translateCore(parenMatch[1]);
    if (inner.toLowerCase() !== out.toLowerCase()) out += ` (${inner.charAt(0).toLowerCase()}${inner.slice(1)})`;
  }
  if (!out) return en;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
