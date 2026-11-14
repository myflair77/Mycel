export type NotificationHandle={data?:{roomId?:unknown};close:()=>void};
export type RoomActivity={room_id:string;unread_count:number};
// Only dismiss notifications captured before the server read. A notification
// arriving during the request must survive until a later authoritative check.
export function closeReadNotifications(notifications:NotificationHandle[],activity:RoomActivity[]){
 const readRooms=new Set(activity.filter(row=>Number(row.unread_count)===0).map(row=>row.room_id));
 for(const notification of notifications){
  const room=notification.data?.roomId;
  if(typeof room==='string'&&readRooms.has(room)){try{notification.close()}catch{/* Retry on the next sync. */}}
 }
}
