/**
 * Zod schemas for generation tools
 */

import { z } from "zod";
import {
  AIModel,
  ModelType,
  SmartTopologyModel,
  SymmetryMode,
  TextureResolution,
  Topology,
  PoseMode
} from "../constants.js";

/**
 * Shared target_formats schema.
 * 3MF is NOT included in default output — must be explicitly requested.
 */
const TargetFormatsSchema = z.array(z.enum(["glb", "obj", "fbx", "stl", "usdz", "3mf"]))
  .optional()
  .describe("Output formats to generate. When omitted, produces glb/obj/fbx/stl/usdz but NOT 3mf. To get 3MF, you MUST include '3mf' explicitly (e.g. [\"glb\", \"3mf\"]). Specifying formats can reduce task completion time.");

/**
 * Shared optional parameters reused across generation/refine schemas.
 * Defined as factory functions so each schema gets a fresh ZodType instance.
 */
const decimationMode = () =>
  z.number().int().min(1).max(4).optional()
    .describe("Adaptive decimation polycount level (1=ultra, 2=high, 3=medium, 4=low). When set, target_polycount is ignored.");
const alphaThumbnail = () =>
  z.boolean().optional()
    .describe("Also render a transparent-background (RGBA) preview, returned as alpha_thumbnail_url. Default false.");
const hdTexture = () =>
  z.boolean().optional()
    .describe("DEPRECATED — use texture_resolution instead (hd_texture: true is exactly texture_resolution: '4k'). Kept for backward compatibility.");
const textureResolution = () =>
  z.nativeEnum(TextureResolution).optional()
    .describe("Base color texture resolution: 2k (default), 4k, or 8k. Supported on meshy-6 / meshy-7 / meshy-7.1 / latest / smart-topology. PBR maps stay at 2K. Replaces hd_texture; confirm current texturing cost before submitting.");
const multiViewThumbnails = () =>
  z.boolean().optional()
    .describe("Also return 4 cardinal-view thumbnails (front/back/left/right). Default false.");
const geometryResolution = () =>
  z.enum(["standard", "2k", "4k"]).optional()
    .describe("Meshy 7.1 geometry pass: standard, 2k, or 4k. Requires meshy-7.1/latest and standard model type. Confirm additional cost before higher-detail passes.");
const deprecatedUltraMode = () =>
  z.boolean().optional()
    .describe("DEPRECATED — prefer geometry_resolution. true is equivalent to the 2k geometry pass; cannot conflict with geometry_resolution or be used with Smart Topology/lowpoly.");
const lightingRemoval = () =>
  z.boolean().optional()
    .describe("Lighting removal for Meshy 6 only. Omitted values are left to the API default; not automatically sent with latest or Meshy 7.1.");
const deprecatedSymmetryMode = () =>
  z.nativeEnum(SymmetryMode).optional()
    .describe("DEPRECATED — no longer affects output (kept for backward compatibility). Values: 'off', 'auto', 'on'.");
import {
  ResponseFormatSchema,
  PromptSchema,
  UrlSchema
} from "./common.js";

/**
 * Text-to-3D input schema
 */
export const TextTo3DInputSchema = z.object({
  prompt: PromptSchema,
  ai_model: z.union([z.nativeEnum(AIModel), z.literal(SmartTopologyModel.MESHY_T2)])
    .optional()
    .describe("Standard generation: meshy-7.1 or latest (currently Meshy 7.1); legacy standard IDs remain accepted. Smart Topology: meshy-t2 with model_type smart-topology. Omitted model defaults to latest for standard or T2 for Smart Topology. Confirm model choice and current cost before generation."),
  model_type: z.nativeEnum(ModelType)
    .optional()
    .describe("standard (default), smart-topology (T2, triangle-only), or deprecated lowpoly. Smart Topology ignores remesh and adaptive-decimation controls."),
  geometry_resolution: geometryResolution(),
  ultra_mode: deprecatedUltraMode(),
  topology: z.nativeEnum(Topology)
    .optional()
    .describe("Mesh topology type (quad or triangle)"),
  target_polycount: z.number()
    .int()
    .min(100, "Polycount must be at least 100")
    .max(300000, "Polycount cannot exceed 300,000")
    .optional()
    .describe("Standard remesh target: 100–300,000 faces. Supported T2 routes generate directly at 100–15,000 faces (default 4,000)."),
  decimation_mode: decimationMode(),
  symmetry_mode: deprecatedSymmetryMode(),
  should_remesh: z.boolean()
    .optional()
    .describe("Enable standard remeshing to apply a target count. Defaults false for Meshy 6/7/7.1. Ignored on Smart Topology routes."),
  pose_mode: z.nativeEnum(PoseMode)
    .optional()
    .describe("Pose mode for character models: 'a-pose' or 't-pose'. IMPORTANT: When the user intends to rig or animate the model, default to 't-pose' for best rigging results"),
  target_formats: TargetFormatsSchema,
  alpha_thumbnail: alphaThumbnail(),
  auto_size: z.boolean()
    .optional()
    .describe("Use AI to auto-estimate real-world height and resize the model. Default false."),
  origin_at: z.enum(["bottom", "center"])
    .optional()
    .describe("Origin position: 'bottom' or 'center'. Default 'bottom' when auto_size is true."),
  response_format: ResponseFormatSchema
}).strict();

/**
 * Image-to-3D input schema
 */
export const ImageTo3DInputSchema = z.object({
  image_url: z.string()
    .optional()
    .describe("PUBLIC image URL (https://...). Use ONLY for remote images. For local files use file_path instead. NEVER manually base64-encode."),
  file_path: z.string()
    .optional()
    .describe("ABSOLUTE path to LOCAL image (.jpg/.png). PREFERRED for local files. Server auto-encodes. Example: /Users/me/photo.jpg. NEVER manually base64-encode."),
  input_task_id: z.string()
    .optional()
    .describe("Chain from a SUCCEEDED text-to-image or image-to-image task: use its generated image as the input instead of image_url/file_path. Provide only one image source."),
  ai_model: z.union([z.nativeEnum(AIModel), z.nativeEnum(SmartTopologyModel)])
    .optional()
    .describe("Standard generation: meshy-7.1 or latest (currently Meshy 7.1); legacy IDs remain accepted. Smart Topology: meshy-t2 (default) or legacy meshy-t1 with model_type smart-topology. Confirm model choice and current cost before generation."),
  geometry_resolution: geometryResolution(),
  ultra_mode: deprecatedUltraMode(),
  model_type: z.nativeEnum(ModelType)
    .optional()
    .describe("Model type: 'standard' (default), 'smart-topology' (part-separated geometry via meshy-t1/meshy-t2), or deprecated 'lowpoly'. Prefer Smart Topology for controllable lower-poly generation; confirm current costs."),
  pose_mode: z.nativeEnum(PoseMode)
    .optional()
    .describe("Pose mode for character models: 'a-pose' or 't-pose'. IMPORTANT: When the user intends to rig or animate the model, default to 't-pose' for best rigging results"),
  enable_pbr: z.boolean()
    .default(false)
    .describe("Enable physically-based rendering textures. Default false"),
  topology: z.nativeEnum(Topology)
    .optional()
    .describe("Mesh topology type (quad or triangle)"),
  target_polycount: z.number()
    .int()
    .min(100, "Polycount must be at least 100")
    .max(300000, "Polycount cannot exceed 300,000")
    .optional()
    .describe("Standard remesh target: 100–300,000 faces. Supported T2 routes generate directly at 100–15,000 faces (default 4,000)."),
  decimation_mode: decimationMode(),
  should_remesh: z.boolean()
    .optional()
    .describe("Enable standard remeshing to apply a target count. Defaults false for Meshy 6/7/7.1. Ignored on Smart Topology routes."),
  symmetry_mode: deprecatedSymmetryMode(),
  should_texture: z.boolean()
    .optional()
    .describe("Whether to generate textures. Default true"),
  texture_prompt: z.string()
    .max(600)
    .optional()
    .describe("Text to guide texturing. Max 600 characters"),
  texture_image_url: UrlSchema
    .optional()
    .describe("Image URL to guide texturing"),
  texture_resolution: textureResolution(),
  hd_texture: hdTexture(),
  image_enhancement: z.boolean()
    .optional()
    .describe("Optimize input image. Supported on meshy-6, meshy-7.1, and latest. Set false to preserve deliberate source styling."),
  remove_lighting: lightingRemoval(),
  save_pre_remeshed_model: z.boolean()
    .optional()
    .describe("Store GLB before remeshing. Default false. Only applies when should_remesh is true"),
  target_formats: TargetFormatsSchema,
  alpha_thumbnail: alphaThumbnail(),
  multi_view_thumbnails: multiViewThumbnails(),
  auto_size: z.boolean()
    .optional()
    .describe("Use AI to auto-estimate real-world height and resize the model. Default false."),
  origin_at: z.enum(["bottom", "center"])
    .optional()
    .describe("Origin position: 'bottom' or 'center'. Default 'bottom' when auto_size is true."),
  response_format: ResponseFormatSchema
}).strict();

/**
 * Text-to-3D Refine input schema
 */
export const TextTo3DRefineInputSchema = z.object({
  preview_task_id: z.string()
    .min(1, "Preview task ID is required")
    .describe("Task ID of the completed preview task to refine"),
  enable_pbr: z.boolean()
    .default(false)
    .describe("Enable physically-based rendering textures"),
  texture_prompt: z.string()
    .max(600, "Texture prompt must not exceed 600 characters")
    .optional()
    .describe("Text to guide texturing. Max 600 characters"),
  texture_image_url: UrlSchema
    .optional()
    .describe("Image URL to guide texturing"),
  ai_model: z.nativeEnum(AIModel)
    .optional()
    .describe("Refine model override: meshy-7.1/latest or a legacy standard model. Omit to inherit the preview model. Do not pass T2 as a refine override; confirm texturing cost before submitting."),
  texture_resolution: textureResolution(),
  hd_texture: hdTexture(),
  remove_lighting: lightingRemoval(),
  target_formats: TargetFormatsSchema,
  alpha_thumbnail: alphaThumbnail(),
  auto_size: z.boolean()
    .optional()
    .describe("Use AI to auto-estimate real-world height and resize the model. Default false."),
  origin_at: z.enum(["bottom", "center"])
    .optional()
    .describe("Origin position: 'bottom' or 'center'. Default 'bottom' when auto_size is true."),
  response_format: ResponseFormatSchema
}).strict();

/**
 * Multi-image-to-3D input schema
 */
export const MultiImageTo3DInputSchema = z.object({
  image_urls: z.array(z.string())
    .min(1)
    .max(4)
    .optional()
    .describe("Array of 1–4 publicly accessible image URLs. Provide this OR file_paths, not both"),
  file_paths: z.array(z.string())
    .min(1)
    .max(4)
    .optional()
    .describe("Array of 1–4 absolute paths to local image files (.jpg, .jpeg, .png). The server reads and encodes them automatically"),
  input_task_id: z.string()
    .optional()
    .describe("Chain from a SUCCEEDED text-to-image / image-to-image task that produced multi-view images, using them as the input instead of image_urls/file_paths."),
  ai_model: z.nativeEnum(AIModel)
    .default(AIModel.LATEST)
    .describe("Standard generation: meshy-7.1 or latest (currently Meshy 7.1); legacy IDs remain accepted. Smart Topology is not supported here. Confirm model choice and current cost first."),
  geometry_resolution: z.enum(["standard", "2k"]).optional()
    .describe("Meshy 7.1 multi-image geometry pass: standard or 2k only. Confirm extra cost before using 2k."),
  ultra_mode: deprecatedUltraMode(),
  model_type: z.enum([ModelType.STANDARD, ModelType.LOWPOLY])
    .optional()
    .describe("Model type: standard or deprecated lowpoly. Smart Topology is unavailable on multi-image generation."),
  pose_mode: z.nativeEnum(PoseMode)
    .optional()
    .describe("Pose mode for character models: 'a-pose' or 't-pose'. IMPORTANT: When the user intends to rig or animate the model, default to 't-pose' for best rigging results"),
  enable_pbr: z.boolean()
    .default(false)
    .describe("Enable physically-based rendering textures. Default false"),
  topology: z.nativeEnum(Topology)
    .optional()
    .describe("Mesh topology type (quad or triangle)"),
  target_polycount: z.number()
    .int()
    .min(100, "Polycount must be at least 100")
    .max(300000, "Polycount cannot exceed 300,000")
    .optional()
    .describe("Multi-image standard remesh target: 100–300,000 faces. Requires should_remesh true; decimation_mode takes precedence. Smart Topology is not supported on this endpoint."),
  decimation_mode: decimationMode(),
  should_remesh: z.boolean()
    .optional()
    .describe("Enable standard remeshing to apply a target count. Defaults false for Meshy 6/7/7.1."),
  symmetry_mode: deprecatedSymmetryMode(),
  should_texture: z.boolean()
    .optional()
    .describe("Whether to generate textures. Default true"),
  texture_prompt: z.string()
    .max(600)
    .optional()
    .describe("Text to guide texturing. Max 600 characters"),
  texture_image_url: UrlSchema
    .optional()
    .describe("Image URL to guide texturing"),
  texture_resolution: textureResolution(),
  hd_texture: hdTexture(),
  image_enhancement: z.boolean()
    .optional()
    .describe("Optimize input images. Supported on meshy-6, meshy-7.1, and latest. Set false to preserve source styling."),
  remove_lighting: lightingRemoval(),
  save_pre_remeshed_model: z.boolean()
    .optional()
    .describe("Store GLB before remeshing. Default false. Only applies when should_remesh is true"),
  target_formats: TargetFormatsSchema,
  alpha_thumbnail: alphaThumbnail(),
  multi_view_thumbnails: multiViewThumbnails(),
  auto_size: z.boolean()
    .optional()
    .describe("Use AI to auto-estimate real-world height and resize the model. Default false."),
  origin_at: z.enum(["bottom", "center"])
    .optional()
    .describe("Origin position: 'bottom' or 'center'. Default 'bottom' when auto_size is true."),
  response_format: ResponseFormatSchema
}).strict();
