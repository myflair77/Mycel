// Inputs are observations from both connected calendars, never event instructions.
export function planCalendarChange({direction,mycel,google,mapping}){
 if(!['import','export','both'].includes(direction))throw Error('Invalid direction');
 if(!mapping){
   if(mycel && google)return 'review_possible_duplicate';
   if(google && !google.deleted && direction!=='export')return 'preview_create_in_mycel';
   if(mycel && !mycel.deleted && direction!=='import')return 'preview_create_in_google';
   return 'skip';
 }
 if(!mycel || !google)return 'review_missing_record';
 const localChanged=mycel.version!==mapping.mycel_version;
 const remoteChanged=google.version!==mapping.google_version;
 if(!localChanged && !remoteChanged)return 'unchanged';
 if(localChanged && remoteChanged)return 'review_conflict';
 if(remoteChanged && direction!=='export')return google.deleted?'review_delete_in_mycel':'preview_update_in_mycel';
 if(localChanged && direction!=='import')return mycel.deleted?'review_delete_in_google':'preview_update_in_google';
 return 'review_change_outside_direction';
}
