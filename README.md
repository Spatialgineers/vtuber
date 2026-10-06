# SGX vTuber Engine

Spatialgineers realtime performance studio for Tales, Terps & Tech.

Remote performance for Restream: in desktop Inputs, choose **Conectar teléfono · QR**. Pair a second device using the same ChatGPT account, start its front camera, and share the desktop **Clean window** in Restream. The phone supplies face, finger, arm and optional full-body tracking plus touch pads for clips, powers, hand poses and stage controls. [Remote controller setup and validation](docs/REMOTE-CONTROLLER.md).

## Workflow

The four main sections are **Actuar**, **Personaje**, **Crear** and **Escena**. Start a local camera or pair the phone in Entradas. The clean broadcast window and action pads remain below the character.

In **Crear**, choose one task:

- **Guardar una pose**: select a body part and move its gizmo, or copy your posture after a three-second countdown. Name it, then **Guardar pose**. **Poner en un pad** uses a free slot without replacing an existing action.
- **Grabar mis movimientos**: name the movement, start the countdown, act with tracking or pads, then **Detener y guardar movimiento**. Capture continues when switching panels. Select a maximum of 5, 10 or 20 seconds.
- **Animar paso a paso**: create the initial position, move the character, and **Añadir posición al final**. Select a position to change it with **Actualizar posición seleccionada**. **Probar animación**, **Guardar animación**, then put it in a pad. The detailed timeline is optional.

These actions save directly to the private account, together with the current character; new characters are captured automatically when needed. Failed writes keep the draft and offer retry. **Grabar video** downloads the clean rendered video; **Guardar escena** saves the environment and scene settings. They are separate from capturing reusable movements. On mobile the character stays visible above creation controls.

`node scripts/verify-authoring.mjs` checks the guided workflows on an actual customized Robot, immutable pose frames, interpolated arm/finger motion, pad ownership and safe assignment, bounded dense recordings, character persistence and initial UI markup. Compiled Worker checks also exercise pose → positions → pad saves without creating a scene.

## Use

The studio opens with the original **SGX Robot**, with energy eyes and mouth, 57 bones, 75 mesh pieces and nine morph targets. Select it directly in Inputs → Character. Character includes its colors, independent energy glow, proportions, surfaces and removable parts. Personaje → Piezas manages mesh visibility. Crear provides a 3D gizmo editor for all 57 joints, including face and fingers, plus saved poses and a keyframe timeline. Save retains its custom look and bone offsets. Its GLB export preserves actual skeletal joints and rigid skin weights. [SGX Robot controls and export](docs/SGX-ROBOT.md).

Choose Highcoon Classic or TerpSuit, start the microphone for mouthless facial speech, or use Track my hands & arms to start face, hand and upper-body tracking. Use Test hand rig · 8 seconds to inspect open hands, fists, pointing and spread without a camera. Each Highcoon has 74 exported joints, ten facial controls, eight power presets and 31 retained Riftlands animation clips. Act offers Live / Animation / Hybrid body drivers. Powers has channel effects and an eight-second Overload. [Highcoon controls and assets](docs/HIGHCOON.md).

You can also load a GLB or GLTF with its resources and perform. Calibrate the head while facing forward.

Body tracking offers Off, Arms & torso, and Full body. Full body enables detailed hands and frames the entire avatar. Step back until your hips, knees and feet fit inside the webcam. The camera overlay shows detected joints; the Inputs panel reports whether arms, legs and hands are visible. Full-body motion drives hips, torso, shoulders, elbows, wrists, knees, ankles and feet. Hands drive palm orientation and all three segments of each finger. Hand and finger smoothing are independent of face smoothing. Palm roll is shared with the forearm without moving the elbow. Clips and power presets preserve enabled live hands; full-body Live also retains the legs. If body pose is disabled, hands can still estimate arm reach from wrist positions.

Act includes separate body, arm, leg and finger gains, smoothing, confidence and foot grounding. Mirroring reflects the motion and swaps left/right joints together. Uncertain or stale joints ease back to the rest pose or embedded animation. Pause holds the complete tracked pose. Face tracking compensates torso motion so leaning does not apply twice to the head.

Actuar → Animaciones del modelo y ajustes del rig → Body & hand bones lets you connect any humanoid joint to a named model node or disable it. Common SGX, Mixamo, VRM-style humanoid names and Unreal-style bone names auto-detect; ambiguous names need a manual choice. Mapping uses the model's bind rotations and retains its hierarchy. Characters still need an appropriate rig; a static GLB cannot acquire skeletal motion automatically. Native rig updates migrate unique named layer/morph routes in older scenes.

Act adjusts movement gain and smoothing. Map connects MediaPipe / audio signals to morphs, rotations, per-axis scale/translation, emission and visibility. Layers switches costumes and materials. World imports 3D environments or image/video backgrounds. FX operates on the complete stage.

Save stores scenes in private cloud storage, including uploaded models and backgrounds. Scene snapshots also save the viewport camera, bundled character identity, facial controls, powers, puppet hand poses and animation driver. Camera frames and microphone analysis stay on the device. Remote mode sends compact facial coefficients, enabled body/hand joints and pad commands through a direct link when available, with a temporary cloud fallback; it does not send the phone's video or audio. Export settings produces a JSON file; it does not package model assets.

The new **Pose / Pads** workflow authors bind-relative poses and keyframe clips, with joint picking, move/rotate/scale gizmos, hand/foot IK, undo/redo, quaternion interpolation, playback and three configurable banks of twelve action pads. Pads support Tap, Hold and Toggle, combined actions, per-pad clip loop/speed and the synced phone. The Robot starts with editable Wave, Hero landing and Groove clips. [Pose editor and action deck guide](docs/POSE-AND-ACTION-DECK.md).

## Character library and animation studio

**Character** builds saved Robot variants from colors, three head shells, bar/round/diamond energy eyes, antenna/horns/ears, independent head/eye proportions, arm and leg length/width, hand size/width, feet, torso and shoulder/hip spacing. Save character or Save changes stores the library in your private account. Imported rigs and both Highcoons can also be saved with their layers, materials, model assets and timeline cursor. On reload, the library and last selected character reopen automatically, with playback paused. Variants use the same rig so an animation remains reusable across their proportions. Save as new duplicates the current custom clip when capacity is available.

The Robot has four fingers across each palm and a shorter thumb on its side, with mirrored rest orientations and three joints per digit. Tracking and puppet gestures use those rest orientations. Existing procedural Robot poses, clips and pads retain their identity; exported GLBs retain their actual skin bind transforms. `node scripts/verify-robot-thumbs.mjs` checks placement, live/puppet gestures, saved actions and actual exported thumb deformation.

**Crear → Animar paso a paso → Abrir timeline avanzado** adds a whole-rig animation timeline: frame stepping at 24/30/60 fps, snapped diamond dragging, Auto key, copy/paste/mirror keys, clip duplication, undo/redo, and duration retiming. Grabar mis movimientos samples joint offsets and face morphs at six keys per second, up to 120 keys / 20 seconds; refine those positions afterwards. Dense recordings thin samples as needed to fit the account library limit, retaining duration and endpoints. Longer hand-authored clips can run up to five minutes. Save animation persists characters, poses, clips and pads independently of a scene. Camera, environment and output settings remain in cloud scenes. Custom clips are saved in SGX JSON, not baked as embedded GLB animation tracks.

The phone now has a compact, sticky **character monitor** of the actual clean rendered output, with current clip/playhead and connection confirmation time. It targets 8 fps on the direct link and 2 fps on cloud fallback, at 320×180; it is a beat monitor, while the desktop still produces your broadcast output. Phone camera video remains local.

Direct pads send before any cloud request, and release does not wait for press acknowledgement. Each command carries a session epoch and order; the host deduplicates IDs, buffers reordered fallback commands and retains a bounded acknowledgement catalog. Cloud dispatch waits only for ordered POST delivery, not for each action to play. Preview has a separate disposable data channel and bounded JPEG frames, so stale images cannot accumulate ahead of controls. WebRTC now uses Cloudflare's public STUN service to discover routes beyond local candidates; restrictive NAT/firewalls can still require cloud fallback. TURN is not configured. The controller displays Directa/Nube and measured acknowledgement round-trip time.

`node scripts/verify-characters.mjs` checks character persistence, appearance-relative poses, joint dimensions, modular geometry/blinks, real variant GLB skinning and timeline operations. Remote checks additionally simulate delayed HTTP while verifying direct pads bypass it, concurrent ordered cloud actions, separate preview delivery and reconnection. Compiled Worker checks cover the private library and preserving model assets after scene deletion. A physical phone/network check is still required to assess your actual latency.

## Tracking recovery and speed

**Live** below the viewport and **Track my hands & arms** release the pose editor, saved poses, custom clips and puppet fingers before returning control to the camera. Starting a camera also returns to live. Saved designs, proportions, poses and clips remain available. An ownership message explains when a pose, animation or editor controls the body instead of tracking.

On the phone choose **Cara · rápido**, **Cara y dedos**, **Manos y brazos** or **Cuerpo completo**. The last two need shoulders, elbows and wrists in view; full body also needs hips, knees and feet. The phone and desktop share these tracking settings. Video stays on the phone; normalized and world-space joint coordinates are compact, bounded and sent through the same disposable tracking channel or latest-frame cloud fallback. Cached detections retain their original age when clocks differ.

Live rendering no longer captures and serializes every joint for an inactive timeline. Rig references update when character proportions change; temporary vectors, colors, maps and fog are reused, and hidden particles skip CPU updates. Inference uses a 640px-wide frame with one pending frame at most. Changing tracking frequency does not reload models. Repeated phone snapshots update acknowledgements and preview without rerendering unchanged controls. Studio and controller pages use no-store headers to avoid referencing chunks from a previous publication.

Body and hand landmarks now use speed-adaptive 1€ filtering in sensor time: cached packets never advance the filter, and shoulder/palm spans normalize its tuning across characters and hands. Small movements receive more damping; large movements receive less. Visibility/presence controls each body's tracking weight, briefly missing joints hold their reliable target and fade back, and angular speed caps bound reacquisition and forearm roll. Finger direction mapping accounts for nonuniform hand scales. **Natural body limits** in Actuar → tracking adjustments → Manos y cuerpo bounds elbow/knee flexion and ankle/shoulder rotation; disable it for exaggerated motion. Disabling body parts or switching to hybrid releases them directly to animation.

Full-body inference now follows available camera frames more frequently, still with one pending frame and no queue. Full-body grounding uses up to 16 cached vertices from the actual soles, evaluated with skin weights, with joint-based fallback for models lacking foot geometry. It remains active through brief occlusion and respects custom proportions. Facial smoothing uses quicker envelopes for speech, blinks and eye direction. These controls drive a tracked rig; they are not a rigid-body physics simulation, foot-locking mocap system or a guarantee of optical accuracy.

`node scripts/verify-tracking-quality.mjs` exercises sensor-time filtering, noisy and fast motion, render-rate consistency, hidden/stale landmarks, freeze/reacquisition, custom hand scales, optional joint limits, real sole contacts, speech/blink response and both Highcoons' weights/deformation. Its synthetic measurements describe the filter and CPU rig, not end-to-end camera or phone latency. The adaptive filter is based on https://gery.casiez.net/1euro/.

`node scripts/verify-live-tracking.mjs` reproduces the edited-character pose conflict, verifies recovery with zero gains and held pads, checks actual weighted GLB arm deformation, and tests steady live frames and camera backpressure.

## Capture

Editor helpers are drawn after a separate clean capture; they never appear in Clean window, PNG or recordings. Grabar video downloads the clean render canvas with microphone audio when enabled. Recordings use WebM or MP4 depending on browser support. PNG snapshots preserve alpha. For reliable OBS capture, open Clean window, select Chroma green and apply a Chroma Key filter. Browser recording does not guarantee video alpha.

For Restream, share the desktop Clean window while the paired second device supplies the tracking camera and pads. Keep the studio open and the phone controller visible. Desktop microphone reactivity remains independent of the remote camera.

Keyboard: 1–9 / 0 for the first ten slots of the displayed action bank; 1–6 in Moods. Space pause, Escape return, Ctrl/Cmd-S save.

## Asset support

GLB / GLTF (40 MB total per import), local resources, Draco, Meshopt, embedded clips and standard PBR materials. GLTF uploads are repackaged as self-contained GLB for cloud saves. KTX2 textures, VRM spring bones and universal humanoid retargeting are not included. PNG/JPG textures are the safest export. Custom rigs can use the editable bone map.

Backgrounds: PNG, JPEG, WebP, AVIF and browser-decodable MP4 / WebM / QuickTime. Browser decoding support varies.

Requires WebGL2 and a modern browser. Camera and microphone require HTTPS, device access and user consent.

If an embedded view blocks camera or microphone permissions, use Open full studio to open the same app in its own browser tab. Webcam preview starts independently of the 3D renderer and remains open if tracking fails. Retry tracking reuses the current stream. Device selection reconnects an active camera; a missing saved camera falls back to the default. Permission prompts and video playback can be cancelled without leaving late streams active. Errors remain visible with details instead of disappearing in a toast.

Studio guide → Check tracking engine loads the enabled face/hand/body models and processes a blank test frame, without accessing the camera. This checks the inference pipeline; it does not verify face recognition or your physical device.

## Development

Requires Node 22.13+ and pnpm 11.25 (see package.json). From the source directory:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the localhost URL printed by the server; browsers allow camera access on localhost. A remote server must use HTTPS. Do not open the app as a file:// URL. Build with `pnpm build`; `pnpm start` runs the compiled Cloudflare Worker locally with D1 and R2 emulation. Cloud scenes in a standalone deployment need the database migrations, the DB/BUCKET bindings and the authenticated identity contract in `app/chatgpt-auth.ts`, `lib/cloud-store.ts` and `build/sites-worker.ts`. Face/body tracking, imported local assets and recording run in the browser. Hosted deployment uses the included Sites manifest and the same source.

Verification: `node scripts/verify-engine.mjs`, `node scripts/verify-camera.mjs`, `node scripts/verify-rig.mjs`, `node scripts/verify-highcoon.mjs`, `node scripts/verify-hands.mjs` and `node node_modules/typescript/bin/tsc --noEmit`. Camera lifecycle tests use simulated device/worker adapters; they cover cancellation races, permissions, device fallback, worker failure recovery and microphone cleanup. Rig checks use actual Three.js hierarchies and reference landmarks, including a rotated Mixamo-style T-pose, mirrored motion, elbow priority, fingers, grounded feet, stale/occluded joints, head/torso compensation and old scene defaults. Worker protocol checks verify that skipped inferences do not refresh detection timestamps.

`node scripts/verify-robot.mjs` additionally checks every robot joint, body/finger auto-binding, independent energy materials, persisted custom settings, real GLB joints and skin weights, customized vertex positions after roundtrip, actual exported finger deformation and retained eye/mouth morphs.

`node scripts/verify-performance.mjs` verifies the new editor, real model poses, timeline playback, IK, action ownership, starter deck, persistence schema, output ordering and server-rendered UI markup.

Remote verification: `node scripts/verify-remote.mjs` exercises real D1 migrations, ownership, pairing credentials, single-controller leases, refresh epochs, receiver clocks, stale/out-of-order packets, idempotent pad acknowledgements, both client transports, network recovery and revocation. After a build, `node scripts/verify-remote-worker.mjs` checks the compiled Worker API and both initial page responses. WebRTC channels use linked test adapters; actual device cameras, ICE connectivity, latency, GPU rendering and Restream capture still require a physical-device check.

MediaPipe runs in a classic worker because its WASM loader uses importScripts. Rebuild its pinned, local classic bundle with node scripts/build-tracking.mjs when changing public/tracking/vision_bundle.mjs. Do not switch the tracking worker to a module worker without checking the WASM loader's compatibility.

MediaPipe Tasks Vision 0.10.32 and official Google face/hand/pose models are bundled. Model sources: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task ; https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task ; https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task . MediaPipe is Apache 2.0; Three.js is MIT. Local fonts include their OFL notices under public/fonts.

## Validation scope

Config and signal logic, native morph geometry, GLB roundtrip, failed imports, bundled inference resources, TypeScript and production build are checked by the authoring workflow. The remote preview browser has WebGL disabled: GPU rendering, physical webcam/microphone tracking and recording need verification on a real device. Do not interpret successful code checks as physical tracking or universal model compatibility.

The compiled Worker was also tested in an isolated Cloudflare runtime: D1 migrations, scene save/load/update/delete, user isolation, origin checks, R2 upload/read and unused asset cleanup passed. Optional WebMCP controls are feature-detected; the preview browser did not expose a supported modelContext for validation.

Highcoon derivatives were rendered and reviewed in Blender 4.2 LTS. Actual GLB imports, embedded image decoding and CPU skinning verify neutral shape, speech and isolated blinking; all 31 clips and eight power pools pass. See docs/HIGHCOON.md for lineage and physical-device verification limits.
