// Análise de refeições com o Gemini (saída em JSON estruturado). A chave só existe aqui, no servidor.

const MEAL_TYPES = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
  'pre_workout',
  'post_workout',
  'other',
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export interface MealItem {
  name: string;
  quantity: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Analysis {
  /** false quando a mensagem não descreve uma refeição (ex.: uma pergunta). */
  is_meal: boolean;
  meal_type: MealType;
  description: string;
  items: MealItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** Comentário curto sobre a refeição, ou a resposta quando `is_meal` é false. */
  feedback: string;
}

const num = { type: 'NUMBER' };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_meal: { type: 'BOOLEAN' },
    meal_type: { type: 'STRING', enum: [...MEAL_TYPES] },
    description: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, quantity: { type: 'STRING' }, kcal: num, protein_g: num, carbs_g: num, fat_g: num },
        required: ['name', 'quantity', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
    kcal: num,
    protein_g: num,
    carbs_g: num,
    fat_g: num,
    fiber_g: num,
    feedback: { type: 'STRING' },
  },
  required: ['is_meal', 'meal_type', 'description', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'feedback'],
};

const SYSTEM = `Você é o nutricionista esportivo do app TA Triathlon. O atleta está se preparando para um Ironman 70.3
e tem como meta reduzir gordura preservando massa muscular. Ele manda pelo Telegram fotos ou descrições do que comeu.

Quando a mensagem descreve uma refeição (texto e/ou foto):
- is_meal = true; liste cada alimento em "items" com a porção estimada (ex.: "150 g", "2 colheres de sopa") e os macros.
- Estime porções de forma realista para um prato brasileiro; na dúvida, assuma a porção típica e diga isso no feedback.
- Os totais (kcal, protein_g, carbs_g, fat_g, fiber_g) são a soma dos itens (fibra pode ser estimada só no total).
- meal_type: deduza pelo texto ou pelo horário local informado (pré/pós-treino se ele disser).
- description: resumo curto em português (ex.: "Arroz, feijão, frango grelhado e salada").
- feedback: 1 a 3 frases em português, diretas, considerando o que ele já comeu hoje e os treinos do dia
  (proteína suficiente? carboidrato adequado ao treino? algo para ajustar na próxima refeição?).

Quando a mensagem NÃO é uma refeição (pergunta, cumprimento, foto que não é comida):
- is_meal = false, items vazio, totais 0, meal_type "other", description "";
- feedback = resposta curta e útil em português.

Nunca invente que ele comeu algo que não foi dito ou mostrado.`;

export async function analyzeMeal(input: {
  text?: string;
  photo?: { data: string; mimeType: string };
  context: string;
}): Promise<Analysis> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada no servidor.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const parts: Record<string, unknown>[] = [{ text: `${input.context}\n\nMensagem do atleta: ${input.text?.trim() || '(só a foto)'}` }];
  if (input.photo) parts.push({ inline_data: { mime_type: input.photo.mimeType, data: input.photo.data } });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(`Gemini: ${data?.error?.message ?? res.status}`);

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let out: Analysis;
  try {
    out = JSON.parse(text) as Analysis;
  } catch {
    throw new Error('O Gemini não devolveu uma análise válida.');
  }
  if (!MEAL_TYPES.includes(out.meal_type)) out.meal_type = 'other';
  out.items ??= [];
  return out;
}
