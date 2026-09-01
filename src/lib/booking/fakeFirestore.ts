import { FieldValue } from "firebase-admin/firestore";

/**
 * Fake do Firestore do Admin SDK para testes unitários do motor de agendamento
 * (src/lib/booking/server.ts) sem depender do emulador ou de um projeto real.
 *
 * Suporta apenas o subconjunto de operações usado pelo booking server:
 *  - collection(path) / doc(path) encadeados
 *  - where / limit / orderBy / count em queries
 *  - get, set, update, add, runTransaction
 *  - FieldValue.serverTimestamp() e FieldValue.increment(n)
 *
 * As escritas são aplicadas imediatamente (transações sequenciais), o que é
 * suficiente para exercitar a prevenção de double booking via ID determinístico
 * e a checagem de sobreposição.
 */

type DocData = Record<string, unknown>;
type WhereClause = { field: string; op: string; value: unknown };

function comparable(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return v;
}

function matches(docData: DocData, w: WhereClause): boolean {
  const actual = comparable(docData[w.field]);
  const expected = comparable(w.value);
  switch (w.op) {
    case "==":
      return actual === expected;
    case "<":
      return (actual as number) < (expected as number);
    case "<=":
      return (actual as number) <= (expected as number);
    case ">":
      return (actual as number) > (expected as number);
    case ">=":
      return (actual as number) >= (expected as number);
    case "in":
      return Array.isArray(w.value) && (w.value as unknown[]).includes(docData[w.field] as never);
    case "array-contains":
      return Array.isArray(docData[w.field]) && (docData[w.field] as unknown[]).includes(w.value);
    default:
      return true;
  }
}

function childDocPaths(store: Map<string, DocData>, collectionPath: string): string[] {
  const prefix = `${collectionPath}/`;
  const out: string[] = [];
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length);
      if (!rest.includes("/")) out.push(key);
    }
  }
  return out;
}

export class FakeDocumentSnapshot {
  readonly ref: {
    path: string;
    update: (data: DocData) => Promise<void>;
    delete: () => Promise<void>;
  };

  constructor(
    public db: FakeFirestore,
    public path: string,
    private dataValue: DocData | null
  ) {
    this.ref = {
      path,
      update: (data: DocData) => {
        const current = this.db.store.get(path) ?? {};
        this.db.store.set(path, this.db.applyUpdate(current, data));
        return Promise.resolve();
      },
      delete: async () => {
        this.db.store.delete(path);
      },
    };
  }

  get id(): string {
    return this.path.split("/").pop() ?? "";
  }

  get exists(): boolean {
    return this.dataValue !== null;
  }

  data(): DocData {
    if (!this.dataValue) throw new Error("Document doesn't exist");
    return this.dataValue;
  }

  update(data: DocData): Promise<void> {
    if (!this.exists) throw new Error("Document doesn't exist");
    this.db.store.set(this.path, this.db.applyUpdate(this.dataValue!, data));
    return Promise.resolve();
  }
}

export class FakeQuerySnapshot {
  constructor(public docs: FakeDocumentSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }
}

export class FakeDocumentRef {
  constructor(
    public db: FakeFirestore,
    public path: string
  ) {}

  get id(): string {
    return this.path.split("/").pop() ?? "";
  }

  async get(): Promise<FakeDocumentSnapshot> {
    const data = this.db.store.get(this.path) ?? null;
    return new FakeDocumentSnapshot(this.db, this.path, data);
  }

  collection(segment: string): FakeCollectionRef {
    return new FakeCollectionRef(this.db, `${this.path}/${segment}`);
  }

  async set(data: DocData): Promise<void> {
    this.db.store.set(this.path, this.db.processWrite(data));
  }

  async update(data: DocData): Promise<void> {
    const current = this.db.store.get(this.path) ?? {};
    this.db.store.set(this.path, this.db.applyUpdate(current, data));
  }

  async delete(): Promise<void> {
    this.db.store.delete(this.path);
  }
}

export class FakeQuery {
  constructor(
    public db: FakeFirestore,
    public path: string,
    public wheres: WhereClause[] = [],
    public limitValue?: number
  ) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path, [...this.wheres, { field, op, value }], this.limitValue);
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, this.path, this.wheres, n);
  }

  orderBy(): FakeQuery {
    return this;
  }

  private match(): FakeDocumentSnapshot[] {
    const docs = childDocPaths(this.db.store, this.path).map(
      (key) => new FakeDocumentSnapshot(this.db, key, this.db.store.get(key) ?? {})
    );
    const filtered = docs.filter((d) => this.wheres.every((w) => matches(d.data(), w)));
    return this.limitValue ? filtered.slice(0, this.limitValue) : filtered;
  }

  async get(): Promise<FakeQuerySnapshot> {
    return new FakeQuerySnapshot(this.match());
  }

  count(): { get: () => Promise<{ data: () => { count: number } }> } {
    return {
      get: async () => ({ data: () => ({ count: this.match().length }) }),
    };
  }
}

/** Query sobre uma collection group (ex.: todas as subcoleções `api_keys`). */
export class FakeCollectionGroupQuery {
  constructor(
    public db: FakeFirestore,
    private docPaths: string[],
    private wheres: WhereClause[] = [],
    private limitValue?: number
  ) {}

  where(field: string, op: string, value: unknown): FakeCollectionGroupQuery {
    return new FakeCollectionGroupQuery(
      this.db,
      this.docPaths,
      [...this.wheres, { field, op, value }],
      this.limitValue
    );
  }

  limit(n: number): FakeCollectionGroupQuery {
    return new FakeCollectionGroupQuery(this.db, this.docPaths, this.wheres, n);
  }

  orderBy(): FakeCollectionGroupQuery {
    return this;
  }

  private match(): FakeDocumentSnapshot[] {
    const docs = this.docPaths.map(
      (key) => new FakeDocumentSnapshot(this.db, key, this.db.store.get(key) ?? {})
    );
    const filtered = docs.filter((d) => this.wheres.every((w) => matches(d.data(), w)));
    return this.limitValue ? filtered.slice(0, this.limitValue) : filtered;
  }

  async get(): Promise<FakeQuerySnapshot> {
    return new FakeQuerySnapshot(this.match());
  }

  count(): { get: () => Promise<{ data: () => { count: number } }> } {
    return {
      get: async () => ({ data: () => ({ count: this.match().length }) }),
    };
  }
}

export class FakeCollectionRef extends FakeQuery {
  constructor(
    public db: FakeFirestore,
    public path: string
  ) {
    super(db, path);
  }

  doc(id: string): FakeDocumentRef {
    return new FakeDocumentRef(this.db, `${this.path}/${id}`);
  }

  async add(data: DocData): Promise<{ id: string }> {
    const id = `auto_${++this.db.counter}`;
    this.db.store.set(`${this.path}/${id}`, this.db.processWrite(data));
    return { id };
  }
}

export class FakeTransaction {
  constructor(public db: FakeFirestore) {}

  async get(ref: FakeDocumentRef | FakeQuery): Promise<FakeDocumentSnapshot | FakeQuerySnapshot> {
    if (ref instanceof FakeDocumentRef) return ref.get();
    return ref.get();
  }

  set(ref: FakeDocumentRef, data: DocData): Promise<void> {
    return ref.set(data);
  }

  update(ref: FakeDocumentRef, data: DocData): Promise<void> {
    return ref.update(data);
  }
}

export class FakeFirestore {
  store = new Map<string, DocData>();
  counter = 0;

  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(this, path);
  }

  doc(path: string): FakeDocumentRef {
    return new FakeDocumentRef(this, path);
  }

  /**
   * Encontra todos os documentos cuja coleção imediata tem o nome informado,
   * em qualquer caminho (ex.: `tenants/t1/api_keys/xxx`).
   */
  collectionGroup(name: string): FakeCollectionGroupQuery {
    const paths: string[] = [];
    for (const key of this.store.keys()) {
      const parts = key.split("/");
      if (parts.length % 2 === 0 && parts[parts.length - 2] === name) paths.push(key);
    }
    return new FakeCollectionGroupQuery(this, paths);
  }

  runTransaction(fn: (tx: FakeTransaction) => Promise<unknown> | unknown): Promise<unknown> {
    return Promise.resolve(fn(new FakeTransaction(this)));
  }

  processWrite(data: DocData): DocData {
    const out: DocData = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = this.processValue(v);
    }
    return out;
  }

  private processValue(v: unknown): unknown {
    if (v instanceof FieldValue) {
      const operand = (v as { operand?: number }).operand;
      return typeof operand === "number" ? operand : new Date();
    }
    return v;
  }

  applyUpdate(current: DocData, patch: DocData): DocData {
    const out = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v instanceof FieldValue) {
        const operand = (v as { operand?: number }).operand;
        if (typeof operand === "number") {
          const base = typeof out[k] === "number" ? (out[k] as number) : 0;
          out[k] = base + operand;
        } else {
          out[k] = new Date();
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
