export function previewUrl(raw:string):URL;
export function publicIPv4(ip:string):boolean;
export function parseLinkMetadata(html:string,base:string):{title:string;description:string;image:string|null;site:string};
export function linkPreviewApi(request:Request):Promise<Response>;
