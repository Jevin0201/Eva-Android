from pathlib import Path
p=Path('probe/AndroidManifest.xml');s=p.read_text(encoding='utf-8').replace('</manifest>','<instrumentation android:name=".WorkspaceCheck" android:targetPackage="ai.eva.android.probe"/></manifest>');p.write_text(s,encoding='utf-8')
p=Path('tools/build-probe.ps1');s=p.read_text(encoding='utf-8').replace("'probe/src/WorkspaceFiles.java'","'probe/src/WorkspaceFiles.java','probe/src/WorkspaceCheck.java'");p.write_text(s,encoding='utf-8')
p=Path('probe/assets/settings.js');s=p.read_text(encoding='utf-8').replace("if(page==='permissions')body=", "if(page==='permissions')body=settingGroup('照片与文件','<p class=\"preview-label\">使用系统选择器，仅访问你主动选择的照片和文件；不申请全部相册或存储空间权限。附件复制到项目目录后可持续使用，发送时交给云端模型。文件页的“另存到手机”由系统选择保存位置。取消选择不会发送附件。</p>')+");p.write_text(s,encoding='utf-8')
