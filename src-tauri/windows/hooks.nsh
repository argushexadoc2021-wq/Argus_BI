; Installer hooks for Argus Business Intelligence (bundle > windows > nsis > installerHooks in tauri.conf.json).
;
; The app was first called "CNCFORGE ERP", then "Business Intelligence", now "Argus Business Intelligence".
; Windows treats each name as a separate app in its own folder, so an update to the new name used to leave the
; old app (and its Start menu / desktop shortcuts) behind: opening the old shortcut started the OLD version, which
; offered the update again, every time.
;
; After installing, the old copies are removed silently (their own uninstaller, then the folder and shortcuts).
; The sign-in and settings are kept: they are stored under the app id (com.cncforge.erp), which is the same for
; all three names, and an uninstaller run silently never deletes them.

!include LogicLib.nsh

!macro ARGUS_REMOVE_OLD_COPY OLDNAME
  ; never touch the folder the new app was just installed into
  ${If} "$INSTDIR" != "$LOCALAPPDATA\${OLDNAME}"
    ${If} ${FileExists} "$LOCALAPPDATA\${OLDNAME}\uninstall.exe"
      ExecWait '"$LOCALAPPDATA\${OLDNAME}\uninstall.exe" /S _?=$LOCALAPPDATA\${OLDNAME}'
      Delete "$LOCALAPPDATA\${OLDNAME}\uninstall.exe"
    ${EndIf}
    ${If} ${FileExists} "$LOCALAPPDATA\${OLDNAME}\*.*"
      RMDir /r "$LOCALAPPDATA\${OLDNAME}"
    ${EndIf}
    Delete "$SMPROGRAMS\${OLDNAME}.lnk"
    Delete "$SMPROGRAMS\${OLDNAME}\${OLDNAME}.lnk"
    RMDir "$SMPROGRAMS\${OLDNAME}"
    Delete "$DESKTOP\${OLDNAME}.lnk"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${OLDNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${OLDNAME}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro ARGUS_REMOVE_OLD_COPY "Business Intelligence"
  !insertmacro ARGUS_REMOVE_OLD_COPY "CNCFORGE ERP"
!macroend
