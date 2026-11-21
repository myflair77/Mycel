export type ThreadComment={id:string;parent_id?:string|null;resolved?:boolean;deleted?:boolean;created_at:string;[key:string]:any};
export function commentThreads(comments:ThreadComment[],showResolved=false){
 const byId=new Map(comments.map(c=>[c.id,c])),groups=new Map<string,ThreadComment[]>();
 for(const c of comments){let root=c;const seen=new Set([c.id]);while(root.parent_id&&byId.has(root.parent_id)&&!seen.has(root.parent_id)){seen.add(root.parent_id);root=byId.get(root.parent_id)!}const list=groups.get(root.id)??[];list.push(c);groups.set(root.id,list)}
 return [...groups.entries()].map(([id,items])=>({root:byId.get(id)!,items:items.sort((a,b)=>Number(b.id===id)-Number(a.id===id)||a.created_at.localeCompare(b.created_at))})).filter(g=>showResolved||g.items.some(c=>!c.deleted&&!c.resolved));
}
