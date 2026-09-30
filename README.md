# Meshy MCP Server

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the [Meshy AI](https://www.meshy.ai) 3D generation platform. Enables AI agents to create, manage, and download 3D models, textures, images, rigged characters, and animations through natural conversation.

## Features

24 tools covering the full Meshy API:

| Category | Tools |
|----------|-------|
| **3D Generation** | `meshy_text_to_3d`, `meshy_text_to_3d_refine`, `meshy_image_to_3d`, `meshy_multi_image_to_3d` |
| **Creative Lab** | `meshy_creative_lab` (7 products) |
| **Post-Processing** | `meshy_remesh`, `meshy_retexture`, `meshy_rig`, `meshy_animate` |
| **Conversion** | `meshy_convert`, `meshy_resize`, `meshy_uv_unwrap` |
| **Image Generation** | `meshy_text_to_image`, `meshy_image_to_image` |
| **Task Management** | `meshy_get_task_status`, `meshy_list_tasks`, `meshy_cancel_task`, `meshy_download_model` |
| **Workspace** | `meshy_list_models` |
| **3D Printing** | `meshy_send_to_slicer`, `meshy_analyze_printability`, `meshy_repair_printability`, `meshy_process_multicolor` |
| **Account** | `meshy_check_balance` |

### Key Capabilities

- **Text to 3D**: Generate 3D models from text descriptions (preview + refine pipeline)
- **Image to 3D**: Convert single or multiple images into 3D models
- **Meshy 7.1 generation**: `ai_model: "meshy-7.1"` or `"latest"` for text preview, single-image, and multi-image generation. `geometry_resolution: "standard" | "2k" | "4k"` selects geometry detail (multi-image supports standard/2k only). `ultra_mode` is deprecated; legacy explicit Meshy 7 single-image Ultra requests remain compatible.
- **Smart Topology**: `model_type: "smart-topology"` with `ai_model: "meshy-t2"` on text preview and single-image generation. T2 generates triangle geometry directly at a target of 100–15,000 faces (default 4,000), without remeshing. Legacy single-image `meshy-t1` remains accepted. Multi-image does not support this route.
- **8K Textures (v0.5.0)**: `texture_resolution: "2k" | "4k" | "8k"` on image-to-3d, multi-image-to-3d, text-to-3d refine and retexture (8K costs 15 credits vs 10). Replaces the now-deprecated `hd_texture` flag
- **Multi-view Retexture (v0.5.0)**: `multiview_image_urls` — 1–4 ordered views of the *same object* drive the texture instead of a single style reference (requires Meshy 7)
- **Auto-Rigging & Animation**: Add skeletons and animations to humanoid characters
- **Creative Lab**: One tool — a photo or a line of text → a finished, print-ready product. **7 products (v0.5.0)**: figure, lamp, keychain, fridge-magnet, vinyl-figure, brick-figure and keycap. Runs prototype→build end-to-end and returns only the final 3D model
- **Format & Size Utilities**: `convert` (format conversion incl. 3MF, 1 credit), `resize` (real-world dimensions, 1 credit), `uv_unwrap` (clean UV layout for external texturing, 5 credits)
- **2D Image Models**: `text_to_image` / `image_to_image` support `nano-banana`, `nano-banana-2`, `nano-banana-pro` and `gpt-image-2`
- **3D Printability Suite**:
  - `analyze_printability` — free FDM check (watertight, volume, holes, non-manifold edges, degenerate faces)
  - `repair_printability` — 10-credit topology repair, now also accepting **.fbx / .gltf** input (v0.5.0)
  - `process_multicolor` — 10-credit multi-color 3MF for AMS/MMU printers
- **Slicer Integration**: Auto-detect 7 installed slicers (OrcaSlicer, Bambu, Creality, Elegoo, Anycubic, PrusaSlicer, Cura) and return launch commands the agent can execute
- **Smart File Organization**: Auto-saves to `meshy_output/` with project folders, metadata, and history tracking
- **Built-in Workflow Intelligence**: Server instructions guide the agent through correct tool chains for each use case

### Models & Credits

Model availability is endpoint-specific. Current generation routing follows the [text](https://docs.meshy.ai/en/api/text-to-3d), [single-image](https://docs.meshy.ai/en/api/image-to-3d), and [multi-image](https://docs.meshy.ai/en/api/multi-image-to-3d) API contracts:

| Endpoint | Current route | Compatibility |
|---|---|---|
| `meshy_text_to_3d` | Standard `meshy-7.1` / `latest`; Smart Topology `meshy-t2` | Legacy standard IDs remain accepted by the tool schema |
| `meshy_image_to_3d` | Standard `meshy-7.1` / `latest`; Smart Topology `meshy-t2` | Legacy standard IDs and single-image `meshy-t1` remain accepted |
| `meshy_multi_image_to_3d` | Standard `meshy-7.1` / `latest` | Legacy standard IDs remain accepted; no Smart Topology |
| `meshy_text_to_3d_refine` | Omit `ai_model` to inherit the preview; explicit standard override supported | T2 is not an explicit refine override |
| `meshy_retexture` | Existing tool contract is unchanged by this generation update | Inspect its live schema and API documentation independently |

`latest` currently resolves to Meshy 7.1 on the updated generation endpoints. Use an explicit model for reproducibility; retaining a legacy ID in a schema does not guarantee continued API availability.

For standard models, `target_polycount` requires `should_remesh: true` and is superseded by `decimation_mode`. For T2, it controls generation directly; remesh/decimation controls are omitted. Single-image Smart Topology also omits topology and pre-remesh controls. Text T2 rejects quad topology. Deprecated `model_type: "lowpoly"` remains accepted, but prefer Smart Topology.

`image_enhancement` is forwarded for Meshy 6, Meshy 7.1, and `latest`. `remove_lighting` is forwarded only for explicit Meshy 6, or an explicit refine value when the model is inherited. Neither lighting removal nor higher geometry detail is silently enabled. When inheriting a legacy preview, confirm that model supports any requested texture upgrade; the server does not fetch the preview to infer compatibility. Inherited lighting removal is left for the API to apply only where supported.

Costs depend on endpoint, model, geometry pass, and texture options. Check the [current API pricing](https://docs.meshy.ai/en/api/pricing) and obtain permission before generation or texturing. Older release credit examples are not a quote for Meshy 7.1/4k geometry.

## Prerequisites

- Node.js >= 18
- A Meshy API key ([get one here](https://www.meshy.ai/settings/api) — requires Pro plan or above)

## Installation

Pick whichever fits your workflow — they all produce the same config.

### Option 1 · One-Command Install · Recommended

[`add-mcp`](https://github.com/neondatabase/add-mcp) auto-detects every AI client on your machine (Cursor, Claude Code, Claude Desktop, Windsurf, Codex, VS Code, Cline, …) and writes the right config to each:

```bash
npx add-mcp @meshy-ai/meshy-mcp-server --env MESHY_API_KEY=msy_YOUR_API_KEY
```

After it finishes, jump to [Activate](#activate-after-install) for your client.

### Option 2 · Install by Asking Your AI Agent

Already chatting with Cursor / Claude Code / Codex? Paste this prompt:

```
Install the Meshy MCP server for me. Docs: https://github.com/meshy-dev/meshy-mcp-server
Use this env var: MESHY_API_KEY=msy_YOUR_API_KEY
```

The agent will run `add-mcp` (or write `mcp.json` directly) and tell you when it's ready. You'll still need the **Activate** step for your client.

### Option 3 · Manual Install

<details>
<summary><b>Cursor</b></summary>

Paste into `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "meshy": {
      "command": "npx",
      "args": ["-y", "@meshy-ai/meshy-mcp-server"],
      "env": { "MESHY_API_KEY": "msy_YOUR_API_KEY" }
    }
  }
}
```

> **Windows**: replace `"command": "npx"` with `"command": "cmd"` and `"args": ["/c", "npx", "-y", "@meshy-ai/meshy-mcp-server"]`.

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add-json meshy '{"command":"npx","args":["-y","@meshy-ai/meshy-mcp-server"],"env":{"MESHY_API_KEY":"msy_YOUR_API_KEY"}}'
```

</details>

<details>
<summary><b>Other clients</b> (Windsurf, Claude Desktop, Codex, VS Code, Cline…)</summary>

Use **Option 1** — `add-mcp` writes the correct config for each.

</details>

## Activate After Install

Most clients auto-load the new server, but **Cursor and VS Code require a manual toggle**:

| Client | What to do | Verify |
|---|---|---|
| **Cursor** | Restart → `Settings` → `MCP & Integrations` → toggle `meshy` **on** → wait for green dot ● → open a **new chat** | `List the meshy tools available` |
| **Claude Code** | Nothing — auto-loads on next message | `/mcp` shows `meshy ✓ connected` |
| **Claude Desktop** | Quit & relaunch the app | `List the meshy tools available` |
| **Windsurf** | Refresh in the Cascade panel's MCP section | `List the meshy tools available` |
| **VS Code** | Run command `MCP: List Servers` → click `meshy` → **Start** | `List the meshy tools available` |
| **Codex** | Nothing — auto-loads on next session | `List the meshy tools available` |

## Troubleshooting

- **`MESHY_API_KEY environment variable is required`** — the key didn't reach the server. Make sure it sits inside an `"env": {...}` block in your `mcp.json`, not in `args`.
- **`spawn npx ENOENT`** (Windows) — wrap with `cmd /c` (see Cursor block above).
- **`error: unknown option '-y'`** (Claude Code on Windows) — use `claude mcp add-json` instead of `claude mcp add … -- npx -y …`.
- **Cursor doesn't list `meshy`** — make sure `mcp.json` is valid JSON (no trailing commas), then fully restart Cursor.
- **Tool calls return 401** — the API key is invalid or revoked. Regenerate at https://www.meshy.ai/settings/api.

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `MESHY_API_KEY` | **Required.** Your Meshy API key (starts with `msy_`) | — |
| `MESHY_API_HOST` | API base URL | `https://api.meshy.ai` |
| `TRANSPORT` | Transport mode: `stdio` or `http` | `stdio` |
| `PORT` | Port for HTTP transport | `3000` |
| `CHARACTER_LIMIT` | Max response size in characters | `25000` |

## Development

```bash
# Clone and install
git clone https://github.com/meshy-dev/meshy-mcp-server.git
cd meshy-mcp-server
npm ci

# Development with hot reload
npm run dev

# Build
npm run build

# Type check
npm run lint

# Build and run offline mocked-request tests (no API key or credits required)
npm test

# Run
npm start
```

### Maintaining a local checkout

See [setup, updates, and rollback](docs/maintenance.md) for running a reviewed local build, pinning package versions, testing model routing without paid API calls, and reconnecting a client safely.

## HTTP Transport

For remote access, run in HTTP mode:

```bash
TRANSPORT=http PORT=3000 npm start
```

Endpoints:
- `POST /mcp` — MCP protocol endpoint
- `GET /health` — Health check

## License

[MIT](LICENSE)
