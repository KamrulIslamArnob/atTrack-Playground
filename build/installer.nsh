; BetterJob NSIS Installer Customization
; - Custom page for data directory selection during install
; - "Use same folder" checkbox
; - Registry persistence for data dir across uninstall/reinstall
; - Data-preserving uninstall with explicit opt-in deletion

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ─── Install: Custom Data Directory Page (Installer only) ─────────────

!ifndef BUILD_UNINSTALLER

Var DataDirField
Var DataDirBrowseBtn
Var SameFolderCheckbox
Var DataDirValue
Var UseSameFolder

Function DataDirPageCreate
  ; Check if there's an existing data dir in registry (reinstall scenario)
  ReadRegStr $DataDirValue HKCU "Software\BetterJob" "DataDir"
  ${If} $DataDirValue == ""
    ; Default: install dir + \data
    StrCpy $DataDirValue "$INSTDIR\data"
  ${EndIf}

  StrCpy $UseSameFolder "1"

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ; Title label
  ${NSD_CreateLabel} 0 0 100% 24u "Select a folder where BetterJob will store your data (database, documents, logs).$\nThis folder is preserved when you uninstall and reinstall."
  Pop $0

  ; Existing data notice
  ${If} ${FileExists} "$DataDirValue\attrack.db"
    ${NSD_CreateLabel} 0 28u 100% 16u "Previous data found at this location. It will be reused automatically."
    Pop $0
    SetCtlColors $0 0x006600 transparent
  ${EndIf}

  ; Data directory input
  ${NSD_CreateLabel} 0 50u 100% 12u "Data folder:"
  Pop $0

  ${NSD_CreateText} 0 64u 80% 13u "$DataDirValue"
  Pop $DataDirField

  ; Browse button
  ${NSD_CreateButton} 82% 63u 18% 15u "Browse..."
  Pop $DataDirBrowseBtn
  ${NSD_OnClick} $DataDirBrowseBtn DataDirBrowse

  ; "Use same folder as installation" checkbox
  ${NSD_CreateCheckbox} 0 84u 100% 14u "Use a subfolder inside the installation directory"
  Pop $SameFolderCheckbox
  ${NSD_SetState} $SameFolderCheckbox ${BST_CHECKED}
  ${NSD_OnClick} $SameFolderCheckbox OnSameFolderToggle

  ; Info text
  ${NSD_CreateLabel} 0 104u 100% 24u "Tip: If you chose a custom location previously, uncheck the box above and browse to your data folder."
  Pop $0
  SetCtlColors $0 0x666666 transparent

  nsDialogs::Show
FunctionEnd

Function DataDirBrowse
  nsDialogs::SelectFolderDialog "Select Data Folder" "$DataDirValue"
  Pop $0
  ${If} $0 != error
    StrCpy $DataDirValue $0
    ${NSD_SetText} $DataDirField $DataDirValue
    ; Uncheck "same folder" since user manually picked
    ${NSD_SetState} $SameFolderCheckbox ${BST_UNCHECKED}
    StrCpy $UseSameFolder "0"
  ${EndIf}
FunctionEnd

Function OnSameFolderToggle
  ${NSD_GetState} $SameFolderCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $UseSameFolder "1"
    StrCpy $DataDirValue "$INSTDIR\data"
    ${NSD_SetText} $DataDirField "$INSTDIR\data"
    EnableWindow $DataDirField 0
    EnableWindow $DataDirBrowseBtn 0
  ${Else}
    StrCpy $UseSameFolder "0"
    EnableWindow $DataDirField 1
    EnableWindow $DataDirBrowseBtn 1
  ${EndIf}
FunctionEnd

Function DataDirPageLeave
  ; Read the final value from the text field
  ${NSD_GetText} $DataDirField $DataDirValue

  ; If "same folder" is checked, force it to $INSTDIR\data
  ${If} $UseSameFolder == "1"
    StrCpy $DataDirValue "$INSTDIR\data"
  ${EndIf}

  ; Validate: not empty
  ${If} $DataDirValue == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Please select a data folder."
    Abort
  ${EndIf}

  ; Create the directory
  CreateDirectory "$DataDirValue"

  ; Write to registry for Electron to read on first launch
  WriteRegStr HKCU "Software\BetterJob" "DataDir" "$DataDirValue"
FunctionEnd

!macro customPageAfterChangeDir
  Page custom DataDirPageCreate DataDirPageLeave
!macroend

!endif

; ─── Uninstall ─────────────────────────────────────────────────────────

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to completely delete all personal data (database, uploaded documents, settings, and logs)?$\n$\nClick 'Yes' to delete all your personal data.$\nClick 'No' to keep your database and documents for future use." \
    /SD IDNO IDNO skip_user_data_cleanup

  ; Read data dir from registry before deleting
  ReadRegStr $0 HKCU "Software\BetterJob" "DataDir"
  ${If} $0 != ""
    ${If} ${FileExists} "$0\*.*"
      RMDir /r "$0"
    ${EndIf}
  ${EndIf}

  ; Delete user AppData and local state directories
  RMDir /r "$APPDATA\BetterJob"
  RMDir /r "$APPDATA\betterjob"
  RMDir /r "$APPDATA\AtTrack"
  RMDir /r "$APPDATA\atTrack"
  RMDir /r "$LOCALAPPDATA\BetterJob"
  RMDir /r "$LOCALAPPDATA\betterjob"
  RMDir /r "$LOCALAPPDATA\BetterJob-updater"
  RMDir /r "$LOCALAPPDATA\AtTrack"
  RMDir /r "$LOCALAPPDATA\atTrack"
  RMDir /r "$LOCALAPPDATA\AtTrack-updater"

  ; Remove registry key only when user chose to delete data
  DeleteRegKey HKCU "Software\BetterJob"

  skip_user_data_cleanup:
!macroend
