// Keep this order explicit: the output receives the stage before any editor
// overlay. Restream, recording and PNG all consume that same clean surface.
export function presentFrame(renderStage:()=>void,copyOutput:()=>void,renderEditor:()=>void,outputNeeded:boolean,editorVisible:boolean){renderStage();if(outputNeeded||editorVisible)copyOutput();if(editorVisible)renderEditor();}
