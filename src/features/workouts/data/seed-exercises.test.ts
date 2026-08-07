import { beforeEach, describe, expect, it } from "vitest";

import type { EntityId } from "@/core/domain/entity";

import type { Exercise } from "../types/exercise";
import { CATALOGUE } from "./catalogue/catalogue";
import media from "./exercise-media.json";
import type { ExerciseRepository } from "./exercise-repository";
import { refreshExerciseMedia, seedExerciseCatalogue } from "./seed-exercises";

/** An exercise the curated mapping has a photo for. */
const MAPPED_ID = "supino-reto-barra";

/**
 * One it deliberately has none for, read from the mapping rather than named.
 *
 * A hardcoded id here rots the moment that exercise gains a photo — which is
 * exactly what happened the first time. Deriving it keeps the test honest, and
 * the throw below means "everything is covered now" fails loudly instead of
 * passing on an empty fixture.
 */
const UNMAPPED_ID = (() => {
  const covered = new Set(Object.keys(media));
  const first = CATALOGUE.find((exercise) => !covered.has(exercise.id));
  if (first === undefined) {
    throw new Error("Todo exercício tem foto: escolha outro caso de teste.");
  }
  return first.id;
})();

class FakeRepository implements ExerciseRepository {
  readonly rows = new Map<EntityId, Exercise>();
  writes = 0;

  listAll() {
    return Promise.resolve([...this.rows.values()]);
  }

  getById(id: EntityId) {
    return Promise.resolve(this.rows.get(id));
  }

  save(exercise: Exercise) {
    this.writes += 1;
    this.rows.set(exercise.id, exercise);
    return Promise.resolve();
  }

  saveMany(exercises: readonly Exercise[]) {
    this.writes += exercises.length;
    for (const exercise of exercises) this.rows.set(exercise.id, exercise);
    return Promise.resolve();
  }

  remove(id: EntityId) {
    this.rows.delete(id);
    return Promise.resolve();
  }

  isEmpty() {
    return Promise.resolve(this.rows.size === 0);
  }
}

beforeEach(() => {
  localStorage.clear();
});

describe("seedExerciseCatalogue", () => {
  it("gives seeded exercises their illustrations straight away", async () => {
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);

    expect(repository.rows.get(MAPPED_ID)?.media?.source).toBe(
      "free-exercise-db",
    );
  });

  it("leaves unmapped exercises with no media rather than a guess", async () => {
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);

    expect(repository.rows.get(UNMAPPED_ID)?.media).toBeNull();
  });

  it("does not re-seed over exercises that are already stored", async () => {
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);
    const writes = repository.writes;

    await seedExerciseCatalogue(repository);

    expect(repository.writes).toBe(writes);
  });
});

/**
 * A row as an older version of the app actually left it: no `media` key at
 * all, rather than the key set to `null`.
 *
 * The distinction is not pedantic. Writing `media: null` here is the more
 * convenient fixture and it is the wrong one — it describes a row that has
 * been through this code, which is precisely the row that needs no backfill.
 */
function asStoredBeforeMedia(exercise: Exercise): Exercise {
  const { media: _media, ...rest } = exercise;
  return rest as Exercise;
}

describe("refreshExerciseMedia", () => {
  it("backfills a catalogue seeded before illustrations existed", async () => {
    // The reason this function exists: seeding skips a populated store, so
    // without a backfill every existing install would stay medialess forever.
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);

    const before = repository.rows.get(MAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    repository.rows.set(MAPPED_ID, asStoredBeforeMedia(before));

    await refreshExerciseMedia(repository);

    expect(repository.rows.get(MAPPED_ID)?.media?.images.length).toBeGreaterThan(
      0,
    );
  });

  it("writes an explicit null onto old rows that get no illustration", async () => {
    // Otherwise the key stays missing and every reader has to keep guarding
    // against a field the type promises is there.
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);

    const before = repository.rows.get(UNMAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    repository.rows.set(UNMAPPED_ID, asStoredBeforeMedia(before));

    await refreshExerciseMedia(repository);

    const after = repository.rows.get(UNMAPPED_ID);
    expect(after).toHaveProperty("media");
    expect(after?.media).toBeNull();
  });

  it("writes nothing when the stored media already matches", async () => {
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);
    const writes = repository.writes;

    await refreshExerciseMedia(repository);

    expect(repository.writes).toBe(writes);
  });

  it("skips the read entirely once the revision is marked", async () => {
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);
    await refreshExerciseMedia(repository);

    // Blank it again; a second refresh must not notice, because the marker
    // says this revision was already applied.
    const before = repository.rows.get(MAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    repository.rows.set(MAPPED_ID, asStoredBeforeMedia(before));

    await refreshExerciseMedia(repository);

    expect(repository.rows.get(MAPPED_ID)?.media).toBeUndefined();
  });

  it("never touches exercises the user created", async () => {
    const repository = new FakeRepository();
    const now = Date.now();
    const custom: Exercise = {
      id: "custom-1",
      name: "Meu exercício",
      aliases: [],
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      stabilizerMuscles: [],
      equipment: ["barbell"],
      movementPattern: null,
      movementPlanes: [],
      technicalDifficulty: null,
      isUnilateral: null,
      isCompound: null,
      media: null,
      classification: "user",
      isCustom: true,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    await repository.save(custom);

    await refreshExerciseMedia(repository);

    expect(repository.rows.get("custom-1")).toEqual(custom);
  });

  it("survives storage being blocked", async () => {
    const repository = new FakeRepository();
    await seedExerciseCatalogue(repository);

    const before = repository.rows.get(MAPPED_ID);
    if (before === undefined) throw new Error("fixture ausente");
    repository.rows.set(MAPPED_ID, asStoredBeforeMedia(before));

    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error("bloqueado");
    };
    Storage.prototype.setItem = () => {
      throw new Error("bloqueado");
    };

    try {
      await refreshExerciseMedia(repository);
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }

    // The images still land. Only the "already done" marker is lost.
    expect(repository.rows.get(MAPPED_ID)?.media).not.toBeNull();
  });
});
