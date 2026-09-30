import assert from "node:assert/strict";
import { registerGenerationTools } from "../dist/tools/generation.js";
import { resolveGenerationOptions } from "../dist/utils/generation-options.js";
import { test } from "node:test";

// Register the actual handlers without constructing a MeshyClient or opening a transport.
function createHarness() {
  const tools = new Map();
  const requests = [];
  registerGenerationTools(
    {
      registerTool(name, config, handler) {
        tools.set(name, { schema: config.inputSchema, handler });
      },
    },
    {
      async post(path, body) {
        requests.push({ path, body });
        return { result: "offline-task-id" };
      },
    },
  );
  return {
    requests,
    async call(name, input) {
      const { schema, handler } = tools.get(name);
      const result = await handler(schema.parse(input));
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return requests.at(-1);
    },
    async invalid(name, input) {
      const { schema, handler } = tools.get(name);
      const result = await handler(schema.parse(input));
      assert.equal(result.isError, true);
      assert.equal(requests.length, 0);
    },
  };
}

for (const endpoint of ["text", "image", "multi-image"]) {
  test(`${endpoint}: explicit Meshy 7.1 geometry`, () => {
    assert.deepEqual(
      resolveGenerationOptions(
        { ai_model: "meshy-7.1", geometry_resolution: "2k" },
        endpoint,
      ),
      {
        ai_model: "meshy-7.1",
        model_type: "standard",
        smartTopology: false,
        geometry_resolution: "2k",
        ultra_mode: undefined,
      },
    );
  });
}

test("Smart Topology selects T2 and infers the matching model type", () => {
  assert.equal(
    resolveGenerationOptions({ model_type: "smart-topology" }, "text").ai_model,
    "meshy-t2",
  );
  assert.equal(
    resolveGenerationOptions({ ai_model: "meshy-t2" }, "image").model_type,
    "smart-topology",
  );
  for (const target_polycount of [100, 15000]) {
    assert.equal(
      resolveGenerationOptions(
        { ai_model: "meshy-t2", target_polycount },
        "text",
      ).smartTopology,
      true,
    );
  }
});

for (const [label, options, endpoint, message] of [
  [
    "standard model with Smart Topology",
    { ai_model: "meshy-7.1", model_type: "smart-topology" },
    "text",
    /requires ai_model/,
  ],
  [
    "T2 with standard type",
    { ai_model: "meshy-t2", model_type: "standard" },
    "image",
    /require model_type/,
  ],
  [
    "multi-image T2",
    { ai_model: "meshy-t2" },
    "multi-image",
    /supported on text preview and single-image/,
  ],
  [
    "text T1",
    { ai_model: "meshy-t1" },
    "text",
    /supported on text preview and single-image/,
  ],
  [
    "T2 over face limit",
    { ai_model: "meshy-t2", target_polycount: 15001 },
    "text",
    /15,000/,
  ],
  [
    "text T2 quad",
    { ai_model: "meshy-t2", topology: "quad" },
    "text",
    /triangle topology/,
  ],
  [
    "multi-image 4k",
    { geometry_resolution: "4k" },
    "multi-image",
    /standard or 2k/,
  ],
  [
    "Ultra conflict",
    { ultra_mode: true, geometry_resolution: "4k" },
    "image",
    /conflicts/,
  ],
  [
    "T2 geometry",
    { ai_model: "meshy-t2", geometry_resolution: "2k" },
    "image",
    /require standard/,
  ],
  [
    "legacy model geometry",
    { ai_model: "meshy-6", geometry_resolution: "2k" },
    "text",
    /requires ai_model/,
  ],
]) {
  test(`rejects ${label}`, () =>
    assert.throws(() => resolveGenerationOptions(options, endpoint), message));
}

test("Ultra alias maps to 2k but preserves legacy single-image Meshy 7", () => {
  for (const endpoint of ["text", "image", "multi-image"]) {
    assert.equal(
      resolveGenerationOptions({ ultra_mode: true }, endpoint)
        .geometry_resolution,
      "2k",
    );
  }
  const legacy = resolveGenerationOptions(
    { ai_model: "meshy-7", ultra_mode: true },
    "image",
  );
  assert.equal(legacy.ultra_mode, true);
  assert.equal(legacy.geometry_resolution, undefined);
});

test("text preview forwards 7.1 geometry and explicit false values", async () => {
  const { call } = createHarness();
  const { path, body } = await call("meshy_text_to_3d", {
    prompt: "a robot",
    ai_model: "meshy-7.1",
    geometry_resolution: "4k",
    should_remesh: false,
    auto_size: false,
    alpha_thumbnail: false,
  });
  assert.equal(path, "/openapi/v2/text-to-3d");
  assert.equal(body.mode, "preview");
  assert.equal(body.ai_model, "meshy-7.1");
  assert.equal(body.geometry_resolution, "4k");
  assert.equal(body.should_remesh, false);
  assert.equal(body.auto_size, false);
  assert.equal(body.alpha_thumbnail, false);
});

test("text T2 forwards face target, not remesh or decimation", async () => {
  const { call } = createHarness();
  const { body } = await call("meshy_text_to_3d", {
    prompt: "a robot",
    model_type: "smart-topology",
    target_polycount: 4000,
    topology: "triangle",
    should_remesh: true,
    decimation_mode: 4,
  });
  assert.equal(body.ai_model, "meshy-t2");
  assert.equal(body.model_type, "smart-topology");
  assert.equal(body.target_polycount, 4000);
  assert.equal(body.topology, "triangle");
  assert.equal("should_remesh" in body, false);
  assert.equal("decimation_mode" in body, false);
});

test("invalid T2 request fails before posting", async () => {
  const { invalid } = createHarness();
  await invalid("meshy_text_to_3d", {
    prompt: "a robot",
    ai_model: "meshy-t2",
    target_polycount: 15001,
  });
});

for (const [tool, source] of [
  ["meshy_image_to_3d", { image_url: "https://example.invalid/input.png" }],
  [
    "meshy_multi_image_to_3d",
    { image_urls: ["https://example.invalid/input.png"] },
  ],
]) {
  for (const ai_model of ["meshy-6", "meshy-7.1", "latest"]) {
    test(`${tool}: ${ai_model} preserves enhancement false and gates lighting removal`, async () => {
      const { call } = createHarness();
      const { body } = await call(tool, {
        ...source,
        ai_model,
        image_enhancement: false,
        remove_lighting: false,
        should_texture: false,
        enable_pbr: false,
        ...(ai_model !== "meshy-6" ? { geometry_resolution: "2k" } : {}),
      });
      assert.equal(body.image_enhancement, false);
      assert.equal(body.should_texture, false);
      assert.equal(body.enable_pbr, false);
      assert.equal("remove_lighting" in body, ai_model === "meshy-6");
      if (ai_model === "meshy-6") assert.equal(body.remove_lighting, false);
      else assert.equal(body.geometry_resolution, "2k");
    });
  }
  test(`${tool}: omitted lighting removal is not defaulted`, async () => {
    const { call } = createHarness();
    const { body } = await call(tool, { ...source, ai_model: "meshy-6" });
    assert.equal("remove_lighting" in body, false);
  });
}

test("image T2 omits topology, remesh, decimation, and pre-remesh controls", async () => {
  const { call } = createHarness();
  const { path, body } = await call("meshy_image_to_3d", {
    input_task_id: "offline-image",
    ai_model: "meshy-t2",
    target_polycount: 1000,
    topology: "quad",
    should_remesh: true,
    decimation_mode: 4,
    save_pre_remeshed_model: true,
    image_enhancement: true,
    remove_lighting: true,
    should_texture: false,
  });
  assert.equal(path, "/openapi/v1/image-to-3d");
  assert.equal(body.input_task_id, "offline-image");
  assert.equal(body.model_type, "smart-topology");
  assert.equal(body.target_polycount, 1000);
  assert.equal(body.should_texture, false);
  for (const field of [
    "topology",
    "should_remesh",
    "decimation_mode",
    "save_pre_remeshed_model",
    "image_enhancement",
    "remove_lighting",
  ]) {
    assert.equal(field in body, false, field);
  }
});

test("legacy image T1 and Meshy 7 Ultra remain usable", async () => {
  const { call } = createHarness();
  const { body: t1 } = await call("meshy_image_to_3d", {
    input_task_id: "offline-image",
    ai_model: "meshy-t1",
  });
  assert.equal(t1.ai_model, "meshy-t1");
  assert.equal(t1.model_type, "smart-topology");
  const { body: ultra } = await call("meshy_image_to_3d", {
    input_task_id: "offline-image",
    ai_model: "meshy-7",
    ultra_mode: true,
  });
  assert.equal(ultra.ultra_mode, true);
  assert.equal("geometry_resolution" in ultra, false);
});

test("refine inherits the preview model and preserves explicit overrides", async () => {
  const { call } = createHarness();
  const { body: inherited } = await call("meshy_text_to_3d_refine", {
    preview_task_id: "offline-preview",
  });
  assert.equal(inherited.mode, "refine");
  assert.equal("ai_model" in inherited, false);
  assert.equal("remove_lighting" in inherited, false);
  for (const ai_model of [undefined, "meshy-6", "meshy-7.1", "latest"]) {
    const { body } = await call("meshy_text_to_3d_refine", {
      preview_task_id: "offline-preview",
      ai_model,
      remove_lighting: false,
    });
    assert.equal(body.ai_model, ai_model);
    assert.equal(
      "remove_lighting" in body,
      ai_model === undefined || ai_model === "meshy-6",
    );
    if ("remove_lighting" in body) assert.equal(body.remove_lighting, false);
  }
});
