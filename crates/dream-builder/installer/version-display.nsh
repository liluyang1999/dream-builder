; Windows and players see the same two-component product version.
; scripts/verify-version-contract.ps1 prevents this checked value from drifting.
!define DREAM_BUILDER_DISPLAY_VERSION "1.0"

; DisplayVersion stays player-facing. Normalize only the temporary comparison value.
; The real plugin validates normalized SemVer against its minimum numeric version;
; invalid input compares as older than that minimum and is returned as an empty value.
Function DreamBuilderNormalizeInstalledVersion
  Exch $0
  Push $1
  Push $2
  Push $3
  StrCpy $1 0
  StrCpy $2 0
  dream_builder_version_next:
    StrCpy $3 $0 1 $1
    StrCmp $3 "" dream_builder_version_complete
    StrCmp $3 "." dream_builder_version_dot
    StrCmp $3 "0" dream_builder_version_digit
    StrCmp $3 "1" dream_builder_version_digit
    StrCmp $3 "2" dream_builder_version_digit
    StrCmp $3 "3" dream_builder_version_digit
    StrCmp $3 "4" dream_builder_version_digit
    StrCmp $3 "5" dream_builder_version_digit
    StrCmp $3 "6" dream_builder_version_digit
    StrCmp $3 "7" dream_builder_version_digit
    StrCmp $3 "8" dream_builder_version_digit
    StrCmp $3 "9" dream_builder_version_digit
    Goto dream_builder_version_invalid
  dream_builder_version_dot:
    IntOp $2 $2 + 1
  dream_builder_version_digit:
    IntOp $1 $1 + 1
    Goto dream_builder_version_next
  dream_builder_version_complete:
    ${If} $2 = 1
      StrCpy $0 "$0.0"
    ${ElseIf} $2 != 2
      Goto dream_builder_version_invalid
    ${EndIf}
    nsis_tauri_utils::SemverCompare "0.0.0" $0
    Pop $3
    ${If} $3 = 1
      Goto dream_builder_version_invalid
    ${EndIf}
    Goto dream_builder_version_done
  dream_builder_version_invalid:
    StrCpy $0 ""
  dream_builder_version_done:
    Pop $3
    Pop $2
    Pop $1
    Exch $0
FunctionEnd

; Result: -1 downgrade, 0 reinstall, 1 upgrade, 2 invalid installed version.
!macro DreamBuilderCompareInstalledVersion CURRENT INSTALLED RESULT
  Push "${INSTALLED}"
  Call DreamBuilderNormalizeInstalledVersion
  Pop ${RESULT}
  ${If} ${RESULT} == ""
    StrCpy ${RESULT} 2
  ${Else}
    nsis_tauri_utils::SemverCompare "${CURRENT}" ${RESULT}
    Pop ${RESULT}
  ${EndIf}
!macroend

!macro DreamBuilderEnforceInstalledVersion CURRENT INSTALLED ALLOW_DOWNGRADES INVALID_MESSAGE DOWNGRADE_MESSAGE
  !insertmacro DreamBuilderCompareInstalledVersion "${CURRENT}" "${INSTALLED}" $R0
  ${If} $R0 = 2
    MessageBox MB_OK|MB_ICONSTOP "${INVALID_MESSAGE}" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  !if "${ALLOW_DOWNGRADES}" == "false"
    ${If} $R0 = -1
      MessageBox MB_OK|MB_ICONSTOP "${DOWNGRADE_MESSAGE}" /SD IDOK
      SetErrorLevel 2
      Abort
    ${EndIf}
  !endif
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayVersion" "${DREAM_BUILDER_DISPLAY_VERSION}"
!macroend
