// Classic worker: MediaPipe's WASM loader calls importScripts().
importScripts('./vision_bundle.js?v=0.10.32');
const { FilesetResolver, FaceLandmarker, HandLandmarker, PoseLandmarker } = SGXVision;
const asset = name => new URL(name, self.location.href).href;
let face, hands, pose, files, busy = false, count = 0;
let options = { hands: false, pose: false, bodyMode:'upper' }, initializing, cachedHands=[],cachedPose,cachedWorld,handTime=0,poseTime=0,pinchSignals={leftPinch:0,rightPinch:0};
async function configure(next, requestId) {
  options = {hands:!!next.hands,pose:!!next.pose,bodyMode:next.bodyMode==='full'?'full':'upper'};
  postMessage({type:'progress',requestId,message:'Loading face tracking…'});
  files ||= await FilesetResolver.forVisionTasks(asset('./wasm'));
  face ||= await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: asset('./face.task'), delegate:'CPU' }, runningMode:'VIDEO', numFaces:1, outputFaceBlendshapes:true, outputFacialTransformationMatrixes:true });
  if (options.hands && !hands) {
    postMessage({type:'progress',requestId,message:'Loading hand tracking…'});
    try { hands = await HandLandmarker.createFromOptions(files, { baseOptions:{modelAssetPath:asset('./hands.task'),delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.45,minHandPresenceConfidence:.45,minTrackingConfidence:.5 }); }
    catch(e) { options.hands=false;postMessage({type:'warning',requestId,message:'Face tracking is available, but hands could not load. Retry tracking to try again. '+e.message}); }
  }
  if (options.pose && !pose) {
    postMessage({type:'progress',requestId,message:'Loading body tracking…'});
    try { pose = await PoseLandmarker.createFromOptions(files, { baseOptions:{modelAssetPath:asset('./pose.task'),delegate:'CPU'},runningMode:'VIDEO',numPoses:1 }); }
    catch(e) { options.pose=false;postMessage({type:'warning',requestId,message:'Face tracking is available, but body tracking could not load. Retry tracking to try again. '+e.message}); }
  }
  if(!options.hands){cachedHands=[];pinchSignals={leftPinch:0,rightPinch:0};}
  if(!options.pose){cachedPose=[];cachedWorld=[];}
  postMessage({type:'ready',options,requestId});
}
onmessage = async ({data}) => {
  if (data.type === 'init') {
    try { initializing = (initializing || Promise.resolve()).catch(()=>{}).then(()=>configure(data.options,data.requestId)); await initializing; }
    catch(e) { postMessage({type:'error',requestId:data.requestId,message:e.message||String(e)}); }
    return;
  }
  if (data.type !== 'frame' && data.type !== 'probe') return;
  let bitmap;
  try {
    if(data.type==='probe') {
      const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('A 2D canvas could not be created for the tracking check.');
      ctx.fillStyle='#222222';ctx.fillRect(0,0,256,256);bitmap=canvas.transferToImageBitmap();
    }else bitmap=data.bitmap;
  }
  catch(e) { postMessage({type:'frame-error',message:e.message});return; }
  if (!face || busy) { bitmap.close(); postMessage({type:'skipped'}); return; }
  busy = true;
  try {
    const start = performance.now(), f = face.detectForVideo(bitmap, data.time);
    let h, p;
    if (options.hands && hands) h = hands.detectForVideo(bitmap, data.time);
    // Full-body performance keeps arms/legs coherent with hands on available frames.
    // CameraTracking already has one pending frame at most; inference cannot queue up.
    if (options.pose && pose && data.time-poseTime >= (options.bodyMode==='full'?30:40)) p = pose.detectForVideo(bitmap, data.time);
    count++;
    const signals = Object.fromEntries((f.faceBlendshapes?.[0]?.categories || []).map(x=>[x.categoryName,x.score]));
    const trackedHands = h?.landmarks?.map((points,i)=>({side:h.handedness?.[i]?.[0]?.categoryName === 'Right' ? 'Left' : h.handedness?.[i]?.[0]?.categoryName === 'Left' ? 'Right' : '',score:h.handedness?.[i]?.[0]?.score,points,world:h.worldLandmarks?.[i],aspect:bitmap.width/bitmap.height}));
    if (trackedHands) { handTime=data.time;cachedHands=trackedHands;pinchSignals={leftPinch:0,rightPinch:0};for(const hand of trackedHands) {
      const a=hand.points[4], b=hand.points[8],w=hand.points[0],m=hand.points[9],size=Math.hypot(w.x-m.x,w.y-m.y)||.1;
      pinchSignals[hand.side==='Left'?'leftPinch':'rightPinch']=Math.max(0,Math.min(1,1-Math.hypot(a.x-b.x,a.y-b.y)/size));
    }}
    Object.assign(signals,pinchSignals);if(p){poseTime=data.time;cachedPose=p.landmarks?.[0]||[];cachedWorld=p.worldLandmarks?.[0]||[];}
    postMessage({type:data.type==='probe'?'probe-result':'result',frame:{ signals,matrix:f.facialTransformationMatrixes?.[0]?.data,face:f.faceLandmarks?.[0],hands:cachedHands,handTime,pose:cachedPose,poseWorld:cachedWorld,poseTime,inference:performance.now()-start,time:data.time }});
  } catch(e) { postMessage({type:'frame-error',message:e.message}); }
  finally { bitmap.close(); busy=false; }
};
