from pathlib import Path
p=Path('probe/src/PhoneAccessibility.java');s=p.read_text(encoding='utf-8');s=s.replace('String snapshot="",snapshotPackage="";', 'long observedAt;String snapshot="",snapshotPackage="";')
s=s.replace('snapshot=UUID.randomUUID().toString();', 'observedAt=SystemClock.elapsedRealtime();snapshot=UUID.randomUUID().toString();')
s=s.replace('if(snapshot.isEmpty()||!snapshot.equals', 'if(SystemClock.elapsedRealtime()-observedAt>15000||snapshot.isEmpty()||!snapshot.equals')
s=s.replace('copy.compress(Bitmap.CompressFormat.JPEG,65,out);copy.recycle();result.complete(new JSONObject().put("imageUrl",', 'int imageWidth=copy.getWidth(),imageHeight=copy.getHeight();copy.compress(Bitmap.CompressFormat.JPEG,65,out);copy.recycle();result.complete(new JSONObject().put("imageWidth",imageWidth).put("imageHeight",imageHeight).put("screenWidth",getResources().getDisplayMetrics().widthPixels).put("screenHeight",getResources().getDisplayMetrics().heightPixels).put("imageUrl",')
p.write_text(s,encoding='utf-8')
p=Path('probe/src/PhoneTools.java');s=p.read_text(encoding='utf-8').replace('gesture uses screenshot pixel coordinates and snapshot.', 'gesture uses physical screen coordinates from observe and snapshot; screenshot may be scaled, convert using imageWidth/imageHeight and screenWidth/screenHeight.')
s=s.replace('if(output.has("imageUrl"))items.put(new JSONObject().put("type","inputImage").put("imageUrl",output.getString("imageUrl")));', 'if(output.has("imageUrl")){items.put(new JSONObject().put("type","inputImage").put("imageUrl",output.getString("imageUrl")));output.remove("imageUrl");items.put(new JSONObject().put("type","inputText").put("text",output.toString()));}')
p.write_text(s,encoding='utf-8')
