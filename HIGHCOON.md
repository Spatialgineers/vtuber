# Highcoon in SGX vTuber Engine

Classic and TerpSuit are self-contained GLBs recovered from Riftlands and extended in Blender 4.2 LTS. Each retains 31 clips and the original 64 exported joints, with ten added facial controls. Original assets remain untouched.

No mouth was added. Webcam jaw opening and the gated microphone envelope stretch the head and muzzle. Smile moves the cheeks; brows lift or lower; eyes look and blink. Silence returns speech to neutral. Act → Mouthless face adjusts intensity or disables it. Map supports individual scale and translation axes for custom bone routes.

| Control | Behavior |
| --- | --- |
| SGX_FaceVolume | Head stretch with compensating width and depth |
| SGX_Muzzle | Speech stretch and displacement |
| SGX_Cheek.L / .R | Cheek volume and smile lift |
| SGX_Brow.L / .R | Brow elevation and tilt |
| SGX_Eye.L / .R | Gaze parents of weighted eye joints |
| SGX_Blink.L / .R | Eye compression, isolated from mask and visor |

Bone-local axes: X width, Y height, Z depth; the source is 3 m tall before studio normalization. Gaze parent bones have no direct weights; their weighted blink children carry the eyes. TerpSuit's visor remains steady during blinks, with eyes underneath. Layers can toggle VISOR, HEAD, MASK, NOSE, EYES_L/R, BODY, GEAR and TAIL separately.

## Start a performance

The studio opens with Classic in Idle. Choose either Highcoon in Inputs → Character. Start microphone for speech without a camera, or camera for expressions and head movement. Try demo previews facial motion without opening either input.

Act → Animation deck chooses the body driver:

- Live: track your body, with the selected clip as fallback for unseen joints.
- Animation: the clip controls the body; face, voice and enabled hands stay live.
- Hybrid: live torso, arms and fingers, with animated hips and legs.

Enabling body tracking selects Live. Enabling hands while using Animation selects Hybrid. Full body needs hips, knees and feet inside the webcam. The quick deck includes breathing, celebration, walking, running, jumping, recharge, slash and guard. Embedded animation exposes all 31 clips. One-shots return to Idle; loops, speed and transition time are editable. Re-selecting a gesture restarts it. Pause freezes playback and power timers.

## Hands and fingers

Inputs → Track my hands & arms enables both tracking tasks and starts the camera. Inputs → Test hand rig · 8 seconds cycles open hands, fists, pointing and finger spread without a webcam. The viewport says RIG TEST during that synthetic reference performance. Start the camera or stop the test to return to actual tracking.

Each model has 15 articulated finger joints per hand. Their bind positions fit the actual sculpt, and their weights are confined to hand geometry. Costume cuffs follow the forearm. TerpSuit hands receive localized linear subdivision for smoother bends while preserving the sculpted surface and UVs. Native face bones and all 31 clips remain available.

Act provides separate wrist rotation, finger motion, hand smoothing and natural hand limits. Palm roll is shared with the forearm; the tracked elbow position remains intact. Two hands use a joint assignment based on pose wrists, recent positions and handedness, including crossed hands. Handedness certainty is not treated as detection confidence. Short occlusions hold briefly before easing back to the current animation. Hands use world landmarks when valid; image fallback accounts for the actual camera aspect ratio. Hands are inferred on every accepted tracking frame; body inference is throttled separately.

## Powers

Riftlands names, roles and colors are retained. These are performance effects using existing clips; the studio does not include combat statistics or game state.

| Channel | Power | Effect | Existing clip |
| --- | --- | --- | --- |
| Limonene | Reflex Rush | Fast orbit trails | Run |
| Myrcene | Blue Recovery | Recovery rings | Restore |
| Caryophyllene | Grounded Carapace | Carapace shield | ShieldGuard |
| Linalool | Bloomstep | Petals and bloom particles | Jump |
| Terpinolene | Spectrum Recharge | Reactor orbits | AmgOverclock |
| Humulene | Thermal Balance | Thermal pulses | Idle |
| Alpha-Pinene | Crystal Focus | Precision crystals | RifleAim |
| Beta-Pinene | Clear Signal | Clarity scans | AmgDisrupt |

Powers → Play power animation keeps enabled hands and arms live in Hybrid. A full-body Live performance retains its leg tracking when a power or clip starts. Turn the animation toggle off to keep the current clip. Full Spectrum combines the eight channel colors. Overload boosts an effect for eight seconds; selecting another preset or clearing effects cancels it. Intensity and voice reactivity are editable. Effects appear in clean output, snapshots and recordings, including transparent/chroma modes.

Cloud scenes save bundled character identity, face settings, powers, animation behavior, mappings, layers and camera. Uploaded custom characters still save their own model. Settings files reference bundled characters; custom media must accompany settings or be saved in a cloud scene. Twenty importable settings presets are included in public/avatars/highcoon/presets.

## Assets and regeneration

The companion kit includes both facial GLBs, Highcoon-vTuber-face-rigs.blend, presets, scripts, render review and weight report.

```sh
blender -b --python scripts/blender/rig_highcoon_face.py -- SOURCE/Highcoon-Riftlands.blend OUTPUT_DIR
node scripts/generate-highcoon-presets.mjs
node scripts/verify-highcoon.mjs
node scripts/verify-hands.mjs --review-dir HAND_REVIEW
blender -b --python-exit-code 1 --python scripts/blender/review_highcoon_hands.py -- OUTPUT_DIR HAND_REVIEW HAND_REVIEW/render
```

Copy the two generated GLBs and face-rig-report.json into public/avatars/highcoon. The Blender script writes a separate editable native file, checks neutral bind geometry, uses up to four normalized skin weights and exports only the selected character in the active scene. It splits the joined TerpSuit into named costume layers. The report records the source SHA256 and actual weighted vertex counts.

Checks import the actual GLBs through the app's Three.js loader, decode eight embedded images, validate all 49 body/finger roles, and test neutral geometry, speech deformation, unchanged lower body, isolated blink, silence/disable, 31 clip transforms, one-shot completion, pause, avatar yaw, power pools and scene serialization. Sharp is needed for the CPU texture check; install it as a development dependency if your installation does not expose it. This check does not upload textures to a GPU.

Hand checks load the actual exported meshes and verify influence and measurable deformation for every finger joint, independent pointing, zero gain, disable, frozen joints, all motion modes, crossed hand identity and retained animated legs. The hand review renders actual Three.js solver world matrices in Blender Cycles on CPU and checks matrix conversion against the solver output. These are reference landmarks, not physical camera observations.

Both models were rendered and reviewed in Blender at neutral, speech and blink. The remote browser has WebGL disabled and no physical webcam, so device tracking, live GPU rendering, microphone latency and recording still need a real-device check. The body rigs use Riftlands procedural weights; extreme poses may need artistic refinement.
