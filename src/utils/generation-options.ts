import { AIModel, ModelType, SmartTopologyModel } from "../constants.js";

type GenerationEndpoint = "text" | "image" | "multi-image";

interface GenerationOptions {
  ai_model?: string;
  model_type?: string;
  topology?: string;
  target_polycount?: number;
  geometry_resolution?: "standard" | "2k" | "4k";
  ultra_mode?: boolean;
}

export function resolveGenerationOptions(options: GenerationOptions, endpoint: GenerationEndpoint) {
  const isSmartModel = options.ai_model === SmartTopologyModel.MESHY_T1 ||
    options.ai_model === SmartTopologyModel.MESHY_T2;
  const modelType = options.model_type ?? (isSmartModel ? ModelType.SMART_TOPOLOGY : ModelType.STANDARD);
  const model = options.ai_model ?? (modelType === ModelType.SMART_TOPOLOGY
    ? SmartTopologyModel.MESHY_T2 : AIModel.LATEST);
  const smartTopology = modelType === ModelType.SMART_TOPOLOGY;

  if (smartTopology && model !== SmartTopologyModel.MESHY_T1 && model !== SmartTopologyModel.MESHY_T2) {
    throw new Error("Smart Topology requires ai_model meshy-t2 (or legacy meshy-t1 on single-image generation).");
  }
  if (isSmartModel && !smartTopology) {
    throw new Error("Smart Topology models require model_type smart-topology.");
  }
  if (smartTopology && (endpoint === "multi-image" || (endpoint === "text" && model !== SmartTopologyModel.MESHY_T2))) {
    throw new Error("T2 Smart Topology is supported on text preview and single-image generation only.");
  }
  if (model === SmartTopologyModel.MESHY_T2 && options.target_polycount !== undefined && options.target_polycount > 15000) {
    throw new Error("T2 target_polycount must be between 100 and 15,000 faces.");
  }
  if (smartTopology && endpoint === "text" && options.topology === "quad") {
    throw new Error("T2 text preview accepts triangle topology only.");
  }
  if (options.ultra_mode && options.geometry_resolution !== undefined && options.geometry_resolution !== "2k") {
    throw new Error("ultra_mode true conflicts with geometry_resolution; use 2k or omit the deprecated flag.");
  }

  // Preserve the pre-7.1 single-image Ultra request for legacy callers.
  const legacyUltra = options.ultra_mode && model === AIModel.MESHY_7 &&
    endpoint === "image" && options.geometry_resolution === undefined;
  const geometryResolution = options.geometry_resolution ?? (options.ultra_mode && !legacyUltra ? "2k" : undefined);
  if (geometryResolution !== undefined || legacyUltra) {
    if (modelType !== ModelType.STANDARD) {
      throw new Error("Geometry resolution and Ultra require standard generation, not Smart Topology or lowpoly.");
    }
    if (!legacyUltra && model !== AIModel.MESHY_7_1 && model !== AIModel.LATEST) {
      throw new Error("geometry_resolution requires ai_model meshy-7.1 or latest.");
    }
    if (endpoint === "multi-image" && geometryResolution === "4k") {
      throw new Error("Multi-image geometry_resolution supports standard or 2k only.");
    }
  }

  return {
    ai_model: model,
    model_type: modelType,
    smartTopology,
    geometry_resolution: geometryResolution,
    ultra_mode: legacyUltra ? true : undefined
  };
}
