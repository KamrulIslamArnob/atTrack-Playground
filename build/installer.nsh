!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to completely delete all personal data (database, uploaded documents, settings, and logs)?$\n$\nClick 'Yes' to delete all your personal data.$\nClick 'No' to keep your database and documents for future use." \
    /SD IDNO IDNO skip_user_data_cleanup

  ; Delete user AppData and local state directories
  RMDir /r "$APPDATA\AtTrack"
  RMDir /r "$APPDATA\atTrack"
  RMDir /r "$LOCALAPPDATA\AtTrack"
  RMDir /r "$LOCALAPPDATA\atTrack"
  RMDir /r "$LOCALAPPDATA\AtTrack-updater"

  skip_user_data_cleanup:
!macroend
