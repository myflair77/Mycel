export type Rect={left:number;top:number;right:number;bottom:number};
/** Prefer an empty side of the block; shrink vertically before covering its content. */
export function blockMenuPosition(block:Rect,anchorY:number,viewport:Rect,size:{width:number;height:number}){
 const pad=8,gap=12,left=viewport.left+pad,right=viewport.right-pad,top=viewport.top+pad,bottom=viewport.bottom-pad;
 const width=Math.max(1,Math.min(size.width,right-left)),height=Math.max(1,Math.min(size.height,bottom-top));
 const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,Math.max(min,max)));
 const sideY=clamp(anchorY-12,top,bottom-height);
 if(block.left-gap-width>=left)return {left:block.left-gap-width,top:sideY,width,maxHeight:height,placement:'left'};
 if(block.right+gap+width<=right)return {left:block.right+gap,top:sideY,width,maxHeight:height,placement:'right'};
 const x=clamp(block.left,left,right-width),below=Math.max(0,bottom-Math.max(top,block.bottom+gap)),above=Math.max(0,Math.min(bottom,block.top-gap)-top);
 const minimum=Math.min(160,height);
 if(below>=height||below>=minimum&&above<height&&below>=above)return {left:x,top:Math.max(top,block.bottom+gap),width,maxHeight:Math.min(height,below),placement:'below'};
 if(above>=minimum)return {left:x,top:Math.min(bottom,block.top-gap)-Math.min(height,above),width,maxHeight:Math.min(height,above),placement:'above'};
 // A viewport-filling block leaves no exterior space. Keep its active first line visible.
 const compact=Math.min(height,Math.max(minimum,below,above));
 const y=anchorY<(top+bottom)/2?bottom-compact:top;
 return {left:x,top:y,width,maxHeight:compact,placement:'edge'};
}
