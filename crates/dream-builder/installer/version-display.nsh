; Windows and players see the same two-component product version.
; scripts/verify-version-contract.ps1 prevents this checked value from drifting.
!define DREAM_BUILDER_DISPLAY_VERSION "1.0"

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayVersion" "${DREAM_BUILDER_DISPLAY_VERSION}"
!macroend
