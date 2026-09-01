export type ContextRequest = {
  subject: string;
  purpose: string;
  query?: string;
  profileId?: string;
  maxItems?: number;
};

export type ContextObject = {
  type: string;
  id: string;
  value: Record<string, unknown>;
};

export type ContextScope = "private" | "shared" | "published";
export type ContextBoundary = "inside" | "between" | "beneath" | "around";
export type ContextFlowTarget =
  | "transient-task"
  | "rack-source"
  | "standing-host-practice"
  | "shared-practice"
  | "evaluation"
  | "organisational-analytics";

export type ContextFlowDecision = {
  allowed: boolean;
  reason: string;
};

export type ContextSnapshot = {
  id: string;
  sourceId: string;
  subject: string;
  purpose: string;
  objects: ContextObject[];
  evidenceRefs: string[];
  generatedAt: string;
  expiresAt: string | null;
  scope: ContextScope;
  boundary: ContextBoundary;
  permissions: string[];
  provenance: Record<string, unknown>;
  extensions: Record<string, unknown>;
};

export interface ContextSource {
  id: string;
  resolve(request: ContextRequest): Promise<ContextSnapshot>;
}

export type OosContextRequest = {
  subject: string;
  purpose: string;
  requestedBy: string;
  wanted?: {
    maxItems?: number;
    query?: string;
  };
};

export interface OosContextTransport {
  requestContext(request: OosContextRequest): Promise<unknown>;
}

export type OosNodeCapabilityManifest = {
  protocol: "oos/0.1-draft";
  node: {
    id: string;
    name: string;
    version: string | null;
  };
  provides: string[];
  emits: string[];
  accepts: string[];
  queries: string[];
  actions: string[];
  extensions: Record<string, unknown>;
};

export const rackOosManifest: OosNodeCapabilityManifest = {
  protocol: "oos/0.1-draft",
  node: {
    id: "rack",
    name: "RACK",
    version: "0.1",
  },
  provides: [],
  emits: [],
  accepts: [],
  queries: ["context"],
  actions: [],
  extensions: {
    status: "context-consumer-only",
    note:
      "RACK does not yet advertise OOS Practice objects because Rack modules, Set-ups and shared practice do not map cleanly to one Practice primitive.",
  },
};

const asRecord = (
  value: unknown,
  field: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid OOS Context Packet: ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const stringField = (
  record: Record<string, unknown>,
  field: string,
): string => {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid OOS Context Packet: ${field} must be a string.`);
  }
  return value;
};

const nullableStringField = (
  record: Record<string, unknown>,
  field: string,
): string | null => {
  const value = record[field];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(
      `Invalid OOS Context Packet: ${field} must be a string or null.`,
    );
  }
  return value;
};

const contextScopeField = (
  record: Record<string, unknown>,
  field: string,
): ContextScope => {
  const value = record[field];
  if (value !== "private" && value !== "shared" && value !== "published") {
    throw new Error(
      `Invalid OOS Context Packet: ${field} must be private, shared or published.`,
    );
  }
  return value;
};

const boundaryForScope = (scope: ContextScope): ContextBoundary => {
  if (scope === "private") return "inside";
  if (scope === "shared") return "between";
  return "around";
};

const stringArrayField = (
  record: Record<string, unknown>,
  field: string,
): string[] => {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(
      `Invalid OOS Context Packet: ${field} must be an array of strings.`,
    );
  }
  return [...value];
};

const contextObjects = (value: unknown): ContextObject[] => {
  if (!Array.isArray(value)) {
    throw new Error(
      "Invalid OOS Context Packet: objects must be an array.",
    );
  }

  return value.map((item, index) => {
    const record = asRecord(item, `objects[${index}]`);
    return {
      type: stringField(record, "type"),
      id: stringField(record, "id"),
      value: asRecord(record.value, `objects[${index}].value`),
    };
  });
};

export const parseOosContextPacket = (
  value: unknown,
  expected?: Pick<ContextRequest, "subject" | "purpose">,
): ContextSnapshot => {
  const packet = asRecord(value, "packet");
  if (packet.specversion !== "0.1-draft") {
    throw new Error(
      "Invalid OOS Context Packet: unsupported specversion.",
    );
  }

  const subject = stringField(packet, "subject");
  const purpose = stringField(packet, "purpose");
  const provenance = asRecord(packet.provenance, "provenance");
  const createdBy = asRecord(provenance.created_by, "provenance.created_by");
  const sourceId = stringField(createdBy, "id");
  const scope = contextScopeField(packet, "scope");
  const extensions = asRecord(packet.extensions, "extensions");

  if (expected?.subject !== undefined && expected.subject !== subject) {
    throw new Error(
      `OOS Context Packet subject mismatch: expected ${expected.subject}, received ${subject}.`,
    );
  }

  if (expected?.purpose !== undefined && expected.purpose !== purpose) {
    throw new Error(
      `OOS Context Packet purpose mismatch: expected ${expected.purpose}, received ${purpose}.`,
    );
  }

  return {
    id: stringField(packet, "id"),
    sourceId,
    subject,
    purpose,
    objects: contextObjects(packet.objects),
    evidenceRefs: stringArrayField(packet, "evidence_refs"),
    generatedAt: stringField(packet, "generated_at"),
    expiresAt: nullableStringField(packet, "expires_at"),
    scope,
    boundary: boundaryForScope(scope),
    permissions: stringArrayField(packet, "permissions"),
    provenance,
    extensions,
  };
};

export const contextFlowDecision = (
  snapshot: ContextSnapshot,
  target: ContextFlowTarget,
): ContextFlowDecision => {
  if (target === "transient-task") {
    if (
      snapshot.permissions.includes("local-use-only") ||
      snapshot.permissions.includes("task-use")
    ) {
      return {
        allowed: true,
        reason:
          "This purpose-bound snapshot may be used transiently for the reviewed task.",
      };
    }

    return {
      allowed: false,
      reason:
        "This Context Packet does not grant permission for transient task use.",
    };
  }

  const reasons: Record<Exclude<ContextFlowTarget, "transient-task">, string> = {
    "rack-source":
      "Purpose-bound context must not silently become canonical Rack source.",
    "standing-host-practice":
      "Purpose-bound context must not be installed as standing host practice.",
    "shared-practice":
      "Context is not practice and must not be republished through shared practice.",
    evaluation:
      "Evaluation is a different purpose and requires a fresh explicit context disclosure.",
    "organisational-analytics":
      "Purpose-bound context must not become organisational analytics or behavioural telemetry.",
  };

  return { allowed: false, reason: reasons[target] };
};

export type OosContextSourceOptions = {
  id?: string;
  requestingNodeId?: string;
  transport: OosContextTransport;
};

export const createOosContextSource = ({
  id = "oos",
  requestingNodeId = "rack",
  transport,
}: OosContextSourceOptions): ContextSource => ({
  id,
  async resolve(request) {
    const packet = await transport.requestContext({
      subject: request.subject,
      purpose: request.purpose,
      requestedBy: requestingNodeId,
      wanted: {
        ...(request.maxItems === undefined
          ? {}
          : { maxItems: request.maxItems }),
        ...(request.query === undefined ? {} : { query: request.query }),
      },
    });

    return parseOosContextPacket(packet, request);
  },
});
