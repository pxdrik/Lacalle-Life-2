// Monta um backup válido do Life com dados de demonstração, em cima do catálogo
// real exportado do app (probe/base.json). Nada aqui entra no app do Pedro:
// o arquivo só é importado no perfil temporário do navegador de captura.
import { randomUUID } from "node:crypto";

const DAY_MS = 86_400_000;
const uid = () => randomUUID();

export function localDay(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function buildDemoBackup(base, now = new Date()) {
  const foodById = new Map(base.stores.foods.map((f) => [f.id, f]));
  const exById = new Map(base.stores.exercises.map((e) => [e.id, e]));
  const t = now.getTime();
  const env = (at = t) => ({ id: uid(), createdAt: at, updatedAt: at });

  const item = (foodId, grams) => {
    const f = foodById.get(foodId);
    if (!f) throw new Error(`alimento fora do catálogo: ${foodId}`);
    return {
      id: uid(),
      foodId: f.id,
      name: f.name,
      grams,
      unit: f.unit,
      per100g: f.per100g,
      ...(f.practicalUnit ? { practicalUnit: f.practicalUnit } : {}),
    };
  };
  const meal = (name, time, items) => ({
    id: uid(),
    name,
    time,
    notes: "",
    items,
  });

  const diet = {
    ...env(t - 20 * DAY_MS),
    name: "Ganho de massa",
    weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    meals: [
      meal("Café da manhã", "07:30", [
        item("aveia-em-flocos", 50),
        item("banana", 120),
        item("leite-integral", 300),
        item("pao-frances", 80),
        item("abacate", 50),
      ]),
      meal("Almoço", "12:30", [
        item("arroz-branco-cozido", 300),
        item("feijao-cozido", 150),
        item("frango-peito-sem-pele-grelhado", 80),
        item("brocolis-cozido", 80),
        item("azeite-de-oliva", 14),
      ]),
      meal("Lanche", "16:00", [
        item("iogurte-grego-natural", 170),
        item("aveia-em-flocos", 20),
        item("maca-vermelha", 130),
        item("amendoim", 30),
      ]),
      meal("Jantar", "20:00", [
        item("arroz-branco-cozido", 250),
        item("frango-peito-sem-pele-grelhado", 80),
        item("batata-doce-cozida", 200),
        item("tomate", 60),
        item("azeite-de-oliva", 18),
      ]),
    ],
  };

  // --- treinos -------------------------------------------------------------
  const routineDefs = [
    {
      name: "Treino A · Peito e tríceps",
      exercises: [
        ["supino-reto-barra", 4, 8, 60],
        ["supino-inclinado-barra", 3, 10, 50],
        ["elevacao-lateral-halteres", 3, 12, 10],
        ["triceps-polia-barra", 3, 12, 30],
      ],
    },
    {
      name: "Treino B · Costas e bíceps",
      exercises: [
        ["puxada-frontal-pronada", 4, 10, 55],
        ["remada-curvada-barra", 4, 8, 50],
        ["remada-baixa-polia", 3, 10, 45],
        ["rosca-direta-barra", 3, 10, 25],
      ],
    },
    {
      name: "Treino C · Pernas",
      exercises: [
        ["agachamento-livre-barra", 4, 8, 70],
        ["leg-press-45", 4, 10, 160],
        ["cadeira-extensora", 3, 12, 45],
        ["mesa-flexora", 3, 12, 35],
      ],
    },
  ];

  const WEEKS = 10;
  const bumpFor = (week) => Math.floor((WEEKS - 1 - week) / 3) * 2.5;
  const routines = routineDefs.map((def, i) => ({
    ...env(t - (40 - i) * DAY_MS),
    name: def.name,
    notes: "",
    exercises: def.exercises.map(([exerciseId, sets, reps, kg]) => {
      const ex = exById.get(exerciseId);
      if (!ex) throw new Error(`exercício fora do catálogo: ${exerciseId}`);
      return {
        id: uid(),
        exerciseId,
        name: ex.name,
        restSeconds: 90,
        notes: "",
        sets: Array.from({ length: sets }, () => ({
          id: uid(),
          reps,
          weightKg: kg + bumpFor(0),
          rpe: null,
          durationSeconds: null,
        })),
      };
    }),
  }));

  // Histórico: 6 semanas, A/B/C, com carga subindo 2,5 kg a cada duas semanas.
  const sessions = [];
  for (let week = WEEKS - 1; week >= 0; week--) {
    routines.forEach((routine, i) => {
      const daysAgo = week * 7 + (2 - i) * 2 + 1;
      if (daysAgo < 1) return;
      const start = new Date(now);
      start.setDate(start.getDate() - daysAgo);
      start.setHours(18, 10, 0, 0);
      const bump = bumpFor(week);
      sessions.push({
        ...env(start.getTime()),
        routineId: routine.id,
        name: routine.name,
        startedAt: start.getTime(),
        finishedAt: start.getTime() + 62 * 60_000,
        exercises: routine.exercises.map((re) => ({
          id: uid(),
          exerciseId: re.exerciseId,
          name: re.name,
          restSeconds: re.restSeconds,
          notes: "",
          sets: re.sets.map((s) => ({
            id: uid(),
            reps: s.reps,
            weightKg: s.weightKg - bumpFor(0) + bump,
            rpe: null,
            durationSeconds: null,
            isCompleted: true,
            planned: {
              reps: s.reps,
              weightKg: s.weightKg - bumpFor(0) + bump,
              rpe: null,
              durationSeconds: null,
            },
          })),
        })),
      });
    });
  }

  // --- evolução ------------------------------------------------------------
  const weights = [73.4, 73.6, 73.9, 74.0, 74.4, 74.6, 74.9, 75.1, 75.5, 75.8];
  const body = weights.map((kg, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (weights.length - 1 - i) * 7);
    d.setHours(7, 0, 0, 0);
    return {
      ...env(d.getTime()),
      day: localDay(d),
      notes: "",
      weightKg: kg,
      bodyFatPercent: null,
    };
  });

  const profile = {
    ...env(t - 60 * DAY_MS),
    id: "me", // PROFILE_ID em features/profile/types/profile.ts
    nutrition: {
      sex: "male",
      ageYears: 27,
      heightCm: 178,
      weightKg: 75.8,
      activityLevel: "moderate",
      goal: "bulk",
      weeklyChangeKg: 0.25,
    },
  };

  return {
    schemaVersion: base.schemaVersion,
    exportedAt: t,
    stores: {
      body,
      foodLogs: [],
      foods: base.stores.foods,
      diets: [diet],
      profile: [profile],
      exercises: base.stores.exercises,
      routines,
      sessions,
    },
  };
}
